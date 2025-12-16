/**
 * Resend Email Client
 *
 * Phase 8: Notification Preferences + Multi-Channel Alerts
 * Beads Task: intentvision-lyq
 *
 * Sends transactional emails via Resend API.
 * Uses environment variables for configuration:
 * - INTENTVISION_RESEND_API_KEY: Resend API key
 * - INTENTVISION_ALERT_FROM_EMAIL: From address (default: jeremy@intentsolutions.io)
 */

// =============================================================================
// Configuration
// =============================================================================

const RESEND_API_KEY = process.env.INTENTVISION_RESEND_API_KEY;
const ALERT_FROM_EMAIL = process.env.INTENTVISION_ALERT_FROM_EMAIL || 'jeremy@intentsolutions.io';
const RESEND_API_URL = 'https://api.resend.com/emails';

// =============================================================================
// Types
// =============================================================================

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface ResendSuccessResponse {
  id: string;
}

interface ResendErrorResponse {
  statusCode: number;
  message: string;
  name: string;
}

// =============================================================================
// Client Functions
// =============================================================================

/**
 * Check if Resend is configured
 */
export function isResendConfigured(): boolean {
  return !!RESEND_API_KEY;
}

/**
 * Get the configured from email address
 */
export function getFromEmail(): string {
  return ALERT_FROM_EMAIL;
}

/**
 * Send an email via Resend API
 *
 * @param options - Email options
 * @returns Result with success status and message ID or error
 */
export async function sendResendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    console.warn('[Resend] Email alerts disabled: INTENTVISION_RESEND_API_KEY not set');
    return {
      success: false,
      error: 'Resend API key not configured',
    };
  }

  try {
    const payload = {
      from: ALERT_FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo,
      tags: options.tags,
    };

    console.log('[Resend] Sending email', {
      to: payload.to,
      subject: payload.subject,
      from: ALERT_FROM_EMAIL,
    });

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json() as ResendErrorResponse;
      console.error('[Resend] API error', {
        status: response.status,
        message: errorData.message,
        name: errorData.name,
      });
      return {
        success: false,
        error: `Resend API error: ${errorData.message || response.statusText}`,
      };
    }

    const data = await response.json() as ResendSuccessResponse;
    console.log('[Resend] Email sent successfully', {
      messageId: data.id,
    });

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Resend] Failed to send email', { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// =============================================================================
// Alert Email Formatting
// =============================================================================

/**
 * Format an alert as an HTML email
 */
export function formatAlertEmailHtml(alert: {
  orgId: string;
  metricKey: string;
  severity: string;
  title: string;
  message: string;
  occurredAt: string;
  context?: Record<string, unknown>;
}): string {
  const severityColor = {
    info: '#2196F3',
    warning: '#FF9800',
    critical: '#F44336',
  }[alert.severity] || '#757575';

  const timestamp = new Date(alert.occurredAt).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    dateStyle: 'full',
    timeStyle: 'long',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(alert.title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-left: 4px solid ${severityColor}; padding-left: 16px; margin-bottom: 20px;">
    <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #111;">
      ${escapeHtml(alert.title)}
    </h1>
    <span style="display: inline-block; background: ${severityColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
      ${escapeHtml(alert.severity)}
    </span>
  </div>

  <p style="font-size: 16px; margin: 16px 0;">
    ${escapeHtml(alert.message)}
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666; width: 120px;">Metric</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-family: monospace;">${escapeHtml(alert.metricKey)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Organization</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(alert.orgId)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Occurred At</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(timestamp)}</td>
    </tr>
    ${alert.context ? formatContextRows(alert.context) : ''}
  </table>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
    <p style="margin: 0;">
      This alert was generated by <strong>IntentVision</strong>.<br>
      <a href="https://intentvision.io" style="color: #2196F3;">View Dashboard</a>
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Format an alert as plain text email
 */
export function formatAlertEmailText(alert: {
  orgId: string;
  metricKey: string;
  severity: string;
  title: string;
  message: string;
  occurredAt: string;
  context?: Record<string, unknown>;
}): string {
  const timestamp = new Date(alert.occurredAt).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    dateStyle: 'full',
    timeStyle: 'long',
  });

  let text = `
[${alert.severity.toUpperCase()}] ${alert.title}

${alert.message}

Details:
- Metric: ${alert.metricKey}
- Organization: ${alert.orgId}
- Occurred At: ${timestamp}
`;

  if (alert.context) {
    text += '\nContext:\n';
    for (const [key, value] of Object.entries(alert.context)) {
      text += `- ${key}: ${JSON.stringify(value)}\n`;
    }
  }

  text += `
---
This alert was generated by IntentVision.
https://intentvision.io
`;

  return text.trim();
}

// =============================================================================
// Helpers
// =============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatContextRows(context: Record<string, unknown>): string {
  return Object.entries(context)
    .map(([key, value]) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">${escapeHtml(key)}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(String(value))}</td>
    </tr>
    `)
    .join('');
}
