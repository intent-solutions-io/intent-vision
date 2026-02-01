/**
 * V1 API Routes
 *
 * Phase 1: Firestore-backed MVP Core
 * Phase 4: Production SaaS Control Plane + Public API v1
 * Beads Tasks: intentvision-002, intentvision-p88
 *
 * Endpoints:
 * - POST /v1/ingest/timeseries - Ingest time series data
 * - POST /v1/forecast/run - Run forecast for a metric
 * - GET  /v1/forecast - Get forecasts for a metric
 *
 * Scope Requirements:
 * - ingest:write (or legacy 'ingest') - POST /v1/ingest/*
 * - metrics:read (or legacy 'forecast', 'read') - GET /v1/forecast, POST /v1/forecast/run
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { getDb, generateId, toTimestamp } from '../firestore/client.js';
import {
  COLLECTIONS,
  type Metric,
  type TimeSeriesDocument,
  type TimeSeriesPoint,
  type Forecast,
  type IngestTimeseriesRequest,
  type IngestTimeseriesResponse,
  type RunForecastRequest,
  type RunForecastResponse,
  type GetForecastResponse,
} from '../firestore/schema.js';
import { type AuthContext, hasScopeV1 } from '../auth/api-key.js';
import { getStatisticalBackend } from '../forecast/statistical-backend.js';
import { recordUsageEvent, checkUsageLimit } from '../services/metering-service.js';

// =============================================================================
// Types
// =============================================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  requestId: string;
  timestamp: string;
  data?: T;
  error?: string;
  durationMs?: number;
}

// =============================================================================
// Utilities
// =============================================================================

function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {} as T);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson<T>(res: ServerResponse, statusCode: number, data: ApiResponse<T>): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseUrl(req: IncomingMessage): URL {
  return new URL(req.url || '/', `http://localhost`);
}

// =============================================================================
// POST /v1/ingest/timeseries
// =============================================================================

export async function handleIngestTimeseries(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - ingest:write or legacy 'ingest'
    if (!hasScopeV1(authContext, 'ingest:write')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: ingest:write or admin',
      });
      return;
    }

    // Parse request
    const body = await parseBody<IngestTimeseriesRequest>(req);
    const { metricName, points } = body;

    if (!metricName || typeof metricName !== 'string') {
      throw new Error('metricName is required and must be a string');
    }

    if (!points || !Array.isArray(points) || points.length === 0) {
      throw new Error('points array is required and must not be empty');
    }

    const { orgId } = authContext;
    const db = getDb();

    // Get or create metric
    const metricsCollection = db.collection(COLLECTIONS.metrics(orgId));
    const metricsQuery = await metricsCollection.where('name', '==', metricName).limit(1).get();

    let metricId: string;
    if (metricsQuery.empty) {
      // Create metric
      metricId = generateId('metric');
      const metric: Metric = {
        id: metricId,
        orgId,
        name: metricName,
        createdAt: new Date(),
        updatedAt: new Date(),
        dataPointCount: 0,
      };
      await metricsCollection.doc(metricId).set(metric);
    } else {
      metricId = metricsQuery.docs[0].id;
    }

    // Convert and validate points
    const validPoints: TimeSeriesPoint[] = [];
    for (const point of points) {
      if (point.timestamp === undefined || point.value === undefined) {
        continue; // Skip invalid points
      }

      validPoints.push({
        timestamp: toTimestamp(point.timestamp),
        value: Number(point.value),
        metadata: point.metadata,
      });
    }

    if (validPoints.length === 0) {
      throw new Error('No valid points to ingest');
    }

    // Store points in timeseries document
    const timeseriesCollection = db.collection(COLLECTIONS.timeseries(orgId));
    const tsDocId = generateId('ts');

    const sortedPoints = validPoints.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const tsDoc: TimeSeriesDocument = {
      id: tsDocId,
      orgId,
      metricId,
      metricName,
      startTime: sortedPoints[0].timestamp,
      endTime: sortedPoints[sortedPoints.length - 1].timestamp,
      points: sortedPoints,
      pointCount: sortedPoints.length,
      createdAt: new Date(),
    };

    await timeseriesCollection.doc(tsDocId).set(tsDoc);

    // Update metric stats
    await metricsCollection.doc(metricId).update({
      updatedAt: new Date(),
      lastDataPoint: sortedPoints[sortedPoints.length - 1].timestamp,
      dataPointCount: (metricsQuery.empty ? 0 : (metricsQuery.docs[0].data().dataPointCount || 0)) + sortedPoints.length,
    });

    // Phase 11: Record usage event for data ingestion
    await recordUsageEvent({
      orgId,
      eventType: 'metric_ingested',
      quantity: validPoints.length,
      metadata: { metricId, metricName },
    });

    const responseData: IngestTimeseriesResponse = {
      metricId,
      metricName,
      pointsIngested: validPoints.length,
      duplicatesSkipped: points.length - validPoints.length,
    };

    console.log(`[${requestId}] Ingested ${validPoints.length} points for metric ${metricName}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Ingest error:`, errorMessage);

    sendJson(res, 400, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}

// =============================================================================
// POST /v1/forecast/run
// =============================================================================

export async function handleForecastRun(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - metrics:read or legacy 'forecast'
    if (!hasScopeV1(authContext, 'metrics:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: metrics:read or admin',
      });
      return;
    }

    const { orgId } = authContext;

    // Phase 11: Check plan limits before running forecast
    const limitCheck = await checkUsageLimit(orgId, 'forecast_call');
    if (!limitCheck.allowed) {
      sendJson(res, 429, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: limitCheck.reason || 'Daily forecast limit exceeded',
      });
      return;
    }

    // Parse request
    const body = await parseBody<RunForecastRequest>(req);
    const { metricName, horizonDays = 7, backend: _backend = 'statistical' } = body;

    if (!metricName || typeof metricName !== 'string') {
      throw new Error('metricName is required and must be a string');
    }

    const db = getDb();

    // Find metric
    const metricsCollection = db.collection(COLLECTIONS.metrics(orgId));
    const metricsQuery = await metricsCollection.where('name', '==', metricName).limit(1).get();

    if (metricsQuery.empty) {
      throw new Error(`Metric '${metricName}' not found. Ingest data first.`);
    }

    const metricId = metricsQuery.docs[0].id;

    // Fetch recent time series data
    const timeseriesCollection = db.collection(COLLECTIONS.timeseries(orgId));
    const tsQuery = await timeseriesCollection
      .where('metricName', '==', metricName)
      .orderBy('endTime', 'desc')
      .limit(10)
      .get();

    if (tsQuery.empty) {
      throw new Error(`No time series data found for metric '${metricName}'`);
    }

    // Collect all points
    const allPoints: TimeSeriesPoint[] = [];
    for (const doc of tsQuery.docs) {
      const data = doc.data() as TimeSeriesDocument;
      allPoints.push(...data.points);
    }

    if (allPoints.length < 2) {
      throw new Error('Insufficient data points for forecasting (minimum 2 required)');
    }

    // Sort by timestamp
    allPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Run forecast
    const forecastBackend = getStatisticalBackend();
    const forecastResult = await forecastBackend.forecast(allPoints, {
      horizonDays,
      confidenceLevel: 0.95,
      method: 'ewma',
    });

    // Store forecast
    const forecastsCollection = db.collection(COLLECTIONS.forecasts(orgId));
    const forecastId = generateId('fc');

    const forecast: Forecast = {
      id: forecastId,
      orgId,
      metricId,
      metricName,
      horizonDays,
      backend: 'statistical',
      status: 'completed',
      predictions: forecastResult.predictions,
      modelInfo: forecastResult.modelInfo,
      metrics: forecastResult.metrics,
      createdAt: new Date(),
      completedAt: new Date(),
    };

    await forecastsCollection.doc(forecastId).set(forecast);

    // Phase 11: Record usage event for successful forecast
    await recordUsageEvent({
      orgId,
      eventType: 'forecast_call',
      metadata: { forecastId, metricName, horizonDays },
    });

    const responseData: RunForecastResponse = {
      forecastId,
      metricName,
      horizonDays,
      backend: 'statistical',
      pointsGenerated: forecastResult.predictions.length,
      status: 'completed',
    };

    console.log(`[${requestId}] Generated forecast ${forecastId} for metric ${metricName}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Forecast error:`, errorMessage);

    sendJson(res, 400, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}

// =============================================================================
// GET /v1/forecast
// =============================================================================

export async function handleForecastGet(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - metrics:read or legacy 'read'
    if (!hasScopeV1(authContext, 'metrics:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: metrics:read or admin',
      });
      return;
    }

    // Parse query params
    const url = parseUrl(req);
    const metricName = url.searchParams.get('metricName');
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const latestOnly = url.searchParams.get('latestOnly') === 'true';

    if (!metricName) {
      throw new Error('metricName query parameter is required');
    }

    const { orgId } = authContext;
    const db = getDb();

    // Fetch forecasts
    const forecastsCollection = db.collection(COLLECTIONS.forecasts(orgId));
    let query = forecastsCollection
      .where('metricName', '==', metricName)
      .orderBy('createdAt', 'desc');

    if (latestOnly) {
      query = query.limit(1);
    } else {
      query = query.limit(limit);
    }

    const forecastsSnapshot = await query.get();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const forecasts: Forecast[] = forecastsSnapshot.docs.map((doc: any) => doc.data() as Forecast);

    const responseData: GetForecastResponse = {
      forecasts,
      total: forecasts.length,
    };

    console.log(`[${requestId}] Retrieved ${forecasts.length} forecasts for metric ${metricName}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get forecast error:`, errorMessage);

    sendJson(res, 400, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}
