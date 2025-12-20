/**
 * Onboarding API Routes
 *
 * Phase 14: Customer Onboarding Flow + First Forecast Experience
 *
 * Endpoints for customer onboarding:
 * - POST /orgs/self/projects           - Create first project
 * - POST /projects/:id/sample-source   - Attach sample dataset
 * - POST /projects/:id/first-forecast  - Run guided first forecast
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { type AuthContext } from '../auth/api-key.js';
import {
  createProject,
  getProjects,
  getProjectById,
  attachSampleSource,
  runFirstForecast,
  type CreateProjectParams,
} from '../services/project-service.js';

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

interface CreateProjectRequest {
  name: string;
  description?: string;
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

// =============================================================================
// POST /orgs/self/projects - Create first project
// =============================================================================

export async function handleCreateProject(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    const { orgId } = authContext;

    // Parse request body
    const body = await parseBody<CreateProjectRequest>(req);
    const { name, description } = body;

    // Validate
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Project name is required');
    }

    // Create project
    const params: CreateProjectParams = {
      orgId,
      name: name.trim(),
      description: description?.trim(),
    };

    const project = await createProject(params);

    console.log(`[${requestId}] Created project ${project.id} for org ${orgId}`);

    sendJson(res, 201, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          sampleDataLoaded: project.sampleDataLoaded,
          firstForecastCompleted: project.firstForecastCompleted,
          createdAt: project.createdAt.toISOString(),
        },
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Create project error:`, errorMessage);

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
// GET /orgs/self/projects - List projects
// =============================================================================

export async function handleListProjects(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    const { orgId } = authContext;

    const projects = await getProjects(orgId);

    console.log(`[${requestId}] Listed ${projects.length} projects for org ${orgId}`);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          sampleDataLoaded: p.sampleDataLoaded,
          firstForecastCompleted: p.firstForecastCompleted,
          firstForecastId: p.firstForecastId,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
        total: projects.length,
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] List projects error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startMs,
    });
  }
}

// =============================================================================
// POST /projects/:id/sample-source - Attach sample dataset
// =============================================================================

export async function handleAttachSampleSource(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  projectId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    const { orgId } = authContext;

    // Verify project exists and belongs to org
    const project = await getProjectById(orgId, projectId);
    if (!project) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Project ${projectId} not found`,
      });
      return;
    }

    if (project.sampleDataLoaded) {
      sendJson(res, 400, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Sample data already loaded for this project',
      });
      return;
    }

    // Load sample data
    const result = await attachSampleSource(orgId, projectId);

    console.log(
      `[${requestId}] Loaded ${result.pointsLoaded} sample points for project ${projectId}`
    );

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        metricId: result.metricId,
        metricName: result.metricName,
        pointsLoaded: result.pointsLoaded,
        message: 'Sample MRR data loaded successfully',
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Attach sample source error:`, errorMessage);

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
// POST /projects/:id/first-forecast - Run guided first forecast
// =============================================================================

export async function handleRunFirstForecast(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  projectId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    const { orgId } = authContext;

    // Verify project exists and belongs to org
    const project = await getProjectById(orgId, projectId);
    if (!project) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Project ${projectId} not found`,
      });
      return;
    }

    if (!project.sampleDataLoaded) {
      sendJson(res, 400, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Sample data must be loaded before running forecast',
      });
      return;
    }

    if (project.firstForecastCompleted) {
      sendJson(res, 400, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'First forecast already completed for this project',
      });
      return;
    }

    // Run first forecast
    const result = await runFirstForecast(orgId, projectId);

    console.log(
      `[${requestId}] Generated first forecast ${result.forecastId} for project ${projectId}`
    );

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        forecastId: result.forecastId,
        metricId: result.metricId,
        predictions: result.predictions.map((p) => ({
          timestamp: p.timestamp.toISOString(),
          predictedValue: p.predictedValue,
          confidenceLower: p.confidenceLower,
          confidenceUpper: p.confidenceUpper,
          confidenceLevel: p.confidenceLevel,
        })),
        inputPointsCount: result.inputPointsCount,
        outputPointsCount: result.outputPointsCount,
        message: 'First forecast generated successfully',
      },
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Run first forecast error:`, errorMessage);

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
// Route Helpers
// =============================================================================

/**
 * Extract project ID from pathname like /projects/:id/*
 */
export function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match ? match[1] : null;
}
