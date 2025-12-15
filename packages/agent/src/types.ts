/**
 * Agent Types - Core type definitions for the agent workflow
 *
 * Task ID: intentvision-6g7
 */

// =============================================================================
// Agent Request/Response
// =============================================================================

export interface AgentRequest {
  /** Unique request identifier */
  requestId: string;
  /** Organization ID */
  orgId: string;
  /** User intent/goal */
  intent: string;
  /** Optional context from previous interactions */
  context?: AgentContext;
  /** Maximum iterations for ReAct loop */
  maxIterations?: number;
}

export interface AgentResponse {
  requestId: string;
  success: boolean;
  /** Final result or answer */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution trace for debugging */
  trace: AgentTrace;
  /** Duration in milliseconds */
  durationMs: number;
}

// =============================================================================
// Agent Context
// =============================================================================

export interface AgentContext {
  /** Previous observations */
  observations: Observation[];
  /** Working memory (key-value store) */
  memory: Record<string, unknown>;
  /** Available tools */
  availableTools: string[];
}

export interface Observation {
  timestamp: string;
  source: string;
  content: unknown;
}

// =============================================================================
// ReAct Loop
// =============================================================================

export interface ReactStep {
  /** Step number in the loop */
  step: number;
  /** Reasoning about what to do */
  thought: string;
  /** Action to take (tool name) */
  action?: string;
  /** Action input */
  actionInput?: unknown;
  /** Observation from action */
  observation?: unknown;
  /** Is this the final answer? */
  isFinal: boolean;
  /** Timestamp */
  timestamp: string;
}

export interface AgentTrace {
  /** Request that started the trace */
  request: AgentRequest;
  /** All ReAct steps */
  steps: ReactStep[];
  /** Final answer */
  finalAnswer?: unknown;
  /** Total tool calls made */
  toolCallCount: number;
  /** Start timestamp */
  startedAt: string;
  /** End timestamp */
  endedAt: string;
}

// =============================================================================
// Tools
// =============================================================================

export interface Tool {
  /** Tool name (must be unique) */
  name: string;
  /** Tool description for the agent */
  description: string;
  /** JSON schema for input parameters */
  inputSchema: Record<string, unknown>;
  /** Execute the tool */
  execute: (input: unknown) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: unknown;
  error?: string;
}

// =============================================================================
// Routing
// =============================================================================

export type IntentCategory =
  | 'query'      // Information retrieval
  | 'action'     // Perform an action
  | 'analysis'   // Analyze data
  | 'pipeline'   // Run pipeline operations
  | 'unknown';   // Unrecognized intent

export interface RoutingDecision {
  /** Detected intent category */
  category: IntentCategory;
  /** Confidence score (0-1) */
  confidence: number;
  /** Suggested tools for this intent */
  suggestedTools: string[];
  /** Reasoning for the decision */
  reasoning: string;
}

// =============================================================================
// Decision Logging
// =============================================================================

export interface DecisionLog {
  /** Log ID */
  logId: string;
  /** Request that triggered the decision */
  requestId: string;
  /** Timestamp */
  timestamp: string;
  /** Type of decision */
  type: 'route' | 'tool_select' | 'tool_execute' | 'final_answer';
  /** Decision details */
  decision: unknown;
  /** Reasoning */
  reasoning: string;
  /** Outcome (if known) */
  outcome?: 'success' | 'failure' | 'pending';
}
