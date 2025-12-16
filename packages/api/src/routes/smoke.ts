/**
 * Smoke Test Routes
 *
 * Phase 9: Staging Cloud Run + Firestore + Cloud Smoke Tests
 * Beads Task: intentvision-ltq
 *
 * Internal endpoints for cloud smoke testing.
 * Validates Firestore connectivity and basic operations.
 *
 * Endpoints:
 * - POST /v1/internal/smoke - Run smoke test (write + read + verify)
 * - GET  /v1/internal/smoke/:runId - Get smoke test result
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { getDb, getEnvironment, generateId, getEnvCollection } from '../firestore/client.js';

// =============================================================================
// Types
// =============================================================================

interface SmokeTestResult {
  ok: boolean;
  env: string;
  runId: string;
  projectId?: string;
  firestoreWrite?: boolean;
  firestoreRead?: boolean;
  firestoreVerify?: boolean;
  durationMs: number;
  error?: string;
  timestamp: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  requestId: string;
  timestamp: string;
  data?: T;
  error?: string;
}

// =============================================================================
// Utilities
// =============================================================================

function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sendJson<T>(res: ServerResponse, statusCode: number, data: ApiResponse<T>): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// =============================================================================
// POST /v1/internal/smoke - Run Smoke Test
// =============================================================================

/**
 * Run a smoke test that verifies Firestore connectivity.
 * Does not require authentication - used for infrastructure health checks.
 *
 * Steps:
 * 1. Write a test document to smoke_runs/{runId}
 * 2. Read it back
 * 3. Verify contents match
 * 4. Return result
 */
export async function handleSmokeTest(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();
  const runId = generateId('smoke');
  const env = getEnvironment();

  const result: SmokeTestResult = {
    ok: false,
    env,
    runId,
    firestoreWrite: false,
    firestoreRead: false,
    firestoreVerify: false,
    durationMs: 0,
    timestamp: new Date().toISOString(),
  };

  try {
    const db = getDb();

    // Get project ID from settings (if available)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settings = (db as any)._settings;
      result.projectId = settings?.projectId || process.env.INTENTVISION_GCP_PROJECT_ID || 'unknown';
    } catch {
      result.projectId = process.env.INTENTVISION_GCP_PROJECT_ID || 'unknown';
    }

    // Step 1: Write test document
    const testDoc = {
      runId,
      env,
      timestamp: new Date().toISOString(),
      testData: {
        message: 'IntentVision smoke test',
        phase: 'Phase 9',
        purpose: 'Cloud Firestore connectivity verification',
      },
    };

    const collectionPath = getEnvCollection('smoke_runs');
    await db.collection(collectionPath).doc(runId).set(testDoc);
    result.firestoreWrite = true;

    // Step 2: Read it back
    const readDoc = await db.collection(collectionPath).doc(runId).get();
    result.firestoreRead = true;

    // Step 3: Verify contents
    if (readDoc.exists) {
      const data = readDoc.data();
      if (data?.runId === runId && data?.env === env) {
        result.firestoreVerify = true;
        result.ok = true;
      } else {
        result.error = 'Document verification failed: data mismatch';
      }
    } else {
      result.error = 'Document verification failed: document not found after write';
    }

    result.durationMs = Date.now() - startMs;

    console.log(`[${requestId}] Smoke test ${result.ok ? 'PASSED' : 'FAILED'}: runId=${runId}, env=${env}, duration=${result.durationMs}ms`);

    sendJson(res, result.ok ? 200 : 500, {
      success: result.ok,
      requestId,
      timestamp: result.timestamp,
      data: result,
    });
  } catch (error) {
    result.error = (error as Error).message;
    result.durationMs = Date.now() - startMs;

    console.error(`[${requestId}] Smoke test FAILED: runId=${runId}, error=${result.error}`);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: result.timestamp,
      data: result,
      error: result.error,
    });
  }
}

// =============================================================================
// GET /v1/internal/smoke/:runId - Get Smoke Test Result
// =============================================================================

/**
 * Retrieve a previous smoke test result by runId.
 */
export async function handleGetSmokeTest(
  _req: IncomingMessage,
  res: ServerResponse,
  runId: string
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const db = getDb();
    const env = getEnvironment();
    const collectionPath = getEnvCollection('smoke_runs');

    const doc = await db.collection(collectionPath).doc(runId).get();

    if (!doc.exists) {
      sendJson(res, 404, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: `Smoke test run not found: ${runId}`,
      });
      return;
    }

    const data = doc.data();

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        runId,
        env,
        ...data,
      },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Get smoke test error:`, errorMessage);

    sendJson(res, 500, {
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}

// =============================================================================
// Route Extractor
// =============================================================================

/**
 * Extract smoke test runId from pathname
 * Pattern: /v1/internal/smoke/:runId
 */
export function extractSmokeRunId(pathname: string): string | null {
  const match = pathname.match(/^\/v1\/internal\/smoke\/([^/]+)$/);
  return match ? match[1] : null;
}
