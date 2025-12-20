/**
 * Backend Selection Policy
 *
 * Phase 18: Plan-Aware Cost Guardrails & Backend Selection
 * Beads Task: intentvision-[TBD]
 *
 * Defines which forecast backends are available for each plan,
 * along with daily usage limits and input constraints.
 *
 * Backend types:
 * - statistical: Local statistical methods (SMA, EWMA, linear) - always free
 * - nixtla: Nixtla TimeGPT API - paid external service
 * - llm: LLM-based forecast analysis - future feature
 */

import type { PlanId } from '../models/plan.js';

// =============================================================================
// Types
// =============================================================================

export type ForecastBackend = 'statistical' | 'nixtla' | 'llm';

export interface BackendPolicy {
  /** Default backend for this plan */
  defaultBackend: ForecastBackend;
  /** Backends allowed for this plan */
  allowedBackends: ForecastBackend[];
  /** Max TimeGPT/Nixtla calls per day (0 = unlimited, -1 = disabled) */
  nixtlaLimitPerDay: number;
  /** Max LLM-based forecast calls per day (0 = unlimited, -1 = disabled) */
  llmLimitPerDay: number;
  /** Max history points for input */
  maxHistoryPoints: number;
  /** Max horizon days */
  maxHorizonDays: number;
}

// =============================================================================
// Plan-Based Backend Policies
// =============================================================================

/**
 * Backend policies for each subscription plan
 *
 * Free tier: Only statistical methods (local, no API cost)
 * Starter: Limited Nixtla access for testing
 * Growth: Full Nixtla access with generous limits
 * Enterprise: Unlimited access to all backends
 */
export const BACKEND_POLICIES: Record<PlanId, BackendPolicy> = {
  free: {
    defaultBackend: 'statistical',
    allowedBackends: ['statistical'],
    nixtlaLimitPerDay: -1, // Disabled
    llmLimitPerDay: -1, // Disabled
    maxHistoryPoints: 365,
    maxHorizonDays: 30,
  },

  starter: {
    defaultBackend: 'statistical',
    allowedBackends: ['statistical', 'nixtla'],
    nixtlaLimitPerDay: 10,
    llmLimitPerDay: 5,
    maxHistoryPoints: 730, // 2 years
    maxHorizonDays: 90,
  },

  growth: {
    defaultBackend: 'nixtla',
    allowedBackends: ['statistical', 'nixtla', 'llm'],
    nixtlaLimitPerDay: 100,
    llmLimitPerDay: 50,
    maxHistoryPoints: 1095, // 3 years
    maxHorizonDays: 180,
  },

  enterprise: {
    defaultBackend: 'nixtla',
    allowedBackends: ['statistical', 'nixtla', 'llm'],
    nixtlaLimitPerDay: 0, // Unlimited
    llmLimitPerDay: 0, // Unlimited
    maxHistoryPoints: 0, // Unlimited
    maxHorizonDays: 365,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get backend policy for a plan
 */
export function getBackendPolicy(planId: PlanId): BackendPolicy {
  const policy = BACKEND_POLICIES[planId];
  if (!policy) {
    throw new Error(`Unknown plan: ${planId}`);
  }
  return policy;
}

/**
 * Check if a backend is allowed for a plan
 */
export function isBackendAllowed(planId: PlanId, backend: ForecastBackend): boolean {
  const policy = getBackendPolicy(planId);
  return policy.allowedBackends.includes(backend);
}

/**
 * Get the default backend for a plan
 */
export function getDefaultBackend(planId: PlanId): ForecastBackend {
  const policy = getBackendPolicy(planId);
  return policy.defaultBackend;
}

/**
 * Get daily limit for a specific backend and plan
 */
export function getBackendDailyLimit(planId: PlanId, backend: ForecastBackend): number {
  const policy = getBackendPolicy(planId);

  switch (backend) {
    case 'nixtla':
      return policy.nixtlaLimitPerDay;
    case 'llm':
      return policy.llmLimitPerDay;
    case 'statistical':
      return 0; // Unlimited - no API cost
    default:
      return -1; // Disabled
  }
}

/**
 * Check if a backend has usage limits (not unlimited or disabled)
 */
export function hasUsageLimit(planId: PlanId, backend: ForecastBackend): boolean {
  const limit = getBackendDailyLimit(planId, backend);
  return limit > 0; // Has a specific limit (not 0=unlimited or -1=disabled)
}

/**
 * Validate forecast parameters against plan limits
 */
export function validateForecastParams(
  planId: PlanId,
  historyPoints: number,
  horizonDays: number
): { valid: boolean; error?: string } {
  const policy = getBackendPolicy(planId);

  // Check history points limit
  if (policy.maxHistoryPoints > 0 && historyPoints > policy.maxHistoryPoints) {
    return {
      valid: false,
      error: `History points (${historyPoints}) exceeds plan limit (${policy.maxHistoryPoints}). Upgrade to access more historical data.`,
    };
  }

  // Check horizon days limit
  if (horizonDays > policy.maxHorizonDays) {
    return {
      valid: false,
      error: `Forecast horizon (${horizonDays} days) exceeds plan limit (${policy.maxHorizonDays} days). Upgrade for longer forecasts.`,
    };
  }

  return { valid: true };
}
