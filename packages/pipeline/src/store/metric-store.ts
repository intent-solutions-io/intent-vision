/**
 * Metric Store - Persist metrics to database
 *
 * Task ID: intentvision-1c6
 */

import { getClient, closeClient } from '../../../../db/config.js';
import type { CanonicalMetric, TimeSeries } from '../../../contracts/src/index.js';

// =============================================================================
// Types
// =============================================================================

export interface StoreResult {
  success: boolean;
  stored: number;
  duplicates: number;
  errors: string[];
}

export interface QueryOptions {
  orgId: string;
  metricKey?: string;
  startTime?: string;
  endTime?: string;
  dimensions?: Record<string, string>;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Store Operations
// =============================================================================

/**
 * Store a single metric
 */
export async function storeMetric(metric: CanonicalMetric): Promise<StoreResult> {
  const client = getClient();

  try {
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

    return { success: true, stored: 1, duplicates: 0, errors: [] };
  } catch (error) {
    return {
      success: false,
      stored: 0,
      duplicates: 0,
      errors: [(error as Error).message],
    };
  }
}

/**
 * Store a batch of metrics
 */
export async function storeMetricBatch(metrics: CanonicalMetric[]): Promise<StoreResult> {
  const client = getClient();
  let stored = 0;
  let duplicates = 0;
  const errors: string[] = [];

  // Process in batches to avoid overwhelming the database
  const BATCH_SIZE = 100;

  for (let i = 0; i < metrics.length; i += BATCH_SIZE) {
    const batch = metrics.slice(i, i + BATCH_SIZE);

    try {
      // Build batch insert
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const args = batch.flatMap((m) => [
        m.org_id,
        m.metric_key,
        m.timestamp,
        m.value,
        JSON.stringify(m.dimensions),
        JSON.stringify(m.provenance),
      ]);

      const result = await client.execute({
        sql: `
          INSERT OR IGNORE INTO metrics
          (org_id, metric_key, timestamp, value, dimensions, provenance)
          VALUES ${placeholders}
        `,
        args,
      });

      // Count how many were actually inserted vs ignored (duplicates)
      const inserted = result.rowsAffected || 0;
      stored += inserted;
      duplicates += batch.length - inserted;
    } catch (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${(error as Error).message}`);
    }
  }

  return {
    success: errors.length === 0,
    stored,
    duplicates,
    errors,
  };
}

/**
 * Query metrics from store
 */
export async function queryMetrics(options: QueryOptions): Promise<CanonicalMetric[]> {
  const client = getClient();

  const conditions: string[] = ['org_id = ?'];
  const args: unknown[] = [options.orgId];

  if (options.metricKey) {
    conditions.push('metric_key = ?');
    args.push(options.metricKey);
  }

  if (options.startTime) {
    conditions.push('timestamp >= ?');
    args.push(options.startTime);
  }

  if (options.endTime) {
    conditions.push('timestamp <= ?');
    args.push(options.endTime);
  }

  const limit = options.limit || 1000;
  const offset = options.offset || 0;

  const result = await client.execute({
    sql: `
      SELECT org_id, metric_key, timestamp, value, dimensions, provenance
      FROM metrics
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `,
    args: [...args, limit, offset],
  });

  return result.rows.map((row) => ({
    org_id: row.org_id as string,
    metric_key: row.metric_key as string,
    timestamp: row.timestamp as string,
    value: row.value as number,
    dimensions: JSON.parse(row.dimensions as string),
    provenance: JSON.parse(row.provenance as string),
  }));
}

/**
 * Get metrics as time series
 */
export async function getTimeSeries(options: {
  orgId: string;
  metricKey: string;
  dimensions?: Record<string, string>;
  startTime?: string;
  endTime?: string;
}): Promise<TimeSeries | null> {
  const metrics = await queryMetrics({
    orgId: options.orgId,
    metricKey: options.metricKey,
    startTime: options.startTime,
    endTime: options.endTime,
    limit: 10000,
  });

  // Filter by dimensions if specified
  let filtered = metrics;
  if (options.dimensions) {
    filtered = metrics.filter((m) => {
      for (const [key, value] of Object.entries(options.dimensions!)) {
        if (m.dimensions[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  if (filtered.length === 0) {
    return null;
  }

  return {
    org_id: options.orgId,
    metric_key: options.metricKey,
    dimensions: options.dimensions || {},
    data_points: filtered.map((m) => ({
      timestamp: m.timestamp,
      value: m.value,
    })),
    metadata: {
      start_time: filtered[0].timestamp,
      end_time: filtered[filtered.length - 1].timestamp,
      count: filtered.length,
    },
  };
}

/**
 * Ensure organization exists
 */
export async function ensureOrganization(orgId: string, name?: string): Promise<void> {
  const client = getClient();

  await client.execute({
    sql: `
      INSERT OR IGNORE INTO organizations (org_id, name)
      VALUES (?, ?)
    `,
    args: [orgId, name || orgId],
  });
}
