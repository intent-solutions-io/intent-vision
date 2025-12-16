/**
 * Tenant Onboarding Routes
 *
 * Phase 10: Sellable Alpha Shell
 * Beads Task: intentvision-yzd
 *
 * Public API for tenant self-service onboarding.
 * Creates organization, owner user, and initial API key.
 *
 * Endpoints:
 * - POST /v1/tenants - Create new tenant (org + user + API key)
 * - GET  /v1/tenants/:slug - Get tenant info (authenticated)
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { generateId } from '../firestore/client.js';
import type { ApiScope } from '../firestore/schema.js';
import {
  createOrganization,
  createUser,
  getOrganizationBySlug,
} from '../services/org-service.js';
import { createApiKey, type AuthContext, hasScopeV1 } from '../auth/api-key.js';
import type { PlanId } from '../models/plan.js';

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

interface CreateTenantRequest {
  /** Organization name */
  name: string;
  /** URL-safe slug (unique) */
  slug: string;
  /** Owner email address */
  email: string;
  /** Owner display name (optional) */
  displayName?: string;
  /** Plan ID (optional, defaults to 'free') */
  plan?: PlanId;
}

interface CreateTenantResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  user: {
    id: string;
    email: string;
    role: string;
  };
  apiKey: {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    /** Raw key - only returned once! */
    key: string;
  };
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
// POST /v1/tenants - Create Tenant
// =============================================================================

/**
 * Create a new tenant with organization, owner user, and API key.
 * This is a public endpoint for self-service onboarding.
 */
export async function handleCreateTenant(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const body = await parseBody<CreateTenantRequest>(req);
    const { name, slug, email, displayName, plan } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('name is required');
    }

    if (!slug || typeof slug !== 'string') {
      throw new Error('slug is required');
    }

    // Validate slug format (lowercase alphanumeric + hyphens)
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && !/^[a-z0-9]$/.test(slug)) {
      throw new Error('slug must be lowercase alphanumeric with optional hyphens (not at start/end)');
    }

    if (slug.length < 3 || slug.length > 50) {
      throw new Error('slug must be between 3 and 50 characters');
    }

    if (!email || typeof email !== 'string') {
      throw new Error('email is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Check if slug is already taken
    const existingOrg = await getOrganizationBySlug(slug);
    if (existingOrg) {
      sendJson(res, 409, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Slug '${slug}' is already taken`,
      });
      return;
    }

    // Determine plan (default to free)
    const selectedPlan = plan || 'free';

    // Map plan ID to legacy OrganizationPlan type
    const orgPlanMap: Record<string, 'beta' | 'starter' | 'growth' | 'enterprise'> = {
      free: 'beta',
      starter: 'starter',
      growth: 'growth',
      enterprise: 'enterprise',
    };

    // Create organization
    const organization = await createOrganization({
      name: name.trim(),
      slug,
      plan: orgPlanMap[selectedPlan] || 'beta',
      contactEmail: email,
    });

    // Generate a temporary auth UID for the owner (in production, this would come from Firebase Auth)
    const tempAuthUid = `temp_${generateId('auth')}`;

    // Create owner user
    const user = await createUser({
      authUid: tempAuthUid,
      email,
      displayName: displayName?.trim(),
      organizationId: organization.id,
      role: 'owner',
    });

    // Create initial API key with full scopes
    const defaultScopes: ApiScope[] = [
      'ingest:write',
      'metrics:read',
      'alerts:read',
      'alerts:write',
    ];

    const { apiKey, rawKey } = await createApiKey(
      organization.id,
      'Default API Key',
      defaultScopes
    );

    console.log(`[${requestId}] Tenant created: org=${organization.id}, user=${user.id}, key=${apiKey.keyPrefix}...`);

    const responseData: CreateTenantResponse = {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: selectedPlan,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        key: rawKey, // Only returned once!
      },
    };

    sendJson(res, 201, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Create tenant error:`, errorMessage);

    sendJson(res, 400, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

// =============================================================================
// GET /v1/tenants/:slug - Get Tenant Info
// =============================================================================

/**
 * Get tenant information by slug.
 * Requires authentication with org access.
 */
export async function handleGetTenant(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  slug: string
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const organization = await getOrganizationBySlug(slug);

    if (!organization) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Tenant '${slug}' not found`,
      });
      return;
    }

    // Check authorization - user must belong to this org or be admin
    if (authContext.orgId !== organization.id && !hasScopeV1(authContext, 'admin')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Access denied to this tenant',
      });
      return;
    }

    // Map legacy plan to new plan ID
    const planIdMap: Record<string, string> = {
      beta: 'free',
      starter: 'starter',
      growth: 'growth',
      enterprise: 'enterprise',
    };

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          plan: planIdMap[organization.plan] || 'free',
          status: organization.status,
          createdAt: organization.createdAt,
        },
      },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get tenant error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

// =============================================================================
// Route Helpers
// =============================================================================

/**
 * Extract tenant slug from pathname
 * Pattern: /v1/tenants/:slug
 */
export function extractTenantSlug(pathname: string): string | null {
  const match = pathname.match(/^\/v1\/tenants\/([^/]+)$/);
  return match ? match[1] : null;
}
