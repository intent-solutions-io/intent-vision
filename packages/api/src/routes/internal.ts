/**
 * Internal Operator API Routes
 *
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Beads Task: intentvision-p5
 *
 * INTERNAL ONLY - Not exposed to customers.
 * These endpoints are for operator/admin use only.
 *
 * Endpoints:
 * - POST /v1/internal/organizations - Create organization
 * - GET  /v1/internal/organizations - List organizations
 * - GET  /v1/internal/organizations/:orgId - Get organization
 * - POST /v1/internal/organizations/:orgId/apiKeys - Create API key
 * - GET  /v1/internal/organizations/:orgId/apiKeys - List API keys
 * - DELETE /v1/internal/organizations/:orgId/apiKeys/:keyId - Revoke API key
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { getDb } from '../firestore/client.js';
import { COLLECTIONS, type ApiKey, type ApiScope } from '../firestore/schema.js';
import { createApiKey, revokeApiKey, type AuthContext, hasScopeV1 } from '../auth/api-key.js';
import {
  createOrganization,
  getOrganizationById,
  listOrganizations,
  createOnboardedOrganization,
} from '../services/org-service.js';

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

interface CreateOrgRequest {
  name: string;
  slug: string;
  contactEmail?: string;
  /** If provided, creates owner user with this Firebase Auth UID */
  ownerAuthUid?: string;
  ownerEmail?: string;
  ownerDisplayName?: string;
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
// Internal Auth Check
// =============================================================================

/**
 * Verify the request has admin scope (internal endpoints require admin)
 */
function requireAdmin(authContext: AuthContext): string | null {
  if (!hasScopeV1(authContext, 'admin')) {
    return 'Admin scope required for internal endpoints';
  }
  return null;
}

// =============================================================================
// POST /v1/internal/organizations
// =============================================================================

export async function handleCreateOrganization(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();

  try {
    // Require admin scope
    const authError = requireAdmin(authContext);
    if (authError) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: authError,
      });
      return;
    }

    const body = await parseBody<CreateOrgRequest>(req);
    const { name, slug, contactEmail, ownerAuthUid, ownerEmail, ownerDisplayName } = body;

    if (!name || typeof name !== 'string') {
      throw new Error('name is required');
    }

    if (!slug || typeof slug !== 'string') {
      throw new Error('slug is required');
    }

    // Validate slug format (alphanumeric + hyphens)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error('slug must be lowercase alphanumeric with hyphens only');
    }

    let result;

    // If owner info provided, use onboarding flow
    if (ownerAuthUid && ownerEmail) {
      result = await createOnboardedOrganization({
        orgName: name,
        orgSlug: slug,
        userAuthUid: ownerAuthUid,
        userEmail: ownerEmail,
        userDisplayName: ownerDisplayName,
      });

      console.log(`[${requestId}] Created organization with owner: ${result.organization.id}`);

      sendJson(res, 201, {
        success: true,
        requestId,
        timestamp: new Date().toISOString(),
        data: {
          organization: result.organization,
          user: result.user,
        },
      });
    } else {
      // Create organization without user
      const organization = await createOrganization({
        name,
        slug,
        contactEmail,
      });

      console.log(`[${requestId}] Created organization: ${organization.id}`);

      sendJson(res, 201, {
        success: true,
        requestId,
        timestamp: new Date().toISOString(),
        data: { organization },
      });
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Create organization error:`, errorMessage);

    sendJson(res, 400, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

// =============================================================================
// GET /v1/internal/organizations
// =============================================================================

export async function handleListOrganizations(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const authError = requireAdmin(authContext);
    if (authError) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: authError,
      });
      return;
    }

    const organizations = await listOrganizations();

    console.log(`[${requestId}] Listed ${organizations.length} organizations`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: { organizations, total: organizations.length },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] List organizations error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

// =============================================================================
// GET /v1/internal/organizations/:orgId
// =============================================================================

export async function handleGetOrganization(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  orgId: string
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const authError = requireAdmin(authContext);
    if (authError) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: authError,
      });
      return;
    }

    const organization = await getOrganizationById(orgId);

    if (!organization) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Organization not found: ${orgId}`,
      });
      return;
    }

    console.log(`[${requestId}] Retrieved organization: ${orgId}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: { organization },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get organization error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

// =============================================================================
// POST /v1/internal/organizations/:orgId/apiKeys
// =============================================================================

export async function handleCreateApiKey(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  orgId: string
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const authError = requireAdmin(authContext);
    if (authError) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: authError,
      });
      return;
    }

    // Verify organization exists
    const organization = await getOrganizationById(orgId);
    if (!organization) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Organization not found: ${orgId}`,
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

    const { apiKey, rawKey } = await createApiKey(orgId, name, keyScopes);

    console.log(`[${requestId}] Created API key for org ${orgId}: ${apiKey.keyPrefix}...`);

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
    console.error(`[${requestId}] Create API key error:`, errorMessage);

    sendJson(res, 400, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

// =============================================================================
// GET /v1/internal/organizations/:orgId/apiKeys
// =============================================================================

export async function handleListApiKeys(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  orgId: string
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const authError = requireAdmin(authContext);
    if (authError) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: authError,
      });
      return;
    }

    // Verify organization exists
    const organization = await getOrganizationById(orgId);
    if (!organization) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Organization not found: ${orgId}`,
      });
      return;
    }

    const db = getDb();
    const snapshot = await db
      .collection(COLLECTIONS.apiKeys(orgId))
      .orderBy('createdAt', 'desc')
      .get();

    // Never return hashed keys
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

    console.log(`[${requestId}] Listed ${apiKeys.length} API keys for org ${orgId}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: { apiKeys, total: apiKeys.length },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] List API keys error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

// =============================================================================
// DELETE /v1/internal/organizations/:orgId/apiKeys/:keyId
// =============================================================================

export async function handleRevokeApiKey(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  orgId: string,
  keyId: string
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const authError = requireAdmin(authContext);
    if (authError) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: authError,
      });
      return;
    }

    // Verify organization exists
    const organization = await getOrganizationById(orgId);
    if (!organization) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Organization not found: ${orgId}`,
      });
      return;
    }

    await revokeApiKey(orgId, keyId);

    console.log(`[${requestId}] Revoked API key ${keyId} for org ${orgId}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: { revoked: true, keyId },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Revoke API key error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}
