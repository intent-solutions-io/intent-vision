/**
 * Alert Dispatcher - Multi-Channel Alert Delivery
 *
 * Phase 8: Notification Preferences + Multi-Channel Alerts
 * Phase 16: Smarter Alerts - Correlation & Grouping
 * Beads Task: intentvision-qb9
 *
 * Dispatches alerts to configured notification channels based on
 * Firestore-stored preferences. Supports:
 * - Email (via Resend) - fully implemented
 * - Slack webhook - stub
 * - HTTP webhook - stub
 * - PagerDuty - stub
 *
 * Phase 16 adds incident correlation to group related alerts
 */

import {
  type AlertEvent,
  type NotificationChannelConfig,
  getChannelsForAlert,
} from './notification-preferences.store.js';
import {
  sendResendEmail,
  formatAlertEmailHtml,
  formatAlertEmailText,
  isResendConfigured,
} from './resend-client.js';
import {
  findOrCreateIncident,
  type AlertIncident,
} from '../services/incident-service.js';
import type { AlertEvent as SchemaAlertEvent } from '../firestore/schema.js';

// =============================================================================
// Types
// =============================================================================

export interface DispatchResult {
  success: boolean;
  channelId: string;
  channelType: string;
  destination: string;
  messageId?: string;
  error?: string;
  sentAt: string;
}

export interface AlertDispatchSummary {
  alertEvent: AlertEvent;
  channelsSelected: number;
  channelsNotified: number;
  channelsFailed: number;
  results: DispatchResult[];
  dispatchedAt: string;
  durationMs: number;
  /** Phase 16: Associated incident if alert was grouped */
  incident?: AlertIncident;
}

// =============================================================================
// Channel Senders
// =============================================================================

/**
 * Send alert via email channel (Resend)
 */
async function sendEmailChannel(
  channel: NotificationChannelConfig,
  alert: AlertEvent,
  incident?: AlertIncident
): Promise<DispatchResult> {
  const sentAt = new Date().toISOString();

  if (!channel.emailAddress) {
    return {
      success: false,
      channelId: channel.id,
      channelType: 'email',
      destination: 'unknown',
      error: 'Email address not configured for channel',
      sentAt,
    };
  }

  const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
  const html = formatAlertEmailHtml(alert, incident);
  const text = formatAlertEmailText(alert, incident);

  const result = await sendResendEmail({
    to: channel.emailAddress,
    subject,
    html,
    text,
    tags: [
      { name: 'org', value: alert.orgId },
      { name: 'severity', value: alert.severity },
      { name: 'metric', value: alert.metricKey },
      ...(incident ? [{ name: 'incident', value: incident.id }] : []),
    ],
  });

  return {
    success: result.success,
    channelId: channel.id,
    channelType: 'email',
    destination: channel.emailAddress,
    messageId: result.messageId,
    error: result.error,
    sentAt,
  };
}

/**
 * Send alert via Slack webhook (stub)
 */
async function sendSlackWebhookChannel(
  channel: NotificationChannelConfig,
  alert: AlertEvent
): Promise<DispatchResult> {
  const sentAt = new Date().toISOString();

  if (!channel.slackWebhookUrl) {
    return {
      success: false,
      channelId: channel.id,
      channelType: 'slack_webhook',
      destination: 'unknown',
      error: 'Slack webhook URL not configured',
      sentAt,
    };
  }

  // Log the intent - full implementation in future phase
  console.log('[AlertDispatcher] Slack webhook notification (stub)', {
    channelId: channel.id,
    webhookUrl: channel.slackWebhookUrl.substring(0, 50) + '...',
    alert: {
      orgId: alert.orgId,
      severity: alert.severity,
      title: alert.title,
      metricKey: alert.metricKey,
    },
  });

  // Stub: return success without actually sending
  // TODO: Implement actual Slack webhook POST in future phase
  return {
    success: true,
    channelId: channel.id,
    channelType: 'slack_webhook',
    destination: channel.slackWebhookUrl,
    messageId: `slack-stub-${Date.now()}`,
    sentAt,
  };
}

/**
 * Send alert via HTTP webhook (stub)
 */
async function sendHttpWebhookChannel(
  channel: NotificationChannelConfig,
  alert: AlertEvent
): Promise<DispatchResult> {
  const sentAt = new Date().toISOString();

  if (!channel.httpWebhookUrl) {
    return {
      success: false,
      channelId: channel.id,
      channelType: 'http_webhook',
      destination: 'unknown',
      error: 'HTTP webhook URL not configured',
      sentAt,
    };
  }

  // Log the intent - full implementation in future phase
  console.log('[AlertDispatcher] HTTP webhook notification (stub)', {
    channelId: channel.id,
    webhookUrl: channel.httpWebhookUrl,
    alert: {
      orgId: alert.orgId,
      severity: alert.severity,
      title: alert.title,
      metricKey: alert.metricKey,
    },
  });

  // Stub: return success without actually sending
  // TODO: Implement actual HTTP POST in future phase
  return {
    success: true,
    channelId: channel.id,
    channelType: 'http_webhook',
    destination: channel.httpWebhookUrl,
    messageId: `webhook-stub-${Date.now()}`,
    sentAt,
  };
}

