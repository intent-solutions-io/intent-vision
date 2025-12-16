/**
 * Admin Usage Routes
 *
 * Phase 11: Usage Metering + Plan Enforcement
 * Beads Task: intentvision-fo8
 *
 * Endpoints:
 * - GET /admin/orgs/:orgId/usage/today - Today's usage for an org
 * - GET /admin/orgs/:orgId/usage/last-30d - Last 30 days usage
 * - GET /admin/orgs/:orgId/usage/overview - Comprehensive usage overview
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { type AuthContext, hasScopeV1 } from '../auth/api-key.js';
import {
  getTodayUsage,
  getLast30DaysUsage,
  getAdminUsageOverview,
} from '../services/metering-service.js';

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
// GET /admin/orgs/:orgId/usage/today
// =============================================================================

export async function handleGetTodayUsage(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  targetOrgId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Require admin scope for admin endpoints
    if (!hasScopeV1(authContext, 'admin')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: admin',
      });
      return;
    }

    // Get today's usage
    const usage = await getTodayUsage(targetOrgId);

    console.log(`[${requestId}] Retrieved today's usage for org ${targetOrgId}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: usage,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get today usage error:`, errorMessage);

    sendJson(res, 400, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}

// =============================================================================
// GET /admin/orgs/:orgId/usage/last-30d
// =============================================================================

export async function handleGetLast30DaysUsage(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  targetOrgId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Require admin scope for admin endpoints
    if (!hasScopeV1(authContext, 'admin')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: admin',
      });
      return;
    }

    // Get last 30 days usage
    const usage = await getLast30DaysUsage(targetOrgId);

    console.log(`[${requestId}] Retrieved last 30 days usage for org ${targetOrgId}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: usage,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get last 30 days usage error:`, errorMessage);

    sendJson(res, 400, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}

// =============================================================================
// GET /admin/orgs/:orgId/usage/overview
// =============================================================================

export async function handleGetUsageOverview(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  targetOrgId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Require admin scope for admin endpoints
    if (!hasScopeV1(authContext, 'admin')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: admin',
      });
      return;
    }

    // Get comprehensive usage overview
    const overview = await getAdminUsageOverview(targetOrgId);

    console.log(`[${requestId}] Retrieved usage overview for org ${targetOrgId}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: overview,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get usage overview error:`, errorMessage);

    sendJson(res, 400, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}

// =============================================================================
// Route Extractor
// =============================================================================

/**
 * Extract org ID from admin usage route path
 * Pattern: /admin/orgs/:orgId/usage/*
 */
export function extractAdminUsageParams(pathname: string): { orgId: string; endpoint: string } | null {
  const match = pathname.match(/^\/admin\/orgs\/([^/]+)\/usage\/(.+)$/);
  if (match) {
    return {
      orgId: match[1],
      endpoint: match[2],
    };
  }
  return null;
}
