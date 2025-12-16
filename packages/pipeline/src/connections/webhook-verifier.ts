/**
 * Webhook Signature Verifier
 *
 * Task ID: intentvision-wgk.3
 *
 * Provides webhook signature verification with:
 * - HMAC-SHA256 signature validation
 * - Timestamp validation (reject > 5 min old)
 * - X-Webhook-Signature header parsing
 * - Multiple signature format support
 */

import { createHmac } from 'crypto';

// =============================================================================
// Types
// =============================================================================

export interface WebhookVerificationConfig {
  /** Secret key for HMAC verification */
  secret: string;
  /** Maximum age of webhook in milliseconds (default: 5 minutes) */
  maxAgeMs?: number;
  /** Timestamp tolerance in milliseconds (for clock skew) */
  toleranceMs?: number;
}

export interface WebhookSignatureHeader {
  /** Timestamp when webhook was sent */
  timestamp: number;
  /** HMAC signature */
  signature: string;
  /** Version of signature scheme (optional) */
  version?: string;
}

export interface VerificationResult {
  /** Whether signature is valid */
  valid: boolean;
  /** Reason for failure (if invalid) */
  reason?: string;
  /** Parsed timestamp */
  timestamp?: number;
}

// =============================================================================
// Webhook Verifier
// =============================================================================

export class WebhookVerifier {
  private config: Required<WebhookVerificationConfig>;

  constructor(config: WebhookVerificationConfig) {
    this.config = {
      secret: config.secret,
      maxAgeMs: config.maxAgeMs ?? 300000, // 5 minutes
      toleranceMs: config.toleranceMs ?? 60000, // 1 minute tolerance for clock skew
    };
  }

  /**
   * Verify webhook signature
   *
   * @param payload - Raw webhook payload (string or Buffer)
   * @param signature - Signature from X-Webhook-Signature header
   * @param secret - Optional secret override (uses config secret if not provided)
   * @returns Verification result
   */
  verify(
    payload: string | Buffer,
    signature: string,
    secret?: string
  ): VerificationResult {
    try {
      // Parse signature header
      const parsed = this.parseSignatureHeader(signature);
      if (!parsed) {
        return { valid: false, reason: 'Invalid signature format' };
      }

      // Validate timestamp
      const timestampResult = this.validateTimestamp(parsed.timestamp);
      if (!timestampResult.valid) {
        return timestampResult;
      }

      // Compute expected signature
      const expectedSignature = this.computeSignature(
        payload,
        parsed.timestamp,
        secret ?? this.config.secret
      );

      // Compare signatures (timing-safe)
      const isValid = this.timingSafeEqual(
        parsed.signature,
        expectedSignature
      );

      if (!isValid) {
        return {
          valid: false,
          reason: 'Signature mismatch',
          timestamp: parsed.timestamp,
        };
      }

      return {
        valid: true,
        timestamp: parsed.timestamp,
      };
    } catch (error) {
      return {
        valid: false,
        reason: `Verification error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Generate signature for outgoing webhook
   *
   * @param payload - Webhook payload
   * @param timestamp - Unix timestamp (optional, defaults to now)
   * @returns Signature header value
   */
  sign(payload: string | Buffer, timestamp?: number): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const signature = this.computeSignature(payload, ts, this.config.secret);
    return `t=${ts},v1=${signature}`;
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Parse X-Webhook-Signature header
   * Supports formats:
   * - "t=1234567890,v1=abc123..." (Stripe-style)
   * - "sha256=abc123..." (GitHub-style)
   * - "abc123..." (raw signature)
   */
  private parseSignatureHeader(header: string): WebhookSignatureHeader | null {
    // Stripe-style: t=timestamp,v1=signature
    const stripeMatch = header.match(/t=(\d+),v1=([a-f0-9]+)/);
    if (stripeMatch) {
      return {
        timestamp: parseInt(stripeMatch[1], 10),
        signature: stripeMatch[2],
        version: 'v1',
      };
    }

    // GitHub-style: sha256=signature
    const githubMatch = header.match(/sha256=([a-f0-9]+)/);
    if (githubMatch) {
      // GitHub doesn't include timestamp, use current time
      return {
        timestamp: Math.floor(Date.now() / 1000),
        signature: githubMatch[1],
        version: 'sha256',
      };
    }

    // Raw signature (assume current timestamp)
    if (/^[a-f0-9]+$/.test(header)) {
      return {
        timestamp: Math.floor(Date.now() / 1000),
        signature: header,
      };
    }

    return null;
  }

  /**
   * Validate webhook timestamp
   */
  private validateTimestamp(timestamp: number): VerificationResult {
    const now = Math.floor(Date.now() / 1000);
    const age = (now - timestamp) * 1000; // Convert to milliseconds

    // Check if timestamp is too old
    if (age > this.config.maxAgeMs) {
      return {
        valid: false,
        reason: `Webhook too old (${Math.floor(age / 1000)}s, max ${Math.floor(this.config.maxAgeMs / 1000)}s)`,
        timestamp,
      };
    }

    // Check if timestamp is too far in the future (clock skew)
    if (age < -this.config.toleranceMs) {
      return {
        valid: false,
        reason: 'Webhook timestamp is in the future',
        timestamp,
      };
    }

    return { valid: true, timestamp };
  }

  /**
   * Compute HMAC-SHA256 signature
   */
  private computeSignature(
    payload: string | Buffer,
    timestamp: number,
    secret: string
  ): string {
    // Construct signed payload: timestamp.payload
    const signedPayload = `${timestamp}.${payload}`;

    // Compute HMAC-SHA256
    const hmac = createHmac('sha256', secret);
    hmac.update(signedPayload);
    return hmac.digest('hex');
  }

  /**
   * Timing-safe string comparison
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

// =============================================================================
// Standalone Functions
// =============================================================================

/**
 * Verify webhook signature (standalone function)
 *
 * @param payload - Raw webhook payload
 * @param signature - Signature from X-Webhook-Signature header
 * @param secret - Secret key for verification
 * @returns Whether signature is valid
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const verifier = new WebhookVerifier({ secret });
  const result = verifier.verify(payload, signature);
  return result.valid;
}

/**
 * Parse X-Webhook-Signature header
 *
 * @param header - Signature header value
 * @returns Parsed signature components or null
 */
export function parseWebhookSignature(
  header: string
): WebhookSignatureHeader | null {
  const verifier = new WebhookVerifier({ secret: 'dummy' });
  return verifier['parseSignatureHeader'](header);
}

/**
 * Sign webhook payload
 *
 * @param payload - Webhook payload
 * @param secret - Secret key for signing
 * @param timestamp - Unix timestamp (optional)
 * @returns Signature header value
 */
export function signWebhookPayload(
  payload: string | Buffer,
  secret: string,
  timestamp?: number
): string {
  const verifier = new WebhookVerifier({ secret });
  return verifier.sign(payload, timestamp);
}

// =============================================================================
// Factory
// =============================================================================

const verifiers = new Map<string, WebhookVerifier>();

/**
 * Get or create a webhook verifier for a given secret
 */
export function getWebhookVerifier(
  secret: string,
  config?: Omit<WebhookVerificationConfig, 'secret'>
): WebhookVerifier {
  const key = secret; // Simple cache key
  if (!verifiers.has(key)) {
    verifiers.set(key, new WebhookVerifier({ secret, ...config }));
  }
  return verifiers.get(key)!;
}

/**
 * Clear webhook verifier cache
 */
export function resetWebhookVerifiers(): void {
  verifiers.clear();
}
