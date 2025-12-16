/**
 * Alert Routes
 *
 * Phase 2: Email Alerts via Resend
 * Phase 4: User-configurable notification channels
 * Beads Tasks: intentvision-8aj.3, intentvision-8aj.4, intentvision-p88
 *
 * Endpoints:
 * - POST   /v1/alerts           - Create alert rule (Phase 4)
 * - GET    /v1/alerts           - List alert rules (Phase 4)
 * - GET    /v1/alerts/:id       - Get alert rule (Phase 4)
 * - PATCH  /v1/alerts/:id       - Update alert rule (Phase 4)
 * - DELETE /v1/alerts/:id       - Delete alert rule (Phase 4)
 * - POST   /v1/alerts/evaluate  - Evaluate alerts against latest forecasts
 *
 * Legacy routes still supported:
 * - POST   /v1/alerts/rules           - Create alert rule (Phase 2)
 * - GET    /v1/alerts/rules           - List alert rules (Phase 2)
 * - etc.
 *
 * Phase 4 Features:
 * - User-configurable notification channels (email, slack future, webhook future)
 * - Condition-based alerts (operator: gt, lt, gte, lte)
 * - Multi-channel delivery with per-channel results
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { getDb, generateId } from '../firestore/client.js';
import {
  COLLECTIONS,
  type AlertRule,
  type AlertEvent,
  type Forecast,
  type CreateAlertRuleRequest,
  type UpdateAlertRuleRequest,
  type AlertRuleResponse,
  type ListAlertRulesResponse,
  type EvaluateAlertsRequest,
  type EvaluateAlertsResponse,
  type NotificationChannel,
  type ChannelDeliveryResult,
  type AlertDeliveryStatus,
} from '../firestore/schema.js';
import { type AuthContext, hasScopeV1 } from '../auth/api-key.js';
import {
  sendAlertEmail,
  buildAlertEmailContent,
  isResendConfigured,
  deliverToEmailChannel,
} from '../notifications/resend.js';
import { recordUsageEvent } from '../services/metering-service.js';

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

async function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {} as T);
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

function parseUrl(req: IncomingMessage): URL {
  return new URL(req.url || '/', `http://localhost`);
}

function extractRuleId(pathname: string): string | null {
  // Pattern: /v1/alerts/rules/:id
  const match = pathname.match(/^\/v1\/alerts\/rules\/([^/]+)$/);
  return match ? match[1] : null;
}

// =============================================================================
// POST /v1/alerts/rules - Create Alert Rule
// =============================================================================

export async function handleCreateAlertRule(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - need admin or alerts:write scope to manage rules
    if (!hasScopeV1(authContext, 'alerts:write')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: alerts:write or admin',
      });
      return;
    }

    // Parse request
    const body = await parseBody<CreateAlertRuleRequest>(req);
    const {
      name,
      metricName,
      type = 'threshold',
      condition,
      direction,
      threshold,
      severityThreshold,
      horizonDays = 7,
      channels,
      email,
      enabled = true,
      description,
    } = body;

    // Validate required fields
    if (!metricName || typeof metricName !== 'string') {
      throw new Error('metricName is required and must be a string');
    }

    // Validate alert condition - support both legacy and new formats
    let finalCondition: { operator: 'gt' | 'lt' | 'gte' | 'lte'; value: number } | undefined;
    let finalDirection: 'above' | 'below' | undefined;
    let finalThreshold: number | undefined;

    if (condition) {
      // New condition-based format
      if (!condition.operator || !['gt', 'lt', 'gte', 'lte'].includes(condition.operator)) {
        throw new Error('condition.operator must be one of: gt, lt, gte, lte');
      }
      if (condition.value === undefined || typeof condition.value !== 'number') {
        throw new Error('condition.value is required and must be a number');
      }
      finalCondition = condition;
      // Map condition to legacy format for backward compatibility
      finalDirection = condition.operator === 'gt' || condition.operator === 'gte' ? 'above' : 'below';
      finalThreshold = condition.value;
    } else if (direction && threshold !== undefined) {
      // Legacy direction/threshold format
      if (!['above', 'below'].includes(direction)) {
        throw new Error('direction must be "above" or "below"');
      }
      if (typeof threshold !== 'number') {
        throw new Error('threshold must be a number');
      }
      finalDirection = direction;
      finalThreshold = threshold;
      // Map legacy to new condition format
      finalCondition = {
        operator: direction === 'above' ? 'gt' : 'lt',
        value: threshold,
      };
    } else {
      throw new Error('Either condition or direction+threshold is required');
    }

    // Validate notification channels
    let finalChannels: NotificationChannel[] = [];
    let finalEmail: string | undefined;

    if (channels && channels.length > 0) {
      // New user-configurable channels
      for (const channel of channels) {
        if (!channel.type) {
          throw new Error('Each channel must have a type');
        }
        if (channel.type === 'email' && (!channel.to || channel.to.length === 0)) {
          throw new Error('Email channel must have at least one recipient in "to"');
        }
        // Validate email addresses
        if (channel.type === 'email' && channel.to) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          for (const addr of channel.to) {
            if (!emailRegex.test(addr)) {
              throw new Error(`Invalid email format: ${addr}`);
            }
          }
        }
      }
      finalChannels = channels.map(ch => ({
        ...ch,
        enabled: ch.enabled !== false,
      }));
    } else if (email) {
      // Legacy single email format - convert to channel
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }
      finalEmail = email;
      finalChannels = [{
        type: 'email',
        to: [email],
        isPrimary: true,
        enabled: true,
      }];
    } else {
      throw new Error('Either channels or email is required');
    }

    const { orgId } = authContext;
    const db = getDb();

    // Create alert rule
    const ruleId = generateId('rule');
    const now = new Date();

    const rule: AlertRule = {
      id: ruleId,
      orgId,
      name: name || `Alert for ${metricName}`,
      metricName,
      type,
      condition: finalCondition,
      direction: finalDirection,
      threshold: finalThreshold,
      severityThreshold,
      horizonDays,
      channels: finalChannels,
      email: finalEmail,
      enabled,
      description,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(COLLECTIONS.alertRules(orgId)).doc(ruleId).set(rule);

    console.log(`[${requestId}] Created alert rule ${ruleId} for metric ${metricName}`);

    const responseData: AlertRuleResponse = { alert: rule };

    sendJson(res, 201, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Create alert rule error:`, errorMessage);

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
// GET /v1/alerts/rules - List Alert Rules
// =============================================================================

export async function handleListAlertRules(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - need alerts:read or read (legacy) or admin
    if (!hasScopeV1(authContext, 'alerts:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: alerts:read or admin',
      });
      return;
    }

    // Parse query params
    const url = parseUrl(req);
    const metricName = url.searchParams.get('metricName');
    const enabledOnly = url.searchParams.get('enabledOnly') === 'true';

    const { orgId } = authContext;
    const db = getDb();

    // Build query
    const query = db.collection(COLLECTIONS.alertRules(orgId)).orderBy('createdAt', 'desc');

    const rulesSnapshot = await query.get();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let alerts: AlertRule[] = rulesSnapshot.docs.map((doc: any) => doc.data() as AlertRule);

    // Apply filters (Firestore doesn't support multiple inequality filters)
    if (metricName) {
      alerts = alerts.filter((r) => r.metricName === metricName);
    }
    if (enabledOnly) {
      alerts = alerts.filter((r) => r.enabled);
    }

    console.log(`[${requestId}] Listed ${alerts.length} alert rules`);

    const responseData: ListAlertRulesResponse = {
      alerts,
      total: alerts.length,
    };

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] List alert rules error:`, errorMessage);

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
// GET /v1/alerts/rules/:id - Get Alert Rule
// =============================================================================

export async function handleGetAlertRule(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  ruleId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - need alerts:read or admin
    if (!hasScopeV1(authContext, 'alerts:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: alerts:read or admin',
      });
      return;
    }

    const { orgId } = authContext;
    const db = getDb();

    // Get rule
    const ruleDoc = await db.collection(COLLECTIONS.alertRules(orgId)).doc(ruleId).get();

    if (!ruleDoc.exists) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Alert rule '${ruleId}' not found`,
      });
      return;
    }

    const alert = ruleDoc.data() as AlertRule;

    console.log(`[${requestId}] Retrieved alert rule ${ruleId}`);

    const responseData: AlertRuleResponse = { alert };

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get alert rule error:`, errorMessage);

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
// PATCH /v1/alerts/rules/:id - Update Alert Rule
// =============================================================================

export async function handleUpdateAlertRule(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  ruleId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - need alerts:write or admin
    if (!hasScopeV1(authContext, 'alerts:write')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: alerts:write or admin',
      });
      return;
    }

    // Parse request
    const body = await parseBody<UpdateAlertRuleRequest>(req);

    const { orgId } = authContext;
    const db = getDb();

    // Get existing rule
    const ruleRef = db.collection(COLLECTIONS.alertRules(orgId)).doc(ruleId);
    const ruleDoc = await ruleRef.get();

    if (!ruleDoc.exists) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Alert rule '${ruleId}' not found`,
      });
      return;
    }

    // Build update object
    const updates: Partial<AlertRule> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) {
      updates.name = body.name;
    }

    if (body.metricName !== undefined) {
      if (typeof body.metricName !== 'string') {
        throw new Error('metricName must be a string');
      }
      updates.metricName = body.metricName;
    }

    if (body.type !== undefined) {
      if (!['threshold', 'anomaly'].includes(body.type)) {
        throw new Error('type must be "threshold" or "anomaly"');
      }
      updates.type = body.type;
    }

    // Handle new condition-based format
    if (body.condition !== undefined) {
      if (!body.condition.operator || !['gt', 'lt', 'gte', 'lte'].includes(body.condition.operator)) {
        throw new Error('condition.operator must be one of: gt, lt, gte, lte');
      }
      if (body.condition.value === undefined || typeof body.condition.value !== 'number') {
        throw new Error('condition.value must be a number');
      }
      updates.condition = body.condition;
      // Update legacy fields for backward compatibility
      updates.direction = body.condition.operator === 'gt' || body.condition.operator === 'gte' ? 'above' : 'below';
      updates.threshold = body.condition.value;
    }

    // Handle legacy direction/threshold format
    if (body.direction !== undefined) {
      if (!['above', 'below'].includes(body.direction)) {
        throw new Error('direction must be "above" or "below"');
      }
      updates.direction = body.direction;
    }

    if (body.threshold !== undefined) {
      if (typeof body.threshold !== 'number') {
        throw new Error('threshold must be a number');
      }
      updates.threshold = body.threshold;
    }

    if (body.severityThreshold !== undefined) {
      updates.severityThreshold = body.severityThreshold;
    }

    if (body.horizonDays !== undefined) {
      if (typeof body.horizonDays !== 'number' || body.horizonDays < 1) {
        throw new Error('horizonDays must be a positive number');
      }
      updates.horizonDays = body.horizonDays;
    }

    // Handle user-configurable channels
    if (body.channels !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const channel of body.channels) {
        if (!channel.type) {
          throw new Error('Each channel must have a type');
        }
        if (channel.type === 'email' && channel.to) {
          for (const addr of channel.to) {
            if (!emailRegex.test(addr)) {
              throw new Error(`Invalid email format: ${addr}`);
            }
          }
        }
      }
      updates.channels = body.channels.map(ch => ({
        ...ch,
        enabled: ch.enabled !== false,
      }));
    }

    // Handle legacy single email
    if (body.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        throw new Error('Invalid email format');
      }
      updates.email = body.email;
    }

    if (body.enabled !== undefined) {
      updates.enabled = !!body.enabled;
    }

    if (body.description !== undefined) {
      updates.description = body.description;
    }

    await ruleRef.update(updates);

    // Get updated rule
    const updatedDoc = await ruleRef.get();
    const alert = updatedDoc.data() as AlertRule;

    console.log(`[${requestId}] Updated alert rule ${ruleId}`);

    const responseData: AlertRuleResponse = { alert };

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Update alert rule error:`, errorMessage);

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
// DELETE /v1/alerts/rules/:id - Delete Alert Rule
// =============================================================================

export async function handleDeleteAlertRule(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  ruleId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - need alerts:write or admin
    if (!hasScopeV1(authContext, 'alerts:write')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: alerts:write or admin',
      });
      return;
    }

    const { orgId } = authContext;
    const db = getDb();

    // Check if rule exists
    const ruleRef = db.collection(COLLECTIONS.alertRules(orgId)).doc(ruleId);
    const ruleDoc = await ruleRef.get();

    if (!ruleDoc.exists) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Alert rule '${ruleId}' not found`,
      });
      return;
    }

    await ruleRef.delete();

    console.log(`[${requestId}] Deleted alert rule ${ruleId}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: { deleted: true, ruleId },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Delete alert rule error:`, errorMessage);

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
// POST /v1/alerts/evaluate - Evaluate Alerts
// =============================================================================

export async function handleEvaluateAlerts(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - need alerts:write or admin to evaluate alerts
    if (!hasScopeV1(authContext, 'alerts:write')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: alerts:write or admin',
      });
      return;
    }

    // Parse request
    const body = await parseBody<EvaluateAlertsRequest>(req);
    const { metricName: filterMetricName } = body;

    const { orgId } = authContext;
    const db = getDb();

    // Get all enabled alert rules
    const rulesSnapshot = await db
      .collection(COLLECTIONS.alertRules(orgId))
      .where('enabled', '==', true)
      .get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rules: AlertRule[] = rulesSnapshot.docs.map((doc: any) => doc.data() as AlertRule);

    // Filter by metric if specified
    if (filterMetricName) {
      rules = rules.filter((r) => r.metricName === filterMetricName);
    }

    const results: EvaluateAlertsResponse['results'] = [];

    // Check if Resend is configured
    const resendConfigured = isResendConfigured();
    if (!resendConfigured) {
      console.warn(`[${requestId}] RESEND_API_KEY not configured - emails will be skipped`);
    }

    // Evaluate each rule
    for (const rule of rules) {
      try {
        // Get latest forecast for this metric
        const forecastsSnapshot = await db
          .collection(COLLECTIONS.forecasts(orgId))
          .where('metricName', '==', rule.metricName)
          .where('status', '==', 'completed')
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (forecastsSnapshot.empty) {
          results.push({
            ruleId: rule.id,
            metricName: rule.metricName,
            triggered: false,
            threshold: rule.threshold ?? 0,
            direction: rule.direction,
            condition: rule.condition,
            emailSent: false,
            error: 'No completed forecast found',
          });
          continue;
        }

        const forecast = forecastsSnapshot.docs[0].data() as Forecast;

        // Find predictions within the rule's horizon
        const now = new Date();
        const horizonEnd = new Date(now.getTime() + rule.horizonDays * 24 * 60 * 60 * 1000);

        const relevantPredictions = forecast.predictions.filter((p) => {
          const predTime = new Date(p.timestamp);
          return predTime >= now && predTime <= horizonEnd;
        });

        if (relevantPredictions.length === 0) {
          results.push({
            ruleId: rule.id,
            metricName: rule.metricName,
            triggered: false,
            threshold: rule.threshold ?? 0,
            direction: rule.direction,
            condition: rule.condition,
            emailSent: false,
            error: 'No predictions within horizon',
          });
          continue;
        }

        // Check if any prediction triggers the rule
        let triggered = false;
        let triggerValue: number | undefined;

        for (const prediction of relevantPredictions) {
          // Support new condition-based format
          if (rule.condition) {
            const { operator, value } = rule.condition;
            const pv = prediction.predictedValue;
            if (
              (operator === 'gt' && pv > value) ||
              (operator === 'gte' && pv >= value) ||
              (operator === 'lt' && pv < value) ||
              (operator === 'lte' && pv <= value)
            ) {
              triggered = true;
              triggerValue = pv;
              break;
            }
          } else if (rule.direction && rule.threshold !== undefined) {
            // Legacy direction-based format
            if (rule.direction === 'above' && prediction.predictedValue > rule.threshold) {
              triggered = true;
              triggerValue = prediction.predictedValue;
              break;
            } else if (rule.direction === 'below' && prediction.predictedValue < rule.threshold) {
              triggered = true;
              triggerValue = prediction.predictedValue;
              break;
            }
          }
        }

        if (!triggered) {
          results.push({
            ruleId: rule.id,
            metricName: rule.metricName,
            triggered: false,
            threshold: rule.threshold ?? rule.condition?.value ?? 0,
            direction: rule.direction,
            condition: rule.condition,
            emailSent: false,
          });
          continue;
        }

        // Alert triggered - deliver to all enabled channels
        const channelResults: ChannelDeliveryResult[] = [];
        let anyChannelSuccess = false;
        let legacyEmailSent = false;
        let legacyResendMessageId: string | undefined;
        let legacyEmailError: string | undefined;

        // Build email content once for all email channels
        const emailContent = buildAlertEmailContent({
          metricName: rule.metricName,
          direction: rule.direction ?? (rule.condition?.operator === 'gt' || rule.condition?.operator === 'gte' ? 'above' : 'below'),
          threshold: rule.threshold ?? rule.condition?.value ?? 0,
          triggerValue: triggerValue!,
          horizonDays: rule.horizonDays,
          ruleDescription: rule.description,
        });

        // Process user-configurable channels (Phase 4)
        if (rule.channels && rule.channels.length > 0) {
          for (const channel of rule.channels) {
            if (!channel.enabled) {
              channelResults.push({
                channelType: channel.type,
                status: 'skipped',
                recipients: channel.to,
              });
              continue;
            }

            if (channel.type === 'email' && channel.to && channel.to.length > 0) {
              if (!resendConfigured) {
                channelResults.push({
                  channelType: 'email',
                  status: 'failed',
                  error: 'Email service not configured',
                  recipients: channel.to,
                });
                continue;
              }

              try {
                const deliveryResult = await deliverToEmailChannel(
                  { type: 'email', recipients: channel.to },
                  emailContent
                );

                const status: AlertDeliveryStatus = deliveryResult.status === 'sent' ? 'sent' :
                  deliveryResult.status === 'partial' ? 'sent' : 'failed';

                channelResults.push({
                  channelType: 'email',
                  status,
                  externalId: deliveryResult.messageIds?.[0],
                  recipients: channel.to,
                  error: deliveryResult.error,
                });

                if (status === 'sent') {
                  anyChannelSuccess = true;
                  console.log(`[${requestId}] Sent alert to ${channel.to.length} recipients for rule ${rule.id}`);
                }
              } catch (error) {
                channelResults.push({
                  channelType: 'email',
                  status: 'failed',
                  error: (error as Error).message,
                  recipients: channel.to,
                });
              }
            } else if (channel.type === 'slack' || channel.type === 'webhook' || channel.type === 'sms') {
              // Future channel types - not implemented yet
              channelResults.push({
                channelType: channel.type,
                status: 'skipped',
                error: `${channel.type} channel not yet implemented`,
              });
            }
          }
        } else if (rule.email) {
          // Legacy single email fallback (Phase 2 compatibility)
          if (resendConfigured) {
            try {
              const result = await sendAlertEmail({
                to: rule.email,
                subject: emailContent.subject,
                textBody: emailContent.textBody,
                htmlBody: emailContent.htmlBody,
              });

              legacyEmailSent = true;
              legacyResendMessageId = result.id;
              anyChannelSuccess = true;
              console.log(`[${requestId}] Sent legacy alert email for rule ${rule.id} to ${rule.email}`);

              channelResults.push({
                channelType: 'email',
                status: 'sent',
                externalId: result.id,
                recipients: [rule.email],
              });
            } catch (error) {
              legacyEmailError = (error as Error).message;
              console.error(`[${requestId}] Failed to send legacy alert email:`, legacyEmailError);

              channelResults.push({
                channelType: 'email',
                status: 'failed',
                error: legacyEmailError,
                recipients: [rule.email],
              });
            }
          }
        }

        // Create alert event with per-channel results
        const eventId = generateId('event');
        const overallStatus: AlertDeliveryStatus = anyChannelSuccess ? 'sent' :
          resendConfigured ? 'failed' : 'queued';

        const alertEvent: AlertEvent = {
          id: eventId,
          orgId,
          ruleId: rule.id,
          metricName: rule.metricName,
          triggeredAt: new Date(),
          triggerValue: triggerValue!,
          threshold: rule.threshold ?? rule.condition?.value ?? 0,
          direction: rule.direction,
          condition: rule.condition,
          deliveryStatus: overallStatus,
          channelResults,
          // Legacy fields for backward compatibility
          email: rule.email,
          deliveryError: legacyEmailError,
          resendMessageId: legacyResendMessageId,
        };

        await db.collection(COLLECTIONS.alertEvents(orgId)).doc(eventId).set(alertEvent);

        // Phase 11: Record usage event when alert is fired (only if delivery was attempted)
        if (anyChannelSuccess || legacyEmailSent) {
          await recordUsageEvent({
            orgId,
            eventType: 'alert_fired',
            metadata: { ruleId: rule.id, eventId, metricName: rule.metricName },
          });
        }

        results.push({
          ruleId: rule.id,
          metricName: rule.metricName,
          triggered: true,
          triggerValue,
          threshold: rule.threshold ?? rule.condition?.value ?? 0,
          direction: rule.direction,
          condition: rule.condition,
          channelResults: channelResults.map(cr => ({
            type: cr.channelType,
            sent: cr.status === 'sent',
            error: cr.error,
          })),
          emailSent: anyChannelSuccess || legacyEmailSent,
          error: legacyEmailError,
        });
      } catch (error) {
        const errorMessage = (error as Error).message;
        results.push({
          ruleId: rule.id,
          metricName: rule.metricName,
          triggered: false,
          threshold: rule.threshold ?? rule.condition?.value ?? 0,
          direction: rule.direction,
          condition: rule.condition,
          emailSent: false,
          error: errorMessage,
        });
      }
    }

    const responseData: EvaluateAlertsResponse = {
      rulesEvaluated: rules.length,
      rulesTriggered: results.filter((r) => r.triggered).length,
      results,
    };

    console.log(
      `[${requestId}] Evaluated ${rules.length} rules, ${responseData.rulesTriggered} triggered`
    );

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Evaluate alerts error:`, errorMessage);

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
// Route Handler Export
// =============================================================================

export { extractRuleId };
