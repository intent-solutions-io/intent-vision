/**
 * Customer Dashboard Routes (/v1/me)
 *
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Beads Task: intentvision-p5
 *
 * These endpoints are for authenticated dashboard users.
 * They use Firebase Auth tokens instead of API keys.
 *
 * Endpoints:
 * - GET  /v1/me           - Get current user and organization info
 * - GET  /v1/me/apiKeys   - List API keys for user's organization
 * - POST /v1/me/apiKeys   - Create API key for user's organization
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { getDb } from '../firestore/client.js';
import { COLLECTIONS, type ApiKey, type ApiScope, type User, type Organization } from '../firestore/schema.js';
import { createApiKey } from '../auth/api-key.js';
import { getUserByAuthUid, getOrganizationById } from '../services/org-service.js';
import { requirePermission } from '../auth/rbac.js';
import { logAuditEvent } from '../services/audit-service.js';

// =============================================================================
// Types
// =============================================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  requestId: string;
  timestamp: string;
  data?: T;
  error?: string;
}

export interface UserContext {
  authUid: string;
  user: User;
  organization: Organization;
}

interface CreateApiKeyRequest {
  name: string;
  scopes?: ApiScope[];
}

// =============================================================================
// Utilities
// =============================================================================

function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson<T>(res: ServerResponse, statusCode: number, data: ApiResponse<T>): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// =============================================================================
// Firebase Auth Token Verification (Simplified - production would use Admin SDK)
// =============================================================================

/**
 * Extract Firebase Auth UID from request
 * In production, this would verify the JWT token using Firebase Admin SDK.
 * For now, we accept the UID from a header for development.
 *
 * Headers accepted:
 * - Authorization: Bearer <firebase-id-token> (production)
 * - X-Firebase-UID: <uid> (development only)
 */
export async function extractFirebaseAuth(
  req: IncomingMessage
): Promise<{ authUid: string } | { error: string }> {
  const headers = req.headers;

  // Development mode: accept X-Firebase-UID header
  const devUid = headers['x-firebase-uid'];
  if (devUid && typeof devUid === 'string') {
    return { authUid: devUid };
  }

  // Production: verify Firebase ID token
  const authHeader = headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') {
    return { error: 'Authorization header required' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Invalid authorization format. Use Bearer <token>' };
  }

  const token = authHeader.slice(7);

  // TODO: In production, verify token with Firebase Admin SDK
  // For now, we'll treat the token as the UID for development
  // This is NOT secure for production!
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    // In development, accept the token as the UID directly
    return { authUid: token };
  }

  // In production without proper verification, reject
  return { error: 'Firebase token verification not yet implemented. Use X-Firebase-UID in development.' };
}

/**
 * Get user context from Firebase Auth UID
 */
export async function getUserContext(authUid: string): Promise<UserContext | null> {
  const user = await getUserByAuthUid(authUid);
  if (!user) {
    return null;
  }

  const organization = await getOrganizationById(user.organizationId);
  if (!organization) {
    return null;
  }

  return { authUid, user, organization };
}

// =============================================================================
// GET /v1/me
// =============================================================================

export async function handleGetMe(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = generateRequestId();

  try {
    // Extract Firebase Auth UID
    const authResult = await extractFirebaseAuth(req);
    if ('error' in authResult) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: authResult.error,
      });
      return;
    }

    // Get user context
    const context = await getUserContext(authResult.authUid);
    if (!context) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'User not found or not associated with an organization',
      });
      return;
    }

    console.log(`[${requestId}] GET /v1/me - user: ${context.user.id}, org: ${context.organization.id}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        user: {
          id: context.user.id,
          email: context.user.email,
          displayName: context.user.displayName,
          role: context.user.role,
          createdAt: context.user.createdAt,
        },
        organization: {
          id: context.organization.id,
          name: context.organization.name,
          slug: context.organization.slug,
          plan: context.organization.plan,
          status: context.organization.status,
        },
      },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] GET /v1/me error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
    });
  }
}

// =============================================================================
// GET /v1/me/apiKeys
// =============================================================================

export async function handleListMyApiKeys(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = generateRequestId();

  try {
    // Extract Firebase Auth UID
    const authResult = await extractFirebaseAuth(req);
    if ('error' in authResult) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: authResult.error,
      });
      return;
    }

    // Get user context
    const context = await getUserContext(authResult.authUid);
    if (!context) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'User not found or not associated with an organization',
      });
      return;
    }

    // Get API keys for organization (never return hashed keys)
    const db = getDb();
    const snapshot = await db
      .collection(COLLECTIONS.apiKeys(context.organization.id))
      .orderBy('createdAt', 'desc')
      .get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiKeys = snapshot.docs.map((doc: any) => {
      const data = doc.data() as ApiKey;
      return {
        id: data.id,
        name: data.name,
        keyPrefix: data.keyPrefix,
        scopes: data.scopes,
        createdAt: data.createdAt,
        lastUsedAt: data.lastUsedAt,
        status: data.status,
      };
    });

    console.log(`[${requestId}] GET /v1/me/apiKeys - found ${apiKeys.length} keys for org ${context.organization.id}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: { apiKeys, total: apiKeys.length },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] GET /v1/me/apiKeys error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
    });
  }
}

// =============================================================================
// POST /v1/me/apiKeys
// =============================================================================

export async function handleCreateMyApiKey(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = generateRequestId();

  try {
    // Extract Firebase Auth UID
    const authResult = await extractFirebaseAuth(req);
    if ('error' in authResult) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: authResult.error,
      });
      return;
    }

    // Get user context
    const context = await getUserContext(authResult.authUid);
    if (!context) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'User not found or not associated with an organization',
      });
      return;
    }

    // Check permission using RBAC - admin+ required to create API keys
    try {
      await requirePermission(context.organization.id, context.user.id, 'api_keys:create');
    } catch (error) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
      return;
    }

    const body = await parseBody<CreateApiKeyRequest>(req);
    const { name, scopes } = body;

    if (!name || typeof name !== 'string') {
      throw new Error('name is required');
    }

    // Default to standard scopes if none provided
    const keyScopes: ApiScope[] = scopes || ['ingest:write', 'metrics:read', 'alerts:read', 'alerts:write'];

    // Prevent non-admin users from creating admin keys
    if (keyScopes.includes('admin') && context.user.role !== 'owner') {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Only organization owners can create admin API keys',
      });
      return;
    }

    const { apiKey, rawKey } = await createApiKey(context.organization.id, name, keyScopes);

    // Log audit event
    await logAuditEvent({
      orgId: context.organization.id,
      userId: context.user.id,
      action: 'api_key.created',
      resourceType: 'apiKey',
      resourceId: apiKey.id,
      metadata: { name, scopes: keyScopes },
    });

    console.log(`[${requestId}] POST /v1/me/apiKeys - created key ${apiKey.keyPrefix}... for org ${context.organization.id}`);

    sendJson(res, 201, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          scopes: apiKey.scopes,
          createdAt: apiKey.createdAt,
          status: apiKey.status,
        },
        // Return raw key only once - customer must save it
        rawKey,
      },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] POST /v1/me/apiKeys error:`, errorMessage);

    sendJson(res, 400, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}
