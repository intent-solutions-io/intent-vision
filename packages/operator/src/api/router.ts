/**
 * API Router
 *
 * Task ID: intentvision-10op.2
 *
 * Provides REST API endpoints for the operator interface:
 * - Health check
 * - Metrics query
 * - Alerts management
 * - Organization info
 */

import { authenticateRequest, type AuthResult } from '../auth/middleware.js';
import { withTenantContext, type TenantContext } from '../tenant/context.js';
import { getApiKeyManager } from '../auth/api-key.js';

// =============================================================================
// Types
// =============================================================================

export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  query?: Record<string, string>;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}

export type RouteHandler = (
  req: ApiRequest,
  ctx: TenantContext
) => Promise<ApiResponse>;

interface Route {
  method: string;
  path: string | RegExp;
  handler: RouteHandler;
  requireAuth: boolean;
  scopes?: string[];
}

// =============================================================================
// Router
// =============================================================================

export class ApiRouter {
  private routes: Route[] = [];

  /**
   * Register a route
   */
  route(
    method: string,
    path: string | RegExp,
    handler: RouteHandler,
    options: { requireAuth?: boolean; scopes?: string[] } = {}
  ): void {
    this.routes.push({
      method: method.toUpperCase(),
      path,
      handler,
      requireAuth: options.requireAuth ?? true,
      scopes: options.scopes,
    });
  }

  /**
   * Handle an incoming request
   */
  async handle(req: ApiRequest): Promise<ApiResponse> {
    // Find matching route
    const route = this.findRoute(req.method, req.path);
    if (!route) {
      return {
        status: 404,
        body: { error: 'Not found', path: req.path },
      };
    }

    // Authenticate if required
    let authResult: AuthResult = { authenticated: false };
    if (route.requireAuth) {
      authResult = await authenticateRequest(req.headers, {
        requiredScopes: route.scopes,
      });

      if (!authResult.authenticated) {
        return {
          status: authResult.statusCode || 401,
          body: { error: authResult.error || 'Unauthorized' },
        };
      }
    }

    // Execute handler within tenant context
    const orgId = authResult.request?.orgId || 'anonymous';
    return withTenantContext(
      {
        orgId,
        apiKey: authResult.request?.apiKey,
        source: {
          ip: req.headers['x-forwarded-for'],
          userAgent: req.headers['user-agent'],
          origin: req.headers['origin'],
        },
      },
      async (ctx) => {
        try {
          return await route.handler(req, ctx);
        } catch (error) {
          console.error('Handler error:', error);
          return {
            status: 500,
            body: { error: 'Internal server error' },
          };
        }
      }
    );
  }

  private findRoute(method: string, path: string): Route | undefined {
    return this.routes.find((route) => {
      if (route.method !== method.toUpperCase()) return false;
      if (typeof route.path === 'string') {
        return route.path === path;
      }
      return route.path.test(path);
    });
  }
}

// =============================================================================
// Default Routes
// =============================================================================

export function createDefaultRouter(): ApiRouter {
  const router = new ApiRouter();

  // Health check (no auth required)
  router.route('GET', '/health', async () => ({
    status: 200,
    body: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    },
  }), { requireAuth: false });

  // Get organization info
  router.route('GET', '/api/v1/org', async (_req, ctx) => ({
    status: 200,
    body: {
      org_id: ctx.orgId,
      scopes: ctx.apiKey?.scopes || [],
      request_id: ctx.requestId,
    },
  }));

  // List API keys (admin scope required)
  router.route('GET', '/api/v1/keys', async (_req, ctx) => {
    const manager = getApiKeyManager();
    const keys = await manager.listKeys(ctx.orgId);
    return {
      status: 200,
      body: {
        keys: keys.map((k) => ({
          key_id: k.keyId,
          name: k.name,
          scopes: k.scopes,
          created_at: k.createdAt,
          expires_at: k.expiresAt,
          last_used_at: k.lastUsedAt,
          enabled: k.enabled,
        })),
      },
    };
  }, { scopes: ['admin'] });

  // Create API key (admin scope required)
  router.route('POST', '/api/v1/keys', async (req, ctx) => {
    const body = req.body as { name?: string; scopes?: string[]; expires_in_days?: number };
    if (!body?.name) {
      return {
        status: 400,
        body: { error: 'Name is required' },
      };
    }

    const manager = getApiKeyManager();
    const { key, rawKey } = await manager.createKey({
      orgId: ctx.orgId,
      name: body.name,
      scopes: body.scopes,
      expiresInDays: body.expires_in_days,
    });

    return {
      status: 201,
      body: {
        key_id: key.keyId,
        raw_key: rawKey,
        name: key.name,
        scopes: key.scopes,
        expires_at: key.expiresAt,
        message: 'Store this key securely - it will not be shown again',
      },
    };
  }, { scopes: ['admin'] });

  // Revoke API key (admin scope required)
  router.route('DELETE', /^\/api\/v1\/keys\/([^/]+)$/, async (req, ctx) => {
    const match = req.path.match(/^\/api\/v1\/keys\/([^/]+)$/);
    const keyId = match?.[1];

    if (!keyId) {
      return {
        status: 400,
        body: { error: 'Key ID is required' },
      };
    }

    const manager = getApiKeyManager();
    const revoked = await manager.revokeKey(keyId);

    if (!revoked) {
      return {
        status: 404,
        body: { error: 'Key not found' },
      };
    }

    return {
      status: 200,
      body: { message: 'Key revoked successfully' },
    };
  }, { scopes: ['admin'] });

  return router;
}

// =============================================================================
// Factory
// =============================================================================

let _router: ApiRouter | null = null;

export function getRouter(): ApiRouter {
  if (!_router) {
    _router = createDefaultRouter();
  }
  return _router;
}

export function resetRouter(): void {
  _router = null;
}
