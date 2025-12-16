/**
 * Live Firestore Tests - Metrics Demo
 *
 * Phase 7: Cloud Firestore Wiring + Live Tests
 * Beads Task: intentvision-cyy
 *
 * These tests hit REAL Firestore (dev environment), not an emulator.
 * They are gated by the INTENTVISION_FIRESTORE_LIVE_TESTS environment variable.
 *
 * Prerequisites:
 * - INTENTVISION_GCP_PROJECT_ID set to your dev GCP project
 * - GOOGLE_APPLICATION_CREDENTIALS pointing to service account JSON
 *   OR running with ADC (gcloud auth application-default login)
 * - INTENTVISION_FIRESTORE_LIVE_TESTS=1 to enable
 *
 * Run with:
 *   INTENTVISION_FIRESTORE_LIVE_TESTS=1 npm run test:firestore:live
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// =============================================================================
// Test Gate - Skip if live tests not enabled
// =============================================================================

const LIVE_TESTS_ENABLED = process.env.INTENTVISION_FIRESTORE_LIVE_TESTS === '1';

// Skip tests gracefully when not enabled
describe.skipIf(!LIVE_TESTS_ENABLED)('Live Firestore Tests', () => {
  // Test identifiers - clearly marked for easy cleanup
  const TEST_ORG_ID = 'dev-firestore-test-org';
  const TEST_METRIC_ID = `daily-signups-live-test-${Date.now()}`;
  const TEST_METRIC_NAME = 'Daily Signups (Live Test)';

  // Dynamically imported modules (to avoid credential errors when skipped)
  let getDb: typeof import('../../src/firestore/client.js').getDb;
  let resetFirestore: typeof import('../../src/firestore/client.js').resetFirestore;
  let getClientInfo: typeof import('../../src/firestore/client.js').getClientInfo;
  let getEnvironment: typeof import('../../src/firestore/client.js').getEnvironment;
  let getMetricsRepository: typeof import('../../src/data/metrics-repository.js').getMetricsRepository;
  let resetMetricsRepository: typeof import('../../src/data/metrics-repository.js').resetMetricsRepository;
  let ingestDemoMetric: typeof import('../../src/services/forecast-demo-service.js').ingestDemoMetric;
  let runDemoForecast: typeof import('../../src/services/forecast-demo-service.js').runDemoForecast;
  let getDemoMetricData: typeof import('../../src/services/forecast-demo-service.js').getDemoMetricData;

  beforeAll(async () => {
    // Dynamic imports to avoid initialization when tests are skipped
    const clientModule = await import('../../src/firestore/client.js');
    const repoModule = await import('../../src/data/metrics-repository.js');
    const serviceModule = await import('../../src/services/forecast-demo-service.js');

    getDb = clientModule.getDb;
    resetFirestore = clientModule.resetFirestore;
    getClientInfo = clientModule.getClientInfo;
    getEnvironment = clientModule.getEnvironment;
    getMetricsRepository = repoModule.getMetricsRepository;
    resetMetricsRepository = repoModule.resetMetricsRepository;
    ingestDemoMetric = serviceModule.ingestDemoMetric;
    runDemoForecast = serviceModule.runDemoForecast;
    getDemoMetricData = serviceModule.getDemoMetricData;

    // Reset any cached state
    resetFirestore();
    resetMetricsRepository();

    // Log configuration
    const info = getClientInfo();
    console.log('\n========================================');
    console.log('Live Firestore Test Configuration');
    console.log('========================================');
    console.log(`Mode: ${info.mode}`);
    console.log(`Project: ${info.projectId || 'NOT SET'}`);
    console.log(`Environment: ${info.environment}`);
    console.log(`Test Org: ${TEST_ORG_ID}`);
    console.log(`Test Metric: ${TEST_METRIC_ID}`);
    console.log('========================================\n');

    // Verify we're in cloud mode (not emulator)
    if (info.mode === 'emulator') {
      console.warn('WARNING: Running against emulator, not cloud Firestore');
    }
  });

  afterAll(async () => {
    // Optional: Clean up test data
    // For now, we leave test data for inspection
    // A cleanup script can purge docs with 'live-test' in the ID
    console.log('\n========================================');
    console.log('Live Firestore Tests Complete');
    console.log(`Test data left in: envs/${getEnvironment()}/orgs/${TEST_ORG_ID}/`);
    console.log('========================================\n');
  });

  describe('Firestore Client', () => {
    it('should connect to cloud Firestore', async () => {
      const db = getDb();
      expect(db).toBeDefined();

      const info = getClientInfo();
      expect(info.initialized).toBe(true);
      expect(info.projectId).toBeDefined();
    });

    it('should be configured for correct environment', () => {
      const info = getClientInfo();
      expect(['dev', 'stage', 'prod', 'test']).toContain(info.environment);
    });
  });

  describe('MetricsRepository - Live Operations', () => {
    it('should upsert a metric definition', async () => {
      const repo = getMetricsRepository();

      await repo.upsertMetric({
        orgId: TEST_ORG_ID,
        metricId: TEST_METRIC_ID,
        name: TEST_METRIC_NAME,
        unit: 'count',
        description: 'Test metric for live Firestore tests',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Verify it was created
      const metric = await repo.getMetric(TEST_ORG_ID, TEST_METRIC_ID);
      expect(metric).not.toBeNull();
      expect(metric?.name).toBe(TEST_METRIC_NAME);
      expect(metric?.unit).toBe('count');
    });

    it('should append time series points', async () => {
      const repo = getMetricsRepository();

      // Generate 30 days of synthetic data
      const points: Array<{ timestamp: string; value: number }> = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        points.push({
          timestamp: date.toISOString(),
          value: Math.round(100 + Math.random() * 50 + i * 2), // Growing trend
        });
      }

      const count = await repo.appendPoints(TEST_ORG_ID, TEST_METRIC_ID, points);
      expect(count).toBe(30);
    });

    it('should read back recent points', async () => {
      const repo = getMetricsRepository();

      const points = await repo.getRecentPoints(TEST_ORG_ID, TEST_METRIC_ID, 30);
      expect(points.length).toBeGreaterThanOrEqual(30);

      // Verify points are in chronological order
      for (let i = 1; i < points.length; i++) {
        const prevTime = new Date(points[i - 1].timestamp).getTime();
        const currTime = new Date(points[i].timestamp).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });
  });

  describe('Forecast Service - Live Operations', () => {
    it('should ingest demo metric via service', async () => {
      const result = await ingestDemoMetric({
        orgId: TEST_ORG_ID,
        metricId: `${TEST_METRIC_ID}-service`,
        metricName: 'Service Test Metric',
        unit: 'USD',
        description: 'Test metric ingested via service',
        points: [
          { timestamp: new Date(Date.now() - 86400000 * 5).toISOString(), value: 1000 },
          { timestamp: new Date(Date.now() - 86400000 * 4).toISOString(), value: 1050 },
          { timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), value: 1100 },
          { timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), value: 1080 },
          { timestamp: new Date(Date.now() - 86400000 * 1).toISOString(), value: 1150 },
        ],
      });

      expect(result.pointsIngested).toBe(5);
      expect(result.orgId).toBe(TEST_ORG_ID);
    });

    it('should run forecast with stub backend', async () => {
      const result = await runDemoForecast({
        orgId: TEST_ORG_ID,
        metricId: `${TEST_METRIC_ID}-service`,
        horizonDays: 7,
        backend: 'stub',
      });

      expect(result).not.toBeNull();
      expect(result.forecastId).toBeTruthy();
      expect(result.backend).toBe('stub');
      expect(result.points.length).toBe(7);
      expect(result.inputPointsCount).toBeGreaterThanOrEqual(5);
    });

    it('should run forecast with stat backend', async () => {
      const result = await runDemoForecast({
        orgId: TEST_ORG_ID,
        metricId: `${TEST_METRIC_ID}-service`,
        horizonDays: 14,
        backend: 'stat',
      });

      expect(result).not.toBeNull();
      expect(result.forecastId).toBeTruthy();
      expect(result.backend).toBe('stat');
      expect(result.points.length).toBe(14);
      expect(result.modelInfo?.name).toContain('Statistical');
    });

    it('should retrieve metric data with latest forecast', async () => {
      const data = await getDemoMetricData(TEST_ORG_ID, `${TEST_METRIC_ID}-service`);

      expect(data).not.toBeNull();
      expect(data?.metric.name).toBe('Service Test Metric');
      expect(data?.recentPoints.length).toBeGreaterThanOrEqual(5);
      expect(data?.latestForecast).not.toBeNull();
      expect(data?.latestForecast?.points.length).toBeGreaterThan(0);
    });
  });

  describe('E2E Flow - Live', () => {
    const E2E_METRIC_ID = `e2e-live-test-${Date.now()}`;

    it('should complete full ingest → forecast → retrieve flow', async () => {
      // Step 1: Ingest
      const ingestResult = await ingestDemoMetric({
        orgId: TEST_ORG_ID,
        metricId: E2E_METRIC_ID,
        metricName: 'E2E Live Test MRR',
        unit: 'USD',
        points: Array.from({ length: 60 }, (_, i) => ({
          timestamp: new Date(Date.now() - (60 - i) * 86400000).toISOString(),
          value: 10000 + i * 50 + Math.random() * 200,
        })),
      });

      expect(ingestResult.pointsIngested).toBe(60);

      // Step 2: Forecast
      const forecastResult = await runDemoForecast({
        orgId: TEST_ORG_ID,
        metricId: E2E_METRIC_ID,
        horizonDays: 30,
        backend: 'stat',
        statMethod: 'ewma',
      });

      expect(forecastResult.inputPointsCount).toBe(60);
      expect(forecastResult.outputPointsCount).toBe(30);
      expect(forecastResult.backend).toBe('stat');

      // Step 3: Retrieve
      const data = await getDemoMetricData(TEST_ORG_ID, E2E_METRIC_ID);

      expect(data).not.toBeNull();
      expect(data?.metric.name).toBe('E2E Live Test MRR');
      expect(data?.recentPoints.length).toBe(60);
      expect(data?.latestForecast?.points.length).toBe(30);

      console.log('\nE2E Live Test Summary:');
      console.log(`  Ingested: ${ingestResult.pointsIngested} points`);
      console.log(`  Forecast: ${forecastResult.outputPointsCount} points (${forecastResult.backend})`);
      console.log(`  Model: ${forecastResult.modelInfo?.name}`);
      console.log(`  Forecast ID: ${forecastResult.forecastId}`);
    });
  });
});

// Show message when tests are skipped
if (!LIVE_TESTS_ENABLED) {
  describe('Live Firestore Tests (Skipped)', () => {
    it('should be enabled with INTENTVISION_FIRESTORE_LIVE_TESTS=1', () => {
      console.log('Live Firestore tests skipped. Set INTENTVISION_FIRESTORE_LIVE_TESTS=1 to enable.');
      expect(true).toBe(true);
    });
  });
}
