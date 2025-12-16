/**
 * Metering Service
 *
 * Phase 11: Usage Metering + Plan Enforcement
 * Beads Task: intentvision-zf7
 *
 * Records usage events and provides aggregation helpers for:
 * - Plan limit enforcement
 * - Admin usage views
 * - Future billing integration
 */

import { getDb, generateId } from '../firestore/client.js';
import {
  COLLECTIONS,
  type UsageEvent,
  type UsageEventType,
} from '../firestore/schema.js';
import { getOrganizationById } from './org-service.js';
import { getPlan, type PlanId } from '../models/plan.js';

// =============================================================================
// Types
// =============================================================================

export interface RecordUsageParams {
  orgId: string;
  eventType: UsageEventType;
  quantity?: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageSummary {
  orgId: string;
  planId: string;
  periodStart: Date;
  periodEnd: Date;
  counts: {
    forecast_call: number;
    alert_fired: number;
    metric_ingested: number;
    api_call: number;
  };
  totalEvents: number;
}

export interface UsageLimitCheck {
  allowed: boolean;
  eventType: UsageEventType;
  current: number;
  limit: number;
  percentUsed: number;
  reason?: string;
}

// =============================================================================
// Record Usage Events
// =============================================================================

/**
 * Record a usage event
 *
 * This function is designed to never throw - failures are logged but don't
 * break the main operation flow.
 */
export async function recordUsageEvent(params: RecordUsageParams): Promise<void> {
  const { orgId, eventType, quantity = 1, userId, metadata } = params;

  try {
    const db = getDb();

    // Get org's plan
    const org = await getOrganizationById(orgId);
    const planId = org?.plan || 'beta';

    // Map legacy plan names to new plan IDs
    const planIdMap: Record<string, PlanId> = {
      beta: 'free',
      starter: 'starter',
      growth: 'growth',
      enterprise: 'enterprise',
    };

    const usageEvent: UsageEvent = {
      id: generateId('usage'),
      orgId,
      planId: planIdMap[planId] || 'free',
      userId,
      eventType,
      quantity,
      occurredAt: new Date(),
      metadata,
    };

    await db.collection(COLLECTIONS.usageEvents(orgId)).doc(usageEvent.id).set(usageEvent);

    console.log(`[Metering] Recorded ${eventType} for org ${orgId}`);
  } catch (error) {
    // Log but don't throw - metering failures shouldn't break main flow
    console.error(`[Metering] Failed to record ${eventType} for org ${orgId}:`, (error as Error).message);
  }
}

// =============================================================================
// Query Usage
// =============================================================================

/**
 * Get usage summary for an organization within a time range
 */
export async function getOrgUsage(
  orgId: string,
  from: Date,
  to: Date
): Promise<UsageSummary> {
  const db = getDb();

  // Get org's plan
  const org = await getOrganizationById(orgId);
  const planId = org?.plan || 'beta';
  const planIdMap: Record<string, PlanId> = {
    beta: 'free',
    starter: 'starter',
    growth: 'growth',
    enterprise: 'enterprise',
  };

  // Query usage events for the period
  const snapshot = await db
    .collection(COLLECTIONS.usageEvents(orgId))
    .where('occurredAt', '>=', from)
    .where('occurredAt', '<', to)
    .get();

  // Aggregate by event type
  const counts: Record<UsageEventType, number> = {
    forecast_call: 0,
    alert_fired: 0,
    metric_ingested: 0,
    api_call: 0,
  };

  let totalEvents = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshot.docs.forEach((doc: any) => {
    const event = doc.data() as UsageEvent;
    const eventType = event.eventType as UsageEventType;
    if (counts[eventType] !== undefined) {
      counts[eventType] += event.quantity;
      totalEvents += event.quantity;
    }
  });

  return {
    orgId,
    planId: planIdMap[planId] || 'free',
    periodStart: from,
    periodEnd: to,
    counts,
    totalEvents,
  };
}

/**
 * Get today's usage for an organization
 */
export async function getTodayUsage(orgId: string): Promise<UsageSummary> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  return getOrgUsage(orgId, startOfDay, endOfDay);
}

/**
 * Get last 30 days usage for an organization
 */
export async function getLast30DaysUsage(orgId: string): Promise<UsageSummary> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

  return getOrgUsage(orgId, thirtyDaysAgo, now);
}

// =============================================================================
// Plan Limit Enforcement
// =============================================================================

/**
 * Check if an operation is allowed based on plan limits
 */
