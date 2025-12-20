/**
 * Backend Router
 *
 * Phase 18: Plan-Aware Cost Guardrails & Backend Selection
 * Beads Task: intentvision-[TBD]
 *
 * Intelligent backend selection with:
 * - Plan-based access control
 * - Daily usage quota enforcement
 * - Automatic fallback to statistical when limits hit
 * - Cost estimation and tracking
 */

import type { PlanId } from '../models/plan.js';
import {
  type ForecastBackend,
  isBackendAllowed,
  getDefaultBackend,
  getBackendDailyLimit,
  hasUsageLimit,
  validateForecastParams,
} from './backend-policy.js';

// =============================================================================
// Types
// =============================================================================

export interface BackendSelectionResult {
  /** Selected backend to use */
  backend: ForecastBackend;
  /** Explanation for the selection */
  rationale: string;
  /** Estimated cost for this forecast */
  costEstimate?: {
    credits: number;
    usdEstimate: number;
  };
  /** Fallback backend if primary fails */
  fallback?: ForecastBackend;
  /** Warning message if using fallback */
  warning?: string;
}

export interface BackendRouterOptions {
  /** Organization ID */
  orgId: string;
  /** Subscription plan */
  planId: PlanId;
  /** Metric ID being forecasted */
  metricId: string;
  /** User's requested backend (optional) */
  requestedBackend?: ForecastBackend;
  /** Number of historical data points */
  historyPoints: number;
  /** Forecast horizon in days */
  horizonDays: number;
}

export interface QuotaCheckResult {
  /** Whether quota is available */
  allowed: boolean;
  /** Current usage count today */
  current: number;
  /** Daily limit (0 = unlimited, -1 = disabled) */
  limit: number;
  /** Remaining quota */
  remaining: number;
  /** Upgrade message if over limit */
  upgradeMessage?: string;
}

// =============================================================================
// Cost Estimation
// =============================================================================

/**
 * Estimate cost for a forecast based on backend and parameters
 *
 * Pricing assumptions:
 * - Statistical: Free (local computation)
 * - Nixtla: ~$0.01 per forecast call
 * - LLM: ~$0.05 per forecast call (varies by model)
 */
export function estimateCost(
  backend: ForecastBackend,
  historyPoints: number,
  horizonDays: number
): { credits: number; usdEstimate: number } {
  switch (backend) {
    case 'statistical':
      // Free - no API costs
      return { credits: 0, usdEstimate: 0 };

    case 'nixtla': {
      // Nixtla pricing: Base cost + complexity factor
      const baseCost = 1; // 1 credit per call
      const complexityFactor = Math.min(
        1 + (historyPoints / 1000) * 0.1 + (horizonDays / 100) * 0.05,
        2
      );
      const credits = Math.ceil(baseCost * complexityFactor);
      const usdEstimate = credits * 0.01; // $0.01 per credit
      return { credits, usdEstimate };
    }

    case 'llm': {
      // LLM pricing: Higher base cost + token usage
      const baseCost = 5; // 5 credits per call
      const complexityFactor = Math.min(
        1 + (historyPoints / 500) * 0.2 + (horizonDays / 50) * 0.1,
        3
      );
      const credits = Math.ceil(baseCost * complexityFactor);
      const usdEstimate = credits * 0.01; // $0.01 per credit
      return { credits, usdEstimate };
    }

    default:
      return { credits: 0, usdEstimate: 0 };
  }
}

// =============================================================================
// Quota Management
// =============================================================================

/**
 * Check remaining quota for a backend
 */
