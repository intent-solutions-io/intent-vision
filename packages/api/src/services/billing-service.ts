/**
 * Billing Service
 *
 * Phase 12: Billing Backend
 * Beads Task: intentvision-[phase12]
 *
 * Manages billing snapshots and usage aggregation for billing periods.
 * Provides data for future Stripe integration.
 */

import { getDb, generateId } from '../firestore/client.js';
import {
  COLLECTIONS,
  type BillingSnapshot,
  type UsageEvent,
} from '../firestore/schema.js';
import { getOrganizationById } from './org-service.js';
import { type PlanId } from '../models/plan.js';

// =============================================================================
// Types
// =============================================================================

export interface BillingPeriod {
  start: Date;
  end: Date;
}

export interface CurrentPeriodUsage {
  orgId: string;
  planId: string;
  periodStart: Date;
  periodEnd: Date;
  usage: {
    forecast_calls: number;
    alerts_fired: number;
    metrics_ingested: number;
  };
  daysInPeriod: number;
  daysElapsed: number;
  projectedMonthly: {
    forecast_calls: number;
    alerts_fired: number;
    metrics_ingested: number;
  };
}

// =============================================================================
// Period Calculation
// =============================================================================

/**
 * Get the current billing period (calendar month)
 */
export function getCurrentBillingPeriod(): BillingPeriod {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

/**
 * Get billing period for a specific month
 */
export function getBillingPeriod(year: number, month: number): BillingPeriod {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

// =============================================================================
// Snapshot Generation
// =============================================================================

/**
 * Generate a billing snapshot for an organization and period
 * Reads usage_events, aggregates by type, and saves snapshot
 */
export async function generateBillingSnapshot(
  orgId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<BillingSnapshot> {
  const db = getDb();

  // Get organization to determine plan
  const org = await getOrganizationById(orgId);
  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  // Map legacy plan names to new plan IDs
  const planIdMap: Record<string, PlanId> = {
    beta: 'free',
    starter: 'starter',
    growth: 'growth',
    enterprise: 'enterprise',
  };
  const planId = planIdMap[org.plan] || 'free';

  // Query usage events for the period
  const snapshot = await db
    .collection(COLLECTIONS.usageEvents(orgId))
    .where('occurredAt', '>=', periodStart)
    .where('occurredAt', '<', periodEnd)
    .get();

  // Aggregate by event type
  const totals = {
    forecast_calls: 0,
    alerts_fired: 0,
    metrics_ingested: 0,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshot.docs.forEach((doc: any) => {
    const event = doc.data() as UsageEvent;
    switch (event.eventType) {
      case 'forecast_call':
        totals.forecast_calls += event.quantity;
        break;
      case 'alert_fired':
        totals.alerts_fired += event.quantity;
        break;
      case 'metric_ingested':
        totals.metrics_ingested += event.quantity;
        break;
    }
  });

  // Create billing snapshot
  const billingSnapshot: BillingSnapshot = {
    id: generateId('billing'),
    orgId,
    planId,
    periodStart,
    periodEnd,
    totals,
    createdAt: new Date(),
  };

  // Save to Firestore
  await db
    .collection(COLLECTIONS.billingSnapshots(orgId))
    .doc(billingSnapshot.id)
    .set(billingSnapshot);

  console.log(
    `[Billing] Generated snapshot for org ${orgId}, period ${periodStart.toISOString()} - ${periodEnd.toISOString()}`
  );
  console.log(`[Billing] Totals:`, totals);

  return billingSnapshot;
}

// =============================================================================
// Snapshot Retrieval
// =============================================================================

/**
 * Get billing snapshots for an organization
 * Returns most recent snapshots first
 */
export async function getBillingSnapshots(
  orgId: string,
  limit: number = 12
): Promise<BillingSnapshot[]> {
  const db = getDb();

  const snapshot = await db
    .collection(COLLECTIONS.billingSnapshots(orgId))
    .orderBy('periodStart', 'desc')
    .limit(limit)
    .get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snapshot.docs.map((doc: any) => doc.data() as BillingSnapshot);
}

/**
 * Get a specific billing snapshot by ID
 */
export async function getBillingSnapshotById(
  orgId: string,
  snapshotId: string
): Promise<BillingSnapshot | null> {
  const db = getDb();

  const doc = await db
    .collection(COLLECTIONS.billingSnapshots(orgId))
    .doc(snapshotId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as BillingSnapshot;
}

// =============================================================================
// Current Period Usage
// =============================================================================

/**
 * Get current billing period usage with projections
 */
export async function getCurrentPeriodUsage(
  orgId: string
): Promise<CurrentPeriodUsage> {
  const db = getDb();
  const period = getCurrentBillingPeriod();
  const now = new Date();

  // Get organization to determine plan
  const org = await getOrganizationById(orgId);
  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  // Map legacy plan names to new plan IDs
  const planIdMap: Record<string, PlanId> = {
    beta: 'free',
    starter: 'starter',
    growth: 'growth',
    enterprise: 'enterprise',
  };
  const planId = planIdMap[org.plan] || 'free';

  // Query usage events for current period
  const snapshot = await db
    .collection(COLLECTIONS.usageEvents(orgId))
    .where('occurredAt', '>=', period.start)
    .where('occurredAt', '<', now)
    .get();

  // Aggregate by event type
  const usage = {
    forecast_calls: 0,
    alerts_fired: 0,
    metrics_ingested: 0,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshot.docs.forEach((doc: any) => {
    const event = doc.data() as UsageEvent;
    switch (event.eventType) {
      case 'forecast_call':
        usage.forecast_calls += event.quantity;
        break;
      case 'alert_fired':
        usage.alerts_fired += event.quantity;
        break;
      case 'metric_ingested':
        usage.metrics_ingested += event.quantity;
        break;
    }
  });

  // Calculate projections
  const daysInPeriod = Math.ceil(
    (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysElapsed = Math.ceil(
    (now.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const projectionFactor = daysElapsed > 0 ? daysInPeriod / daysElapsed : 1;

  const projectedMonthly = {
    forecast_calls: Math.ceil(usage.forecast_calls * projectionFactor),
    alerts_fired: Math.ceil(usage.alerts_fired * projectionFactor),
    metrics_ingested: Math.ceil(usage.metrics_ingested * projectionFactor),
  };

  return {
    orgId,
    planId,
    periodStart: period.start,
    periodEnd: period.end,
    usage,
    daysInPeriod,
    daysElapsed,
    projectedMonthly,
  };
}
