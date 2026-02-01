/**
 * Usage Service
 *
 * Phase 10: Sellable Alpha Shell
 * Beads Task: intentvision-cv6
 *
 * Tracks organization usage against plan limits.
 * Provides enforcement for metrics, alerts, and forecasts.
 */

import { getDb } from '../firestore/client.js';
import { COLLECTIONS } from '../firestore/schema.js';
import {
  getPlan,
  checkMetricLimit,
  checkAlertLimit,
  checkForecastLimit,
  isFeatureEnabled,
  type PlanId,
  type Plan,
  type LimitCheckResult,
} from '../models/plan.js';
import { getOrganizationById } from './org-service.js';

// =============================================================================
// Types
// =============================================================================

export interface OrganizationUsage {
  orgId: string;
  metricsCount: number;
  alertsCount: number;
  forecastsToday: number;
  lastUpdated: Date;
}

export interface UsageCheckResult {
  allowed: boolean;
  plan: Plan;
  check: LimitCheckResult;
}

// =============================================================================
// Usage Retrieval
// =============================================================================

/**
 * Get current usage stats for an organization
 */
export async function getOrganizationUsage(
  orgId: string
): Promise<OrganizationUsage> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Count metrics
  const metricsSnapshot = await db
    .collection(COLLECTIONS.metrics(orgId))
    .where('active', '!=', false)
    .count()
    .get();
  const metricsCount = metricsSnapshot.data().count;

  // Count active alerts
  const alertsSnapshot = await db
    .collection(COLLECTIONS.alertRules(orgId))
    .where('enabled', '==', true)
    .count()
    .get();
  const alertsCount = alertsSnapshot.data().count;

  // Count today's forecasts
  const todayStart = new Date(today);
  const forecastsSnapshot = await db
    .collection(COLLECTIONS.forecasts(orgId))
    .where('createdAt', '>=', todayStart)
    .count()
    .get();
  const forecastsToday = forecastsSnapshot.data().count;

  return {
    orgId,
    metricsCount,
    alertsCount,
    forecastsToday,
    lastUpdated: new Date(),
  };
}

/**
 * Get organization's current plan
 */
export async function getOrganizationPlan(orgId: string): Promise<Plan | null> {
  const org = await getOrganizationById(orgId);
  if (!org) {
    return null;
  }

  // Map legacy plan names to new PlanId
  const planIdMap: Record<string, PlanId> = {
    beta: 'free',
    starter: 'starter',
    growth: 'growth',
    enterprise: 'enterprise',
  };

  const planId = planIdMap[org.plan] || 'free';
  return getPlan(planId);
}

// =============================================================================
// Limit Checks
// =============================================================================

/**
 * Check if organization can create a new metric
 */
export async function canCreateMetric(orgId: string): Promise<UsageCheckResult> {
  const plan = await getOrganizationPlan(orgId);
  if (!plan) {
    return {
      allowed: false,
      plan: getPlan('free'),
      check: {
        allowed: false,
        limit: 0,
        current: 0,
        remaining: 0,
        message: 'Organization not found',
      },
    };
  }

  const usage = await getOrganizationUsage(orgId);
  const check = checkMetricLimit(plan, usage.metricsCount);

  return { allowed: check.allowed, plan, check };
}

/**
 * Check if organization can create a new alert
 */
export async function canCreateAlert(orgId: string): Promise<UsageCheckResult> {
  const plan = await getOrganizationPlan(orgId);
  if (!plan) {
    return {
      allowed: false,
      plan: getPlan('free'),
      check: {
        allowed: false,
        limit: 0,
        current: 0,
        remaining: 0,
        message: 'Organization not found',
      },
    };
  }

  const usage = await getOrganizationUsage(orgId);
  const check = checkAlertLimit(plan, usage.alertsCount);

  return { allowed: check.allowed, plan, check };
}

/**
 * Check if organization can run a forecast
 */
export async function canRunForecast(orgId: string): Promise<UsageCheckResult> {
  const plan = await getOrganizationPlan(orgId);
  if (!plan) {
    return {
      allowed: false,
      plan: getPlan('free'),
      check: {
        allowed: false,
        limit: 0,
        current: 0,
        remaining: 0,
        message: 'Organization not found',
      },
    };
  }

  const usage = await getOrganizationUsage(orgId);
  const check = checkForecastLimit(plan, usage.forecastsToday);

  return { allowed: check.allowed, plan, check };
}

/**
 * Check if organization has TimeGPT/Nixtla access
 */
export async function canUseTimegpt(orgId: string): Promise<boolean> {
  const plan = await getOrganizationPlan(orgId);
  if (!plan) {
    return false;
  }
  return isFeatureEnabled(plan, 'timegptEnabled');
}

/**
 * Check if organization has Slack notifications
 */
export async function canUseSlack(orgId: string): Promise<boolean> {
  const plan = await getOrganizationPlan(orgId);
  if (!plan) {
    return false;
  }
  return isFeatureEnabled(plan, 'slackEnabled');
}

/**
 * Check if organization has webhook notifications
 */
export async function canUseWebhook(orgId: string): Promise<boolean> {
  const plan = await getOrganizationPlan(orgId);
  if (!plan) {
    return false;
  }
  return isFeatureEnabled(plan, 'webhookEnabled');
}

// =============================================================================
// Dashboard Stats
// =============================================================================

export interface DashboardStats {
  plan: {
    id: string;
    name: string;
  };
  usage: {
    metrics: {
      current: number;
      limit: number;
      remaining: number;
    };
    alerts: {
      current: number;
      limit: number;
      remaining: number;
    };
    forecastsToday: {
      current: number;
      limit: number;
      remaining: number;
    };
  };
  features: {
    timegptEnabled: boolean;
    slackEnabled: boolean;
    webhookEnabled: boolean;
  };
}

/**
 * Get dashboard stats for an organization
 */
export async function getDashboardStats(
  orgId: string
): Promise<DashboardStats | null> {
  const plan = await getOrganizationPlan(orgId);
  if (!plan) {
    return null;
  }

  const usage = await getOrganizationUsage(orgId);

  return {
    plan: {
      id: plan.id,
      name: plan.name,
    },
    usage: {
      metrics: {
        current: usage.metricsCount,
        limit: plan.limits.maxMetrics,
        remaining: Math.max(0, plan.limits.maxMetrics - usage.metricsCount),
      },
      alerts: {
        current: usage.alertsCount,
        limit: plan.limits.maxAlerts,
        remaining: Math.max(0, plan.limits.maxAlerts - usage.alertsCount),
      },
      forecastsToday: {
        current: usage.forecastsToday,
        limit: plan.limits.maxForecastsPerDay,
        remaining: Math.max(
          0,
          plan.limits.maxForecastsPerDay - usage.forecastsToday
        ),
      },
    },
    features: {
      timegptEnabled: plan.features.timegptEnabled,
      slackEnabled: plan.features.slackEnabled,
      webhookEnabled: plan.features.webhookEnabled,
    },
  };
}
