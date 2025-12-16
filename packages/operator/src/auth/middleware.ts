/**
 * Authentication Middleware
 *
 * Task ID: intentvision-cvo (Phase C)
 *
 * Provides authentication middleware for API requests:
 * - JWT Bearer token authentication
 * - API key authentication (X-API-Key header)
 * - Permission checking via RBAC
 * - Rate limiting
 */

import { verifyToken, type TokenPayload } from './jwt.js';
import { getApiKeyManager, hashApiKey, type ApiKey } from './api-keys.js';
import { checkPermission, type Permission } from './rbac.js';

// =============================================================================
// Types
// =============================================================================

export interface AuthContext {
  /** Organization ID */
  orgId: string;
  /** User ID */
  userId: string;
  /** User roles */
  roles: string[];
  /** API key (if authenticated via API key) */
  apiKey?: ApiKey;
  /** JWT payload (if authenticated via JWT) */
  token?: TokenPayload;
  /** Authentication method used */
  authMethod: 'jwt' | 'api-key';
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

export interface AuthResult {
  authenticated: boolean;
  context?: AuthContext;
  error?: string;
  statusCode?: number;
}

export interface AuthMiddlewareConfig {
  /** Required permissions for this endpoint */
  requiredPermissions?: Permission[];
  /** Allow unauthenticated requests */
  allowAnonymous?: boolean;
}

// =============================================================================
// Rate Limiter
// =============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private windowMs = 60000; // 1 minute

  /**
   * Check if request is within rate limit
   */
  check(keyId: string, limit: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.limits.get(keyId);

    if (!entry || now - entry.windowStart > this.windowMs) {
      // New window
      this.limits.set(keyId, { count: 1, windowStart: now });
      return { allowed: true, remaining: limit - 1 };
    }

    if (entry.count >= limit) {
      return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now - entry.windowStart > this.windowMs) {
        this.limits.delete(key);
      }
    }
  }
}

const rateLimiter = new RateLimiter();

// =============================================================================
// Authentication Helpers
// =============================================================================

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Authenticate using JWT Bearer token
 */
async function authenticateJwt(
  authHeader: string | undefined
): Promise<{ success: boolean; context?: AuthContext; error?: string }> {
  const token = extractBearerToken(authHeader);

  if (!token) {
    return { success: false, error: 'No Bearer token provided' };
  }

  const payload = verifyToken(token);

  if (!payload) {
    return { success: false, error: 'Invalid or expired JWT token' };
  }

  return {
    success: true,
    context: {
      orgId: payload.orgId,
      userId: payload.userId,
      roles: payload.roles,
      token: payload,
      authMethod: 'jwt',
    },
  };
}

/**
 * Authenticate using API key
 */
async function authenticateApiKey(
  apiKeyHeader: string | undefined
): Promise<{ success: boolean; context?: AuthContext; error?: string }> {
  if (!apiKeyHeader) {
    return { success: false, error: 'No API key provided' };
  }

  const manager = getApiKeyManager();
  const validation = await manager.validateKey(apiKeyHeader);

  if (!validation.valid || !validation.key) {
    return { success: false, error: validation.error || 'Invalid API key' };
  }

  const key = validation.key;

  // Check rate limit
  const rateCheck = rateLimiter.check(key.keyId, key.rateLimit);
  if (!rateCheck.allowed) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  return {
    success: true,
    context: {
      orgId: key.orgId,
      userId: key.userId || `api-key:${key.keyId}`,
      roles: key.roles,
      apiKey: key,
      authMethod: 'api-key',
    },
  };
}

// =============================================================================
// Main Authentication Function
// =============================================================================

/**
 * Authenticate a request using either JWT or API key
 *
 * Supports two authentication methods:
 * 1. JWT Bearer token: Authorization: Bearer <token>
 * 2. API key: X-API-Key: <key>
 *
 * @param headers - Request headers
 * @param config - Authentication configuration
 * @returns Authentication result with context
 *
 * @example
 * // JWT authentication
 * const result = await authenticateRequest({
 *   'authorization': 'Bearer eyJhbGc...'
 * });
 *
 * // API key authentication
 * const result = await authenticateRequest({
 *   'x-api-key': 'ivk_abc123...'
 * });
 */
export async function authenticateRequest(
  headers: Record<string, string | undefined>,
  config: AuthMiddlewareConfig = {}
): Promise<AuthResult> {
  const authHeader = headers['authorization'] || headers['Authorization'];
  const apiKeyHeader = headers['x-api-key'] || headers['X-API-Key'];

  // Try JWT authentication first (if Authorization header present)
  if (authHeader) {
    const jwtResult = await authenticateJwt(authHeader);

    if (jwtResult.success && jwtResult.context) {
      // Check permissions if required
      if (config.requiredPermissions && config.requiredPermissions.length > 0) {
        for (const permission of config.requiredPermissions) {
          if (!checkPermission(jwtResult.context.roles, permission)) {
            return {
              authenticated: false,
              error: `Missing required permission: ${permission}`,
              statusCode: 403,
            };
          }
        }
      }

      return {
        authenticated: true,
        context: jwtResult.context,
      };
    }

    // If JWT auth failed and no API key provided, return JWT error
    if (!apiKeyHeader) {
      return {
        authenticated: false,
        error: jwtResult.error || 'Authentication failed',
        statusCode: 401,
      };
    }
  }

  // Try API key authentication (if X-API-Key header present)
  if (apiKeyHeader) {
    const apiKeyResult = await authenticateApiKey(apiKeyHeader);

    if (apiKeyResult.success && apiKeyResult.context) {
      // Check permissions if required
      if (config.requiredPermissions && config.requiredPermissions.length > 0) {
        for (const permission of config.requiredPermissions) {
          if (!checkPermission(apiKeyResult.context.roles, permission)) {
            return {
              authenticated: false,
              error: `Missing required permission: ${permission}`,
              statusCode: 403,
            };
          }
        }
      }

      return {
        authenticated: true,
        context: apiKeyResult.context,
      };
    }

    // API key auth failed
    if (apiKeyResult.error === 'Rate limit exceeded') {
      return {
        authenticated: false,
        error: apiKeyResult.error,
        statusCode: 429,
      };
    }

    return {
      authenticated: false,
      error: apiKeyResult.error || 'Authentication failed',
      statusCode: 401,
    };
  }

  // No authentication provided
  if (config.allowAnonymous) {
    return { authenticated: false };
  }

  return {
    authenticated: false,
    error: 'Authentication required (provide Authorization: Bearer <token> or X-API-Key: <key>)',
    statusCode: 401,
  };
}

// =============================================================================
// Middleware Factories
// =============================================================================

/**
 * Create middleware function for specific configuration
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig = {}) {
  return async (headers: Record<string, string | undefined>): Promise<AuthResult> => {
    return authenticateRequest(headers, config);
  };
}

/**
 * Require specific permissions
 */
export function requirePermissions(...permissions: Permission[]) {
  return createAuthMiddleware({ requiredPermissions: permissions });
}

/**
 * Allow anonymous access
 */
export function allowAnonymous() {
  return createAuthMiddleware({ allowAnonymous: true });
}

// =============================================================================
// Exports
// =============================================================================

export { rateLimiter };
