/**
 * IntentVision Production API Server
 *
 * Phase 4: Production SaaS Control Plane + Public API v1
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Phase E2E: Single-Metric Forecast Demo
 * Beads Tasks: intentvision-002, intentvision-8aj, intentvision-p88, intentvision-p5, intentvision-r4j
 *
 * Main entry point for the IntentVision prediction engine.
 * Handles HTTP requests for:
 * - Time series ingestion (POST /v1/events, POST /v1/ingest/timeseries)
 * - Forecasting (GET /v1/metrics/:name/forecasts)
 * - Alerts (POST/GET/PATCH/DELETE /v1/alerts)
 * - Internal operator endpoints (POST/GET /v1/internal/*)
 * - Demo endpoints (POST/GET /v1/demo/*)
 * - Health checks
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { initFirestore, getDb } from './firestore/client.js';
import { authenticateApiKey, extractApiKey, type AuthContext } from './auth/api-key.js';
import { handleIngestTimeseries, handleForecastRun, handleForecastGet } from './routes/v1.js';
import {
  handleCreateAlertRule,
  handleListAlertRules,
  handleGetAlertRule,
  handleUpdateAlertRule,
  handleDeleteAlertRule,
  handleEvaluateAlerts,
  extractRuleId,
} from './routes/alerts.js';
import {
  handleCreateOrganization,
  handleListOrganizations,
  handleGetOrganization,
  handleCreateApiKey,
  handleListApiKeys,
  handleRevokeApiKey,
} from './routes/internal.js';
import {
  handleGetMe,
  handleListMyApiKeys,
  handleCreateMyApiKey,
} from './routes/me.js';
import {
  handleDemoIngest,
  handleDemoForecast,
  handleDemoMetricGet,
  handleDemoBackendsList,
} from './routes/demo.js';

// =============================================================================
// Configuration
// =============================================================================

const PORT = parseInt(process.env.PORT || '8080', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// =============================================================================
// Types
// =============================================================================

interface ApiResponse {
  success: boolean;
  requestId: string;
  timestamp: string;
  data?: unknown;
  error?: string;
  durationMs?: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    firestore: boolean;
  };
}

// =============================================================================
// Request Handlers
// =============================================================================

const startTime = Date.now();

function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function handleHealth(res: ServerResponse): Promise<void> {
  const status: HealthStatus = {
    status: 'healthy',
    version: '0.5.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      firestore: false,
    },
  };

  // Check Firestore connection
  try {
    const db = getDb();
    // Simple connectivity test
    await db.collection('_health').doc('ping').set({ timestamp: new Date() });
    status.checks.firestore = true;
  } catch (error) {
    console.error('[Health] Firestore check failed:', error);
    status.status = 'degraded';
  }

  const statusCode = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(status));
}

// =============================================================================
// Authentication Middleware
// =============================================================================

async function withAuth(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (req: IncomingMessage, res: ServerResponse, auth: AuthContext) => Promise<void>
): Promise<void> {
  const requestId = generateRequestId();

  // Extract API key from headers
  const headers: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key.toLowerCase()] = value;
  }

  const apiKey = extractApiKey(headers);

  if (!apiKey) {
    const response: ApiResponse = {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: 'API key required. Provide X-API-Key header or Authorization: Bearer <key>',
    };
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }

  // Authenticate
  const authResult = await authenticateApiKey(apiKey);

  if (!authResult.success || !authResult.context) {
    const response: ApiResponse = {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: authResult.error || 'Authentication failed',
    };
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }

  // Call handler with auth context
  await handler(req, res, authResult.context);
}

// =============================================================================
// Utilities
// =============================================================================

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
}

function handleNotFound(res: ServerResponse): void {
  const response: ApiResponse = {
    success: false,
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    error: 'Not Found',
  };
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}

function handleMethodNotAllowed(res: ServerResponse): void {
  const response: ApiResponse = {
    success: false,
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    error: 'Method Not Allowed',
  };
  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}

// =============================================================================
// Router
// =============================================================================

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { method, url } = req;
  const pathname = new URL(url || '/', `http://localhost`).pathname;

  // Set CORS headers
  setCorsHeaders(res);

  // Handle preflight
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Route requests
  try {
    // Health check (no auth required)
    if (pathname === '/' || pathname === '/health') {
      await handleHealth(res);
      return;
    }

    // ==========================================================================
    // Dashboard Routes (Firebase Auth - Phase 5)
    // ==========================================================================

    // GET /v1/me - Get current user and org info
    if (pathname === '/v1/me' && method === 'GET') {
      await handleGetMe(req, res);
      return;
    }

    // GET /v1/me/apiKeys - List user's org API keys
    if (pathname === '/v1/me/apiKeys' && method === 'GET') {
      await handleListMyApiKeys(req, res);
      return;
    }

    // POST /v1/me/apiKeys - Create API key for user's org
    if (pathname === '/v1/me/apiKeys' && method === 'POST') {
      await handleCreateMyApiKey(req, res);
      return;
    }

    // ==========================================================================
    // V1 API Routes (API Key auth required)
    // ==========================================================================

    if (pathname === '/v1/ingest/timeseries' && method === 'POST') {
      await withAuth(req, res, handleIngestTimeseries);
      return;
    }

    if (pathname === '/v1/forecast/run' && method === 'POST') {
      await withAuth(req, res, handleForecastRun);
      return;
    }

    if (pathname === '/v1/forecast' && method === 'GET') {
      await withAuth(req, res, handleForecastGet);
      return;
    }

    // Alert Routes (Phase 2)
    if (pathname === '/v1/alerts/rules' && method === 'POST') {
      await withAuth(req, res, handleCreateAlertRule);
      return;
    }

    if (pathname === '/v1/alerts/rules' && method === 'GET') {
      await withAuth(req, res, handleListAlertRules);
      return;
    }

    if (pathname === '/v1/alerts/evaluate' && method === 'POST') {
      await withAuth(req, res, handleEvaluateAlerts);
      return;
    }

    // Alert rule by ID routes
    const ruleId = extractRuleId(pathname);
    if (ruleId) {
      if (method === 'GET') {
        await withAuth(req, res, (req, res, auth) => handleGetAlertRule(req, res, auth, ruleId));
        return;
      }
      if (method === 'PATCH') {
        await withAuth(req, res, (req, res, auth) => handleUpdateAlertRule(req, res, auth, ruleId));
        return;
      }
      if (method === 'DELETE') {
        await withAuth(req, res, (req, res, auth) => handleDeleteAlertRule(req, res, auth, ruleId));
        return;
      }
    }

    // ==========================================================================
    // Internal Operator Routes (Phase 5 - Admin Only)
    // ==========================================================================

    // POST /v1/internal/organizations - Create organization
    if (pathname === '/v1/internal/organizations' && method === 'POST') {
      await withAuth(req, res, handleCreateOrganization);
      return;
    }

    // GET /v1/internal/organizations - List organizations
    if (pathname === '/v1/internal/organizations' && method === 'GET') {
      await withAuth(req, res, handleListOrganizations);
      return;
    }

    // Internal org-specific routes
    const internalOrgMatch = pathname.match(/^\/v1\/internal\/organizations\/([^/]+)$/);
    if (internalOrgMatch) {
      const orgId = internalOrgMatch[1];
      if (method === 'GET') {
        await withAuth(req, res, (req, res, auth) => handleGetOrganization(req, res, auth, orgId));
        return;
      }
    }

    // API key routes for organizations
    const apiKeysMatch = pathname.match(/^\/v1\/internal\/organizations\/([^/]+)\/apiKeys$/);
    if (apiKeysMatch) {
      const orgId = apiKeysMatch[1];
      if (method === 'POST') {
        await withAuth(req, res, (req, res, auth) => handleCreateApiKey(req, res, auth, orgId));
        return;
      }
      if (method === 'GET') {
        await withAuth(req, res, (req, res, auth) => handleListApiKeys(req, res, auth, orgId));
        return;
      }
    }

    // Revoke API key route
    const revokeKeyMatch = pathname.match(/^\/v1\/internal\/organizations\/([^/]+)\/apiKeys\/([^/]+)$/);
    if (revokeKeyMatch && method === 'DELETE') {
      const [, orgId, keyId] = revokeKeyMatch;
      await withAuth(req, res, (req, res, auth) => handleRevokeApiKey(req, res, auth, orgId, keyId));
      return;
    }

    // ==========================================================================
    // Demo Routes (Phase E2E - Single-Metric Forecast Demo)
    // ==========================================================================

    // POST /v1/demo/ingest - Ingest time series data for demo
    if (pathname === '/v1/demo/ingest' && method === 'POST') {
      await withAuth(req, res, handleDemoIngest);
      return;
    }

    // POST /v1/demo/forecast - Run forecast on demo metric
    if (pathname === '/v1/demo/forecast' && method === 'POST') {
      await withAuth(req, res, handleDemoForecast);
      return;
    }

    // GET /v1/demo/metric - Get metric data with latest forecast
    if (pathname === '/v1/demo/metric' && method === 'GET') {
      await withAuth(req, res, handleDemoMetricGet);
      return;
    }

    // GET /v1/demo/backends - List available forecast backends
    if (pathname === '/v1/demo/backends' && method === 'GET') {
      await withAuth(req, res, handleDemoBackendsList);
      return;
    }

    // Method not allowed for known paths
    if (pathname.startsWith('/v1/')) {
      handleMethodNotAllowed(res);
      return;
    }

    // Not found
    handleNotFound(res);
  } catch (error) {
    console.error('Unhandled error:', error);
    const response: ApiResponse = {
      success: false,
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      error: 'Internal Server Error',
    };
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }
}

// =============================================================================
// Server
// =============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('IntentVision API Server v0.6.0');
  console.log('Phase E2E: Single-Metric Forecast Demo');
  console.log('========================================');
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Port: ${PORT}`);

  // Initialize Firestore
  try {
    initFirestore();
    console.log('Firestore initialized');
  } catch (error) {
    console.error('Firestore initialization failed:', (error as Error).message);
    console.log('Server will start but Firestore features will be unavailable');
  }

  // Create HTTP server
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error('Request handler error:', error);
      res.writeHead(500);
      res.end('Internal Server Error');
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  // Start server
  server.listen(PORT, () => {
    console.log('========================================');
    console.log(`Server listening on port ${PORT}`);
    console.log('========================================');
    console.log('Public API v1 Endpoints:');
    console.log('  GET    /health                  - Health check');
    console.log('  POST   /v1/ingest/timeseries    - Ingest time series');
    console.log('  POST   /v1/forecast/run         - Run forecast');
    console.log('  GET    /v1/forecast             - Get forecasts');
    console.log('');
    console.log('Alert Endpoints (Phase 4 - User-configurable channels):');
    console.log('  POST   /v1/alerts/rules         - Create alert rule');
    console.log('  GET    /v1/alerts/rules         - List alert rules');
    console.log('  GET    /v1/alerts/rules/:id     - Get alert rule');
    console.log('  PATCH  /v1/alerts/rules/:id     - Update alert rule');
    console.log('  DELETE /v1/alerts/rules/:id     - Delete alert rule');
    console.log('  POST   /v1/alerts/evaluate      - Evaluate alerts');
    console.log('');
    console.log('Dashboard Endpoints (Phase 5 - Firebase Auth):');
    console.log('  GET    /v1/me                              - Get current user/org');
    console.log('  GET    /v1/me/apiKeys                      - List my API keys');
    console.log('  POST   /v1/me/apiKeys                      - Create my API key');
    console.log('');
    console.log('Internal Operator Endpoints (Phase 5 - Admin Only):');
    console.log('  POST   /v1/internal/organizations          - Create org');
    console.log('  GET    /v1/internal/organizations          - List orgs');
    console.log('  GET    /v1/internal/organizations/:orgId   - Get org');
    console.log('  POST   /v1/internal/organizations/:orgId/apiKeys  - Create key');
    console.log('  GET    /v1/internal/organizations/:orgId/apiKeys  - List keys');
    console.log('  DELETE /v1/internal/organizations/:orgId/apiKeys/:keyId - Revoke key');
    console.log('');
    console.log('Demo Endpoints (Phase E2E - Single-Metric Forecast):');
    console.log('  POST   /v1/demo/ingest       - Ingest demo metric data');
    console.log('  POST   /v1/demo/forecast     - Run forecast on demo metric');
    console.log('  GET    /v1/demo/metric       - Get metric with latest forecast');
    console.log('  GET    /v1/demo/backends     - List available forecast backends');
    console.log('');
    console.log('Scope Requirements:');
    console.log('  ingest:write  - POST /v1/ingest/*');
    console.log('  metrics:read  - GET /v1/forecast');
    console.log('  alerts:read   - GET /v1/alerts/*');
    console.log('  alerts:write  - POST/PATCH/DELETE /v1/alerts/*');
    console.log('  admin         - All operations + internal endpoints');
    console.log('========================================');
    console.log('\nStartup Instructions:');
    console.log('  1. Start Firestore emulator: firebase emulators:start --only firestore');
    console.log('  2. Run seed script: npm run seed:dev');
    console.log('  3. Use the API key from seed output');
    console.log('========================================');
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
