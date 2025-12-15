/**
 * Notification Channels
 *
 * Task ID: intentvision-9ru.2
 *
 * Implementations for alert notification delivery:
 * - Webhook (HTTP POST)
 * - Email (via provider/SMTP)
 * - Slack (webhook integration)
 * - PagerDuty (events API)
 */

import type {
  AlertTrigger,
  AlertChannel,
} from '../../../contracts/src/index.js';
import { logger } from '../observability/logger.js';

// =============================================================================
// Types
// =============================================================================

export interface NotificationResult {
  success: boolean;
  channelType: string;
  destination: string;
  sentAt: string;
  messageId?: string;
  error?: string;
  retryable?: boolean;
}

export interface ChannelConfig {
  /** Whether channel is enabled */
  enabled?: boolean;
  /** Retry configuration */
  retries?: number;
  /** Timeout in ms */
  timeoutMs?: number;
  /** Rate limit per minute */
  rateLimitPerMinute?: number;
}

export interface NotificationPayload {
  alert: AlertTrigger;
  channel: AlertChannel;
  attempt: number;
}

// =============================================================================
// Base Channel Handler
// =============================================================================

export abstract class NotificationChannel {
  abstract readonly type: string;
  protected config: Required<ChannelConfig>;

  constructor(config: ChannelConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      retries: config.retries ?? 3,
      timeoutMs: config.timeoutMs ?? 10000,
      rateLimitPerMinute: config.rateLimitPerMinute ?? 60,
    };
  }

  abstract send(payload: NotificationPayload): Promise<NotificationResult>;

  protected formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  protected truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}

// =============================================================================
// Webhook Channel
// =============================================================================

export class WebhookChannel extends NotificationChannel {
  readonly type = 'webhook';

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const { alert, channel, attempt } = payload;
    const sentAt = new Date().toISOString();

    if (!this.config.enabled) {
      return {
        success: false,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        error: 'Channel disabled',
        retryable: false,
      };
    }

    try {
      const body = JSON.stringify({
        event_type: 'alert',
        alert_id: alert.alert_id,
        rule_id: alert.rule_id,
        org_id: alert.org_id,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        description: alert.description,
        triggered_at: alert.triggered_at,
        metric: alert.metric_context,
        trigger: alert.trigger_details,
      });

      // In production, this would make an actual HTTP request
      // For now, we log the webhook call
      logger.info('Webhook notification', {
        destination: channel.destination,
        alertId: alert.alert_id,
        severity: alert.severity,
        attempt,
      });

      // Simulate webhook call (in production, use fetch/axios)
      const response = await this.simulateWebhookCall(channel.destination, body);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        messageId: `webhook-${alert.alert_id}-${attempt}`,
      };
    } catch (error) {
      return {
        success: false,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        error: (error as Error).message,
        retryable: attempt < this.config.retries,
      };
    }
  }

  private async simulateWebhookCall(
    _url: string,
    _body: string
  ): Promise<{ ok: boolean; status: number; statusText: string }> {
    // Simulate successful webhook call
    return { ok: true, status: 200, statusText: 'OK' };
  }
}

// =============================================================================
// Email Channel
// =============================================================================

export interface EmailConfig extends ChannelConfig {
  /** From address */
  from?: string;
  /** Reply-to address */
  replyTo?: string;
  /** SMTP configuration (for production) */
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  };
}

export class EmailChannel extends NotificationChannel {
  readonly type = 'email';
  private emailConfig: EmailConfig;

  constructor(config: EmailConfig = {}) {
    super(config);
    this.emailConfig = {
      from: config.from || 'alerts@intentvision.io',
      replyTo: config.replyTo || 'alerts@intentvision.io',
      ...config,
    };
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const { alert, channel, attempt } = payload;
    const sentAt = new Date().toISOString();

    if (!this.config.enabled) {
      return {
        success: false,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        error: 'Channel disabled',
        retryable: false,
      };
    }

    try {
      const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
      const body = this.formatEmailBody(alert);

      logger.info('Email notification', {
        to: channel.destination,
        subject,
        alertId: alert.alert_id,
        attempt,
      });

      // In production, send via SMTP/email provider
      // For now, log the email
      const messageId = await this.simulateEmailSend(
        channel.destination,
        subject,
        body
      );

      return {
        success: true,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        messageId,
      };
    } catch (error) {
      return {
        success: false,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        error: (error as Error).message,
        retryable: attempt < this.config.retries,
      };
    }
  }

