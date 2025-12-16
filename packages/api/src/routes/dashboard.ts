/**
 * Dashboard Routes
 *
 * Phase 10: Sellable Alpha Shell
 * Beads Task: intentvision-9xn
 *
 * API endpoints for the dashboard UI.
 * Provides stats, alerts, and organization info.
 *
 * Endpoints:
 * - GET /v1/dashboard - Get dashboard overview
 * - GET /v1/dashboard/alerts - Get recent alerts
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { getDb } from '../firestore/client.js';
import { COLLECTIONS } from '../firestore/schema.js';
import { getUserByAuthUid, getOrganizationById } from '../services/org-service.js';
import { getDashboardStats } from '../services/usage-service.js';
import { extractFirebaseToken } from '../auth/firebase-auth.js';

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

interface DashboardOverview {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  usage: {
    metrics: {
      current: number;
      limit: number;
      percentage: number;
    };
    alerts: {
      current: number;
      limit: number;
      percentage: number;
    };
    forecastsToday: {
      current: number;
      limit: number;
      percentage: number;
    };
  };
  recentAlerts: AlertSummary[];
}

interface AlertSummary {
  id: string;
  metricName: string;
  triggeredAt: string;
  triggerValue: number;
  threshold: number;
  delivered: boolean;
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
// GET /v1/dashboard - Dashboard Overview
// =============================================================================

/**
 * Get dashboard overview including org info, usage stats, and recent alerts
 */
export async function handleGetDashboard(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = generateRequestId();

  try {
    // Get Firebase auth context
    const authContext = await extractFirebaseToken(req);
    if (!authContext) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Authentication required',
      });
      return;
    }

    // Get user from database
    const user = await getUserByAuthUid(authContext.uid);
    if (!user) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'User not found',
      });
      return;
    }

    // Get organization
    const organization = await getOrganizationById(user.organizationId);
    if (!organization) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Organization not found',
      });
      return;
    }

    // Get usage stats
    const stats = await getDashboardStats(user.organizationId);
    if (!stats) {
      sendJson(res, 500, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Failed to get usage stats',
      });
      return;
    }

    // Get recent alerts (last 5)
    const db = getDb();
    const alertsSnapshot = await db
      .collection(COLLECTIONS.alertEvents(user.organizationId))
      .orderBy('triggeredAt', 'desc')
      .limit(5)
      .get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentAlerts: AlertSummary[] = alertsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: data.id,
        metricName: data.metricName,
        triggeredAt: data.triggeredAt?.toDate?.()?.toISOString() || data.triggeredAt,
        triggerValue: data.triggerValue,
        threshold: data.threshold,
        delivered: data.deliveryStatus === 'sent',
      };
    });

    // Map legacy plan to new plan ID
    const planIdMap: Record<string, string> = {
      beta: 'free',
      starter: 'starter',
      growth: 'growth',
      enterprise: 'enterprise',
    };

    const overview: DashboardOverview = {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: planIdMap[organization.plan] || 'free',
      },
      usage: {
        metrics: {
          current: stats.usage.metrics.current,
          limit: stats.usage.metrics.limit,
          percentage: Math.round((stats.usage.metrics.current / stats.usage.metrics.limit) * 100),
        },
        alerts: {
          current: stats.usage.alerts.current,
          limit: stats.usage.alerts.limit,
          percentage: Math.round((stats.usage.alerts.current / stats.usage.alerts.limit) * 100),
        },
        forecastsToday: {
          current: stats.usage.forecastsToday.current,
          limit: stats.usage.forecastsToday.limit,
          percentage: Math.round(
            (stats.usage.forecastsToday.current / stats.usage.forecastsToday.limit) * 100
          ),
        },
      },
      recentAlerts,
    };

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: overview,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Dashboard error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

// =============================================================================
// GET /v1/dashboard/alerts - All Alerts
// =============================================================================

/**
 * Get all alerts with pagination
 */
export async function handleGetDashboardAlerts(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = generateRequestId();

  try {
    // Get Firebase auth context
    const authContext = await extractFirebaseToken(req);
    if (!authContext) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Authentication required',
      });
      return;
    }

    // Get user from database
    const user = await getUserByAuthUid(authContext.uid);
    if (!user) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'User not found',
      });
      return;
    }

    // Parse query params
    const url = new URL(req.url || '/', `http://localhost`);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    // Get alerts
    const db = getDb();
    const alertsSnapshot = await db
      .collection(COLLECTIONS.alertEvents(user.organizationId))
      .orderBy('triggeredAt', 'desc')
      .limit(limit)
      .get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alerts = alertsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: data.id,
        ruleId: data.ruleId,
        metricName: data.metricName,
        triggeredAt: data.triggeredAt?.toDate?.()?.toISOString() || data.triggeredAt,
        triggerValue: data.triggerValue,
        threshold: data.threshold,
        direction: data.direction,
        deliveryStatus: data.deliveryStatus,
        channelResults: data.channelResults,
      };
    });

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        alerts,
        total: alerts.length,
        limit,
      },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Dashboard alerts error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}
