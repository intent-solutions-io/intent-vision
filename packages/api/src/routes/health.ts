/**
 * Health Check Endpoints
 *
 * Phase 20: Load/Resilience Testing and Production Readiness Review
 *
 * Provides health check endpoints for:
 * - Kubernetes liveness/readiness probes
 * - Load balancer health checks
 * - Monitoring and alerting
 *
 * Endpoints:
 * - GET /health         - Basic health (returns 200)
 * - GET /health/ready   - Readiness (checks Firestore connection)
 * - GET /health/live    - Liveness (simple ping)
 * - GET /health/detailed - Detailed health with metrics
 */

import { ServerResponse } from 'http';
import { getDb } from '../firestore/client.js';
import { metrics } from '../observability/metrics.js';

// =============================================================================
// Types
// =============================================================================

export interface BasicHealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: {
    firestore: 'ok' | 'error';
  };
}

export interface LivenessResponse {
  status: 'alive';
  timestamp: string;
}

export interface DetailedHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    firestore: 'ok' | 'error';
    nixtla: 'ok' | 'error' | 'not_configured';
  };
  metrics: {
    requestsLastMinute: number;
    errorsLastMinute: number;
    avgLatencyMs: number;
  };
}

// =============================================================================
// Module State
// =============================================================================

const startTime = Date.now();
const VERSION = process.env.npm_package_version || '0.1.0';

// =============================================================================
// Health Check Handlers
// =============================================================================

/**
 * GET /health - Basic health check
 *
 * Always returns 200 if the server is running.
 * Use for simple load balancer health checks.
 */
export async function handleBasicHealth(res: ServerResponse): Promise<void> {
  const response: BasicHealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}

/**
 * GET /health/live - Liveness probe
 *
 * Simple ping to verify the process is alive.
 * Use for Kubernetes liveness probes.
 * If this fails, the container should be restarted.
 */
export async function handleLiveness(res: ServerResponse): Promise<void> {
  const response: LivenessResponse = {
    status: 'alive',
    timestamp: new Date().toISOString(),
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}

/**
 * GET /health/ready - Readiness probe
 *
 * Checks if the service is ready to accept traffic.
 * Verifies database connectivity.
 * Use for Kubernetes readiness probes.
 * If this fails, traffic should be routed away.
 */
export async function handleReadiness(res: ServerResponse): Promise<void> {
  const response: ReadinessResponse = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    checks: {
      firestore: 'error',
    },
  };

  // Check Firestore connectivity
  try {
    const db = getDb();
    await db.collection('_health').doc('ping').set({
      timestamp: new Date(),
      source: 'readiness_probe',
    });
    response.checks.firestore = 'ok';
  } catch (error) {
    console.error('[Health/Ready] Firestore check failed:', error);
    response.status = 'not_ready';
  }

  const statusCode = response.status === 'ready' ? 200 : 503;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}

/**
 * GET /health/detailed - Detailed health with metrics
 *
 * Returns comprehensive health information including:
 * - All dependency checks
 * - Service uptime
 * - Recent metrics (requests, errors, latency)
 *
 * Use for monitoring dashboards and debugging.
 */
export async function handleDetailedHealth(res: ServerResponse): Promise<void> {
  const response: DetailedHealthResponse = {
    status: 'healthy',
    version: VERSION,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      firestore: 'error',
      nixtla: 'not_configured',
    },
    metrics: {
      requestsLastMinute: 0,
      errorsLastMinute: 0,
      avgLatencyMs: 0,
    },
  };

  // Check Firestore
  try {
    const db = getDb();
    await db.collection('_health').doc('ping').set({
      timestamp: new Date(),
      source: 'detailed_health',
    });
    response.checks.firestore = 'ok';
  } catch (error) {
    console.error('[Health/Detailed] Firestore check failed:', error);
    response.status = 'degraded';
  }

  // Check Nixtla configuration
  const nixtlaKey = process.env.NIXTLA_API_KEY;
  if (nixtlaKey) {
    // We don't make an actual API call here to avoid rate limiting
    // Just check if the key is configured
    response.checks.nixtla = 'ok';
  } else {
    // Not configured is not an error, just informational
    response.checks.nixtla = 'not_configured';
  }

  // Get recent metrics
  try {
    response.metrics.requestsLastMinute = metrics.getRequestCountLastNSeconds(60);
    response.metrics.errorsLastMinute = metrics.getErrorCountLastNSeconds(60);
    response.metrics.avgLatencyMs = metrics.getAvgLatencyLastNSeconds(60);
  } catch (error) {
    console.error('[Health/Detailed] Metrics collection error:', error);
    // Non-fatal, continue with zeros
  }

  // Determine overall status
  if (response.checks.firestore === 'error') {
    response.status = 'unhealthy';
  }

  const statusCode = response.status === 'healthy' ? 200 : response.status === 'degraded' ? 200 : 503;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}

// =============================================================================
// Route Matching
// =============================================================================

/**
 * Match health routes and return the appropriate handler
 */
export function matchHealthRoute(
  pathname: string,
  method: string
): ((res: ServerResponse) => Promise<void>) | null {
  if (method !== 'GET') {
    return null;
  }

  switch (pathname) {
    case '/health':
      return handleBasicHealth;
    case '/health/live':
      return handleLiveness;
    case '/health/ready':
      return handleReadiness;
    case '/health/detailed':
      return handleDetailedHealth;
    default:
      return null;
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  handleBasicHealth,
  handleLiveness,
  handleReadiness,
  handleDetailedHealth,
  matchHealthRoute,
};