  private formatEmailBody(alert: AlertTrigger): string {
    return `
Alert: ${alert.title}

Severity: ${alert.severity.toUpperCase()}
Status: ${alert.status}
Triggered: ${this.formatTimestamp(alert.triggered_at)}

Description:
${alert.description}

Metric: ${alert.metric_context.metric_key}
Current Value: ${alert.metric_context.current_value}

Organization: ${alert.org_id}
Alert ID: ${alert.alert_id}
Rule ID: ${alert.rule_id}

---
This alert was generated by IntentVision.
    `.trim();
  }

  private async simulateEmailSend(
    _to: string,
    _subject: string,
    _body: string
  ): Promise<string> {
    // Simulate email send
    return `email-${Date.now()}`;
  }
}

// =============================================================================
// Slack Channel
// =============================================================================

export interface SlackConfig extends ChannelConfig {
  /** Default channel for notifications */
  defaultChannel?: string;
  /** Bot username */
  username?: string;
  /** Bot icon emoji */
  iconEmoji?: string;
}

export class SlackChannel extends NotificationChannel {
  readonly type = 'slack';
  private slackConfig: SlackConfig;

  constructor(config: SlackConfig = {}) {
    super(config);
    this.slackConfig = {
      defaultChannel: config.defaultChannel || '#alerts',
      username: config.username || 'IntentVision Alerts',
      iconEmoji: config.iconEmoji || ':warning:',
      ...config,
    };
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const { alert, channel, attempt } = payload;
    const sentAt = new Date().toISOString();

    if (!this.config.enabled) {
      return {
        success: false,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        error: 'Channel disabled',
        retryable: false,
      };
    }

    try {
      const slackPayload = this.formatSlackMessage(alert);

      logger.info('Slack notification', {
        webhook: this.truncate(channel.destination, 50),
        alertId: alert.alert_id,
        severity: alert.severity,
        attempt,
      });

      // In production, POST to Slack webhook
      const messageId = await this.simulateSlackSend(
        channel.destination,
        slackPayload
      );

      return {
        success: true,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        messageId,
      };
    } catch (error) {
      return {
        success: false,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        error: (error as Error).message,
        retryable: attempt < this.config.retries,
      };
    }
  }

  private formatSlackMessage(alert: AlertTrigger): object {
    const color = this.getSeverityColor(alert.severity);

    return {
      username: this.slackConfig.username,
      icon_emoji: this.slackConfig.iconEmoji,
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.description,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Status',
              value: alert.status,
              short: true,
            },
            {
              title: 'Metric',
              value: alert.metric_context.metric_key,
              short: true,
            },
            {
              title: 'Value',
              value: String(alert.metric_context.current_value),
              short: true,
            },
          ],
          footer: `Alert ID: ${alert.alert_id} | Rule: ${alert.rule_id}`,
          ts: Math.floor(new Date(alert.triggered_at).getTime() / 1000),
        },
      ],
    };
  }

  private getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      info: '#2196F3',
      warning: '#FF9800',
      error: '#F44336',
      critical: '#9C27B0',
    };
    return colors[severity] || '#757575';
  }

  private async simulateSlackSend(
    _webhook: string,
    _payload: object
  ): Promise<string> {
    // Simulate Slack send
    return `slack-${Date.now()}`;
  }
}

// =============================================================================
// PagerDuty Channel
// =============================================================================

export interface PagerDutyConfig extends ChannelConfig {
  /** PagerDuty Events API URL */
  eventsApiUrl?: string;
}

export class PagerDutyChannel extends NotificationChannel {
  readonly type = 'pagerduty';
  private pdConfig: PagerDutyConfig;

