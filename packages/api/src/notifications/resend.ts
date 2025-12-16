/**
 * Resend Email Notification Client
 *
 * Phase 2: Email Alerts via Resend
 * Phase 4: User-configurable notification channels
 * Beads Tasks: intentvision-8aj.2, intentvision-p88
 *
 * Wrapper for Resend email API to send alert notifications.
 * Supports:
 * - Single and multiple recipients
 * - User-configurable notification channels
 * - Per-channel delivery tracking
 *
 * Uses environment variables:
 * - RESEND_API_KEY: API key for Resend
 * - RESEND_FROM_EMAIL: Sender email address (default: jeremy@intentsolutions.io)
 */

// =============================================================================
// Configuration
// =============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'jeremy@intentsolutions.io';
const RESEND_API_URL = 'https://api.resend.com/emails';

// =============================================================================
// Types
// =============================================================================

export interface SendEmailParams {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
}

export interface SendEmailResult {
  id: string;
}

export interface ResendError {
  statusCode: number;
  message: string;
  name: string;
}

// Phase 4: Multi-recipient and channel support
export interface SendMultiRecipientEmailParams {
  to: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
}

export interface MultiRecipientResult {
  totalRecipients: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    recipient: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

export interface ChannelDeliveryInput {
  type: 'email';
  recipients: string[];
}

export interface ChannelDeliveryOutput {
  channelType: 'email';
  status: 'sent' | 'failed' | 'partial';
  recipients: string[];
  messageIds?: string[];
  error?: string;
}

// =============================================================================
// Client
// =============================================================================

/**
 * Check if Resend is configured
 */
export function isResendConfigured(): boolean {
  return !!RESEND_API_KEY;
}

/**
 * Send an email via Resend API
 *
 * @param params - Email parameters
 * @returns Promise with message ID
 * @throws Error if Resend is not configured or API call fails
 */
export async function sendAlertEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }

  const { to, subject, textBody, htmlBody } = params;

  // Validate email format
  if (!to || !isValidEmail(to)) {
    throw new Error('Invalid recipient email address');
  }

  if (!subject || subject.trim().length === 0) {
    throw new Error('Email subject is required');
  }

  if (!textBody || textBody.trim().length === 0) {
    throw new Error('Email body is required');
  }

  // Build request payload
  const payload: Record<string, unknown> = {
    from: RESEND_FROM_EMAIL,
    to: [to],
    subject,
    text: textBody,
  };

  if (htmlBody) {
    payload.html = htmlBody;
  }

  // Send request to Resend API
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `Resend API error: ${response.status}`;

    try {
      const errorJson = JSON.parse(errorBody) as ResendError;
      errorMessage = errorJson.message || errorMessage;
    } catch {
      // Use raw error body if not JSON
      if (errorBody) {
        errorMessage = `${errorMessage} - ${errorBody}`;
      }
    }

    throw new Error(errorMessage);
  }

  const result = await response.json() as { id: string };

  if (!result.id) {
    throw new Error('Resend API did not return a message ID');
  }

  return { id: result.id };
}

/**
 * Build alert email content
 *
 * @param params - Alert details
 * @returns Email content with text and HTML bodies
 */
