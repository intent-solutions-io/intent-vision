/**
 * E2E Test Setup Utilities
 *
 * Task ID: intentvision-7yf.5
 * Phase: E - Integration Testing
 *
 * Provides:
 * - createTestDatabase(): in-memory libSQL setup
 * - seedTestData(db, orgId): insert test fixtures
 * - cleanupTestData(db): truncate tables
 * - generateSyntheticMetrics(count): create test data
 */

import { createClient, type Client } from '@libsql/client';
import type { CanonicalMetric, TimeSeries } from '../../../../contracts/src/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// Types
// =============================================================================

export interface TestDatabase {
  client: Client;
  close: () => Promise<void>;
}

export interface TestDataOptions {
  orgId?: string;
  metricCount?: number;
  includeAnomalies?: boolean;
  includeForecasts?: boolean;
}

// =============================================================================
// Database Setup
// =============================================================================

/**
 * Create an in-memory test database with schema
 *
 * @returns TestDatabase with client and close method
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  // Create in-memory database
  const client = createClient({
    url: ':memory:',
  });

  // Load and apply schema migrations
  const migrationsPath = join(__dirname, '../../../../db/migrations');
  const schema001 = readFileSync(join(migrationsPath, '001_initial_schema.sql'), 'utf-8');
  const schema002 = readFileSync(join(migrationsPath, '002_saas_tables.sql'), 'utf-8');

  // Split and execute SQL statements
  const statements001 = schema001
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements001) {
    await client.execute(stmt);
  }

  const statements002 = schema002
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements002) {
    await client.execute(stmt);
  }

  return {
    client,
    close: async () => {
      await client.close();
    },
  };
}

// =============================================================================
// Test Data Generation
// =============================================================================

/**
 * Generate synthetic metrics for testing
 *
 * @param count - Number of metrics to generate
 * @param options - Customization options
 * @returns Array of canonical metrics
 */
export function generateSyntheticMetrics(
  count: number,
  options: {
    orgId?: string;
    metricKey?: string;
    startTime?: Date;
    intervalMs?: number;
    baseValue?: number;
    variance?: number;
    addAnomalies?: boolean;
  } = {}
): CanonicalMetric[] {
  const {
    orgId = 'test-org',
    metricKey = 'system.cpu.usage',
    startTime = new Date(Date.now() - count * 60000), // 1 minute intervals by default
    intervalMs = 60000,
    baseValue = 50,
    variance = 10,
    addAnomalies = false,
  } = options;

  const metrics: CanonicalMetric[] = [];
  let currentTime = startTime.getTime();

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(currentTime).toISOString();

    // Generate value with trend and noise
    const trend = Math.sin(i / 10) * variance * 0.5;
    const noise = (Math.random() - 0.5) * variance;
    let value = baseValue + trend + noise;

    // Add anomalies at specific intervals if requested
    if (addAnomalies && i % 20 === 0 && i > 0) {
      value = baseValue + variance * 3; // Spike
    }

    value = Math.max(0, value);

    metrics.push({
      org_id: orgId,
      metric_key: metricKey,
      timestamp,
      value,
      dimensions: {
        host: 'test-server-1',
        environment: 'test',
        region: 'us-west-1',
      },
      provenance: {
        source_id: 'test-fixture',
        ingested_at: new Date().toISOString(),
        pipeline_version: '1.0.0-test',
        transformations: ['synthetic-generation'],
      },
    });

    currentTime += intervalMs;
  }

  return metrics;
}

/**
 * Generate a synthetic time series
 *
 * @param options - Time series configuration
 * @returns TimeSeries object
 */
export function generateSyntheticTimeSeries(options: {
  orgId?: string;
  metricKey?: string;
  pointCount?: number;
  startTime?: Date;
  intervalMs?: number;
  baseValue?: number;
  variance?: number;
}): TimeSeries {
  const {
    orgId = 'test-org',
    metricKey = 'system.memory.usage',
    pointCount = 100,
    startTime = new Date(Date.now() - pointCount * 300000), // 5 minute intervals
    intervalMs = 300000,
    baseValue = 60,
    variance = 15,
  } = options;

  const dataPoints: Array<{ timestamp: string; value: number }> = [];
  let currentTime = startTime.getTime();

  for (let i = 0; i < pointCount; i++) {
    const timestamp = new Date(currentTime).toISOString();
    const trend = Math.sin(i / 8) * variance * 0.6;
    const noise = (Math.random() - 0.5) * variance;
    const value = Math.max(0, baseValue + trend + noise);

    dataPoints.push({ timestamp, value });
    currentTime += intervalMs;
  }

  return {
    org_id: orgId,
    metric_key: metricKey,
    dimensions: {
      source: 'synthetic',
      environment: 'test',
    },
    data_points: dataPoints,
    metadata: {
      start_time: dataPoints[0].timestamp,
      end_time: dataPoints[dataPoints.length - 1].timestamp,
      count: pointCount,
      resolution: `${intervalMs / 60000}m`,
    },
  };
}

// =============================================================================
// Data Seeding
// =============================================================================

/**
 * Seed test data into database
 *
 * @param client - Database client
 * @param orgId - Organization ID
 * @param options - Seeding options
 * @returns Stats about seeded data
 */
