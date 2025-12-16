/**
 * Plan Model
 *
 * Phase 10: Sellable Alpha Shell
 * Beads Task: intentvision-cv6
 *
 * Defines subscription plans with feature limits.
 * Plans control access to metrics, alerts, forecasts, and features.
 */

// =============================================================================
// Types
// =============================================================================

export type PlanId = 'free' | 'starter' | 'growth' | 'enterprise';

export interface PlanLimits {
  /** Maximum number of metrics this plan can track */
  maxMetrics: number;
  /** Maximum number of active alert rules */
  maxAlerts: number;
  /** Maximum forecasts per day */
  maxForecastsPerDay: number;
  /** Maximum data retention in days */
  dataRetentionDays: number;
  /** Maximum API requests per minute */
  apiRateLimit: number;
}

export interface PlanFeatures {
  /** TimeGPT/Nixtla backend enabled */
  timegptEnabled: boolean;
  /** Slack notifications enabled */
  slackEnabled: boolean;
  /** Webhook notifications enabled */
  webhookEnabled: boolean;
  /** Custom email from address */
  customEmailFrom: boolean;
  /** Priority support */
  prioritySupport: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  limits: PlanLimits;
  features: PlanFeatures;
  /** Monthly price in cents (0 = free) */
  priceMonthly: number;
  /** Whether this plan is available for new signups */
  available: boolean;
}

// =============================================================================
// Plan Definitions
// =============================================================================

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic forecasting',
    limits: {
      maxMetrics: 3,
      maxAlerts: 5,
      maxForecastsPerDay: 10,
      dataRetentionDays: 30,
      apiRateLimit: 60, // 60 requests/minute
    },
    features: {
      timegptEnabled: false,
      slackEnabled: false,
      webhookEnabled: false,
      customEmailFrom: false,
      prioritySupport: false,
    },
    priceMonthly: 0,
    available: true,
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'For growing teams with more metrics',
    limits: {
      maxMetrics: 25,
      maxAlerts: 50,
      maxForecastsPerDay: 100,
      dataRetentionDays: 90,
      apiRateLimit: 300, // 300 requests/minute
    },
    features: {
      timegptEnabled: true,
      slackEnabled: true,
      webhookEnabled: true,
      customEmailFrom: false,
      prioritySupport: false,
    },
    priceMonthly: 4900, // $49/month
    available: true,
  },

  growth: {
    id: 'growth',
    name: 'Growth',
    description: 'For scaling businesses with advanced needs',
    limits: {
      maxMetrics: 100,
      maxAlerts: 200,
      maxForecastsPerDay: 500,
      dataRetentionDays: 365,
      apiRateLimit: 1000, // 1000 requests/minute
    },
    features: {
      timegptEnabled: true,
      slackEnabled: true,
      webhookEnabled: true,
      customEmailFrom: true,
      prioritySupport: true,
    },
    priceMonthly: 19900, // $199/month
    available: true,
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    limits: {
      maxMetrics: 1000,
      maxAlerts: 1000,
      maxForecastsPerDay: 5000,
      dataRetentionDays: 730, // 2 years
      apiRateLimit: 10000, // 10000 requests/minute
    },
    features: {
      timegptEnabled: true,
      slackEnabled: true,
      webhookEnabled: true,
      customEmailFrom: true,
      prioritySupport: true,
    },
    priceMonthly: 0, // Custom pricing
    available: false, // Contact sales
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a plan by ID
 */
export function getPlan(planId: PlanId): Plan {
  const plan = PLANS[planId];
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`);
  }
  return plan;
}

/**
 * Get the default plan for new organizations
 */
export function getDefaultPlan(): Plan {
  return PLANS.free;
}

/**
 * Check if a plan ID is valid
 */
export function isValidPlanId(planId: string): planId is PlanId {
  return planId in PLANS;
}

/**
 * Get all available plans (for pricing page)
 */
export function getAvailablePlans(): Plan[] {
  return Object.values(PLANS).filter((plan) => plan.available);
}

// =============================================================================
// Limit Checking
// =============================================================================

export interface UsageStats {
  metricsCount: number;
  alertsCount: number;
  forecastsToday: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
  message?: string;
}

/**
 * Check if creating a new metric is allowed
 */
export function checkMetricLimit(
  plan: Plan,
  currentCount: number
): LimitCheckResult {
  const allowed = currentCount < plan.limits.maxMetrics;
  return {
    allowed,
    limit: plan.limits.maxMetrics,
    current: currentCount,
    remaining: Math.max(0, plan.limits.maxMetrics - currentCount),
    message: allowed
      ? undefined
      : `Metric limit reached (${plan.limits.maxMetrics}). Upgrade to add more metrics.`,
  };
}

/**
 * Check if creating a new alert is allowed
 */
export function checkAlertLimit(
  plan: Plan,
  currentCount: number
): LimitCheckResult {
  const allowed = currentCount < plan.limits.maxAlerts;
  return {
    allowed,
    limit: plan.limits.maxAlerts,
    current: currentCount,
    remaining: Math.max(0, plan.limits.maxAlerts - currentCount),
    message: allowed
      ? undefined
      : `Alert limit reached (${plan.limits.maxAlerts}). Upgrade to create more alerts.`,
  };
}

/**
 * Check if running a forecast is allowed
 */
export function checkForecastLimit(
  plan: Plan,
  forecastsToday: number
): LimitCheckResult {
  const allowed = forecastsToday < plan.limits.maxForecastsPerDay;
  return {
    allowed,
    limit: plan.limits.maxForecastsPerDay,
    current: forecastsToday,
    remaining: Math.max(0, plan.limits.maxForecastsPerDay - forecastsToday),
    message: allowed
      ? undefined
      : `Daily forecast limit reached (${plan.limits.maxForecastsPerDay}). Try again tomorrow or upgrade.`,
  };
}

/**
 * Check if a feature is enabled for the plan
 */
export function isFeatureEnabled(
  plan: Plan,
  feature: keyof PlanFeatures
): boolean {
  return plan.features[feature];
}
