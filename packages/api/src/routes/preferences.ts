/**
 * User Preferences Routes
 *
 * Phase 10: Sellable Alpha Shell
 * Beads Task: intentvision-s4z
 *
 * Endpoints for managing user notification preferences.
 *
 * Endpoints:
 * - GET  /v1/me/preferences/notifications - Get notification preferences
 * - PUT  /v1/me/preferences/notifications - Update notification preferences
 * - POST /v1/me/preferences/notifications/test - Send test notification
 */

import type { IncomingMessage, ServerResponse } from 'http';
import {
  getUserNotificationPreferences,
  upsertUserNotificationPreferences,
  resolveNotificationConfig,
  type UpdatePreferencesRequest,
} from '../services/user-preferences-service.js';
import { getUserByAuthUid } from '../services/org-service.js';
import { canUseSlack, canUseWebhook } from '../services/usage-service.js';
import { dispatchAlert, type AlertEvent } from '../notifications/index.js';
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

// =============================================================================
// Utilities
// =============================================================================

function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson<T>(res: ServerResponse, statusCode: number, data: ApiResponse<T>): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// =============================================================================
// GET /v1/me/preferences/notifications
// =============================================================================

/**
 * Get current user's notification preferences
 */
export async function handleGetNotificationPreferences(
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

    // Get preferences
    const preferences = await getUserNotificationPreferences(user.id);

    // Check plan features
    const slackAllowed = await canUseSlack(user.organizationId);
    const webhookAllowed = await canUseWebhook(user.organizationId);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        preferences: {
          email: preferences.email,
          slack: {
            ...preferences.slack,
            available: slackAllowed,
          },
          webhook: {
            ...preferences.webhook,
            available: webhookAllowed,
          },
        },
        updatedAt: preferences.updatedAt,
      },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get preferences error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

// =============================================================================
// PUT /v1/me/preferences/notifications
// =============================================================================

/**
 * Update current user's notification preferences
 */
export async function handleUpdateNotificationPreferences(
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

    // Parse request body
    const body = await parseBody<UpdatePreferencesRequest>(req);

    // Check plan features before enabling
    if (body.slack?.enabled) {
      const slackAllowed = await canUseSlack(user.organizationId);
      if (!slackAllowed) {
        sendJson(res, 403, {
          success: false,
          requestId,
          timestamp: new Date().toISOString(),
          error: 'Slack notifications require a paid plan',
        });
        return;
      }
    }

    if (body.webhook?.enabled) {
      const webhookAllowed = await canUseWebhook(user.organizationId);
      if (!webhookAllowed) {
        sendJson(res, 403, {
          success: false,
          requestId,
          timestamp: new Date().toISOString(),
          error: 'Webhook notifications require a paid plan',
        });
        return;
      }
    }

    // Update preferences
    const updated = await upsertUserNotificationPreferences(user.id, body);

    console.log(`[${requestId}] Updated preferences for user: ${user.id}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        preferences: {
          email: updated.email,
          slack: updated.slack,
          webhook: updated.webhook,
        },
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Update preferences error:`, errorMessage);

    sendJson(res, 400, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

// =============================================================================
// POST /v1/me/preferences/notifications/test
// =============================================================================

/**
 * Send a test notification to the current user
 */
export async function handleSendTestNotification(
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

    // Get resolved notification config
    const config = await resolveNotificationConfig(user.id);

    // Check if any channel is enabled
    if (!config.emailEnabled && !config.slackEnabled && !config.webhookEnabled) {
      sendJson(res, 400, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'No notification channels enabled. Enable at least one channel first.',
      });
      return;
    }

    // Create a test alert event
    const testAlert: AlertEvent = {
      orgId: user.organizationId,
      metricKey: 'system:test',
      severity: 'info',
      title: 'Test Notification',
      message: `This is a test notification from IntentVision. If you received this, your notification settings are working correctly.`,
      context: {
        userId: user.id,
        userEmail: user.email,
        testId: requestId,
        timestamp: new Date().toISOString(),
      },
      occurredAt: new Date().toISOString(),
    };

    // Dispatch the test alert
    const result = await dispatchAlert(testAlert);

    console.log(`[${requestId}] Test notification sent for user: ${user.id}, channels: ${result.channelsNotified}/${result.channelsSelected}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        testId: requestId,
        channelsSelected: result.channelsSelected,
        channelsNotified: result.channelsNotified,
        channelsFailed: result.channelsFailed,
        results: result.results.map((r) => ({
          channel: r.channelType,
          success: r.success,
          error: r.error,
        })),
      },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Test notification error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}
