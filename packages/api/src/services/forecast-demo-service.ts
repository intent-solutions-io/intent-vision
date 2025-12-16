/**
 * Forecast Demo Service
 *
 * Phase E2E: Single-Metric Forecast Demo
 * Beads Task: intentvision-bpz
 *
 * Orchestrates the end-to-end forecast flow:
 * 1. Reads recent metric points from MetricsRepository
 * 2. Calls forecast backend (stat, stub, or TimeGPT)
 * 3. Saves forecast results back to Firestore
 *
 * Supports three backends:
 * - stub: Returns synthetic forecast data (always available)
 * - stat: Uses StatisticalForecastBackend (EWMA, SMA, linear)
 * - timegpt: Calls Nixtla TimeGPT API (requires NIXTLA_API_KEY)
 */

import {
  getMetricsRepository,
  type MetricPoint,
  type ForecastResult,
  type MetricDefinition,
} from '../data/metrics-repository.js';
import {
  getStatisticalBackend,
  type ForecastOptions as StatForecastOptions,
} from '../forecast/statistical-backend.js';
import type { TimeSeriesPoint } from '../firestore/schema.js';

// =============================================================================
// Types
// =============================================================================

export type ForecastBackendType = 'stub' | 'stat' | 'timegpt';

export interface ForecastDemoRequest {
  orgId: string;
  metricId: string;
  horizonDays: number;
  backend?: ForecastBackendType;
  /** For stat backend: which method to use */
  statMethod?: 'sma' | 'ewma' | 'linear';
}

export interface ForecastDemoResponse {
  forecastId: string;
  orgId: string;
  metricId: string;
  horizonDays: number;
  backend: ForecastBackendType;
  inputPointsCount: number;
  outputPointsCount: number;
  points: MetricPoint[];
  generatedAt: string;
  modelInfo?: {
    name: string;
    version?: string;
  };
}

export interface IngestDemoRequest {
  orgId: string;
  metricId: string;
  metricName: string;
  unit?: string;
  description?: string;
  points: MetricPoint[];
}

export interface IngestDemoResponse {
  orgId: string;
  metricId: string;
  pointsIngested: number;
  totalPoints: number;
}

export interface MetricDataResponse {
  metric: MetricDefinition;
  recentPoints: MetricPoint[];
  latestForecast: ForecastResult | null;
}

// =============================================================================
// Backend Implementations
// =============================================================================

/**
 * Stub backend - returns synthetic forecast data
 * Always available, no external dependencies
 */
async function stubForecast(
  points: MetricPoint[],
  horizonDays: number
): Promise<{ predictions: MetricPoint[]; modelInfo: { name: string; version: string } }> {
  if (points.length === 0) {
    throw new Error('No input points for forecast');
  }

  const lastPoint = points[points.length - 1];
  const lastValue = lastPoint.value;
  const lastDate = new Date(lastPoint.timestamp);

  // Simple synthetic forecast: slight upward trend with noise
  const predictions: MetricPoint[] = [];
  for (let i = 1; i <= horizonDays; i++) {
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + i);

    // Add small random variation (±5%) plus slight upward trend
    const trend = lastValue * 0.01 * i;
    const noise = (Math.random() - 0.5) * lastValue * 0.1;
    const predictedValue = Math.max(0, lastValue + trend + noise);

    predictions.push({
      timestamp: futureDate.toISOString(),
      value: Math.round(predictedValue * 100) / 100,
    });
  }

  return {
    predictions,
    modelInfo: {
      name: 'Stub Forecast',
      version: '1.0.0',
    },
  };
}

/**
 * Statistical backend - uses existing StatisticalForecastBackend
 */
async function statForecast(
  points: MetricPoint[],
  horizonDays: number,
  method: 'sma' | 'ewma' | 'linear' = 'ewma'
): Promise<{ predictions: MetricPoint[]; modelInfo: { name: string; version: string } }> {
  const backend = getStatisticalBackend();

  // Convert MetricPoint to TimeSeriesPoint
  const tsPoints: TimeSeriesPoint[] = points.map((p) => ({
    timestamp: new Date(p.timestamp),
    value: p.value,
  }));

  const options: StatForecastOptions = {
    horizonDays,
    confidenceLevel: 0.95,
    method,
  };

  const result = await backend.forecast(tsPoints, options);

  // Convert predictions back to MetricPoint
  const predictions: MetricPoint[] = result.predictions.map((p) => ({
    timestamp: p.timestamp.toISOString(),
    value: Math.round(p.predictedValue * 100) / 100,
  }));

  return {
    predictions,
    modelInfo: {
      name: result.modelInfo.name,
      version: result.modelInfo.version,
    },
  };
}

/**
 * TimeGPT backend - calls Nixtla API
 * Requires NIXTLA_API_KEY environment variable
 */
