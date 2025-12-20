/**
 * Agent Chat Routes
 *
 * Beads Task: intentvision-mpr.2
 * Phase F: Productization
 *
 * Endpoints for AI-powered agent chat functionality.
 * Communicates with ADK agents via the A2A gateway.
 *
 * Endpoints:
 * - POST /v1/chat - Send a message to the orchestrator agent
 * - GET /v1/chat/agents - List available agents
 * - GET /v1/chat/agents/:name/card - Get agent card
 * - POST /v1/chat/agents/:name/tasks - Submit task to specific agent
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { type AuthContext, hasScopeV1 } from '../auth/api-key.js';
import {
  getA2AClient,
  isA2AGatewayAvailable,
  type ChatRequest,
  type ChatResponse,
  type TaskRequest,
  A2AGatewayError,
} from '../agent/a2a-client.js';

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
// POST /v1/chat - Send Chat Message
// =============================================================================

interface ChatRequestBody {
  message: string;
  session_id?: string;
}

interface ChatResponseData extends ChatResponse {
  agent: string;
}

/**
 * Send a chat message to the orchestrator agent.
 *
 * Request body:
 * - message: The user's message (required)
 * - session_id: Optional session ID for conversation continuity
 *
 * Response:
 * - response: The agent's response
 * - session_id: Session ID for continuing the conversation
 * - agent: Which agent handled the request
 */
export async function handleChat(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    // Check scope - need read access
    if (!hasScopeV1(authContext, 'metrics:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: metrics:read or admin',
      });
      return;
    }

    // Parse request body
    const body = await parseBody<ChatRequestBody>(req);

    if (!body.message || body.message.trim().length === 0) {
      sendJson(res, 400, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'message is required',
      });
      return;
    }

    // Send to A2A gateway
    const client = getA2AClient();
    const chatRequest: ChatRequest = {
      message: body.message,
      org_id: authContext.orgId,
      session_id: body.session_id,
    };

    const result = await client.chat(chatRequest);

    const responseData: ChatResponseData = {
      ...result,
      agent: 'orchestrator',
    };

    console.log(
      `[${requestId}] Chat response from orchestrator in ${Date.now() - startMs}ms`
    );

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    handleError(res, requestId, startMs, error);
  }
}

// =============================================================================
// GET /v1/chat/agents - List Agents
// =============================================================================

interface AgentListData {
  agents: string[];
  gateway_available: boolean;
}

/**
 * List available agents.
 */
export async function handleListAgents(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    if (!hasScopeV1(authContext, 'metrics:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions. Required scope: metrics:read or admin',
      });
      return;
    }

    const gatewayAvailable = await isA2AGatewayAvailable();

    let agents: string[] = [];
    if (gatewayAvailable) {
      const client = getA2AClient();
      agents = await client.listAgents();
    }

    const responseData: AgentListData = {
      agents,
      gateway_available: gatewayAvailable,
    };

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: responseData,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    handleError(res, requestId, startMs, error);
  }
}

// =============================================================================
// GET /v1/chat/agents/:name/card - Get Agent Card
// =============================================================================

/**
 * Get A2A protocol agent card for discovery.
 */
export async function handleGetAgentCard(
  _req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  agentName: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    if (!hasScopeV1(authContext, 'metrics:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions',
      });
      return;
    }

    const client = getA2AClient();
    const card = await client.getAgentCard(agentName);

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: card,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    handleError(res, requestId, startMs, error);
  }
}

// =============================================================================
// POST /v1/chat/agents/:name/tasks - Submit Task
// =============================================================================

interface SubmitTaskBody extends TaskRequest {}

/**
 * Submit a task to a specific agent.
 */
export async function handleSubmitTask(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext,
  agentName: string
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    if (!hasScopeV1(authContext, 'metrics:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions',
      });
      return;
    }

    const body = await parseBody<SubmitTaskBody>(req);

    if (!body.skill) {
      sendJson(res, 400, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'skill is required',
      });
      return;
    }

    // Inject org_id into input
    const taskRequest: TaskRequest = {
      skill: body.skill,
      input: {
        ...body.input,
        org_id: authContext.orgId,
      },
      session_id: body.session_id,
      trace_id: requestId,
    };

    const client = getA2AClient();
    const result = await client.submitTask(agentName, taskRequest);

    console.log(
      `[${requestId}] Task submitted to ${agentName}: ${result.task_id}`
    );

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: result,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    handleError(res, requestId, startMs, error);
  }
}

// =============================================================================
// Specialized Endpoints
// =============================================================================

/**
 * POST /v1/chat/explain-forecast - Quick forecast explanation
 */
export async function handleExplainForecast(
  req: IncomingMessage,
  res: ServerResponse,
  authContext: AuthContext
): Promise<void> {
  const requestId = generateRequestId();
  const startMs = Date.now();

  try {
    if (!hasScopeV1(authContext, 'metrics:read')) {
      sendJson(res, 403, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'Insufficient permissions',
      });
      return;
    }

    const body = await parseBody<{ metric_key: string; time_range?: string }>(req);

    if (!body.metric_key) {
      sendJson(res, 400, {
        success: false,
        requestId,
        timestamp: new Date().toISOString(),
        error: 'metric_key is required',
      });
      return;
    }

    const client = getA2AClient();
    const result = await client.explainForecast(
      authContext.orgId,
      body.metric_key,
      { timeRange: body.time_range }
    );

    sendJson(res, 200, {
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: result,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    handleError(res, requestId, startMs, error);
  }
}

// =============================================================================
// Error Handler
// =============================================================================

function handleError(
  res: ServerResponse,
  requestId: string,
  startMs: number,
  error: unknown
): void {
  const errorMessage = (error as Error).message;
  console.error(`[${requestId}] Chat error:`, errorMessage);

  let statusCode = 500;
  if (error instanceof A2AGatewayError) {
    statusCode = error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 502;
  } else if (errorMessage.includes('not found')) {
    statusCode = 404;
  }

  sendJson(res, statusCode, {
    success: false,
    requestId,
    timestamp: new Date().toISOString(),
    error: errorMessage,
    durationMs: Date.now() - startMs,
  });
}

// =============================================================================
// Route Matchers
// =============================================================================

/**
 * Check if path is the main chat endpoint
 */
export function isChatPath(pathname: string): boolean {
  return pathname === '/v1/chat';
}

/**
 * Check if path is list agents
 */
export function isListAgentsPath(pathname: string): boolean {
  return pathname === '/v1/chat/agents';
}

/**
 * Extract agent name from card path
 * Pattern: /v1/chat/agents/:name/card
 */
export function extractAgentNameFromCardPath(pathname: string): string | null {
  const match = pathname.match(/^\/v1\/chat\/agents\/([^/]+)\/card$/);
  return match ? match[1] : null;
}

/**
 * Extract agent name from tasks path
 * Pattern: /v1/chat/agents/:name/tasks
 */
export function extractAgentNameFromTasksPath(pathname: string): string | null {
  const match = pathname.match(/^\/v1\/chat\/agents\/([^/]+)\/tasks$/);
  return match ? match[1] : null;
}

/**
 * Check if path is explain-forecast shortcut
 */
export function isExplainForecastPath(pathname: string): boolean {
  return pathname === '/v1/chat/explain-forecast';
}