/**
 * Send alert via PagerDuty (stub)
 */
async function sendPagerDutyChannel(
  channel: NotificationChannelConfig,
  alert: AlertEvent
): Promise<DispatchResult> {
  const sentAt = new Date().toISOString();

  if (!channel.pagerDutyRoutingKey) {
    return {
      success: false,
      channelId: channel.id,
      channelType: 'pagerduty',
      destination: 'unknown',
      error: 'PagerDuty routing key not configured',
      sentAt,
    };
  }

  // Log the intent - full implementation in future phase
  console.log('[AlertDispatcher] PagerDuty notification (stub)', {
    channelId: channel.id,
    routingKey: channel.pagerDutyRoutingKey.substring(0, 8) + '...',
    alert: {
      orgId: alert.orgId,
      severity: alert.severity,
      title: alert.title,
      metricKey: alert.metricKey,
    },
  });

  // Stub: return success without actually sending
  // TODO: Implement actual PagerDuty Events API in future phase
  return {
    success: true,
    channelId: channel.id,
    channelType: 'pagerduty',
    destination: `pd:${channel.pagerDutyRoutingKey.substring(0, 8)}...`,
    messageId: `pagerduty-stub-${Date.now()}`,
    sentAt,
  };
}

// =============================================================================
// Main Dispatcher
// =============================================================================

/**
 * Dispatch an alert to all matching channels based on Firestore preferences
 *
 * Flow:
 * 1. Convert alert to schema format and find/create incident (Phase 16)
 * 2. Query Firestore for matching preferences (by org, metric, severity)
 * 3. Collect unique enabled channels from those preferences
 * 4. Send alert to each channel using channel-specific sender
 * 5. Return summary of dispatch results
 */
export async function dispatchAlert(
  alert: AlertEvent,
  schemaAlertEvent?: SchemaAlertEvent
): Promise<AlertDispatchSummary> {
  const startTime = Date.now();
  const dispatchedAt = new Date().toISOString();
  const results: DispatchResult[] = [];

  console.log('[AlertDispatcher] Dispatching alert', {
    orgId: alert.orgId,
    severity: alert.severity,
    title: alert.title,
    metricKey: alert.metricKey,
  });

  // Phase 16: Find or create incident for alert correlation
  let incident: AlertIncident | undefined;
  if (schemaAlertEvent) {
    try {
      incident = await findOrCreateIncident(schemaAlertEvent);
      console.log('[AlertDispatcher] Associated with incident', {
        incidentId: incident.id,
        status: incident.status,
        alertCount: incident.alertEventIds.length,
      });
    } catch (error) {
      console.error('[AlertDispatcher] Failed to create/find incident', error);
      // Continue without incident - non-blocking
    }
  }

  // Get channels for this alert based on preferences
  const channels = await getChannelsForAlert(alert);

  console.log('[AlertDispatcher] Found channels', {
    count: channels.length,
    types: channels.map((ch) => ch.type),
  });

  if (channels.length === 0) {
    console.log('[AlertDispatcher] No channels configured for alert');
    return {
      alertEvent: alert,
      channelsSelected: 0,
      channelsNotified: 0,
      channelsFailed: 0,
      results: [],
      dispatchedAt,
      durationMs: Date.now() - startTime,
      incident,
    };
  }

  // Dispatch to each channel
  for (const channel of channels) {
    let result: DispatchResult;

    switch (channel.type) {
      case 'email':
        result = await sendEmailChannel(channel, alert, incident);
        break;
      case 'slack_webhook':
        result = await sendSlackWebhookChannel(channel, alert);
        break;
      case 'http_webhook':
        result = await sendHttpWebhookChannel(channel, alert);
        break;
      case 'pagerduty':
        result = await sendPagerDutyChannel(channel, alert);
        break;
      default:
        result = {
          success: false,
          channelId: channel.id,
          channelType: channel.type,
          destination: 'unknown',
          error: `Unknown channel type: ${channel.type}`,
          sentAt: new Date().toISOString(),
        };
    }

    results.push(result);
  }

  const summary: AlertDispatchSummary = {
    alertEvent: alert,
    channelsSelected: channels.length,
    channelsNotified: results.filter((r) => r.success).length,
    channelsFailed: results.filter((r) => !r.success).length,
    results,
    dispatchedAt,
    durationMs: Date.now() - startTime,
    incident,
  };

  console.log('[AlertDispatcher] Dispatch complete', {
    channelsSelected: summary.channelsSelected,
    channelsNotified: summary.channelsNotified,
    channelsFailed: summary.channelsFailed,
    durationMs: summary.durationMs,
    incidentId: incident?.id,
  });

  return summary;
}

/**
 * Check if the alert dispatcher is properly configured
 */
export function getDispatcherStatus(): {
  resendConfigured: boolean;
  fromEmail: string;
} {
  return {
    resendConfigured: isResendConfigured(),
    fromEmail: process.env.INTENTVISION_ALERT_FROM_EMAIL || 'jeremy@intentsolutions.io',
  };
}

// Re-export types for convenience
export type { AlertEvent, NotificationChannelConfig } from './notification-preferences.store.js';
