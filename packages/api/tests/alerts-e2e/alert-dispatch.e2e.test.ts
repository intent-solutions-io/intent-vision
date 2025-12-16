/**
 * Alert Dispatch E2E Tests
 *
 * Phase 8: Notification Preferences + Multi-Channel Alerts
 *
 * These tests hit REAL Firestore (dev environment), not an emulator.
 * They are gated by the INTENTVISION_E2E_ALERTS environment variable.
 *
 * Prerequisites:
 * - INTENTVISION_GCP_PROJECT_ID set to your dev GCP project
 * - GOOGLE_APPLICATION_CREDENTIALS pointing to service account JSON
 *   OR running with ADC (gcloud auth application-default login)
 * - INTENTVISION_E2E_ALERTS=1 to enable
 *
 * Run with:
 *   INTENTVISION_E2E_ALERTS=1 npm run test:e2e:alerts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// =============================================================================
// Test Gate - Skip if E2E alerts tests not enabled
// =============================================================================

const E2E_ALERTS_ENABLED = process.env.INTENTVISION_E2E_ALERTS === '1';

describe.skipIf(!E2E_ALERTS_ENABLED)('Alert Dispatch E2E Tests', () => {
  // Test identifiers
  const TEST_ORG_ID = `e2e-alerts-test-org-${Date.now()}`;
  const TEST_EMAIL = 'test@example.com';

  // Dynamically imported modules
  let upsertNotificationChannel: typeof import('../../src/notifications/index.js').upsertNotificationChannel;
  let upsertNotificationPreference: typeof import('../../src/notifications/index.js').upsertNotificationPreference;
  let listNotificationChannelsForOrg: typeof import('../../src/notifications/index.js').listNotificationChannelsForOrg;
  let listNotificationPreferencesForOrg: typeof import('../../src/notifications/index.js').listNotificationPreferencesForOrg;
  let findMatchingPreferences: typeof import('../../src/notifications/index.js').findMatchingPreferences;
  let getChannelsForAlert: typeof import('../../src/notifications/index.js').getChannelsForAlert;
  let dispatchAlert: typeof import('../../src/notifications/index.js').dispatchAlert;
  let getClientInfo: typeof import('../../src/firestore/client.js').getClientInfo;
  let resetFirestore: typeof import('../../src/firestore/client.js').resetFirestore;

  beforeAll(async () => {
    // Dynamic imports to avoid initialization when tests are skipped
    const notificationsModule = await import('../../src/notifications/index.js');
    const clientModule = await import('../../src/firestore/client.js');

    upsertNotificationChannel = notificationsModule.upsertNotificationChannel;
    upsertNotificationPreference = notificationsModule.upsertNotificationPreference;
    listNotificationChannelsForOrg = notificationsModule.listNotificationChannelsForOrg;
    listNotificationPreferencesForOrg = notificationsModule.listNotificationPreferencesForOrg;
    findMatchingPreferences = notificationsModule.findMatchingPreferences;
    getChannelsForAlert = notificationsModule.getChannelsForAlert;
    dispatchAlert = notificationsModule.dispatchAlert;
    getClientInfo = clientModule.getClientInfo;
    resetFirestore = clientModule.resetFirestore;

    // Reset cached state
    resetFirestore();

    // Log configuration
    const info = getClientInfo();
    console.log('\n========================================');
    console.log('Alert Dispatch E2E Test Configuration');
    console.log('========================================');
    console.log(`Mode: ${info.mode}`);
    console.log(`Project: ${info.projectId || 'NOT SET'}`);
    console.log(`Environment: ${info.environment}`);
    console.log(`Test Org: ${TEST_ORG_ID}`);
    console.log('========================================\n');
  });

  afterAll(async () => {
    console.log('\n========================================');
    console.log('Alert Dispatch E2E Tests Complete');
    console.log(`Test data left in org: ${TEST_ORG_ID}`);
    console.log('========================================\n');
  });

  describe('Notification Channel CRUD', () => {
    it('should create an email channel', async () => {
      const channel = await upsertNotificationChannel(TEST_ORG_ID, {
        type: 'email',
        enabled: true,
        name: 'E2E Test Email Channel',
        description: 'Phase 8 E2E test',
        emailAddress: TEST_EMAIL,
      });

      expect(channel.id).toBeTruthy();
      expect(channel.orgId).toBe(TEST_ORG_ID);
      expect(channel.type).toBe('email');
      expect(channel.emailAddress).toBe(TEST_EMAIL);
      expect(channel.enabled).toBe(true);
    });

    it('should create a slack webhook channel (stub)', async () => {
      const channel = await upsertNotificationChannel(TEST_ORG_ID, {
        type: 'slack_webhook',
        enabled: true,
        name: 'E2E Test Slack Channel',
        slackWebhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      });

      expect(channel.id).toBeTruthy();
      expect(channel.type).toBe('slack_webhook');
      expect(channel.slackWebhookUrl).toBeTruthy();
    });

    it('should list channels for org', async () => {
      const channels = await listNotificationChannelsForOrg(TEST_ORG_ID);

      expect(channels.length).toBeGreaterThanOrEqual(2);
      expect(channels.some((ch) => ch.type === 'email')).toBe(true);
      expect(channels.some((ch) => ch.type === 'slack_webhook')).toBe(true);
    });
  });

  describe('Notification Preference CRUD', () => {
    let emailChannelId: string;

    beforeAll(async () => {
      const channels = await listNotificationChannelsForOrg(TEST_ORG_ID);
      const emailChannel = channels.find((ch) => ch.type === 'email');
      emailChannelId = emailChannel!.id;
    });

    it('should create a warning preference linked to email channel', async () => {
      const preference = await upsertNotificationPreference(TEST_ORG_ID, {
        severity: 'warning',
        channels: [emailChannelId],
        enabled: true,
      });

      expect(preference.id).toBeTruthy();
      expect(preference.orgId).toBe(TEST_ORG_ID);
      expect(preference.severity).toBe('warning');
      expect(preference.channels).toContain(emailChannelId);
    });

    it('should create a metric-specific preference', async () => {
      const preference = await upsertNotificationPreference(TEST_ORG_ID, {
        severity: 'critical',
        metricKey: 'stripe:*',
        channels: [emailChannelId],
        enabled: true,
      });

      expect(preference.metricKey).toBe('stripe:*');
      expect(preference.severity).toBe('critical');
    });

    it('should list preferences for org', async () => {
      const preferences = await listNotificationPreferencesForOrg(TEST_ORG_ID);

      expect(preferences.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Preference Matching', () => {
    it('should find matching preferences for warning alert', async () => {
      const matches = await findMatchingPreferences({
        orgId: TEST_ORG_ID,
        metricKey: 'test:metric',
        severity: 'warning',
      });

      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches.some((p) => p.severity === 'warning')).toBe(true);
    });

    it('should find matching preferences for metric-specific pattern', async () => {
      const matches = await findMatchingPreferences({
        orgId: TEST_ORG_ID,
        metricKey: 'stripe:mrr',
        severity: 'critical',
      });

      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches.some((p) => p.metricKey === 'stripe:*')).toBe(true);
    });

    it('should not match unrelated metric patterns', async () => {
      const matches = await findMatchingPreferences({
        orgId: TEST_ORG_ID,
        metricKey: 'sentry:errors',
        severity: 'info',
      });

      // May or may not have matches depending on default preferences
      // But should not match 'stripe:*' pattern
      const stripeMatch = matches.find((p) => p.metricKey === 'stripe:*');
      expect(stripeMatch).toBeUndefined();
    });
  });

  describe('Channel Resolution', () => {
    it('should get channels for alert based on preferences', async () => {
      const channels = await getChannelsForAlert({
        orgId: TEST_ORG_ID,
        metricKey: 'test:metric',
        severity: 'warning',
        title: 'Test Alert',
        message: 'Test message',
        occurredAt: new Date().toISOString(),
      });

      expect(channels.length).toBeGreaterThanOrEqual(1);
      expect(channels.some((ch) => ch.type === 'email')).toBe(true);
    });
  });

  describe('Alert Dispatch', () => {
    it('should dispatch alert to matching channels', async () => {
      const summary = await dispatchAlert({
        orgId: TEST_ORG_ID,
        metricKey: 'test:metric',
        severity: 'warning',
        title: 'E2E Test Alert',
        message: 'This is an E2E test alert from the test suite.',
        context: {
          testId: `e2e-test-${Date.now()}`,
          phase: 'Phase 8',
        },
        occurredAt: new Date().toISOString(),
      });

      expect(summary.channelsSelected).toBeGreaterThanOrEqual(1);
      expect(summary.results.length).toBe(summary.channelsSelected);
      expect(summary.durationMs).toBeGreaterThanOrEqual(0);

      // Log results for inspection
      console.log('\nDispatch Summary:');
      console.log(`  Channels Selected: ${summary.channelsSelected}`);
      console.log(`  Channels Notified: ${summary.channelsNotified}`);
      console.log(`  Channels Failed: ${summary.channelsFailed}`);
      for (const result of summary.results) {
        console.log(`  - ${result.channelType}: ${result.success ? 'OK' : 'FAILED'}`);
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
      }
    });

    it('should handle org with no preferences gracefully', async () => {
      const summary = await dispatchAlert({
        orgId: 'nonexistent-org-' + Date.now(),
        metricKey: 'test:metric',
        severity: 'warning',
        title: 'Test Alert',
        message: 'Test message',
        occurredAt: new Date().toISOString(),
      });

      expect(summary.channelsSelected).toBe(0);
      expect(summary.channelsNotified).toBe(0);
      expect(summary.channelsFailed).toBe(0);
    });
  });
});

// Show message when tests are skipped
if (!E2E_ALERTS_ENABLED) {
  describe('Alert Dispatch E2E Tests (Skipped)', () => {
    it('should be enabled with INTENTVISION_E2E_ALERTS=1', () => {
      console.log('Alert dispatch E2E tests skipped. Set INTENTVISION_E2E_ALERTS=1 to enable.');
      expect(true).toBe(true);
    });
  });
}