export async function seedTestData(
  client: Client,
  orgId: string,
  options: TestDataOptions = {}
): Promise<{
  organizations: number;
  metrics: number;
  forecasts: number;
  anomalies: number;
  alerts: number;
}> {
  const { metricCount = 50, includeAnomalies = true, includeForecasts = true } = options;

  const stats = {
    organizations: 0,
    metrics: 0,
    forecasts: 0,
    anomalies: 0,
    alerts: 0,
  };

  // Create organization
  await client.execute({
    sql: 'INSERT OR IGNORE INTO organizations (org_id, name) VALUES (?, ?)',
    args: [orgId, `Test Organization ${orgId}`],
  });
  stats.organizations = 1;

  // Generate and insert metrics
  const metrics = generateSyntheticMetrics(metricCount, {
    orgId,
    addAnomalies: includeAnomalies,
  });

  for (const metric of metrics) {
    await client.execute({
      sql: `
        INSERT OR IGNORE INTO metrics
        (org_id, metric_key, timestamp, value, dimensions, provenance)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        metric.org_id,
        metric.metric_key,
        metric.timestamp,
        metric.value,
        JSON.stringify(metric.dimensions),
        JSON.stringify(metric.provenance),
      ],
    });
    stats.metrics++;
  }

  // Create forecast jobs if requested
  if (includeForecasts) {
    await client.execute({
      sql: `
        INSERT INTO forecast_jobs
        (job_id, org_id, metric_key, dimensions, backend, status, horizon, frequency, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        'test-forecast-job-1',
        orgId,
        'system.cpu.usage',
        JSON.stringify({ host: 'test-server-1' }),
        'stub',
        'completed',
        6,
        '5m',
        new Date().toISOString(),
      ],
    });
    stats.forecasts = 1;
  }

  // Create anomalies if requested
  if (includeAnomalies) {
    const anomalyMetric = metrics.find((m) => m.value > 70);
    if (anomalyMetric) {
      await client.execute({
        sql: `
          INSERT INTO anomalies
          (anomaly_id, request_id, org_id, metric_key, dimensions, timestamp,
           observed_value, expected_value, score, type, severity, description, detected_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          'test-anomaly-1',
          'test-request-1',
          orgId,
          anomalyMetric.metric_key,
          JSON.stringify(anomalyMetric.dimensions),
          anomalyMetric.timestamp,
          anomalyMetric.value,
          50.0,
          0.85,
          'point',
          'high',
          'CPU usage spike detected',
          new Date().toISOString(),
        ],
      });
      stats.anomalies = 1;
    }
  }

  return stats;
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Clean up all test data from database
 *
 * @param client - Database client
 * @param orgId - Optional: clean only specific org
 */
export async function cleanupTestData(client: Client, orgId?: string): Promise<void> {
  const tables = [
    'alerts',
    'anomalies',
    'forecasts',
    'forecast_jobs',
    'metrics',
    'time_series',
    'ingestion_sources',
    'alert_rules',
    'idempotency_keys',
    'dead_letter_queue',
  ];

  for (const table of tables) {
    try {
      if (orgId) {
        await client.execute({
          sql: `DELETE FROM ${table} WHERE org_id = ?`,
          args: [orgId],
        });
      } else {
        await client.execute(`DELETE FROM ${table}`);
      }
    } catch (error) {
      // Table might not exist, ignore
      console.warn(`Failed to clean table ${table}:`, (error as Error).message);
    }
  }

  // Clean organizations if no orgId specified
  if (!orgId) {
    try {
      await client.execute('DELETE FROM organizations');
    } catch (error) {
      console.warn('Failed to clean organizations:', (error as Error).message);
    }
  }
}

// =============================================================================
// Multi-tenant Test Helpers
// =============================================================================

/**
 * Create multiple test organizations
 *
 * @param client - Database client
 * @param count - Number of organizations to create
 * @returns Array of org IDs
 */
export async function createTestOrganizations(
  client: Client,
  count: number
): Promise<string[]> {
  const orgIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const orgId = `test-org-${i + 1}`;
    await client.execute({
      sql: 'INSERT OR IGNORE INTO organizations (org_id, name) VALUES (?, ?)',
      args: [orgId, `Test Org ${i + 1}`],
    });
    orgIds.push(orgId);
  }

  return orgIds;
}

/**
 * Verify org_id isolation - ensure data from one org doesn't leak to another
 *
 * @param client - Database client
 * @param orgId - Organization to check
 * @param expectedCount - Expected metric count for this org
 */
export async function verifyOrgIsolation(
  client: Client,
  orgId: string,
  expectedCount: number
): Promise<boolean> {
  const result = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM metrics WHERE org_id = ?',
    args: [orgId],
  });

  const count = result.rows[0]?.count as number;
  return count === expectedCount;
}

// =============================================================================
// Test Assertions
// =============================================================================

/**
 * Assert that database state matches expectations
 *
 * @param client - Database client
 * @param table - Table name
 * @param conditions - WHERE clause conditions
 * @param expectedCount - Expected number of rows
 */
export async function assertDatabaseState(
  client: Client,
  table: string,
  conditions: Record<string, string | number>,
  expectedCount: number
): Promise<void> {
  const whereClauses: string[] = [];
  const args: (string | number)[] = [];

  for (const [key, value] of Object.entries(conditions)) {
    whereClauses.push(`${key} = ?`);
    args.push(value);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const result = await client.execute({
    sql: `SELECT COUNT(*) as count FROM ${table} ${whereClause}`,
    args,
  });

  const count = result.rows[0]?.count as number;

  if (count !== expectedCount) {
    throw new Error(
      `Database assertion failed: Expected ${expectedCount} rows in ${table}, found ${count}`
    );
  }
}
