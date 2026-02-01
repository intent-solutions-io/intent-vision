/**
 * Sandbox Middleware
 *
 * Phase 19: Developer Experience - OpenAPI, SDK, and Sandbox Keys
 *
 * Enforces sandbox limitations:
 * - No real TimeGPT/Nixtla calls (statistical backend only)
 * - Limited history (last 30 days only)
 * - Limited volume (100 requests/day)
 * - Responses include sandbox flag
 */

import { type AuthContext } from '../auth/api-key.js';
import { getDb } from '../firestore/client.js';
import { COLLECTIONS } from '../firestore/schema.js';

// =============================================================================
// Types
// =============================================================================

export interface SandboxContext {
  /** Whether the request is in sandbox mode */
  isSandbox: boolean;
  /** Sandbox limits configuration */
  sandboxLimits: {
    /** Maximum requests per day */
    maxRequestsPerDay: number;
    /** Maximum history in days */
    maxHistoryDays: number;
    /** Allowed forecast backends */
    allowedBackends: string[];
  };
}

export interface SandboxLimitCheckResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: string;
  /** Current usage count */
  currentUsage?: number;
  /** Maximum allowed */
  maxAllowed?: number;
}

// =============================================================================
// Constants
// =============================================================================

const SANDBOX_LIMITS = {
  /** Maximum requests per day for sandbox keys */
  MAX_REQUESTS_PER_DAY: 100,
  /** Maximum historical data in days */
  MAX_HISTORY_DAYS: 30,
  /** Allowed backends in sandbox mode */
  ALLOWED_BACKENDS: ['statistical'],
} as const;

// =============================================================================
// Sandbox Context
// =============================================================================

/**
 * Apply sandbox limits to request context
 *
 * @param authContext - Authentication context
 * @returns Sandbox context with limits
 */
export function applySandboxLimits(authContext: AuthContext): SandboxContext {
  return {
    isSandbox: authContext.isSandbox,
    sandboxLimits: {
      maxRequestsPerDay: SANDBOX_LIMITS.MAX_REQUESTS_PER_DAY,
      maxHistoryDays: SANDBOX_LIMITS.MAX_HISTORY_DAYS,
      allowedBackends: [...SANDBOX_LIMITS.ALLOWED_BACKENDS],
    },
  };
}

/**
 * Check if sandbox request is within daily limits
 *
 * @param orgId - Organization ID
 * @param isSandbox - Whether this is a sandbox key
 * @returns Limit check result
 */
export async function checkSandboxLimit(
  orgId: string,
  isSandbox: boolean
): Promise<SandboxLimitCheckResult> {
  // Production keys have no sandbox limits
  if (!isSandbox) {
    return { allowed: true };
  }

  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get today's usage for sandbox keys
    const usageDoc = await db
      .collection(COLLECTIONS.usage(orgId))
      .doc(`sandbox-${today}`)
      .get();

    const currentUsage = usageDoc.exists
      ? ((usageDoc.data() as { apiCalls?: number }).apiCalls || 0)
      : 0;

    if (currentUsage >= SANDBOX_LIMITS.MAX_REQUESTS_PER_DAY) {
      return {
        allowed: false,
        reason: `Sandbox daily limit exceeded (${SANDBOX_LIMITS.MAX_REQUESTS_PER_DAY} requests/day)`,
        currentUsage,
        maxAllowed: SANDBOX_LIMITS.MAX_REQUESTS_PER_DAY,
      };
    }

    return {
      allowed: true,
      currentUsage,
      maxAllowed: SANDBOX_LIMITS.MAX_REQUESTS_PER_DAY,
    };
  } catch (error) {
    console.error('[Sandbox] Error checking limits:', error);
    // Fail open to avoid blocking legitimate requests
    return { allowed: true };
  }
}

/**
 * Record a sandbox API call
 *
 * @param orgId - Organization ID
 * @param isSandbox - Whether this is a sandbox key
 */