export async function getRemainingQuota(
  orgId: string,
  planId: PlanId,
  backend: ForecastBackend
): Promise<QuotaCheckResult> {
  const limit = getBackendDailyLimit(planId, backend);

  // If backend is disabled (-1)
  if (limit === -1) {
    return {
      allowed: false,
      current: 0,
      limit: -1,
      remaining: 0,
      upgradeMessage: `${backend} backend is not available on your plan. Upgrade to access premium forecasting.`,
    };
  }

  // If backend is unlimited (0)
  if (limit === 0) {
    return {
      allowed: true,
      current: 0,
      limit: 0,
      remaining: -1, // -1 means unlimited
    };
  }

  // Get actual usage from backend-usage-service
  // Dynamically import to avoid circular dependency
  const { getTodaysBackendCount } = await import('../services/backend-usage-service.js');
  const currentUsage = await getTodaysBackendCount(orgId, backend);
  const remaining = Math.max(0, limit - currentUsage);
  const allowed = currentUsage < limit;

  return {
    allowed,
    current: currentUsage,
    limit,
    remaining,
    upgradeMessage: allowed
      ? undefined
      : `Daily ${backend} limit reached (${limit}/${limit}). Upgrade for more capacity or try again tomorrow.`,
  };
}

// =============================================================================
// Backend Selection
// =============================================================================

/**
 * Select the best backend for a forecast request
 *
 * Selection logic:
 * 1. Validate forecast parameters against plan limits
 * 2. Use requested backend if specified and allowed
 * 3. Check quota availability for requested backend
 * 4. Fall back to statistical if quota exceeded
 * 5. Use plan's default backend if no preference
 */
export async function selectBackend(
  options: BackendRouterOptions
): Promise<BackendSelectionResult> {
  const { planId, requestedBackend, historyPoints, horizonDays, orgId } = options;

  // Validate forecast parameters
  const paramValidation = validateForecastParams(planId, historyPoints, horizonDays);
  if (!paramValidation.valid) {
    throw new Error(paramValidation.error);
  }

  // Determine target backend
  const targetBackend = requestedBackend || getDefaultBackend(planId);

  // Check if backend is allowed
  if (!isBackendAllowed(planId, targetBackend)) {
    const fallbackBackend = 'statistical';
    const costEstimate = estimateCost(fallbackBackend, historyPoints, horizonDays);

    return {
      backend: fallbackBackend,
      rationale: `Requested backend '${targetBackend}' is not available on your plan. Using ${fallbackBackend} instead.`,
      costEstimate,
      fallback: fallbackBackend,
      warning: `Upgrade to access ${targetBackend} backend for more accurate forecasts.`,
    };
  }

  // Check quota for non-statistical backends
  if (targetBackend !== 'statistical' && hasUsageLimit(planId, targetBackend)) {
    const quota = await getRemainingQuota(orgId, planId, targetBackend);

    if (!quota.allowed) {
      const fallbackBackend = 'statistical';
      const costEstimate = estimateCost(fallbackBackend, historyPoints, horizonDays);

      return {
        backend: fallbackBackend,
        rationale: `Daily ${targetBackend} quota exceeded (${quota.current}/${quota.limit}). Falling back to ${fallbackBackend}.`,
        costEstimate,
        fallback: fallbackBackend,
        warning: quota.upgradeMessage,
      };
    }
  }

  // Backend is allowed and has quota - use it
  const costEstimate = estimateCost(targetBackend, historyPoints, horizonDays);

  return {
    backend: targetBackend,
    rationale: requestedBackend
      ? `Using requested backend: ${targetBackend}`
      : `Using plan default backend: ${targetBackend}`,
    costEstimate,
  };
}

/**
 * Check if a specific backend is available for immediate use
 */
export async function isBackendAvailable(
  orgId: string,
  planId: PlanId,
  backend: ForecastBackend
): Promise<{ available: boolean; reason?: string }> {
  // Check if backend is allowed on plan
  if (!isBackendAllowed(planId, backend)) {
    return {
      available: false,
      reason: `Backend '${backend}' is not available on your plan.`,
    };
  }

  // Statistical backend is always available (no quota)
  if (backend === 'statistical') {
    return { available: true };
  }

  // Check quota for premium backends
  const quota = await getRemainingQuota(orgId, planId, backend);
  if (!quota.allowed) {
    return {
      available: false,
      reason: quota.upgradeMessage,
    };
  }

  return { available: true };
}
