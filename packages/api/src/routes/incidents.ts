/**
 * Incident Routes
 *
 * Phase 16: Smarter Alerts - Correlation & Grouping
 *
 * Endpoints for managing alert incidents:
 * - GET    /orgs/self/incidents       - List incidents for authenticated org
 * - GET    /orgs/self/incidents/:id   - Get incident detail
 * - POST   /orgs/self/incidents/:id/acknowledge - Acknowledge incident
 * - POST   /orgs/self/incidents/:id/resolve - Resolve incident
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { type AuthContext } from '../auth/api-key.js';
import {
  getIncident,
  listIncidents,
  acknowledgeIncident,
  resolveIncident,
  type ListIncidentsOptions,
} from '../services/incident-service.js';
import type { AlertIncident, IncidentStatus } from '../firestore/schema.js';

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

interface ListIncidentsResponse {
  incidents: AlertIncident[];
  total: number;
}

interface IncidentResponse {
  incident: AlertIncident;
}

interface AcknowledgeRequest {
  userId?: string;
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
  return new URL(req.url || '/', 'http://localhost');
}

function extractIncidentId(pathname: string): string | null {
  // Pattern: /orgs/self/incidents/:id or /orgs/self/incidents/:id/acknowledge or /orgs/self/incidents/:id/resolve
  const match = pathname.match(/^\/orgs\/self\/incidents\/([^/]+)(?:\/(?:acknowledge|resolve))?$/);
  return match ? match[1] : null;
}

// =============================================================================
// GET /orgs/self/incidents - List Incidents
// =============================================================================

export async function handleListIncidents(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    const { orgId } = authContext;
    const url = parseUrl(req);

    // Parse query parameters
    const status = url.searchParams.get('status') as IncidentStatus | null;
    const limitParam = url.searchParams.get('limit');
    const metricName = url.searchParams.get('metricName');

    const options: ListIncidentsOptions = {
      ...(status && { status }),
      ...(limitParam && { limit: parseInt(limitParam, 10) }),
      ...(metricName && { metricName }),
    };

    const incidents = await listIncidents(orgId, options);

    console.log(`[${requestId}] Listed ${incidents.length} incidents for org ${orgId}`);

    const responseData: ListIncidentsResponse = {
      incidents,
      total: incidents.length,
    };

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] List incidents error:`, errorMessage);

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
// GET /orgs/self/incidents/:id - Get Incident Detail
// =============================================================================

export async function handleGetIncident(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  incidentId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    const { orgId } = authContext;

    const incident = await getIncident(incidentId, orgId);

    if (!incident) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Incident '${incidentId}' not found`,
      });
      return;
    }

    console.log(`[${requestId}] Retrieved incident ${incidentId}`);

    const responseData: IncidentResponse = { incident };

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get incident error:`, errorMessage);

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
// POST /orgs/self/incidents/:id/acknowledge - Acknowledge Incident
// =============================================================================

export async function handleAcknowledgeIncident(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  incidentId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    const { orgId } = authContext;

    // Parse optional body with userId
    let userId: string | undefined;
    try {
      const body = await parseBody<AcknowledgeRequest>(req);
      userId = body.userId;
    } catch {
      // Body is optional
    }

    const incident = await acknowledgeIncident(incidentId, orgId, userId);

    console.log(`[${requestId}] Acknowledged incident ${incidentId}${userId ? ` by user ${userId}` : ''}`);

    const responseData: IncidentResponse = { incident };

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Acknowledge incident error:`, errorMessage);

    const statusCode = errorMessage.includes('not found') ? 404 : 400;

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
// POST /orgs/self/incidents/:id/resolve - Resolve Incident
// =============================================================================

export async function handleResolveIncident(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  incidentId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    const { orgId } = authContext;

    const incident = await resolveIncident(incidentId, orgId);

    console.log(`[${requestId}] Resolved incident ${incidentId}`);

    const responseData: IncidentResponse = { incident };

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Resolve incident error:`, errorMessage);

    const statusCode = errorMessage.includes('not found') ? 404 : 400;

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
// Route Handler Export
// =============================================================================

export { extractIncidentId };
