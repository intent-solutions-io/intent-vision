/**
 * Tenant Context
 *
 * Task ID: intentvision-10op.3
 *
 * Provides request-scoped tenant context for multi-tenancy:
 * - Organization isolation
 * - User context
 * - Request metadata
 */

import { v4 as uuidv4 } from 'uuid';
import type { ApiKey } from '../auth/api-key.js';

// =============================================================================
// Types
// =============================================================================

export interface TenantContext {
  /** Request correlation ID */
  requestId: string;
  /** Organization ID (tenant) */
  orgId: string;
  /** User ID if authenticated */
  userId?: string;
  /** API key if authenticated via key */
  apiKey?: ApiKey;
  /** Request timestamp */
  timestamp: string;
  /** Request source info */
  source: {
    ip?: string;
    userAgent?: string;
    origin?: string;
  };
  /** Custom metadata */
  metadata: Record<string, unknown>;
}

export interface TenantContextOptions {
  orgId: string;
  userId?: string;
  apiKey?: ApiKey;
  source?: {
    ip?: string;
    userAgent?: string;
    origin?: string;
  };
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Context Store (AsyncLocalStorage alternative for Node.js)
// =============================================================================

// Simple context store using a Map with request IDs
// In production, use AsyncLocalStorage for proper async context propagation
const contextStore = new Map<string, TenantContext>();

/**
 * Create a new tenant context
 */
export function createTenantContext(options: TenantContextOptions): TenantContext {
  const context: TenantContext = {
    requestId: `req_${uuidv4().slice(0, 12)}`,
    orgId: options.orgId,
    userId: options.userId,
    apiKey: options.apiKey,
    timestamp: new Date().toISOString(),
    source: options.source || {},
    metadata: options.metadata || {},
  };

  contextStore.set(context.requestId, context);
  return context;
}

/**
 * Get context by request ID
 */
export function getContext(requestId: string): TenantContext | undefined {
  return contextStore.get(requestId);
}

/**
 * Clear context when request completes
 */
export function clearContext(requestId: string): void {
  contextStore.delete(requestId);
}

/**
 * Run function within tenant context
 */
export async function withTenantContext<T>(
  options: TenantContextOptions,
  fn: (ctx: TenantContext) => Promise<T>
): Promise<T> {
  const context = createTenantContext(options);
  try {
    return await fn(context);
  } finally {
    clearContext(context.requestId);
  }
}

/**
 * Run sync function within tenant context
 */
export function withTenantContextSync<T>(
  options: TenantContextOptions,
  fn: (ctx: TenantContext) => T
): T {
  const context = createTenantContext(options);
  try {
    return fn(context);
  } finally {
    clearContext(context.requestId);
  }
}

// =============================================================================
// Context Utilities
// =============================================================================

/**
 * Add metadata to context
 */
export function addContextMetadata(
  requestId: string,
  key: string,
  value: unknown
): void {
  const context = contextStore.get(requestId);
  if (context) {
    context.metadata[key] = value;
  }
}

/**
 * Get active context count (for debugging/monitoring)
 */
export function getActiveContextCount(): number {
  return contextStore.size;
}

/**
 * Clean up stale contexts (older than maxAgeMs)
 */
export function cleanupStaleContexts(maxAgeMs: number = 5 * 60 * 1000): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [requestId, context] of contextStore) {
    const contextAge = now - new Date(context.timestamp).getTime();
    if (contextAge > maxAgeMs) {
      contextStore.delete(requestId);
      cleaned++;
    }
  }

  return cleaned;
}

// =============================================================================
// Organization Isolation Helpers
// =============================================================================

/**
 * Verify request is authorized for org
 */
export function verifyOrgAccess(context: TenantContext, targetOrgId: string): boolean {
  // User can only access their own org
  return context.orgId === targetOrgId;
}

/**
 * Apply org filter to queries
 */
export function applyOrgFilter<T extends { org_id?: string }>(
  context: TenantContext,
  items: T[]
): T[] {
  return items.filter((item) => item.org_id === context.orgId);
}

/**
 * Validate org ownership before mutation
 */
export function validateOrgOwnership(
  context: TenantContext,
  resourceOrgId: string
): { valid: boolean; error?: string } {
  if (resourceOrgId !== context.orgId) {
    return {
      valid: false,
      error: `Access denied: resource belongs to org ${resourceOrgId}`,
    };
  }
  return { valid: true };
}