  constructor(config: PagerDutyConfig = {}) {
    super(config);
    this.pdConfig = {
      eventsApiUrl:
        config.eventsApiUrl || 'https://events.pagerduty.com/v2/enqueue',
      ...config,
    };
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const { alert, channel, attempt } = payload;
    const sentAt = new Date().toISOString();

    if (!this.config.enabled) {
      return {
        success: false,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        error: 'Channel disabled',
        retryable: false,
      };
    }

    try {
      const pdPayload = this.formatPagerDutyEvent(alert, channel.destination);

      logger.info('PagerDuty notification', {
        routingKey: this.truncate(channel.destination, 20),
        alertId: alert.alert_id,
        severity: alert.severity,
        attempt,
      });

      // In production, POST to PagerDuty Events API
      const dedupKey = await this.simulatePagerDutySend(pdPayload);

      return {
        success: true,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        messageId: dedupKey,
      };
    } catch (error) {
      return {
        success: false,
        channelType: this.type,
        destination: channel.destination,
        sentAt,
        error: (error as Error).message,
        retryable: attempt < this.config.retries,
      };
    }
  }

  private formatPagerDutyEvent(alert: AlertTrigger, routingKey: string): object {
    const severity = this.mapSeverity(alert.severity);

    return {
      routing_key: routingKey,
      event_action: alert.status === 'resolved' ? 'resolve' : 'trigger',
      dedup_key: alert.routing.dedup_key || alert.alert_id,
      payload: {
        summary: alert.title,
        source: `intentvision-${alert.org_id}`,
        severity,
        timestamp: alert.triggered_at,
        custom_details: {
          description: alert.description,
          metric_key: alert.metric_context.metric_key,
          current_value: alert.metric_context.current_value,
          rule_id: alert.rule_id,
          alert_id: alert.alert_id,
        },
      },
    };
  }

  private mapSeverity(severity: string): string {
    const mapping: Record<string, string> = {
      info: 'info',
      warning: 'warning',
      error: 'error',
      critical: 'critical',
    };
    return mapping[severity] || 'info';
  }

  private async simulatePagerDutySend(_payload: object): Promise<string> {
    // Simulate PagerDuty send
    return `pd-${Date.now()}`;
  }
}

// =============================================================================
// Channel Registry and Dispatcher
// =============================================================================

export class NotificationDispatcher {
  private channels = new Map<string, NotificationChannel>();

  constructor() {
    // Register default channels
    this.registerChannel('webhook', new WebhookChannel());
    this.registerChannel('email', new EmailChannel());
    this.registerChannel('slack', new SlackChannel());
    this.registerChannel('pagerduty', new PagerDutyChannel());
  }

  registerChannel(type: string, channel: NotificationChannel): void {
    this.channels.set(type, channel);
  }

  getChannel(type: string): NotificationChannel | undefined {
    return this.channels.get(type);
  }

  /**
   * Send alert to all configured channels
   */
  async dispatch(alert: AlertTrigger): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channelConfig of alert.routing.channels) {
      const channel = this.channels.get(channelConfig.type);

      if (!channel) {
        results.push({
          success: false,
          channelType: channelConfig.type,
          destination: channelConfig.destination,
          sentAt: new Date().toISOString(),
          error: `Unknown channel type: ${channelConfig.type}`,
          retryable: false,
        });
        continue;
      }

      const result = await channel.send({
        alert,
        channel: channelConfig,
        attempt: 1,
      });

      results.push(result);

      // Retry if needed
      if (!result.success && result.retryable) {
        for (let attempt = 2; attempt <= 3; attempt++) {
          const retryResult = await channel.send({
            alert,
            channel: channelConfig,
            attempt,
          });

          if (retryResult.success) {
            results[results.length - 1] = retryResult;
            break;
          }
        }
      }
    }

    return results;
  }
}

// =============================================================================
// Factory
// =============================================================================

let _dispatcher: NotificationDispatcher | null = null;

export function getNotificationDispatcher(): NotificationDispatcher {
  if (!_dispatcher) {
    _dispatcher = new NotificationDispatcher();
  }
  return _dispatcher;
}

export function resetNotificationDispatcher(): void {
  _dispatcher = null;
}
