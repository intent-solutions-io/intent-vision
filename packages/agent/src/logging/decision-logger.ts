/**
 * Decision Logger - Log agent decisions to AgentFS
 *
 * Task ID: intentvision-rhs.3
 *
 * Logs all agent decisions for:
 * - Audit trail
 * - Debugging
 * - Performance analysis
 * - Decision replay
 *
 * Environment Variables:
 * - AGENTFS_ENABLED: Set to '1' to enable persistent logging (default: off)
 * - AGENTFS_DB_PATH: Path to AgentFS database (default: .agentfs/intentvision.db)
 */

import { AgentFS } from 'agentfs-sdk';
import type { DecisionLog } from '../types.js';

// =============================================================================
// Configuration
// =============================================================================

interface AgentFSConfig {
  enabled: boolean;
  dbPath: string;
  projectId: string;
}

function getConfig(): AgentFSConfig {
  return {
    enabled: process.env.AGENTFS_ENABLED === '1',
    dbPath: process.env.AGENTFS_DB_PATH || '.agentfs/intentvision.db',
    projectId: 'intentvision',
  };
}

// =============================================================================
// AgentFS Client
// =============================================================================

let _agentfs: Awaited<ReturnType<typeof AgentFS.open>> | null = null;
let _initPromise: Promise<void> | null = null;
let _config: AgentFSConfig | null = null;

/**
 * Initialize AgentFS client
 */
export function initializeAgentFS(config?: { dbPath?: string }): void {
  _config = getConfig();

  if (config?.dbPath) {
    _config.dbPath = config.dbPath;
  }

  if (!_config.enabled) {
    console.log('[AgentFS] Decision logging disabled (set AGENTFS_ENABLED=1 to enable)');
    return;
  }

  // Start async initialization
  _initPromise = initAsync();
}

async function initAsync(): Promise<void> {
  if (!_config) {
    _config = getConfig();
  }

  try {
    _agentfs = await AgentFS.open({ id: _config.projectId });
    console.log(`[AgentFS] Connected to ${_config.dbPath}`);
  } catch (error) {
    console.error('[AgentFS] Failed to initialize:', error);
    _agentfs = null;
  }
}

/**
 * Get AgentFS client (waits for initialization if needed)
 */
async function getClient(): Promise<typeof _agentfs> {
  if (!_config) {
    initializeAgentFS();
  }

  if (!_config?.enabled) {
    return null;
  }

  if (_initPromise) {
    await _initPromise;
  }

  return _agentfs;
}

/**
 * Check if AgentFS is enabled and connected
 */
export function isAgentFSEnabled(): boolean {
  return _config?.enabled ?? false;
}

// =============================================================================
// Decision Logging
// =============================================================================

/**
 * Log a decision to AgentFS
 */
export async function logDecision(log: DecisionLog): Promise<void> {
  const client = await getClient();

  if (!client) {
    // Fallback to console when disabled
    if (process.env.NODE_ENV !== 'test') {
      console.log('[AgentFS:stub] Decision logged:', JSON.stringify(log, null, 2));
    }
    return;
  }

  // Store in KV store with decision key
  const key = `decisions:${log.requestId}:${log.logId}`;
  await client.kv.set(key, {
    ...log,
    persistedAt: new Date().toISOString(),
  });

  // Also record as tool call for audit trail
  const startTime = new Date(log.timestamp).getTime() / 1000;
  await client.tools.record(
    `decision:${log.type}`,
    startTime,
    Date.now() / 1000,
    { requestId: log.requestId, type: log.type },
    { decision: log.decision, outcome: log.outcome }
  );
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
// Query Operations (for testing and debugging)
// =============================================================================

/**
 * Get a logged decision by key
 */
export async function getDecision(requestId: string, logId: string): Promise<DecisionLog | null> {
  const client = await getClient();

  if (!client) {
    return null;
  }

  const key = `decisions:${requestId}:${logId}`;
  const result = await client.kv.get(key);
  return result as DecisionLog | null;
}

/**
 * Get all decisions for a request
 */
export async function getRequestDecisions(requestId: string): Promise<DecisionLog[]> {
  const client = await getClient();

  if (!client) {
    return [];
  }

  // Note: This is a simplified implementation
  // Real implementation would use a proper query mechanism
  const decisions: DecisionLog[] = [];
  const possibleLogIds = [
    `${requestId}-route`,
    `${requestId}-final`,
    ...Array.from({ length: 10 }, (_, i) => `${requestId}-tool-select-${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `${requestId}-tool-exec-${i + 1}`),
  ];

  for (const logId of possibleLogIds) {
    const decision = await getDecision(requestId, logId);
    if (decision) {
      decisions.push(decision);
    }
  }

  return decisions.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
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
  const client = await getClient();
  const snapshotId = `snapshot-${Date.now()}`;

  if (!client) {
    console.log(`[AgentFS:stub] Snapshot created: ${snapshotId}`);
    return snapshotId;
  }

  await client.kv.set(`snapshots:${snapshotId}`, {
    requestId,
    timestamp: new Date().toISOString(),
    state,
  });

  return snapshotId;
}

/**
 * Log batch of decisions (for bulk import)
 */
export async function logDecisionBatch(logs: DecisionLog[]): Promise<void> {
  for (const log of logs) {
    await logDecision(log);
  }
}
