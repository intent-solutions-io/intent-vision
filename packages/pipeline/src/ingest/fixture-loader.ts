/**
 * Fixture Loader - Load test data for pipeline development
 *
 * Task ID: intentvision-k4p
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CanonicalMetric, TimeSeries } from '../../../contracts/src/index.js';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// Types
// =============================================================================

export interface FixtureData {
  canonical_metrics: CanonicalMetric[];
  time_series: TimeSeries;
  description: string;
}

export interface LoadOptions {
  /** Base path to fixtures directory */
  basePath?: string;
  /** Fixture file name */
  filename?: string;
}

// =============================================================================
// Loader
// =============================================================================

const DEFAULT_FIXTURES_PATH = join(__dirname, '../../../../packages/contracts/fixtures');

/**
 * Load metrics fixture data
 */
export function loadMetricsFixture(options: LoadOptions = {}): FixtureData {
  const basePath = options.basePath || DEFAULT_FIXTURES_PATH;
  const filename = options.filename || 'sample-metrics.json';

  const filepath = join(basePath, filename);
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Generate synthetic time series data for testing
 */
export function generateSyntheticSeries(options: {
  orgId: string;
  metricKey: string;
  startTime: Date;
  pointCount: number;
  intervalMs: number;
  baseValue: number;
  variance: number;
}): TimeSeries {
  const {
    orgId,
    metricKey,
    startTime,
    pointCount,
    intervalMs,
    baseValue,
    variance,
  } = options;

  const dataPoints: Array<{ timestamp: string; value: number }> = [];
  let currentTime = startTime.getTime();

  for (let i = 0; i < pointCount; i++) {
    const timestamp = new Date(currentTime).toISOString();
    // Add some randomness with trend
    const trend = Math.sin(i / 10) * variance * 0.5;
    const noise = (Math.random() - 0.5) * variance;
    const value = baseValue + trend + noise;

    dataPoints.push({ timestamp, value: Math.max(0, value) });
    currentTime += intervalMs;
  }

  return {
    org_id: orgId,
    metric_key: metricKey,
    dimensions: { source: 'synthetic', environment: 'dev' },
    data_points: dataPoints,
    metadata: {
      start_time: dataPoints[0].timestamp,
      end_time: dataPoints[dataPoints.length - 1].timestamp,
      count: pointCount,
      resolution: `${intervalMs / 60000}m`,
    },
  };
}

/**
 * Create canonical metrics from time series
 */
export function timeSeriesToMetrics(
  series: TimeSeries,
  sourceId: string = 'fixture-loader'
): CanonicalMetric[] {
  const now = new Date().toISOString();

  return series.data_points.map((point) => ({
    org_id: series.org_id,
    metric_key: series.metric_key,
    timestamp: point.timestamp,
    value: point.value,
    dimensions: series.dimensions,
    provenance: {
      source_id: sourceId,
      ingested_at: now,
      pipeline_version: '1.0.0',
      transformations: ['fixture-load'],
    },
  }));
}