async function timeGptForecast(
  points: MetricPoint[],
  horizonDays: number
): Promise<{ predictions: MetricPoint[]; modelInfo: { name: string; version: string } }> {
  const apiKey = process.env.NIXTLA_API_KEY;
  if (!apiKey) {
    throw new Error('NIXTLA_API_KEY not configured. Use stat or stub backend instead.');
  }

  // Prepare data for TimeGPT API
  const df = points.map((p) => ({
    timestamp: p.timestamp,
    value: p.value,
  }));

  try {
    const response = await fetch('https://api.nixtla.io/v1/forecast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        df,
        h: horizonDays,
        freq: 'D', // Daily frequency
        time_col: 'timestamp',
        target_col: 'value',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`TimeGPT API error: ${response.status} - ${errorBody}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await response.json();

    // Parse TimeGPT response
    const predictions: MetricPoint[] = (result.forecast || []).map(
      (item: { timestamp: string; TimeGPT: number }) => ({
        timestamp: item.timestamp,
        value: Math.round(item.TimeGPT * 100) / 100,
      })
    );

    return {
      predictions,
      modelInfo: {
        name: 'TimeGPT',
        version: String(result.model_version || '1.0'),
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('TimeGPT API error')) {
      throw error;
    }
    throw new Error(`TimeGPT request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Ingest metric data points
 * Creates metric definition if it doesn't exist
 */
export async function ingestDemoMetric(
  request: IngestDemoRequest
): Promise<IngestDemoResponse> {
  const repo = getMetricsRepository();

  // Upsert metric definition
  await repo.upsertMetric({
    orgId: request.orgId,
    metricId: request.metricId,
    name: request.metricName,
    unit: request.unit,
    description: request.description,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Append points
  const ingested = await repo.appendPoints(
    request.orgId,
    request.metricId,
    request.points
  );

  // Get total point count
  const allPoints = await repo.getRecentPoints(
    request.orgId,
    request.metricId,
    1000
  );

  console.log(
    `[ForecastDemo] Ingested ${ingested} points for ${request.orgId}/${request.metricId}`
  );

  return {
    orgId: request.orgId,
    metricId: request.metricId,
    pointsIngested: ingested,
    totalPoints: allPoints.length,
  };
}

/**
 * Run a forecast for a demo metric
 */
export async function runDemoForecast(
  request: ForecastDemoRequest
): Promise<ForecastDemoResponse> {
  const repo = getMetricsRepository();
  const backend = request.backend || 'stat';

  console.log(
    `[ForecastDemo] Running ${backend} forecast for ${request.orgId}/${request.metricId}`
  );

  // Get recent points
  const points = await repo.getRecentPoints(
    request.orgId,
    request.metricId,
    365 // Up to 1 year of data
  );

  if (points.length < 2) {
    throw new Error(
      `Insufficient data points (${points.length}). Need at least 2 points to forecast.`
    );
  }

  // Run forecast based on backend
  let forecastResult: { predictions: MetricPoint[]; modelInfo: { name: string; version: string } };

  switch (backend) {
    case 'stub':
      forecastResult = await stubForecast(points, request.horizonDays);
      break;
    case 'timegpt':
      forecastResult = await timeGptForecast(points, request.horizonDays);
      break;
    case 'stat':
    default:
      forecastResult = await statForecast(
        points,
        request.horizonDays,
        request.statMethod
      );
      break;
  }

  const generatedAt = new Date().toISOString();
  const forecastId = `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Save forecast result
  await repo.saveForecast({
    id: forecastId,
    orgId: request.orgId,
    metricId: request.metricId,
    horizonDays: request.horizonDays,
    generatedAt,
    points: forecastResult.predictions,
    backend,
    inputPointsCount: points.length,
    modelInfo: forecastResult.modelInfo,
  });

  console.log(
    `[ForecastDemo] Generated ${forecastResult.predictions.length} forecast points using ${backend}`
  );

  return {
    forecastId,
    orgId: request.orgId,
    metricId: request.metricId,
    horizonDays: request.horizonDays,
    backend,
    inputPointsCount: points.length,
    outputPointsCount: forecastResult.predictions.length,
    points: forecastResult.predictions,
    generatedAt,
    modelInfo: forecastResult.modelInfo,
  };
}

/**
 * Get metric data including recent points and latest forecast
 */
export async function getDemoMetricData(
  orgId: string,
  metricId: string,
  pointsLimit: number = 90
): Promise<MetricDataResponse | null> {
  const repo = getMetricsRepository();

  const metric = await repo.getMetric(orgId, metricId);
  if (!metric) {
    return null;
  }

  const recentPoints = await repo.getRecentPoints(orgId, metricId, pointsLimit);
  const latestForecast = await repo.getLatestForecast(orgId, metricId);

  return {
    metric,
    recentPoints,
    latestForecast,
  };
}

/**
 * Check if TimeGPT backend is available
 */
export function isTimeGptAvailable(): boolean {
  return !!process.env.NIXTLA_API_KEY;
}

/**
 * Get available backends
 */
export function getAvailableBackends(): ForecastBackendType[] {
  const backends: ForecastBackendType[] = ['stub', 'stat'];
  if (isTimeGptAvailable()) {
    backends.push('timegpt');
  }
  return backends;
}
