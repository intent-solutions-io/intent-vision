/**
 * API Key Authentication Middleware
 *
 * Phase 1: Firestore-backed MVP Core
 * Phase 4: Production SaaS Control Plane + Public API v1
 * Beads Tasks: intentvision-002, intentvision-p88
 *
 * Authenticates requests using API keys stored in Firestore.
 * Keys are hashed (SHA-256) - raw keys are never stored.
 *
 * Scope System (Phase 4):
 * - Legacy scopes: ingest, forecast, read
 * - v1 scopes: ingest:write, metrics:read, alerts:read, alerts:write, admin
 * - Legacy scopes are mapped to v1 scopes for backward compatibility
 */

import { createHash } from 'crypto';
import { getDb, generateId } from '../firestore/client.js';
import { COLLECTIONS, type ApiKey, type ApiScope } from '../firestore/schema.js';

// =============================================================================
// Types
// =============================================================================

export interface AuthContext {
  orgId: string;
  keyId: string;
  scopes: ApiScope[];
  /** Whether this is a sandbox key (non-billable, limited functionality) */
  isSandbox: boolean;
}

export interface AuthResult {
  success: boolean;
  context?: AuthContext;
  error?: string;
}

// =============================================================================
// Key Management
// =============================================================================

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Generate a new API key (returns raw key - only shown once)
 */
export function generateApiKey(): { rawKey: string; hashedKey: string; keyPrefix: string } {
  const rawKey = `iv_${generateId()}_${Math.random().toString(36).slice(2, 18)}`;
  const hashedKey = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 8);

  return { rawKey, hashedKey, keyPrefix };
}

/**
 * Create a new API key in Firestore
 */
export async function createApiKey(
  orgId: string,
  name: string,
  scopes: ApiScope[] = ['ingest', 'forecast', 'read'],
  mode: 'sandbox' | 'production' = 'production'
): Promise<{ apiKey: ApiKey; rawKey: string }> {
  const db = getDb();
  const { rawKey, hashedKey, keyPrefix } = generateApiKey();
  const keyId = generateId('key');

  const apiKey: ApiKey = {
    id: keyId,
    orgId,
    name,
    hashedKey,
    keyPrefix,
    scopes,
    createdAt: new Date(),
    status: 'active',
    mode,
  };

  const collection = COLLECTIONS.apiKeys(orgId);
  await db.collection(collection).doc(keyId).set(apiKey);

  return { apiKey, rawKey };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(orgId: string, keyId: string): Promise<void> {
  const db = getDb();
  const collection = COLLECTIONS.apiKeys(orgId);

  await db.collection(collection).doc(keyId).update({
    status: 'revoked',
  });
}

// =============================================================================
// Authentication
// =============================================================================

/**
 * Authenticate an API key and return auth context
 */
export async function authenticateApiKey(rawKey: string): Promise<AuthResult> {
  if (!rawKey) {
    return { success: false, error: 'API key is required' };
  }

  // Handle different key formats
  const cleanKey = rawKey.startsWith('Bearer ') ? rawKey.slice(7) : rawKey;

  // Validate key format
  if (!cleanKey.startsWith('iv_')) {
    return { success: false, error: 'Invalid API key format' };
  }

  const hashedKey = hashApiKey(cleanKey);
  const db = getDb();

  try {
    // Search all organizations for this key
    // In production, you might want to include org hint in the key format
    const orgsSnapshot = await db.collection(COLLECTIONS.organizations).get();

    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const keysSnapshot = await db
        .collection(COLLECTIONS.apiKeys(orgId))
        .where('hashedKey', '==', hashedKey)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!keysSnapshot.empty) {
        const keyDoc = keysSnapshot.docs[0];
        const keyData = keyDoc.data() as ApiKey;

        // Check expiration
        if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
          return { success: false, error: 'API key has expired' };
        }

        // Update last used timestamp (fire and forget)
        keyDoc.ref.update({ lastUsedAt: new Date() }).catch(() => {});

        return {
          success: true,
          context: {
            orgId,
            keyId: keyData.id,
            scopes: keyData.scopes,
            isSandbox: keyData.mode === 'sandbox',
          },
        };
      }
    }

    return { success: false, error: 'Invalid API key' };
  } catch (error) {
    console.error('[Auth] Error authenticating API key:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Check if auth context has required scope
 */
export function hasScope(context: AuthContext, requiredScope: ApiScope): boolean {
  return context.scopes.includes(requiredScope) || context.scopes.includes('admin');
}

// =============================================================================
// Phase 4: Enhanced Scope System
// =============================================================================

/**
 * Mapping from legacy scopes to v1 scopes
 * Allows backward compatibility while supporting new fine-grained permissions
 */
const LEGACY_SCOPE_MAP: Record<string, ApiScope[]> = {
  'ingest': ['ingest:write'],
  'forecast': ['metrics:read'],
  'read': ['metrics:read', 'alerts:read'],
};

/**
 * Scope hierarchy - admin grants all permissions
 */
const ADMIN_GRANTS_ALL: ApiScope[] = [
  'ingest:write',
  'metrics:read',
  'alerts:read',
  'alerts:write',
  'ingest',
  'forecast',
  'read',
];

/**
 * Check if auth context has any of the required scopes
 * Supports both legacy and v1 scopes with automatic mapping
 */
export function hasScopeV1(context: AuthContext, requiredScope: ApiScope): boolean {
  // Admin grants all permissions
  if (context.scopes.includes('admin')) {
    return true;
  }

  // Direct scope match
  if (context.scopes.includes(requiredScope)) {
    return true;
  }

  // Check if any legacy scope maps to the required scope
  for (const scope of context.scopes) {
    const mappedScopes = LEGACY_SCOPE_MAP[scope];
    if (mappedScopes && mappedScopes.includes(requiredScope)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if auth context has any of the specified scopes
 */
export function hasAnyScope(context: AuthContext, requiredScopes: ApiScope[]): boolean {
  return requiredScopes.some(scope => hasScopeV1(context, scope));
}

/**
 * Check if auth context has all of the specified scopes
 */
export function hasAllScopes(context: AuthContext, requiredScopes: ApiScope[]): boolean {
  return requiredScopes.every(scope => hasScopeV1(context, scope));
}

/**
 * Get all effective scopes for an auth context (including mapped legacy scopes)
 */
export function getEffectiveScopes(context: AuthContext): ApiScope[] {
  if (context.scopes.includes('admin')) {
    return [...ADMIN_GRANTS_ALL, 'admin'];
  }

  const effectiveScopes = new Set<ApiScope>(context.scopes);

  // Add mapped scopes from legacy scopes
  for (const scope of context.scopes) {
    const mappedScopes = LEGACY_SCOPE_MAP[scope];
    if (mappedScopes) {
      for (const mapped of mappedScopes) {
        effectiveScopes.add(mapped);
      }
    }
  }

  return Array.from(effectiveScopes);
}

// =============================================================================
// Middleware Helper
// =============================================================================

/**
 * Extract API key from request headers
 */
export function extractApiKey(headers: Record<string, string | string[] | undefined>): string | null {
  // Try X-API-Key header first
  const xApiKey = headers['x-api-key'];
  if (xApiKey) {
    return Array.isArray(xApiKey) ? xApiKey[0] : xApiKey;
  }

  // Try Authorization header
  const auth = headers['authorization'];
  if (auth) {
    const authStr = Array.isArray(auth) ? auth[0] : auth;
    if (authStr.startsWith('Bearer ')) {
      return authStr.slice(7);
    }
    return authStr;
  }

  return null;
}
