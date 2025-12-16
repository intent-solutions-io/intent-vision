/**
 * Demo API Routes
 *
 * Phase E2E: Single-Metric Forecast Demo
 * Beads Task: intentvision-x8o
 *
 * Demo endpoints for the single-metric forecast flow:
 * - POST /v1/demo/ingest     - Ingest time series data for demo
 * - POST /v1/demo/forecast   - Run forecast on demo metric
 * - GET  /v1/demo/metric     - Get metric data with latest forecast
 * - GET  /v1/demo/backends   - List available forecast backends
 *
 * Scope Requirements:
 * - ingest:write - POST /v1/demo/ingest
 * - metrics:read - POST /v1/demo/forecast, GET /v1/demo/metric
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { type AuthContext, hasScopeV1 } from '../auth/api-key.js';
import {
  ingestDemoMetric,
  runDemoForecast,
  getDemoMetricData,
  getAvailableBackends,
  type IngestDemoRequest,
  type ForecastDemoRequest,
  type ForecastBackendType,
} from '../services/forecast-demo-service.js';

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

interface IngestRequestBody {
  metricId: string;
  metricName: string;
  unit?: string;
  description?: string;
  points: Array<{
    timestamp: string;
    value: number;
  }>;
}

interface ForecastRequestBody {
  metricId: string;
  horizonDays?: number;
  backend?: ForecastBackendType;
  statMethod?: 'sma' | 'ewma' | 'linear';
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
        resolve(body ? JSON.parse(body) : ({} as T));
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
// POST /v1/demo/ingest
// =============================================================================

export async function handleDemoIngest(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope
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
    const body = await parseBody<IngestRequestBody>(req);
    const { metricId, metricName, unit, description, points } = body;

    if (!metricId || typeof metricId !== 'string') {
      throw new Error('metricId is required and must be a string');
    }

    if (!metricName || typeof metricName !== 'string') {
      throw new Error('metricName is required and must be a string');
    }

    if (!points || !Array.isArray(points) || points.length === 0) {
      throw new Error('points array is required and must not be empty');
    }

    // Validate points
    const validPoints = points.filter(
      (p) => p.timestamp && typeof p.value === 'number' && !isNaN(p.value)
    );

    if (validPoints.length === 0) {
      throw new Error('No valid points provided');
    }

    const { orgId } = authContext;

    // Ingest via service
    const request: IngestDemoRequest = {
      orgId,
      metricId,
      metricName,
      unit,
      description,
      points: validPoints.map((p) => ({
        timestamp: p.timestamp,
        value: p.value,
      })),
    };

    const result = await ingestDemoMetric(request);

    console.log(`[${requestId}] Demo ingest: ${result.pointsIngested} points for ${orgId}/${metricId}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        orgId: result.orgId,
        metricId: result.metricId,
        pointsIngested: result.pointsIngested,
        totalPoints: result.totalPoints,
        skipped: points.length - validPoints.length,
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Demo ingest error:`, errorMessage);

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
// POST /v1/demo/forecast
// =============================================================================

export async function handleDemoForecast(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope
    if (!hasScopeV1(authContext, 'metrics:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: metrics:read or admin',
      });
      return;
    }

    // Parse request
    const body = await parseBody<ForecastRequestBody>(req);
    const { metricId, horizonDays = 7, backend = 'stat', statMethod } = body;

    if (!metricId || typeof metricId !== 'string') {
      throw new Error('metricId is required and must be a string');
    }

    if (horizonDays < 1 || horizonDays > 365) {
      throw new Error('horizonDays must be between 1 and 365');
    }

    const validBackends: ForecastBackendType[] = ['stub', 'stat', 'timegpt'];
    if (!validBackends.includes(backend)) {
      throw new Error(`Invalid backend. Must be one of: ${validBackends.join(', ')}`);
    }

    const { orgId } = authContext;

    // Run forecast via service
    const request: ForecastDemoRequest = {
      orgId,
      metricId,
      horizonDays,
      backend,
      statMethod,
    };

    const result = await runDemoForecast(request);

    console.log(
      `[${requestId}] Demo forecast: ${result.outputPointsCount} points using ${backend} for ${orgId}/${metricId}`
    );

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        forecastId: result.forecastId,
        orgId: result.orgId,
        metricId: result.metricId,
        horizonDays: result.horizonDays,
        backend: result.backend,
        inputPointsCount: result.inputPointsCount,
        outputPointsCount: result.outputPointsCount,
        generatedAt: result.generatedAt,
        modelInfo: result.modelInfo,
        points: result.points,
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Demo forecast error:`, errorMessage);

    const statusCode = errorMessage.includes('Insufficient data') ? 400 : 500;

    sendJson(res, statusCode, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}

// =============================================================================
// GET /v1/demo/metric
// =============================================================================

export async function handleDemoMetricGet(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope
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
    const metricId = url.searchParams.get('metricId');
    const limit = parseInt(url.searchParams.get('limit') || '90', 10);

    if (!metricId) {
      throw new Error('metricId query parameter is required');
    }

    const { orgId } = authContext;

    // Get metric data via service
    const result = await getDemoMetricData(orgId, metricId, limit);

    if (!result) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Metric '${metricId}' not found for organization`,
      });
      return;
    }

    console.log(
      `[${requestId}] Demo metric get: ${result.recentPoints.length} points for ${orgId}/${metricId}`
    );

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        metric: {
          id: result.metric.metricId,
          name: result.metric.name,
          unit: result.metric.unit,
          description: result.metric.description,
          createdAt: result.metric.createdAt.toISOString(),
          updatedAt: result.metric.updatedAt.toISOString(),
        },
        historicalPoints: result.recentPoints,
        latestForecast: result.latestForecast
          ? {
              id: result.latestForecast.id,
              horizonDays: result.latestForecast.horizonDays,
              generatedAt: result.latestForecast.generatedAt,
              backend: result.latestForecast.backend,
              inputPointsCount: result.latestForecast.inputPointsCount,
              points: result.latestForecast.points,
              modelInfo: result.latestForecast.modelInfo,
            }
          : null,
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Demo metric get error:`, errorMessage);

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
// GET /v1/demo/backends
// =============================================================================

export async function handleDemoBackendsList(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - allow any authenticated user
    if (!authContext.orgId) {
      sendJson(res, 401, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Authentication required',
      });
      return;
    }

    const backends = getAvailableBackends();

    const backendInfo = backends.map((b) => {
      switch (b) {
        case 'stub':
          return {
            id: 'stub',
            name: 'Stub Forecast',
            description: 'Synthetic forecast data for testing',
            available: true,
          };
        case 'stat':
          return {
            id: 'stat',
            name: 'Statistical',
            description: 'Local statistical methods (EWMA, SMA, Linear)',
            available: true,
          };
        case 'timegpt':
          return {
            id: 'timegpt',
            name: 'TimeGPT',
            description: 'Nixtla TimeGPT API for production forecasting',
            available: true,
          };
        default:
          return { id: b, name: b, description: '', available: false };
      }
    });

    console.log(`[${requestId}] Demo backends list: ${backends.length} backends available`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        backends: backendInfo,
        default: 'stat',
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Demo backends list error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}
