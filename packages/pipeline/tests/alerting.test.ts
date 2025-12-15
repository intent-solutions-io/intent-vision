/**
 * Alerting System Tests
 *
 * Task ID: intentvision-9ru.5
 *
 * Tests for:
 * - Rules engine condition evaluation
 * - Notification channel dispatch
 * - Deduplication and suppression
 * - Lifecycle management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RulesEngine,
  createRulesEngine,
  resetRulesEngine,
  type RuleEvaluationContext,
} from '../src/alert/rules-engine.js';
import {
  WebhookChannel,
  EmailChannel,
  SlackChannel,
  PagerDutyChannel,
  NotificationDispatcher,
  resetNotificationDispatcher,
} from '../src/alert/notification-channels.js';
import {
  DeduplicationManager,
  SuppressionManager,
  AlertFilter,
  resetAlertFilter,
} from '../src/alert/deduplication.js';
import {
  AlertLifecycleManager,
  resetAlertLifecycleManager,
} from '../src/alert/lifecycle.js';
import type {
  AlertRule,
  AlertTrigger,
  AlertSuppression,
  CanonicalMetric,
  Anomaly,
  ForecastPoint,
} from '../../contracts/src/index.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestMetric(overrides: Partial<CanonicalMetric> = {}): CanonicalMetric {
  return {
    metric_id: 'test-metric-1',
    org_id: 'test-org',
    metric_key: 'system.cpu.usage',
    value: 75,
    timestamp: new Date().toISOString(),
    source: 'test',
    dimensions: { host: 'server-1', region: 'us-east' },
    data_quality: {
      validation_status: 'valid',
      completeness_score: 1.0,
      processing_latency_ms: 10,
    },
    ...overrides,
  };
}

function createTestRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    rule_id: 'test-rule-1',
    org_id: 'test-org',
    name: 'High CPU Alert',
    description: 'Alert when CPU exceeds 80%',
    enabled: true,
    metric_key: 'system.cpu.usage',
    condition: {
      type: 'threshold',
      operator: 'gt',
      value: 80,
    },
    severity: 'warning',
    routing: {
      channels: [
        { type: 'webhook', destination: 'https://example.com/webhook' },
      ],
    },
    ...overrides,
  };
}

function createTestTrigger(overrides: Partial<AlertTrigger> = {}): AlertTrigger {
  return {
    alert_id: `alert-${Date.now()}`,
    rule_id: 'test-rule-1',
    org_id: 'test-org',
    triggered_at: new Date().toISOString(),
    severity: 'warning',
    status: 'firing',
    trigger_type: 'threshold',
    title: '[WARNING] High CPU Alert',
    description: 'CPU exceeds threshold',
    metric_context: {
      metric_key: 'system.cpu.usage',
      dimensions: { host: 'server-1' },
      current_value: 85,
      recent_values: [],
    },
    trigger_details: {
      type: 'threshold',
      operator: 'gt',
      threshold: 80,
      actual_value: 85,
    },
    routing: {
      channels: [
        { type: 'webhook', destination: 'https://example.com/webhook' },
      ],
    },
    lifecycle: {
      triggered_at: new Date().toISOString(),
      notification_count: 0,
    },
    ...overrides,
  };
}

// =============================================================================
// Rules Engine Tests
// =============================================================================

describe('RulesEngine', () => {
  let engine: RulesEngine;

  beforeEach(() => {
    resetRulesEngine();
    engine = createRulesEngine();
  });

  describe('Rule Management', () => {
    it('should register and retrieve rules', () => {
      const rule = createTestRule();
      engine.registerRule(rule);

      expect(engine.getRule(rule.rule_id)).toEqual(rule);
      expect(engine.listRules()).toHaveLength(1);
    });

    it('should unregister rules', () => {
      const rule = createTestRule();
      engine.registerRule(rule);
      engine.unregisterRule(rule.rule_id);

      expect(engine.getRule(rule.rule_id)).toBeUndefined();
    });

    it('should list rules by org', () => {
      engine.registerRule(createTestRule({ org_id: 'org-1' }));
      engine.registerRule(createTestRule({ rule_id: 'rule-2', org_id: 'org-2' }));

      const org1Rules = engine.listRules('org-1');
      expect(org1Rules).toHaveLength(1);
      expect(org1Rules[0].org_id).toBe('org-1');
    });
  });

  describe('Threshold Conditions', () => {
    it('should trigger on gt condition', () => {
      const rule = createTestRule({
        condition: { type: 'threshold', operator: 'gt', value: 80 },
      });
      engine.registerRule(rule);

      const context: RuleEvaluationContext = {
        metric: createTestMetric({ value: 85 }),
      };

      const results = engine.evaluateRules(context);
      expect(results).toHaveLength(1);
      expect(results[0].matched).toBe(true);
      expect(results[0].trigger).toBeDefined();
    });

    it('should not trigger when below threshold', () => {
      const rule = createTestRule({
        condition: { type: 'threshold', operator: 'gt', value: 80 },
      });
      engine.registerRule(rule);

      const context: RuleEvaluationContext = {
        metric: createTestMetric({ value: 70 }),
      };

      const results = engine.evaluateRules(context);
      expect(results).toHaveLength(1);
      expect(results[0].matched).toBe(false);
    });

    it('should handle lt condition', () => {
      const rule = createTestRule({
        condition: { type: 'threshold', operator: 'lt', value: 20 },
      });
      engine.registerRule(rule);

      const context: RuleEvaluationContext = {
        metric: createTestMetric({ value: 10 }),
      };

      const results = engine.evaluateRules(context);
      expect(results[0].matched).toBe(true);
    });

    it('should handle eq condition', () => {
      const rule = createTestRule({
        condition: { type: 'threshold', operator: 'eq', value: 50 },
      });
      engine.registerRule(rule);

      const context: RuleEvaluationContext = {
        metric: createTestMetric({ value: 50 }),
      };

      const results = engine.evaluateRules(context);
      expect(results[0].matched).toBe(true);
    });
  });

  describe('Anomaly Conditions', () => {
    it('should trigger on anomaly above severity', () => {
      const rule = createTestRule({
        condition: { type: 'anomaly', min_severity: 'medium' },
      });
      engine.registerRule(rule);

      const anomaly: Anomaly = {
        anomaly_id: 'anom-1',
        timestamp: new Date().toISOString(),
        value: 100,
        expected_value: 50,
        severity: 'high',
        confidence: 0.95,
        detection_method: 'ensemble',
      };

      const context: RuleEvaluationContext = {
        metric: createTestMetric(),
        anomalies: [anomaly],
      };

      const results = engine.evaluateRules(context);
      expect(results[0].matched).toBe(true);
    });

    it('should not trigger when anomaly below severity', () => {
      const rule = createTestRule({
        condition: { type: 'anomaly', min_severity: 'high' },
      });
      engine.registerRule(rule);

      const anomaly: Anomaly = {
        anomaly_id: 'anom-1',
        timestamp: new Date().toISOString(),
        value: 60,
        expected_value: 50,
        severity: 'low',
        confidence: 0.8,
        detection_method: 'ensemble',
      };

      const context: RuleEvaluationContext = {
        metric: createTestMetric(),
        anomalies: [anomaly],
      };

      const results = engine.evaluateRules(context);
      expect(results[0].matched).toBe(false);
    });
  });

  describe('Forecast Conditions', () => {
    it('should trigger when forecast breaches threshold', () => {
      const rule = createTestRule({
        condition: { type: 'forecast', horizon_hours: 24, threshold: 90 },
      });
      engine.registerRule(rule);

      const forecast: ForecastPoint = {
        timestamp: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        value: 95,
        intervals: { '0.95': [85, 105] },
      };

      const context: RuleEvaluationContext = {
        metric: createTestMetric(),
        forecasts: [forecast],
      };

      const results = engine.evaluateRules(context);
      expect(results[0].matched).toBe(true);
    });
  });

  describe('Rate of Change Conditions', () => {
    it('should trigger on excessive rate', () => {
      const rule = createTestRule({
        condition: { type: 'rate_of_change', max_rate: 10, rate_unit: 'per_minute' },
      });
      engine.registerRule(rule);

      const context: RuleEvaluationContext = {
        metric: createTestMetric({ value: 80 }),
        previousValue: 60,
      };

      const results = engine.evaluateRules(context);
      expect(results[0].matched).toBe(true);
    });
  });

  describe('Missing Data Conditions', () => {
    it('should trigger when data is missing', () => {
      const rule = createTestRule({
        condition: { type: 'missing_data', expected_interval_ms: 60000 },
      });
      engine.registerRule(rule);

      const context: RuleEvaluationContext = {
        metric: createTestMetric(),
        lastSeenAt: new Date(Date.now() - 120000).toISOString(),
      };

      const results = engine.evaluateRules(context);
      expect(results[0].matched).toBe(true);
    });
  });

  describe('Dimension Filters', () => {
    it('should only match metrics with matching dimensions', () => {
      const rule = createTestRule({
        dimension_filters: { region: 'us-east' },
      });
      engine.registerRule(rule);

      const matchingMetric = createTestMetric({
        value: 85,
        dimensions: { host: 'server-1', region: 'us-east' },
      });

      const nonMatchingMetric = createTestMetric({
        value: 85,
        dimensions: { host: 'server-2', region: 'eu-west' },
      });

      expect(engine.evaluateRules({ metric: matchingMetric })[0].matched).toBe(true);
      expect(engine.evaluateRules({ metric: nonMatchingMetric })).toHaveLength(0);
    });
  });
});

// =============================================================================
// Notification Channel Tests
// =============================================================================

describe('Notification Channels', () => {
  beforeEach(() => {
    resetNotificationDispatcher();
  });

  describe('WebhookChannel', () => {
    it('should send webhook notification', async () => {
      const channel = new WebhookChannel();
      const trigger = createTestTrigger();

      const result = await channel.send({
        alert: trigger,
        channel: { type: 'webhook', destination: 'https://example.com/hook' },
        attempt: 1,
      });

      expect(result.success).toBe(true);
      expect(result.channelType).toBe('webhook');
    });

    it('should handle disabled channel', async () => {
      const channel = new WebhookChannel({ enabled: false });
      const trigger = createTestTrigger();

      const result = await channel.send({
        alert: trigger,
        channel: { type: 'webhook', destination: 'https://example.com/hook' },
        attempt: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel disabled');
    });
  });

  describe('EmailChannel', () => {
    it('should send email notification', async () => {
      const channel = new EmailChannel();
      const trigger = createTestTrigger();

      const result = await channel.send({
        alert: trigger,
        channel: { type: 'email', destination: 'alerts@example.com' },
        attempt: 1,
      });

      expect(result.success).toBe(true);
      expect(result.channelType).toBe('email');
    });
  });

  describe('SlackChannel', () => {
    it('should send slack notification', async () => {
      const channel = new SlackChannel();
      const trigger = createTestTrigger();

      const result = await channel.send({
        alert: trigger,
        channel: { type: 'slack', destination: 'https://hooks.slack.com/xxx' },
        attempt: 1,
      });

      expect(result.success).toBe(true);
      expect(result.channelType).toBe('slack');
    });
  });

  describe('PagerDutyChannel', () => {
    it('should send pagerduty notification', async () => {
      const channel = new PagerDutyChannel();
      const trigger = createTestTrigger();

      const result = await channel.send({
        alert: trigger,
        channel: { type: 'pagerduty', destination: 'routing-key-xxx' },
        attempt: 1,
      });

      expect(result.success).toBe(true);
      expect(result.channelType).toBe('pagerduty');
    });
  });

  describe('NotificationDispatcher', () => {
    it('should dispatch to all channels', async () => {
      const dispatcher = new NotificationDispatcher();
      const trigger = createTestTrigger({
        routing: {
          channels: [
            { type: 'webhook', destination: 'https://example.com/hook' },
            { type: 'email', destination: 'alerts@example.com' },
          ],
        },
      });

      const results = await dispatcher.dispatch(trigger);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should handle unknown channel type', async () => {
      const dispatcher = new NotificationDispatcher();
      const trigger = createTestTrigger({
        routing: {
          channels: [{ type: 'unknown' as any, destination: 'nowhere' }],
        },
      });

      const results = await dispatcher.dispatch(trigger);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Unknown channel type');
    });
  });
});

// =============================================================================
// Deduplication Tests
// =============================================================================

describe('Deduplication', () => {
  let dedupManager: DeduplicationManager;
  let testId: string;

  beforeEach(() => {
    resetAlertFilter();
    dedupManager = new DeduplicationManager();
    // Unique test ID per test to avoid cross-test interference
    testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  describe('DeduplicationManager', () => {
    it('should allow first alert', async () => {
      const trigger = createTestTrigger({
        alert_id: `allow-first-${testId}`,
        routing: { channels: [], dedup_key: `dedup-first-${testId}` },
      });
      const result = await dedupManager.checkDedup(trigger);

      expect(result.shouldSend).toBe(true);
      expect(result.reason).toBe('New alert');
    });

    it('should deduplicate identical alerts', async () => {
      const dedupKey = `dedup-identical-${testId}`;
      const trigger = createTestTrigger({
        alert_id: `identical-${testId}`,
        routing: { channels: [], dedup_key: dedupKey },
      });

      // First call should allow
      const first = await dedupManager.checkDedup(trigger);
      expect(first.shouldSend).toBe(true);

      // Second call should dedupe
      const second = await dedupManager.checkDedup(trigger);
      expect(second.shouldSend).toBe(false);
      expect(second.previousAlert).toBeDefined();
    });

    it('should allow after dedup window expires', async () => {
      const manager = new DeduplicationManager({ defaultWindowMs: 100 });
      const dedupKey = `dedup-expiry-${testId}`;
      const trigger = createTestTrigger({
        alert_id: `expiry-${testId}`,
        routing: { channels: [], dedup_key: dedupKey },
      });

      await manager.checkDedup(trigger);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be new after cleanup
      await manager.cleanup();
      const result = await manager.checkDedup(trigger);
      expect(result.shouldSend).toBe(true);
    });

    it('should enforce rate limits', async () => {
      const uniqueOrgId = `rate-limit-org-${testId}`;
      const manager = new DeduplicationManager({ rateLimitPerMinute: 2 });

      // Create 3 unique alerts
      for (let i = 0; i < 3; i++) {
        const trigger = createTestTrigger({
          alert_id: `rate-limit-${testId}-${i}`,
          org_id: uniqueOrgId,
          routing: { channels: [], dedup_key: `rate-limit-dedup-${testId}-${i}` },
        });
        await manager.checkDedup(trigger);
      }

      const result = await manager.checkRateLimit(uniqueOrgId);
      expect(result.shouldSend).toBe(false);
      expect(result.reason).toContain('Rate limit exceeded');
    });
  });

  describe('SuppressionManager', () => {
    it('should suppress during mute window', () => {
      const manager = new SuppressionManager();
      const trigger = createTestTrigger();

      // Create mute window for current time
      const now = new Date();
      const startHour = now.getHours();
      const endHour = (startHour + 1) % 24;
      const start = `${startHour.toString().padStart(2, '0')}:00`;
      const end = `${endHour.toString().padStart(2, '0')}:00`;

      const suppression: AlertSuppression = {
        mute_windows: [{ start, end }],
      };

      const result = manager.checkSuppression(trigger, suppression);
      expect(result.suppressed).toBe(true);
    });

    it('should not suppress outside mute window', () => {
      const manager = new SuppressionManager();
      const trigger = createTestTrigger();

      // Create mute window for different time
      const now = new Date();
      const startHour = (now.getHours() + 2) % 24;
      const endHour = (startHour + 1) % 24;
      const start = `${startHour.toString().padStart(2, '0')}:00`;
      const end = `${endHour.toString().padStart(2, '0')}:00`;

      const suppression: AlertSuppression = {
        mute_windows: [{ start, end }],
      };

      const result = manager.checkSuppression(trigger, suppression);
      expect(result.suppressed).toBe(false);
    });
  });

  describe('AlertFilter', () => {
    it('should combine all checks', async () => {
      const filter = new AlertFilter();
      // Use unique alert ID and dedup key to avoid interference from previous tests
      const uniqueId = `filter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const trigger = createTestTrigger({
        alert_id: uniqueId,
        routing: {
          channels: [{ type: 'webhook', destination: 'https://example.com' }],
          dedup_key: uniqueId,
        },
      });

      const result = await filter.shouldProcess(trigger);
      expect(result.shouldProcess).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Lifecycle Tests
// =============================================================================

describe('AlertLifecycleManager', () => {
  let lifecycle: AlertLifecycleManager;
  let testOrgId: string;

  beforeEach(() => {
    resetAlertLifecycleManager();
    lifecycle = new AlertLifecycleManager();
    // Use unique org ID per test to avoid cross-test interference
    testOrgId = `test-org-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  describe('State Management', () => {
    it('should create alert with firing status', async () => {
      const trigger = createTestTrigger();
      const state = await lifecycle.createAlert(trigger);

      expect(state.status).toBe('firing');
      expect(state.alertId).toBe(trigger.alert_id);
      expect(state.escalationLevel).toBe(0);
    });

    it('should retrieve alert state', async () => {
      const trigger = createTestTrigger();
      await lifecycle.createAlert(trigger);

      const state = await lifecycle.getState(trigger.alert_id);
      expect(state).toBeDefined();
      expect(state?.status).toBe('firing');
    });

    it('should list alerts by status', async () => {
      const trigger1 = createTestTrigger({ alert_id: `alert-1-${Date.now()}`, org_id: testOrgId });
      const trigger2 = createTestTrigger({ alert_id: `alert-2-${Date.now()}`, org_id: testOrgId });

      await lifecycle.createAlert(trigger1);
      await lifecycle.createAlert(trigger2);
      await lifecycle.acknowledge(trigger1.alert_id, 'user-1');

      const firing = await lifecycle.listAlerts(testOrgId, ['firing']);
      const acknowledged = await lifecycle.listAlerts(testOrgId, ['acknowledged']);

      expect(firing).toHaveLength(1);
      expect(acknowledged).toHaveLength(1);
    });
  });

  describe('State Transitions', () => {
    it('should acknowledge alert', async () => {
      const trigger = createTestTrigger();
      await lifecycle.createAlert(trigger);

      const state = await lifecycle.acknowledge(trigger.alert_id, 'user@example.com');

      expect(state?.status).toBe('acknowledged');
      expect(state?.acknowledgedBy).toBe('user@example.com');
      expect(state?.acknowledgedAt).toBeDefined();
    });

    it('should resolve alert', async () => {
      const trigger = createTestTrigger();
      await lifecycle.createAlert(trigger);

      const state = await lifecycle.resolve(trigger.alert_id, 'user@example.com', 'Issue fixed');

      expect(state?.status).toBe('resolved');
      expect(state?.resolvedBy).toBe('user@example.com');
      expect(state?.resolvedAt).toBeDefined();
    });

    it('should escalate alert', async () => {
      const trigger = createTestTrigger();
      await lifecycle.createAlert(trigger);

      const state = await lifecycle.escalate(trigger.alert_id, 'No response');

      expect(state?.status).toBe('escalated');
      expect(state?.escalationLevel).toBe(1);
      expect(state?.escalatedAt).toBeDefined();
    });

    it('should not escalate beyond max level', async () => {
      const lifecycle = new AlertLifecycleManager({ maxEscalationLevel: 2 });
      const trigger = createTestTrigger();
      await lifecycle.createAlert(trigger);

      await lifecycle.escalate(trigger.alert_id);
      await lifecycle.escalate(trigger.alert_id);
      const state = await lifecycle.escalate(trigger.alert_id);

      expect(state?.escalationLevel).toBe(2);
    });

    it('should track notification count', async () => {
      const trigger = createTestTrigger();
      await lifecycle.createAlert(trigger);

      await lifecycle.recordNotification(trigger.alert_id);
      await lifecycle.recordNotification(trigger.alert_id);

      const state = await lifecycle.getState(trigger.alert_id);
      expect(state?.notificationCount).toBe(2);
    });
  });

  describe('History Tracking', () => {
    it('should record transition history', async () => {
      const trigger = createTestTrigger();
      await lifecycle.createAlert(trigger);
      await lifecycle.acknowledge(trigger.alert_id, 'user');
      await lifecycle.resolve(trigger.alert_id, 'user');

      const history = await lifecycle.getHistory(trigger.alert_id);
      expect(history.length).toBeGreaterThanOrEqual(3);
      expect(history.map((h) => h.toStatus)).toContain('acknowledged');
      expect(history.map((h) => h.toStatus)).toContain('resolved');
    });
  });

  describe('Statistics', () => {
    it('should calculate statistics', async () => {
      const trigger = createTestTrigger({ org_id: testOrgId });
      await lifecycle.createAlert(trigger);

      const stats = await lifecycle.getStatistics(testOrgId);
      expect(stats.total).toBeGreaterThanOrEqual(1);
      expect(stats.byStatus.firing).toBeGreaterThanOrEqual(1);
    });
  });
});