export async function recordSandboxUsage(
  orgId: string,
  isSandbox: boolean
): Promise<void> {
  // Only track sandbox usage
  if (!isSandbox) {
    return;
  }

  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const docRef = db.collection(COLLECTIONS.usage(orgId)).doc(`sandbox-${today}`);

    // Increment API call counter
    await docRef.set(
      {
        date: today,
        orgId,
        apiCalls: (await docRef.get()).exists
          ? ((await docRef.get()).data() as { apiCalls?: number })?.apiCalls || 0 + 1
          : 1,
        updatedAt: new Date(),
        sandbox: true,
      },
      { merge: true }
    );
  } catch (error) {
    // Log error but don't fail the request
    console.error('[Sandbox] Error recording usage:', error);
  }
}

/**
 * Filter timeseries data to sandbox limits (last 30 days)
 *
 * @param data - Timeseries data points
 * @param isSandbox - Whether this is a sandbox key
 * @returns Filtered data points
 */
export function filterSandboxHistory<T extends { timestamp: Date }>(
  data: T[],
  isSandbox: boolean
): T[] {
  if (!isSandbox) {
    return data;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - SANDBOX_LIMITS.MAX_HISTORY_DAYS);

  return data.filter((point) => new Date(point.timestamp) >= cutoffDate);
}

/**
 * Validate forecast backend for sandbox mode
 *
 * @param backend - Requested backend
 * @param isSandbox - Whether this is a sandbox key
 * @returns Validated backend (forced to statistical in sandbox)
 */
export function validateSandboxBackend(
  backend: string,
  isSandbox: boolean
): string {
  if (!isSandbox) {
    return backend;
  }

  // Force statistical backend in sandbox mode
  const allowedBackends: readonly string[] = SANDBOX_LIMITS.ALLOWED_BACKENDS;
  if (!allowedBackends.includes(backend)) {
    console.warn(
      `[Sandbox] Backend '${backend}' not allowed in sandbox mode, forcing 'statistical'`
    );
    return 'statistical';
  }

  return backend;
}

/**
 * Add sandbox metadata to response
 *
 * @param response - API response object
 * @param isSandbox - Whether this is a sandbox key
 * @returns Response with sandbox metadata
 */
export function addSandboxMetadata<T extends Record<string, unknown>>(
  response: T,
  isSandbox: boolean
): T & { sandbox?: boolean } {
  if (!isSandbox) {
    return response;
  }

  return {
    ...response,
    sandbox: true,
  };
}

// =============================================================================
// Middleware Helpers
// =============================================================================

/**
 * Create sandbox-aware error response
 *
 * @param message - Error message
 * @param isSandbox - Whether this is a sandbox key
 * @returns Error response with sandbox context
 */
export function createSandboxError(
  message: string,
  isSandbox: boolean
): { error: string; code: string; sandbox?: boolean } {
  const baseError = {
    error: message,
    code: 'SANDBOX_LIMIT_EXCEEDED',
  };

  if (isSandbox) {
    return {
      ...baseError,
      sandbox: true,
    };
  }

  return baseError;
}

/**
 * Get sandbox usage summary
 *
 * @param orgId - Organization ID
 * @returns Usage summary for sandbox keys
 */
export async function getSandboxUsageSummary(orgId: string): Promise<{
  today: number;
  limit: number;
  remaining: number;
  resetAt: string;
}> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const usageDoc = await db
    .collection(COLLECTIONS.usage(orgId))
    .doc(`sandbox-${today}`)
    .get();

  const todayUsage = usageDoc.exists
    ? ((usageDoc.data() as { apiCalls?: number }).apiCalls || 0)
    : 0;

  const resetDate = new Date();
  resetDate.setUTCHours(24, 0, 0, 0); // Next midnight UTC

  return {
    today: todayUsage,
    limit: SANDBOX_LIMITS.MAX_REQUESTS_PER_DAY,
    remaining: Math.max(0, SANDBOX_LIMITS.MAX_REQUESTS_PER_DAY - todayUsage),
    resetAt: resetDate.toISOString(),
  };
}
