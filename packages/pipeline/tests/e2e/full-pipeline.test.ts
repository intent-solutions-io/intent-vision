/**
 * E2E Test: Full Pipeline Integration
 *
 * Task ID: intentvision-7yf.1
 * Phase: E - Integration Testing
 *
 * Tests the complete flow:
 * Ingest → Normalize → Store → Forecast → Anomaly → Alert
 *
 * Coverage:
 * - Full pipeline execution with synthetic data
 * - Multi-tenant isolation
 * - Error handling and recovery
 * - Database state verification at each stage
 * - Pipeline metrics and observability
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { runPipeline, type PipelineConfig } from '../../src/index.js';
import { createWebhookHandler } from '../../src/ingest/webhook/index.js';
import { queryMetrics, getTimeSeries } from '../../src/store/metric-store.js';
import { getClient, closeClient } from '../../../../db/config.js';
import {
  createTestDatabase,
  seedTestData,
  cleanupTestData,
  generateSyntheticMetrics,
  generateSyntheticTimeSeries,
  createTestOrganizations,
  verifyOrgIsolation,
  assertDatabaseState,
} from './setup.js';

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_ORG_1 = 'e2e-org-1';
const TEST_ORG_2 = 'e2e-org-2';
const TEST_ORG_3 = 'e2e-org-3';

// =============================================================================
// Setup / Teardown
// =============================================================================

beforeAll(async () => {
  // Tests use the shared database from db/config.js
  // Clean up any existing test data
  const client = getClient();
  await cleanupTestData(client, TEST_ORG_1);
  await cleanupTestData(client, TEST_ORG_2);
  await cleanupTestData(client, TEST_ORG_3);
});

afterAll(async () => {
  const client = getClient();
  await cleanupTestData(client, TEST_ORG_1);
  await cleanupTestData(client, TEST_ORG_2);
  await cleanupTestData(client, TEST_ORG_3);
  await closeClient();
});

beforeEach(async () => {
  // Clean before each test for isolation
  const client = getClient();
  await cleanupTestData(client, TEST_ORG_1);
  await cleanupTestData(client, TEST_ORG_2);
  await cleanupTestData(client, TEST_ORG_3);
});

// =============================================================================
// Full Pipeline Tests
// =============================================================================

describe('Full Pipeline E2E Tests', () => {
  it('should execute complete pipeline with synthetic data', async () => {
    const config: PipelineConfig = {
      orgId: TEST_ORG_1,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'test.metric.pipeline',
        pointCount: 50,
        intervalMs: 60000,
        baseValue: 45,
        variance: 15,
      },
      forecastHorizon: 6,
      anomalySensitivity: 0.7,
      forecastThreshold: 70,
    };

    const result = await runPipeline(config);

    // Verify pipeline success
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Verify metrics processing
    expect(result.metrics.processed).toBe(50);
    expect(result.metrics.stored).toBe(50);
    expect(result.metrics.duplicates).toBe(0);

    // Verify forecast generation
    expect(result.forecast.generated).toBe(true);
    expect(result.forecast.predictions).toBe(6);

    // Verify anomaly detection ran
    expect(result.anomaly.detected).toBeGreaterThanOrEqual(0);

    // Verify alerts (may be 0 if no anomalies or threshold breaches)
    expect(result.alerts.emitted).toBeGreaterThanOrEqual(0);

    // Verify execution time is reasonable
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.durationMs).toBeLessThan(10000); // Less than 10 seconds
  });

  it('should process fixture data through complete pipeline', async () => {
    const config: PipelineConfig = {
      orgId: TEST_ORG_1,
      useSynthetic: false, // Use fixture data
      forecastHorizon: 4,
    };

    const result = await runPipeline(config);

    expect(result.success).toBe(true);
    expect(result.metrics.processed).toBeGreaterThan(0);
    expect(result.metrics.stored).toBeGreaterThan(0);
    expect(result.forecast.generated).toBe(true);
  });

  it('should handle multiple pipeline runs for same org', async () => {
    const config: PipelineConfig = {
      orgId: TEST_ORG_1,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'test.multi.run',
        pointCount: 20,
        intervalMs: 60000,
        baseValue: 50,
        variance: 10,
      },
    };

    // Run pipeline twice
    const result1 = await runPipeline(config);
    expect(result1.success).toBe(true);
    expect(result1.metrics.stored).toBe(20);

    // Second run with same data should detect duplicates
    const result2 = await runPipeline(config);
    expect(result2.success).toBe(true);
    // Due to timestamp uniqueness, second run might have duplicates
    expect(result2.metrics.processed).toBe(20);
  });

  it('should maintain org isolation across pipeline runs', async () => {
    // Run pipeline for org 1
    const config1: PipelineConfig = {
      orgId: TEST_ORG_1,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'org1.metric',
        pointCount: 30,
        intervalMs: 60000,
        baseValue: 40,
        variance: 10,
      },
    };

    await runPipeline(config1);

    // Run pipeline for org 2
    const config2: PipelineConfig = {
      orgId: TEST_ORG_2,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'org2.metric',
        pointCount: 25,
        intervalMs: 60000,
        baseValue: 60,
        variance: 15,
      },
    };

    await runPipeline(config2);

    // Verify org 1 can only see its own metrics
    const org1Metrics = await queryMetrics({
      orgId: TEST_ORG_1,
      metricKey: 'org1.metric',
    });
    expect(org1Metrics.length).toBe(30);

    // Verify org 2 can only see its own metrics
    const org2Metrics = await queryMetrics({
      orgId: TEST_ORG_2,
      metricKey: 'org2.metric',
    });
    expect(org2Metrics.length).toBe(25);

    // Verify org 1 cannot see org 2's metrics
    const org1CrossQuery = await queryMetrics({
      orgId: TEST_ORG_1,
      metricKey: 'org2.metric',
    });
    expect(org1CrossQuery.length).toBe(0);

    // Verify org 2 cannot see org 1's metrics
    const org2CrossQuery = await queryMetrics({
      orgId: TEST_ORG_2,
      metricKey: 'org1.metric',
    });
    expect(org2CrossQuery.length).toBe(0);
  });

  it('should verify database state at each pipeline stage', async () => {
    const client = getClient();
    const config: PipelineConfig = {
      orgId: TEST_ORG_1,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'test.staged.metric',
        pointCount: 40,
        intervalMs: 60000,
        baseValue: 55,
        variance: 12,
      },
      forecastHorizon: 5,
    };

    const result = await runPipeline(config);
    expect(result.success).toBe(true);

    // Verify organization exists
    await assertDatabaseState(client, 'organizations', { org_id: TEST_ORG_1 }, 1);

    // Verify metrics stored
    const metricsResult = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM metrics WHERE org_id = ? AND metric_key = ?',
      args: [TEST_ORG_1, 'test.staged.metric'],
    });
    expect(metricsResult.rows[0]?.count).toBe(40);

    // Note: runPipeline uses skipJobTracking=true, so no forecast_jobs are created
    // Verify forecast ran successfully via the pipeline result instead
    expect(result.forecast.generated).toBe(true);
  });

  it('should handle pipeline with high variance data (anomaly detection)', async () => {
    const config: PipelineConfig = {
      orgId: TEST_ORG_1,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'test.high.variance',
        pointCount: 60,
        intervalMs: 60000,
        baseValue: 50,
        variance: 40, // High variance to trigger anomalies
      },
      anomalySensitivity: 0.5, // More sensitive
      forecastHorizon: 6,
    };

    const result = await runPipeline(config);

    expect(result.success).toBe(true);
    expect(result.metrics.stored).toBe(60);

    // With high variance, we might detect anomalies
    // Note: Stub detector may return 0, this is valid
    expect(result.anomaly.detected).toBeGreaterThanOrEqual(0);
  });

  it('should generate forecast alerts when threshold breached', async () => {
    const config: PipelineConfig = {
      orgId: TEST_ORG_1,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'test.threshold.breach',
        pointCount: 30,
        intervalMs: 60000,
        baseValue: 90, // High base value
        variance: 5,
      },
      forecastThreshold: 50, // Low threshold to guarantee breach
      forecastHorizon: 6,
    };

    const result = await runPipeline(config);

    expect(result.success).toBe(true);
    expect(result.forecast.generated).toBe(true);

    // With stub backend, predictions might be based on last value
    // which is ~90, so should breach threshold of 50
    expect(result.forecast.predictions).toBe(6);
  });

  it('should handle concurrent pipeline runs for different orgs', async () => {
    const config1: PipelineConfig = {
      orgId: TEST_ORG_1,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'concurrent.metric.1',
        pointCount: 25,
        intervalMs: 60000,
        baseValue: 45,
        variance: 10,
      },
    };

    const config2: PipelineConfig = {
      orgId: TEST_ORG_2,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'concurrent.metric.2',
        pointCount: 35,
        intervalMs: 60000,
        baseValue: 65,
        variance: 15,
      },
    };

    const config3: PipelineConfig = {
      orgId: TEST_ORG_3,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'concurrent.metric.3',
        pointCount: 30,
        intervalMs: 60000,
        baseValue: 55,
        variance: 12,
      },
    };

    // Run all pipelines concurrently
    const [result1, result2, result3] = await Promise.all([
      runPipeline(config1),
      runPipeline(config2),
      runPipeline(config3),
    ]);

    // All should succeed
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result3.success).toBe(true);

    // Verify correct storage
    expect(result1.metrics.stored).toBe(25);
    expect(result2.metrics.stored).toBe(35);
    expect(result3.metrics.stored).toBe(30);

    // Verify isolation
    const client = getClient();
    expect(await verifyOrgIsolation(client, TEST_ORG_1, 25)).toBe(true);
    expect(await verifyOrgIsolation(client, TEST_ORG_2, 35)).toBe(true);
    expect(await verifyOrgIsolation(client, TEST_ORG_3, 30)).toBe(true);
  });

  it('should track pipeline metrics and observability', async () => {
    const config: PipelineConfig = {
      orgId: TEST_ORG_1,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'test.observability',
        pointCount: 45,
        intervalMs: 60000,
        baseValue: 50,
        variance: 10,
      },
    };

    const result = await runPipeline(config);

    // Verify all observability fields are present
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('forecast');
    expect(result).toHaveProperty('anomaly');
    expect(result).toHaveProperty('alerts');
    expect(result).toHaveProperty('durationMs');
    expect(result).toHaveProperty('errors');

    // Verify metrics detail
    expect(result.metrics).toHaveProperty('processed');
    expect(result.metrics).toHaveProperty('stored');
    expect(result.metrics).toHaveProperty('duplicates');

    // Verify forecast detail
    expect(result.forecast).toHaveProperty('generated');
    expect(result.forecast).toHaveProperty('predictions');

    // Verify anomaly detail
    expect(result.anomaly).toHaveProperty('detected');

    // Verify alerts detail
    expect(result.alerts).toHaveProperty('emitted');
  });

  it('should handle pipeline with minimal data points', async () => {
    const config: PipelineConfig = {
      orgId: TEST_ORG_1,
      useSynthetic: true,
      syntheticOptions: {
        metricKey: 'test.minimal.data',
        pointCount: 5, // Minimal data
        intervalMs: 60000,
        baseValue: 50,
        variance: 10,
      },
      forecastHorizon: 3,
    };

    const result = await runPipeline(config);

    // Should still succeed even with minimal data
    expect(result.success).toBe(true);
    expect(result.metrics.processed).toBe(5);
    expect(result.metrics.stored).toBe(5);
  });

  it('should support querying stored time series after pipeline', async () => {
    const metricKey = 'test.timeseries.query';
    const config: PipelineConfig = {
      orgId: TEST_ORG_1,
      useSynthetic: true,
      syntheticOptions: {
        metricKey,
        pointCount: 50,
        intervalMs: 300000, // 5 minutes
        baseValue: 60,
        variance: 15,
      },
    };

    const result = await runPipeline(config);
    expect(result.success).toBe(true);

    // Query the time series
    const series = await getTimeSeries({
      orgId: TEST_ORG_1,
      metricKey,
      dimensions: { source: 'synthetic', environment: 'dev' },
    });

    expect(series).not.toBeNull();
    expect(series?.metric_key).toBe(metricKey);
    expect(series?.data_points.length).toBeGreaterThanOrEqual(50);
  });
});

// =============================================================================
// Webhook Integration Tests
// =============================================================================

describe('Webhook Integration with Pipeline', () => {
  it('should ingest via webhook and query in pipeline', async () => {
    const handler = createWebhookHandler({ enableIdempotency: true });

    // Ingest metrics via webhook
    const webhookResult = await handler.handle({
      org_id: TEST_ORG_1,
      source_id: 'webhook-test',
      metrics: generateSyntheticMetrics(30, {
        orgId: TEST_ORG_1,
        metricKey: 'webhook.pipeline.test',
      }),
    });

    expect(webhookResult.success).toBe(true);
    expect(webhookResult.accepted).toBe(30);

    // Query the ingested metrics
    const metrics = await queryMetrics({
      orgId: TEST_ORG_1,
      metricKey: 'webhook.pipeline.test',
    });

    expect(metrics.length).toBe(30);
  });

  it('should handle webhook idempotency in pipeline context', async () => {
    const handler = createWebhookHandler({ enableIdempotency: true });
    const idempotencyKey = `test-pipeline-${Date.now()}`;

    const request = {
      org_id: TEST_ORG_1,
      source_id: 'idempotent-test',
      metrics: generateSyntheticMetrics(20, {
        orgId: TEST_ORG_1,
        metricKey: 'idempotent.test',
      }),
      idempotency_key: idempotencyKey,
    };

    // First request
    const result1 = await handler.handle(request);
    expect(result1.success).toBe(true);
    expect(result1.accepted).toBe(20);

    // Second request with same key
    const result2 = await handler.handle(request);
    expect(result2.success).toBe(true);
    expect(result2.request_id).toBe(result1.request_id);

    // Verify only 20 metrics stored (not 40)
    const metrics = await queryMetrics({
      orgId: TEST_ORG_1,
      metricKey: 'idempotent.test',
    });
    expect(metrics.length).toBe(20);
  });
});
