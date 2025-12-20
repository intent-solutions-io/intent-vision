/**
 * Agent API Routes
 *
 * Phase 17: Operator Assistant Agent
 *
 * Endpoints for AI-powered incident analysis and summaries.
 *
 * Endpoints:
 * - POST /v1/incidents/:id/summary - Generate AI summary for incident
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { type AuthContext, hasScopeV1 } from '../auth/api-key.js';
import { generateIncidentSummary, type IncidentSummaryResult } from '../agent/orchestrator.js';
import { getLLMStatus, type LLMProvider, type LLMConfig } from '../llm/providers/index.js';

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

interface GenerateSummaryRequest {
  /** Optional LLM provider override */
  llmProvider?: LLMProvider;
  /** Optional model override */
  llmModel?: string;
}

interface GenerateSummaryResponse extends IncidentSummaryResult {
  incidentId: string;
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

// =============================================================================
// POST /v1/incidents/:id/summary - Generate AI Summary
// =============================================================================

/**
 * Generate an AI-powered summary for an incident
 *
 * Request body (optional):
 * - llmProvider: Override default LLM provider (openai, anthropic, google, vertex)
 * - llmModel: Override default model
 *
 * Response:
 * - summary: Plain-language summary of the incident
 * - highlights: Key takeaways (array of strings)
 * - recommendedChecks: Suggested actions (array of strings)
 * - providerUsed: LLM provider that generated the summary
 * - modelUsed: Model that generated the summary
 */
export async function handleGenerateIncidentSummary(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  incidentId: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - need alerts:read to access incident data
    if (!hasScopeV1(authContext, 'alerts:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: alerts:read or admin',
      });
      return;
    }

    // Parse request body
    const body = await parseBody<GenerateSummaryRequest>(req);

    // Build LLM config if overrides provided
    let llmConfig: LLMConfig | undefined;
    if (body.llmProvider || body.llmModel) {
      const status = getLLMStatus();

      // Validate provider if specified
      if (body.llmProvider) {
        const validProviders: LLMProvider[] = ['openai', 'anthropic', 'google', 'vertex', 'azure', 'custom'];
        if (!validProviders.includes(body.llmProvider)) {
          sendJson(res, 400, {
            success: false,
            requestId,
            timestamp: new Date().toISOString(),
            error: `Invalid LLM provider: ${body.llmProvider}. Valid options: ${validProviders.join(', ')}`,
          });
          return;
        }
      }

      llmConfig = {
        provider: body.llmProvider || status.defaultProvider || 'openai',
        model: body.llmModel,
      };
    }

    const { orgId } = authContext;

    // Generate summary
    const result = await generateIncidentSummary(orgId, incidentId, llmConfig);

    const responseData: GenerateSummaryResponse = {
      incidentId,
      ...result,
    };

    console.log(
      `[${requestId}] Generated incident summary for ${incidentId} using ${result.providerUsed}/${result.modelUsed} in ${result.durationMs}ms`
    );

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${requestId}] Generate incident summary error:`, errorMessage);

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes('not found')) {
      statusCode = 404;
    } else if (errorMessage.includes('Authentication') || errorMessage.includes('API key')) {
      statusCode = 502; // Bad gateway - upstream service issue
    } else if (errorMessage.includes('Rate limit')) {
      statusCode = 429;
    }

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
// GET /v1/agent/status - Get Agent Status
// =============================================================================

/**
 * Get the status of the agent system including LLM configuration
 */
export async function handleGetAgentStatus(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - need alerts:read to see agent status
    if (!hasScopeV1(authContext, 'alerts:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: alerts:read or admin',
      });
      return;
    }

    const llmStatus = getLLMStatus();

    const responseData = {
      agent: {
        available: true,
        version: '0.17.0',
      },
      llm: {
        configured: llmStatus.isConfigured,
        defaultProvider: llmStatus.defaultProvider,
        defaultModel: llmStatus.defaultModel,
        availableProviders: llmStatus.configuredProviders,
      },
      capabilities: [
        'incident_summary',
        'metric_analysis',
        'alert_summarization',
      ],
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
    console.error(`[${requestId}] Get agent status error:`, errorMessage);

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
// Route Helpers
// =============================================================================

/**
 * Extract incident ID from URL path
 * Pattern: /v1/incidents/:id/summary
 */
export function extractIncidentIdForSummary(pathname: string): string | null {
  const match = pathname.match(/^\/v1\/incidents\/([^/]+)\/summary$/);
  return match ? match[1] : null;
}

/**
 * Check if path matches agent status endpoint
 */
export function isAgentStatusPath(pathname: string): boolean {
  return pathname === '/v1/agent/status';
}
