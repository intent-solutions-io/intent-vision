/**
 * Billing Routes (/owner/billing)
 *
 * Phase 12: Billing Backend
 * Beads Task: intentvision-[phase12]
 *
 * These endpoints are for organization owners to view billing data.
 * They use Firebase Auth tokens and require owner role.
 *
 * Endpoints:
 * - GET /owner/billing/summary - Get billing summary with current usage and past periods
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { extractFirebaseAuth, getUserContext } from './me.js';
import {
  getBillingSnapshots,
  getCurrentPeriodUsage,
} from '../services/billing-service.js';
import { getStripeClient, STRIPE_PLAN_MAP } from '../billing/stripe-client.js';
import { getPlan, type PlanId } from '../models/plan.js';

// =============================================================================
// Types
// =============================================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  requestId: string;
  timestamp: string;
  data?: T;
  error?: string;
  durationMs?: number;
}

interface BillingSummaryResponse {
  organization: {
    id: string;
    name: string;
    plan: string;
  };
  currentPeriod: {
    periodStart: string;
    periodEnd: string;
    daysElapsed: number;
    daysInPeriod: number;
    usage: {
      forecast_calls: number;
      alerts_fired: number;
      metrics_ingested: number;
    };
    projectedMonthly: {
      forecast_calls: number;
      alerts_fired: number;
      metrics_ingested: number;
    };
  };
  planLimits: {
    maxMetrics: number;
    maxAlerts: number;
    maxForecastsPerDay: number;
  };
  pastPeriods: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    planId: string;
    totals: {
      forecast_calls: number;
      alerts_fired: number;
      metrics_ingested: number;
    };
  }>;
  stripe: {
    enabled: boolean;
    priceId?: string;
    planMap: Record<string, string>;
  };
}

// =============================================================================
// Utilities
// =============================================================================

function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sendJson<T>(res: ServerResponse, statusCode: number, data: ApiResponse<T>): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// =============================================================================
// GET /owner/billing/summary
// =============================================================================

/**
 * Get billing summary for organization owner
 * Requires: owner role
 */
export async function handleGetBillingSummary(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Extract Firebase Auth UID
    const authResult = await extractFirebaseAuth(req);
    if ('error' in authResult) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: authResult.error,
      });
      return;
    }

    // Get user context
    const context = await getUserContext(authResult.authUid);
    if (!context) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'User not found or not associated with an organization',
      });
      return;
    }

    // Check if user is an owner
    if (context.user.role !== 'owner') {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Only organization owners can access billing information',
      });
      return;
    }

    const orgId = context.organization.id;

    console.log(`[${requestId}] GET /owner/billing/summary - org: ${orgId}`);

    // Get current period usage
    const currentPeriod = await getCurrentPeriodUsage(orgId);

    // Get past billing snapshots (last 12 months)
    const pastSnapshots = await getBillingSnapshots(orgId, 12);

    // Get plan limits
    const planIdMap: Record<string, PlanId> = {
      beta: 'free',
      starter: 'starter',
      growth: 'growth',
      enterprise: 'enterprise',
    };
    const planId = planIdMap[context.organization.plan] || 'free';
    const plan = getPlan(planId);

    // Get Stripe configuration
    getStripeClient(); // Initialize client (stubbed for now)
    const stripePriceId = STRIPE_PLAN_MAP[planId];

    // Build response
    const summary: BillingSummaryResponse = {
      organization: {
        id: context.organization.id,
        name: context.organization.name,
        plan: context.organization.plan,
      },
      currentPeriod: {
        periodStart: currentPeriod.periodStart.toISOString(),
        periodEnd: currentPeriod.periodEnd.toISOString(),
        daysElapsed: currentPeriod.daysElapsed,
        daysInPeriod: currentPeriod.daysInPeriod,
        usage: currentPeriod.usage,
        projectedMonthly: currentPeriod.projectedMonthly,
      },
      planLimits: {
        maxMetrics: plan?.limits.maxMetrics || 0,
        maxAlerts: plan?.limits.maxAlerts || 0,
        maxForecastsPerDay: plan?.limits.maxForecastsPerDay || 0,
      },
      pastPeriods: pastSnapshots.map((snapshot) => ({
        id: snapshot.id,
        periodStart: snapshot.periodStart.toISOString(),
        periodEnd: snapshot.periodEnd.toISOString(),
        planId: snapshot.planId,
        totals: snapshot.totals,
      })),
      stripe: {
        enabled: false, // Stripe is stubbed for now
        priceId: stripePriceId,
        planMap: STRIPE_PLAN_MAP,
      },
    };

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: summary,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get billing summary error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}