export async function checkUsageLimit(
  orgId: string,
  eventType: UsageEventType
): Promise<UsageLimitCheck> {
  // Get today's usage
  const usage = await getTodayUsage(orgId);

  // Get plan limits
  const plan = getPlan(usage.planId as PlanId);
  if (!plan) {
    return {
      allowed: true,
      eventType,
      current: usage.counts[eventType],
      limit: Infinity,
      percentUsed: 0,
    };
  }

  // Map event type to plan limit field
  let limit: number;
  switch (eventType) {
    case 'forecast_call':
      limit = plan.limits.maxForecastsPerDay;
      break;
    case 'alert_fired':
      limit = plan.limits.maxAlerts;
      break;
    case 'metric_ingested':
      limit = plan.limits.maxMetrics * 1000; // Allow 1000 points per metric
      break;
    case 'api_call':
      limit = plan.limits.apiRateLimit * 60 * 24; // Daily API limit (rate/min * minutes/day)
      break;
    default:
      limit = Infinity;
  }

  const current = usage.counts[eventType];
  const percentUsed = limit === Infinity ? 0 : Math.round((current / limit) * 100);
  const allowed = current < limit;

  return {
    allowed,
    eventType,
    current,
    limit,
    percentUsed,
    reason: allowed
      ? undefined
      : `Your plan (${plan.name}) allows ${limit} ${eventType.replace('_', ' ')}s per day. You've used ${current} today.`,
  };
}

/**
 * Check if forecast is allowed based on plan limits
 */
export async function canRunForecast(orgId: string): Promise<UsageLimitCheck> {
  return checkUsageLimit(orgId, 'forecast_call');
}

/**
 * Check if alert can be fired based on plan limits
 */
export async function canFireAlert(orgId: string): Promise<UsageLimitCheck> {
  return checkUsageLimit(orgId, 'alert_fired');
}

// =============================================================================
// Admin Usage Views
// =============================================================================

export interface AdminUsageOverview {
  orgId: string;
  plan: {
    id: string;
    name: string;
  };
  today: {
    forecasts: { current: number; limit: number; percentUsed: number };
    alerts: { current: number; limit: number; percentUsed: number };
    ingested: { current: number; limit: number; percentUsed: number };
    apiCalls: { current: number; limit: number; percentUsed: number };
  };
  last30Days: {
    totalEvents: number;
    byType: Record<UsageEventType, number>;
  };
  warnings: string[];
}

/**
 * Get comprehensive usage overview for admin views
 */
export async function getAdminUsageOverview(orgId: string): Promise<AdminUsageOverview> {
  // Get org and plan info
  const org = await getOrganizationById(orgId);
  const planIdMap: Record<string, PlanId> = {
    beta: 'free',
    starter: 'starter',
    growth: 'growth',
    enterprise: 'enterprise',
  };
  const planId = planIdMap[org?.plan || 'beta'] || 'free';
  const plan = getPlan(planId);

  // Get usage data
  const todayUsage = await getTodayUsage(orgId);
  const last30Usage = await getLast30DaysUsage(orgId);

  // Calculate limits and percentages
  const forecastLimit = plan?.limits.maxForecastsPerDay || Infinity;
  const alertLimit = plan?.limits.maxAlerts || Infinity;
  const ingestLimit = (plan?.limits.maxMetrics || 3) * 1000;
  const apiLimit = (plan?.limits.apiRateLimit || 60) * 60 * 24;

  const forecastPercent = forecastLimit === Infinity ? 0 : Math.round((todayUsage.counts.forecast_call / forecastLimit) * 100);
  const alertPercent = alertLimit === Infinity ? 0 : Math.round((todayUsage.counts.alert_fired / alertLimit) * 100);
  const ingestPercent = ingestLimit === Infinity ? 0 : Math.round((todayUsage.counts.metric_ingested / ingestLimit) * 100);
  const apiPercent = apiLimit === Infinity ? 0 : Math.round((todayUsage.counts.api_call / apiLimit) * 100);

  // Generate warnings
  const warnings: string[] = [];
  if (forecastPercent >= 80) {
    warnings.push(`Forecasts: ${forecastPercent}% of daily limit used`);
  }
  if (alertPercent >= 80) {
    warnings.push(`Alerts: ${alertPercent}% of limit used`);
  }
  if (ingestPercent >= 80) {
    warnings.push(`Ingestion: ${ingestPercent}% of limit used`);
  }

  return {
    orgId,
    plan: {
      id: planId,
      name: plan?.name || 'Free',
    },
    today: {
      forecasts: {
        current: todayUsage.counts.forecast_call,
        limit: forecastLimit,
        percentUsed: forecastPercent,
      },
      alerts: {
        current: todayUsage.counts.alert_fired,
        limit: alertLimit,
        percentUsed: alertPercent,
      },
      ingested: {
        current: todayUsage.counts.metric_ingested,
        limit: ingestLimit,
        percentUsed: ingestPercent,
      },
      apiCalls: {
        current: todayUsage.counts.api_call,
        limit: apiLimit,
        percentUsed: apiPercent,
      },
    },
    last30Days: {
      totalEvents: last30Usage.totalEvents,
      byType: last30Usage.counts,
    },
    warnings,
  };
}
