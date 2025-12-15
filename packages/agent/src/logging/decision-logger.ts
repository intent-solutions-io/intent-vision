/**
 * Decision Logger - Log agent decisions to AgentFS
 *
 * Task ID: intentvision-6g7.3
 *
 * Logs all agent decisions for:
 * - Audit trail
 * - Debugging
 * - Performance analysis
 * - Decision replay
 */

import type { DecisionLog } from '../types.js';

// =============================================================================
// AgentFS Integration
// =============================================================================

interface AgentFSClient {
  log(entry: Record<string, unknown>): Promise<void>;
  snapshot(data: Record<string, unknown>): Promise<string>;
}

let _client: AgentFSClient | null = null;

/**
 * Initialize AgentFS client
 */
export function initializeAgentFS(config?: { dbPath?: string }): void {
  // Stub implementation - would connect to actual AgentFS
  _client = {
    async log(entry: Record<string, unknown>): Promise<void> {
      console.log('[AgentFS] Decision logged:', JSON.stringify(entry, null, 2));
    },
    async snapshot(data: Record<string, unknown>): Promise<string> {
      const snapshotId = `snapshot-${Date.now()}`;
      console.log(`[AgentFS] Snapshot created: ${snapshotId}`);
      return snapshotId;
    },
  };

  console.log('[AgentFS] Initialized with config:', config);
}

/**
 * Get AgentFS client (auto-initialize if needed)
 */
function getClient(): AgentFSClient {
  if (!_client) {
    initializeAgentFS();
  }
  return _client!;
}

// =============================================================================
// Decision Logging
// =============================================================================

/**
 * Log a decision to AgentFS
 */
export async function logDecision(log: DecisionLog): Promise<void> {
  const client = getClient();

  await client.log({
    logType: 'decision',
    ...log,
  });
}

/**
 * Log a routing decision
 */
export async function logRoutingDecision(
  requestId: string,
  category: string,
  confidence: number,
  reasoning: string
): Promise<void> {
  await logDecision({
    logId: `${requestId}-route`,
    requestId,
    timestamp: new Date().toISOString(),
    type: 'route',
    decision: { category, confidence },
    reasoning,
    outcome: 'success',
  });
}

/**
 * Log a tool selection decision
 */
export async function logToolSelection(
  requestId: string,
  step: number,
  tool: string,
  reasoning: string
): Promise<void> {
  await logDecision({
    logId: `${requestId}-tool-select-${step}`,
    requestId,
    timestamp: new Date().toISOString(),
    type: 'tool_select',
    decision: { tool, step },
    reasoning,
  });
}

/**
 * Log a tool execution result
 */
export async function logToolExecution(
  requestId: string,
  step: number,
  tool: string,
  success: boolean,
  result: unknown
): Promise<void> {
  await logDecision({
    logId: `${requestId}-tool-exec-${step}`,
    requestId,
    timestamp: new Date().toISOString(),
    type: 'tool_execute',
    decision: { tool, step, result },
    reasoning: `Tool ${tool} executed`,
    outcome: success ? 'success' : 'failure',
  });
}

/**
 * Log final answer
 */
export async function logFinalAnswer(
  requestId: string,
  answer: unknown,
  reasoning: string
): Promise<void> {
  await logDecision({
    logId: `${requestId}-final`,
    requestId,
    timestamp: new Date().toISOString(),
    type: 'final_answer',
    decision: { answer },
    reasoning,
    outcome: 'success',
  });
}

// =============================================================================
// Snapshot Operations
// =============================================================================

/**
 * Create a snapshot of the current agent state
 */
export async function createSnapshot(
  requestId: string,
  state: Record<string, unknown>
): Promise<string> {
  const client = getClient();

  return client.snapshot({
    requestId,
    timestamp: new Date().toISOString(),
    state,
  });
}

/**
 * Log batch of decisions (for bulk import)
 */
export async function logDecisionBatch(logs: DecisionLog[]): Promise<void> {
  const client = getClient();

  for (const log of logs) {
    await client.log({
      logType: 'decision',
      ...log,
    });
  }
}
