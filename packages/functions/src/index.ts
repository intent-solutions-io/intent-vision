/**
 * IntentVision Cloud Functions - HTTP Entrypoints
 *
 * Task ID: intentvision-msy.1
 *
 * Functions:
 * - runPipeline: Execute the full pipeline (HTTP trigger)
 * - scheduledPipeline: Execute via Cloud Scheduler (Pub/Sub trigger)
 */

import { http, HttpFunction } from '@google-cloud/functions-framework';

// =============================================================================
// Types
// =============================================================================

interface PipelineRequest {
  orgId?: string;
  useSynthetic?: boolean;
  forecastHorizon?: number;
  forecastThreshold?: number;
  anomalySensitivity?: number;
}

interface PipelineResponse {
  success: boolean;
  requestId: string;
  timestamp: string;
  metrics?: {
    processed: number;
    stored: number;
  };
  forecast?: {
    predictions: number;
  };
  anomaly?: {
    detected: number;
  };
  alerts?: {
    emitted: number;
  };
  durationMs?: number;
  error?: string;
}

// =============================================================================
// HTTP Function: Run Pipeline
// =============================================================================

/**
 * HTTP-triggered function to run the IntentVision pipeline
 *
 * Usage:
 *   POST /runPipeline
 *   Body: { "orgId": "org-demo", "useSynthetic": true }
 *
 * Environment Variables:
 *   INTENTVISION_DB_URL - Turso database URL
 *   INTENTVISION_DB_AUTH_TOKEN - Turso auth token
 */
export const runPipeline: HttpFunction = async (req, res) => {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // CORS headers for preflight
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  // Only accept POST
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: 'Method not allowed. Use POST.',
    } satisfies PipelineResponse);
    return;
  }

  try {
    const body: PipelineRequest = req.body || {};

    // Validate required environment variables
    const dbUrl = process.env.INTENTVISION_DB_URL;
    const dbToken = process.env.INTENTVISION_DB_AUTH_TOKEN;

    if (!dbUrl) {
      throw new Error('INTENTVISION_DB_URL environment variable not set');
    }

    // Extract configuration with defaults
    const config = {
      orgId: body.orgId || process.env.PIPELINE_ORG_ID || 'org-demo',
      useSynthetic: body.useSynthetic ?? true,
      forecastHorizon: body.forecastHorizon || 6,
      forecastThreshold: body.forecastThreshold || 80,
      anomalySensitivity: body.anomalySensitivity || 0.7,
    };

    console.log(`[${requestId}] Pipeline started`, { config });

    // TODO: Import and run actual pipeline when deployed
    // For now, return stub response showing the function structure works
    const result: PipelineResponse = {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      metrics: {
        processed: 100,
        stored: 100,
      },
      forecast: {
        predictions: config.forecastHorizon,
      },
      anomaly: {
        detected: 0,
      },
      alerts: {
        emitted: 0,
      },
      durationMs: Date.now() - startTime,
    };

    console.log(`[${requestId}] Pipeline completed`, result);
    res.status(200).json(result);
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Pipeline failed`, { error: errorMessage });

    res.status(500).json({
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
      durationMs: Date.now() - startTime,
    } satisfies PipelineResponse);
  }
};

// Register with functions-framework
http('runPipeline', runPipeline);

// =============================================================================
// Pub/Sub Function: Scheduled Pipeline (Stub)
// =============================================================================

/**
 * Pub/Sub-triggered function for scheduled pipeline runs
 * Will be invoked by Cloud Scheduler via Cloud Tasks
 */
export const scheduledPipeline = async (
  message: { data?: string },
  _context: unknown
): Promise<void> => {
  const requestId = generateRequestId();
  console.log(`[${requestId}] Scheduled pipeline triggered`);

  // Decode Pub/Sub message if present
  let payload: PipelineRequest = {};
  if (message.data) {
    payload = JSON.parse(Buffer.from(message.data, 'base64').toString());
  }

  console.log(`[${requestId}] Payload:`, payload);

  // TODO: Run actual pipeline
  console.log(`[${requestId}] Scheduled pipeline completed (stub)`);
};

// =============================================================================
// Helpers
// =============================================================================

function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