export function buildAlertEmailContent(params: {
  metricName: string;
  direction: 'above' | 'below';
  threshold: number;
  triggerValue: number;
  horizonDays: number;
  ruleDescription?: string;
}): { subject: string; textBody: string; htmlBody: string } {
  const { metricName, direction, threshold, triggerValue, horizonDays, ruleDescription } = params;

  const directionText = direction === 'above' ? 'exceeded' : 'dropped below';
  const subject = `Alert: ${metricName} forecast ${directionText} threshold`;

  const textBody = `
IntentVision Alert

Metric: ${metricName}
Alert Condition: Forecast ${direction} ${threshold}
Triggered Value: ${triggerValue.toFixed(2)}
Forecast Horizon: ${horizonDays} days
${ruleDescription ? `Description: ${ruleDescription}` : ''}

Your forecast for "${metricName}" has ${directionText} your configured threshold of ${threshold}.
The forecasted value is ${triggerValue.toFixed(2)}.

View your dashboard for more details.

---
IntentVision | Predictive Analytics
`.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">IntentVision Alert</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${direction === 'above' ? '#ef4444' : '#f59e0b'};">
      <h2 style="margin: 0 0 15px 0; color: #1f2937;">Forecast Alert Triggered</h2>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Metric:</td>
          <td style="padding: 8px 0; font-weight: 600;">${metricName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Condition:</td>
          <td style="padding: 8px 0;">Forecast ${direction} <strong>${threshold}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Triggered Value:</td>
          <td style="padding: 8px 0; font-weight: 600; color: ${direction === 'above' ? '#ef4444' : '#f59e0b'};">${triggerValue.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Forecast Horizon:</td>
          <td style="padding: 8px 0;">${horizonDays} days</td>
        </tr>
        ${ruleDescription ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Description:</td>
          <td style="padding: 8px 0;">${ruleDescription}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">
      Your forecast for "<strong>${metricName}</strong>" has ${directionText} your configured threshold.
    </p>
  </div>

  <div style="background: #1f2937; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">
      IntentVision | Predictive Analytics
    </p>
  </div>
</body>
</html>
`.trim();

  return { subject, textBody, htmlBody };
}

// =============================================================================
// Phase 4: Multi-Recipient Support
// =============================================================================

/**
 * Send email to multiple recipients
 * Resend supports batch sending to multiple recipients in a single API call
 */
export async function sendMultiRecipientEmail(
  params: SendMultiRecipientEmailParams
): Promise<MultiRecipientResult> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }

  const { to, subject, textBody, htmlBody } = params;

  // Filter and validate recipients
  const validRecipients = to.filter(email => isValidEmail(email));
  const invalidRecipients = to.filter(email => !isValidEmail(email));

  if (validRecipients.length === 0) {
    return {
      totalRecipients: to.length,
      successCount: 0,
      failureCount: to.length,
      results: to.map(email => ({
        recipient: email,
        success: false,
        error: 'Invalid email format',
      })),
    };
  }

  // Build request payload - Resend accepts array of recipients
  const payload: Record<string, unknown> = {
    from: RESEND_FROM_EMAIL,
    to: validRecipients,
    subject,
    text: textBody,
  };

  if (htmlBody) {
    payload.html = htmlBody;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Resend API error: ${response.status}`;

      try {
        const errorJson = JSON.parse(errorBody) as ResendError;
        errorMessage = errorJson.message || errorMessage;
      } catch {
        if (errorBody) {
          errorMessage = `${errorMessage} - ${errorBody}`;
        }
      }

      // All valid recipients failed
      const results = [
        ...validRecipients.map(email => ({
          recipient: email,
          success: false,
          error: errorMessage,
        })),
        ...invalidRecipients.map(email => ({
          recipient: email,
          success: false,
          error: 'Invalid email format',
        })),
      ];

      return {
        totalRecipients: to.length,
        successCount: 0,
        failureCount: to.length,
        results,
      };
    }

    const result = await response.json() as { id: string };

    // Success for all valid recipients
    const results = [
      ...validRecipients.map(email => ({
        recipient: email,
        success: true,
        messageId: result.id,
      })),
      ...invalidRecipients.map(email => ({
        recipient: email,
        success: false,
        error: 'Invalid email format',
      })),
    ];

    return {
      totalRecipients: to.length,
      successCount: validRecipients.length,
      failureCount: invalidRecipients.length,
      results,
    };
  } catch (error) {
    const errorMessage = (error as Error).message;

    return {
      totalRecipients: to.length,
      successCount: 0,
      failureCount: to.length,
      results: to.map(email => ({
        recipient: email,
        success: false,
        error: errorMessage,
      })),
    };
  }
}

/**
 * Deliver alert via email channel
 * Used by alert evaluation to send to user-configured channels
 */
export async function deliverToEmailChannel(
  channel: ChannelDeliveryInput,
  emailContent: { subject: string; textBody: string; htmlBody: string }
): Promise<ChannelDeliveryOutput> {
  if (!isResendConfigured()) {
    return {
      channelType: 'email',
      status: 'failed',
      recipients: channel.recipients,
      error: 'Email service not configured',
    };
  }

  const result = await sendMultiRecipientEmail({
    to: channel.recipients,
    subject: emailContent.subject,
    textBody: emailContent.textBody,
    htmlBody: emailContent.htmlBody,
  });

  // Determine overall status
  let status: 'sent' | 'failed' | 'partial';
  if (result.successCount === result.totalRecipients) {
    status = 'sent';
  } else if (result.successCount === 0) {
    status = 'failed';
  } else {
    status = 'partial';
  }

  return {
    channelType: 'email',
    status,
    recipients: channel.recipients,
    messageIds: result.results
      .filter(r => r.success && r.messageId)
      .map(r => r.messageId!),
    error: status === 'failed'
      ? result.results.find(r => r.error)?.error
      : undefined,
  };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Basic email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
