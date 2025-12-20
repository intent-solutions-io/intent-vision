/**
 * A2A Gateway Client
 *
 * Beads Task: intentvision-mpr.1
 * Phase F: Productization
 *
 * TypeScript client for communicating with the A2A gateway service.
 * This bridges the IntentVision API with ADK agents on Agent Engine.
 */

// =============================================================================
// Types
// =============================================================================

export interface AgentCard {
  protocol_version: string;
  name: string;
  version: string;
  url: string;
  description: string;
  capabilities: string[];
  skills: AgentSkill[];
  spiffe_id?: string;
}

export interface AgentSkill {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}

export interface TaskRequest {
  skill: string;
  input: Record<string, unknown>;
  session_id?: string;
  trace_id?: string;
}

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface ChatRequest {
  message: string;
  org_id: string;
  session_id?: string;
}

export interface ChatResponse {
  response: string;
  session_id?: string;
  trace_id?: string;
}

export interface GatewayHealth {
  status: string;
  gateway_id: string;
  spiffe_id: string;
  timestamp: string;
  agents: Record<string, string>;
}

// =============================================================================
// Configuration
// =============================================================================

const A2A_GATEWAY_URL = process.env.A2A_GATEWAY_URL || 'http://localhost:8081';
const REQUEST_TIMEOUT_MS = parseInt(process.env.A2A_REQUEST_TIMEOUT_MS || '30000', 10);

// =============================================================================
// A2A Gateway Client
// =============================================================================

export class A2AGatewayClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl: string = A2A_GATEWAY_URL, timeoutMs: number = REQUEST_TIMEOUT_MS) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeoutMs = timeoutMs;
  }

  // ===========================================================================
  // Health
  // ===========================================================================

  /**
   * Check gateway health status
   */
  async health(): Promise<GatewayHealth> {
    const response = await this.fetch('/health');
    return response as GatewayHealth;
  }

  // ===========================================================================
  // Agent Discovery
  // ===========================================================================

  /**
   * List available agents
   */
  async listAgents(): Promise<string[]> {
    const response = await this.fetch('/agents');
    return response as string[];
  }

  /**
   * Get agent card for A2A protocol discovery
   */
  async getAgentCard(agentName: string): Promise<AgentCard> {
    const response = await this.fetch(`/agents/${agentName}/.well-known/agent-card.json`);
    return response as AgentCard;
  }

  // ===========================================================================
  // Task Submission
  // ===========================================================================

  /**
   * Submit a task to an agent
   */
  async submitTask(agentName: string, request: TaskRequest): Promise<TaskStatus> {
    const response = await this.fetch(`/agents/${agentName}/tasks`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response as TaskStatus;
  }

  // ===========================================================================
  // Orchestrator Chat
  // ===========================================================================

  /**
   * Send a chat message to the orchestrator agent
   *
   * This is the primary interface for user queries about forecasts,
   * alerts, and metrics.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.fetch('/agents/orchestrator/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response as ChatResponse;
  }

  // ===========================================================================
  // Specialized Methods
  // ===========================================================================

  /**
   * Explain a forecast using the metric-analyst agent
   */
  async explainForecast(
    orgId: string,
    metricKey: string,
    options?: { timeRange?: string; sessionId?: string }
  ): Promise<TaskStatus> {
    return this.submitTask('metric-analyst', {
      skill: 'Explain Forecast',
      input: {
        org_id: orgId,
        metric_key: metricKey,
        time_range: options?.timeRange || '7d',
      },
      session_id: options?.sessionId,
    });
  }

  /**
   * Analyze alerts using the alert-tuner agent
   */
  async analyzeAlerts(
    orgId: string,
    options?: { alertRuleId?: string; sessionId?: string }
  ): Promise<TaskStatus> {
    return this.submitTask('alert-tuner', {
      skill: 'Analyze Alerts',
      input: {
        org_id: orgId,
        alert_rule_id: options?.alertRuleId,
      },
      session_id: options?.sessionId,
    });
  }

  /**
   * Get onboarding guidance using the onboarding-coach agent
   */
  async guideOnboarding(
    orgId: string,
    sourceType: string,
    options?: { description?: string; sessionId?: string }
  ): Promise<TaskStatus> {
    return this.submitTask('onboarding-coach', {
      skill: 'Guide Connection',
      input: {
        org_id: orgId,
        source_type: sourceType,
        description: options?.description,
      },
      session_id: options?.sessionId,
    });
  }

  // ===========================================================================
  // Internal HTTP Client
  // ===========================================================================

  private async fetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new A2AGatewayError(
          `A2A Gateway error: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof A2AGatewayError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new A2AGatewayError(
          `A2A Gateway request timeout after ${this.timeoutMs}ms`,
          408
        );
      }

      throw new A2AGatewayError(
        `A2A Gateway connection error: ${(error as Error).message}`,
        503
      );
    }
  }
}

// =============================================================================
// Error Class
// =============================================================================

export class A2AGatewayError extends Error {
  public statusCode: number;
  public responseBody?: string;

  constructor(message: string, statusCode: number, responseBody?: string) {
    super(message);
    this.name = 'A2AGatewayError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _client: A2AGatewayClient | null = null;

/**
 * Get the default A2A gateway client instance
 */
export function getA2AClient(): A2AGatewayClient {
  if (!_client) {
    _client = new A2AGatewayClient();
  }
  return _client;
}

/**
 * Check if A2A gateway is available
 */
export async function isA2AGatewayAvailable(): Promise<boolean> {
  try {
    const client = getA2AClient();
    const health = await client.health();
    return health.status === 'healthy';
  } catch {
    return false;
  }
}
