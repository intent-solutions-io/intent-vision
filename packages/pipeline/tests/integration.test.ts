/**
 * Integration Test: Ingest → Normalize → Store → Metrics Spine
 *
 * Task ID: intentvision-79x.5
 *
 * Proves the full pipeline flow from webhook ingestion to stored metrics.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createWebhookHandler,
  IngestRequest,
  IngestResponse,
} from '../src/ingest/webhook/index.js';
import { queryMetrics, getTimeSeries, ensureOrganization } from '../src/store/metric-store.js';
import { getClient, runMigrations, closeClient } from '../../../db/config.js';

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_ORG_ID = 'test-org-integration';
const TEST_SOURCE_ID = 'integration-test-source';

// =============================================================================
// Setup / Teardown
// =============================================================================

beforeAll(async () => {
  // Run migrations to ensure core tables exist
  try {
    await runMigrations();
  } catch (e) {
    // Ignore if migrations already applied
    console.log('Migrations check:', (e as Error).message);
  }

  // Initialize webhook handler (creates idempotency and dead letter tables)
  const handler = createWebhookHandler();
  await handler['initialize']();

  await ensureOrganization(TEST_ORG_ID, 'Integration Test Org');
});

afterAll(async () => {
  // Clean up test data
  const client = getClient();
  try {
    await client.execute({
      sql: 'DELETE FROM metrics WHERE org_id = ?',
      args: [TEST_ORG_ID],
    });
  } catch {}
  try {
    await client.execute({
      sql: 'DELETE FROM idempotency_keys WHERE key LIKE ?',
      args: [`${TEST_ORG_ID}:%`],
    });
  } catch {}
  try {
    await client.execute({
      sql: 'DELETE FROM dead_letter_queue WHERE org_id = ?',
      args: [TEST_ORG_ID],
    });
  } catch {}
  await closeClient();
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Webhook Ingestion Pipeline', () => {
  it('should ingest, normalize, and store valid metrics', async () => {
    const handler = createWebhookHandler({
      enableIdempotency: true,
      enableDeadLetter: true,
    });

    const request: IngestRequest = {
      org_id: TEST_ORG_ID,
      source_id: TEST_SOURCE_ID,
      metrics: [
        {
          metric_key: 'system.cpu.usage',
          value: 45.5,
          timestamp: new Date().toISOString(),
          dimensions: { host: 'server-1', region: 'us-east' },
        },
        {
          metric_key: 'system.memory.used',
          value: 8192,
          timestamp: new Date().toISOString(),
          dimensions: { host: 'server-1', region: 'us-east' },
        },
        {
          metric_key: 'app.request.count',
          value: 1250,
          timestamp: new Date().toISOString(),
          dimensions: { service: 'api', endpoint: '/users' },
        },
      ],
      idempotency_key: `test-${Date.now()}`,
    };

    const response = await handler.handle(request);

    expect(response.success).toBe(true);
    expect(response.accepted).toBe(3);
    expect(response.rejected).toBe(0);
    expect(response.errors).toBeUndefined();
    expect(response.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('should reject invalid metrics and accept valid ones', async () => {
    const handler = createWebhookHandler({
      enableIdempotency: false,
      enableDeadLetter: true,
    });

    const request: IngestRequest = {
      org_id: TEST_ORG_ID,
      source_id: TEST_SOURCE_ID,
      metrics: [
        {
          metric_key: 'valid.metric',
          value: 100,
        },
        {
          metric_key: '123-invalid-start', // Invalid: starts with number
          value: 50,
        },
        {
          metric_key: 'another.valid.metric',
          value: 200,
        },
        {
          metric_key: 'invalid.value',
          value: NaN, // Invalid: not a finite number
        },
      ],
    };

    const response = await handler.handle(request);

    expect(response.success).toBe(false);
    expect(response.accepted).toBe(2);
    expect(response.rejected).toBe(2);
    expect(response.errors).toBeDefined();
    expect(response.errors?.length).toBe(2);
  });

  it('should return cached response for idempotent requests', async () => {
    const handler = createWebhookHandler({
      enableIdempotency: true,
      enableDeadLetter: false,
    });

    const idempotencyKey = `idemp-test-${Date.now()}`;
    const request: IngestRequest = {
      org_id: TEST_ORG_ID,
      source_id: TEST_SOURCE_ID,
      metrics: [
        { metric_key: 'idempotent.test', value: 999 },
      ],
      idempotency_key: idempotencyKey,
    };

    // First request
    const response1 = await handler.handle(request);
    expect(response1.success).toBe(true);
    expect(response1.accepted).toBe(1);
    const requestId1 = response1.request_id;

    // Second request with same idempotency key
    const response2 = await handler.handle(request);
    expect(response2.success).toBe(true);
    expect(response2.accepted).toBe(1);
    expect(response2.request_id).toBe(requestId1); // Same request ID = cached
  });

  it('should query stored metrics from metrics spine', async () => {
    const handler = createWebhookHandler();
    const timestamp = new Date();

    // Ingest specific metrics
    await handler.handle({
      org_id: TEST_ORG_ID,
      source_id: TEST_SOURCE_ID,
      metrics: [
        {
          metric_key: 'query.test.metric',
          value: 42,
          timestamp: timestamp.toISOString(),
          dimensions: { env: 'test' },
        },
      ],
    });

    // Query metrics
    const metrics = await queryMetrics({
      orgId: TEST_ORG_ID,
      metricKey: 'query.test.metric',
    });

    expect(metrics.length).toBeGreaterThan(0);
    const found = metrics.find((m) => m.value === 42);
    expect(found).toBeDefined();
    expect(found?.dimensions.env).toBe('test');
  });

  it('should build time series from stored metrics', async () => {
    const handler = createWebhookHandler();
    const baseTime = Date.now() - (5 * 60 * 1000); // Start 5 minutes ago (within validation window)

    // Ingest time series data with past timestamps (all valid)
    const metrics = Array.from({ length: 10 }, (_, i) => ({
      metric_key: 'timeseries.test',
      value: 50 + Math.sin(i) * 10,
      timestamp: new Date(baseTime - i * 60000).toISOString(), // Going backwards in time
      dimensions: { series: 'test' },
    }));

    const response = await handler.handle({
      org_id: TEST_ORG_ID,
      source_id: TEST_SOURCE_ID,
      metrics,
    });

    expect(response.accepted).toBe(10);

    // Get as time series
    const series = await getTimeSeries({
      orgId: TEST_ORG_ID,
      metricKey: 'timeseries.test',
      dimensions: { series: 'test' },
    });

    expect(series).not.toBeNull();
    expect(series?.data_points.length).toBeGreaterThanOrEqual(10);
    expect(series?.metric_key).toBe('timeseries.test');
  });

  it('should handle dead letter queue for failures', async () => {
    const handler = createWebhookHandler({
      enableDeadLetter: true,
    });

    // Create a request that will partially fail
    const request: IngestRequest = {
      org_id: TEST_ORG_ID,
      source_id: TEST_SOURCE_ID,
      metrics: [
        { metric_key: 'valid.dlq.test', value: 100 },
        { metric_key: '', value: 50 }, // Invalid: empty key
      ],
    };

    const response = await handler.handle(request);
    expect(response.rejected).toBeGreaterThan(0);

    // Check dead letter stats
    const stats = await handler.getDeadLetterStats();
    expect(stats).not.toBeNull();
    expect(stats!.total).toBeGreaterThan(0);
  });
});

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe('Schema Validation at Ingest Boundary', () => {
  it('should reject requests without org_id', async () => {
    const handler = createWebhookHandler();
    const response = await handler.handle({
      source_id: TEST_SOURCE_ID,
      metrics: [{ metric_key: 'test', value: 1 }],
    } as IngestRequest);

    expect(response.success).toBe(false);
    expect(response.errors?.some((e) => e.message.includes('org_id'))).toBe(true);
  });

  it('should reject metrics with future timestamps', async () => {
    const handler = createWebhookHandler();
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour ahead

    const response = await handler.handle({
      org_id: TEST_ORG_ID,
      source_id: TEST_SOURCE_ID,
      metrics: [
        { metric_key: 'future.test', value: 100, timestamp: futureTime },
      ],
    });

    expect(response.success).toBe(false);
    expect(response.errors?.some((e) => e.code === 'INVALID_TIMESTAMP')).toBe(true);
  });

  it('should reject metrics with too many dimensions', async () => {
    const handler = createWebhookHandler({
      validation: { maxDimensions: 3 },
    });

    const response = await handler.handle({
      org_id: TEST_ORG_ID,
      source_id: TEST_SOURCE_ID,
      metrics: [
        {
          metric_key: 'dimensions.test',
          value: 100,
          dimensions: {
            dim1: 'a',
            dim2: 'b',
            dim3: 'c',
            dim4: 'd',
            dim5: 'e',
          },
        },
      ],
    });

    expect(response.success).toBe(false);
    expect(response.errors?.some((e) => e.code === 'INVALID_DIMENSIONS')).toBe(true);
  });
});
