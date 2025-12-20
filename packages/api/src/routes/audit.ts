/**
 * Audit Routes
 *
 * Phase 15: Team Access, RBAC, and Audit Logging
 *
 * Endpoints:
 * - GET /orgs/self/audit-logs - Query audit logs (admin+)
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { requireFirebaseAuth } from '../auth/firebase-auth.js';
import { requirePermission } from '../auth/rbac.js';
import { getUserByAuthUid } from '../services/org-service.js';
import { getAuditLogs, type GetAuditLogsOptions } from '../services/audit-service.js';
import type { AuditAction } from '../firestore/schema.js';

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

function parseUrl(req: IncomingMessage): URL {
  return new URL(req.url || '/', `http://localhost`);
}

// =============================================================================
// GET /orgs/self/audit-logs - Query Audit Logs
// =============================================================================

export async function handleGetAuditLogs(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Require Firebase authentication
    const authContext = await requireFirebaseAuth(req);
    if (!authContext) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Authentication required',
      });
      return;
    }

    // Get user from auth UID
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

    // Check permission - admin+ required to view audit logs
    await requirePermission(user.organizationId, user.id, 'audit:read');

    // Parse query parameters
    const url = parseUrl(req);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const beforeStr = url.searchParams.get('before');
    const action = url.searchParams.get('action') as AuditAction | null;
    const userId = url.searchParams.get('userId');
    const resourceType = url.searchParams.get('resourceType');

    // Build options
    const options: GetAuditLogsOptions = {
      limit: Math.min(limit, 100), // Cap at 100
    };

    if (beforeStr) {
      const beforeDate = new Date(beforeStr);
      if (!isNaN(beforeDate.getTime())) {
        options.before = beforeDate;
      }
    }

    if (action) {
      options.action = action;
    }

    if (userId) {
      options.userId = userId;
    }

    if (resourceType) {
      options.resourceType = resourceType;
    }

    // Get audit logs
    const logs = await getAuditLogs(user.organizationId, options);

    console.log(`[${requestId}] Retrieved ${logs.length} audit logs`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          userId: log.userId,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          metadata: log.metadata,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          createdAt: log.createdAt,
        })),
        total: logs.length,
        hasMore: logs.length === options.limit,
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get audit logs error:`, errorMessage);

    const statusCode = errorMessage.includes('Insufficient permissions') ? 403 : 400;

    sendJson(res, statusCode, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}
