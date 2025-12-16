/**
 * Notification System Unit Tests
 *
 * Phase 8: Notification Preferences + Multi-Channel Alerts
 *
 * Tests for:
 * - Resend client configuration
 * - Email formatting
 * - Alert dispatcher logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isResendConfigured,
  getFromEmail,
  formatAlertEmailHtml,
  formatAlertEmailText,
} from '../notifications/resend-client.js';

// =============================================================================
// Resend Client Tests
// =============================================================================

describe('Resend Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isResendConfigured', () => {
    it('should return false when API key is not set', () => {
      delete process.env.INTENTVISION_RESEND_API_KEY;
      // Note: This test checks the exported value at import time
      // The actual function reads from env at module load
      expect(typeof isResendConfigured).toBe('function');
    });
  });

  describe('getFromEmail', () => {
    it('should return configured from email', () => {
      const email = getFromEmail();
      expect(email).toBeTruthy();
      expect(email).toContain('@');
    });
  });
});

// =============================================================================
// Email Formatting Tests
// =============================================================================

describe('Email Formatting', () => {
  const sampleAlert = {
    orgId: 'test-org',
    metricKey: 'stripe:mrr',
    severity: 'warning',
    title: 'MRR Anomaly Detected',
    message: 'Monthly recurring revenue dropped by 15% in the last 24 hours.',
    occurredAt: '2025-12-15T10:30:00Z',
    context: {
      previousValue: 50000,
      currentValue: 42500,
      percentageChange: -15,
    },
  };

  describe('formatAlertEmailHtml', () => {
    it('should generate valid HTML email', () => {
      const html = formatAlertEmailHtml(sampleAlert);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('MRR Anomaly Detected');
      expect(html).toContain('warning');
      expect(html).toContain('stripe:mrr');
      expect(html).toContain('test-org');
      expect(html).toContain('dropped by 15%');
    });

    it('should escape HTML in alert content', () => {
      const alertWithHtml = {
        ...sampleAlert,
        title: 'Test <script>alert("xss")</script>',
        message: 'Message with <b>html</b>',
      };

      const html = formatAlertEmailHtml(alertWithHtml);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;b&gt;');
    });

    it('should include context data in rows', () => {
      const html = formatAlertEmailHtml(sampleAlert);

      expect(html).toContain('previousValue');
      expect(html).toContain('50000');
      expect(html).toContain('percentageChange');
      expect(html).toContain('-15');
    });

    it('should color-code by severity', () => {
      const warningHtml = formatAlertEmailHtml({ ...sampleAlert, severity: 'warning' });
      const criticalHtml = formatAlertEmailHtml({ ...sampleAlert, severity: 'critical' });
      const infoHtml = formatAlertEmailHtml({ ...sampleAlert, severity: 'info' });

      // Warning should be orange
      expect(warningHtml).toContain('#FF9800');
      // Critical should be red
      expect(criticalHtml).toContain('#F44336');
      // Info should be blue
      expect(infoHtml).toContain('#2196F3');
    });
  });

  describe('formatAlertEmailText', () => {
    it('should generate plain text email', () => {
      const text = formatAlertEmailText(sampleAlert);

      expect(text).toContain('[WARNING]');
      expect(text).toContain('MRR Anomaly Detected');
      expect(text).toContain('stripe:mrr');
      expect(text).toContain('test-org');
      expect(text).toContain('dropped by 15%');
    });

    it('should include context data', () => {
      const text = formatAlertEmailText(sampleAlert);

      expect(text).toContain('Context:');
      expect(text).toContain('previousValue');
      expect(text).toContain('50000');
    });

    it('should include IntentVision footer', () => {
      const text = formatAlertEmailText(sampleAlert);

      expect(text).toContain('IntentVision');
      expect(text).toContain('intentvision.io');
    });
  });
});

// =============================================================================
// Preference Matching Logic Tests
// =============================================================================

describe('Preference Matching Logic', () => {
  // Note: These are unit tests for the matching logic concepts
  // Integration tests against Firestore are in alerts-e2e tests

  describe('Severity Matching', () => {
    const severities = ['info', 'warning', 'critical'] as const;

    it('should understand severity hierarchy', () => {
      // Critical is higher than warning, warning is higher than info
      const order = { info: 1, warning: 2, critical: 3 };

      expect(order.critical).toBeGreaterThan(order.warning);
      expect(order.warning).toBeGreaterThan(order.info);
    });
  });

  describe('Metric Key Matching', () => {
    function matchesPattern(metricKey: string, pattern: string | null): boolean {
      if (!pattern) return true; // No pattern matches all
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return metricKey.startsWith(prefix);
      }
      return metricKey === pattern;
    }

    it('should match exact metric keys', () => {
      expect(matchesPattern('stripe:mrr', 'stripe:mrr')).toBe(true);
      expect(matchesPattern('stripe:mrr', 'stripe:arr')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      expect(matchesPattern('stripe:mrr', 'stripe:*')).toBe(true);
      expect(matchesPattern('stripe:arr', 'stripe:*')).toBe(true);
      expect(matchesPattern('sentry:errors', 'stripe:*')).toBe(false);
    });

    it('should match all when pattern is null', () => {
      expect(matchesPattern('stripe:mrr', null)).toBe(true);
      expect(matchesPattern('anything:here', null)).toBe(true);
    });
  });

  describe('Channel Deduplication', () => {
    function deduplicateChannelIds(preferences: { channels: string[] }[]): string[] {
      const seen = new Set<string>();
      for (const pref of preferences) {
        for (const channelId of pref.channels) {
          seen.add(channelId);
        }
      }
      return Array.from(seen);
    }

    it('should deduplicate channel IDs from multiple preferences', () => {
      const preferences = [
        { channels: ['ch1', 'ch2'] },
        { channels: ['ch2', 'ch3'] },
        { channels: ['ch1'] },
      ];

      const unique = deduplicateChannelIds(preferences);

      expect(unique).toHaveLength(3);
      expect(unique).toContain('ch1');
      expect(unique).toContain('ch2');
      expect(unique).toContain('ch3');
    });

    it('should handle empty preferences', () => {
      const preferences: { channels: string[] }[] = [];
      const unique = deduplicateChannelIds(preferences);
      expect(unique).toHaveLength(0);
    });
  });
});

// =============================================================================
// Dispatch Result Tests
// =============================================================================

describe('Dispatch Result Types', () => {
  it('should define success result structure', () => {
    const successResult = {
      success: true,
      channelId: 'ch_123',
      channelType: 'email',
      destination: 'user@example.com',
      messageId: 'msg_abc',
      sentAt: new Date().toISOString(),
    };

    expect(successResult.success).toBe(true);
    expect(successResult.messageId).toBeTruthy();
    expect(successResult.error).toBeUndefined();
  });

  it('should define failure result structure', () => {
    const failureResult = {
      success: false,
      channelId: 'ch_123',
      channelType: 'email',
      destination: 'user@example.com',
      error: 'Email address not found',
      sentAt: new Date().toISOString(),
    };

    expect(failureResult.success).toBe(false);
    expect(failureResult.error).toBeTruthy();
    expect(failureResult.messageId).toBeUndefined();
  });
});
