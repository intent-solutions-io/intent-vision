/**
 * Authentication Middleware
 *
 * Task ID: intentvision-10op.1
 *
 * Provides authentication middleware for API requests:
 * - API key extraction from headers
 * - Key validation
 * - Scope checking
 * - Rate limiting
 */

import { getApiKeyManager, type ApiKey } from './api-key.js';

// =============================================================================
// Types
// =============================================================================

export interface AuthenticatedRequest {
  apiKey: ApiKey;
  orgId: string;
  scopes: string[];
}

export interface AuthResult {
  authenticated: boolean;
  request?: AuthenticatedRequest;
  error?: string;
  statusCode?: number;
}

export interface AuthMiddlewareConfig {
  /** Header name for API key */
  headerName?: string;
  /** Required scopes for this endpoint */
  requiredScopes?: string[];
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
// Auth Middleware
// =============================================================================

/**
 * Authenticate a request using API key
 */
export async function authenticateRequest(
  headers: Record<string, string | undefined>,
  config: AuthMiddlewareConfig = {}
): Promise<AuthResult> {
  const headerName = config.headerName || 'x-api-key';
  const apiKey = headers[headerName] || headers[headerName.toLowerCase()];

  // Check for API key
  if (!apiKey) {
    if (config.allowAnonymous) {
      return { authenticated: false };
    }
    return {
      authenticated: false,
      error: 'API key required',
      statusCode: 401,
    };
  }

  // Validate key
  const manager = getApiKeyManager();
  const validation = await manager.validateKey(apiKey);

  if (!validation.valid || !validation.key) {
    return {
      authenticated: false,
      error: validation.error || 'Invalid API key',
      statusCode: 401,
    };
  }

  const key = validation.key;

  // Check rate limit
  const rateCheck = rateLimiter.check(key.keyId, key.rateLimit);
  if (!rateCheck.allowed) {
    return {
      authenticated: false,
      error: 'Rate limit exceeded',
      statusCode: 429,
    };
  }

  // Check required scopes
  if (config.requiredScopes && config.requiredScopes.length > 0) {
    for (const scope of config.requiredScopes) {
      if (!manager.hasScope(key, scope)) {
        return {
          authenticated: false,
          error: `Missing required scope: ${scope}`,
          statusCode: 403,
        };
      }
    }
  }

  return {
    authenticated: true,
    request: {
      apiKey: key,
      orgId: key.orgId,
      scopes: key.scopes,
    },
  };
}

/**
 * Create middleware function for specific configuration
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig = {}) {
  return async (headers: Record<string, string | undefined>): Promise<AuthResult> => {
    return authenticateRequest(headers, config);
  };
}

/**
 * Require specific scopes
 */
export function requireScopes(...scopes: string[]) {
  return createAuthMiddleware({ requiredScopes: scopes });
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
