/**
 * IntentVision Agent - Main Entry Point
 *
 * Task ID: intentvision-6g7
 *
 * Provides the agent workflow baseline:
 * - Intent routing
 * - ReAct loop execution
 * - Decision logging to AgentFS
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AgentRequest,
  AgentResponse,
  AgentContext,
  RoutingDecision,
} from './types.js';
import { routeIntent, getExecutionStrategy } from './router/intent-router.js';
import { executeReactLoop } from './react/react-loop.js';
import {
  initializeAgentFS,
  logRoutingDecision,
  logFinalAnswer,
} from './logging/decision-logger.js';
import { createToolRegistry, ALL_TOOLS } from './tools/stub-tools.js';

// Re-export types
export * from './types.js';
export * from './router/intent-router.js';
export * from './react/react-loop.js';
export * from './logging/decision-logger.js';
export * from './tools/stub-tools.js';

// =============================================================================
// Agent Configuration
// =============================================================================

export interface AgentConfig {
  /** Maximum iterations for ReAct loop */
  maxIterations?: number;
  /** AgentFS database path */
  agentFsPath?: string;
  /** Enable verbose logging */
  verbose?: boolean;
}

const DEFAULT_CONFIG: AgentConfig = {
  maxIterations: 10,
  verbose: false,
};

// =============================================================================
// Agent Initialization
// =============================================================================

let _initialized = false;
let _config: AgentConfig = DEFAULT_CONFIG;

/**
 * Initialize the agent with configuration
 */
export function initializeAgent(config: AgentConfig = {}): void {
  _config = { ...DEFAULT_CONFIG, ...config };

  // Initialize AgentFS
  initializeAgentFS({ dbPath: _config.agentFsPath });

  _initialized = true;

  if (_config.verbose) {
    console.log('[Agent] Initialized with config:', _config);
    console.log('[Agent] Available tools:', ALL_TOOLS.map((t) => t.name).join(', '));
  }
}

// =============================================================================
// Main Agent Function
// =============================================================================

/**
 * Process an agent request
 */
export async function processRequest(
  intent: string,
  orgId: string = 'org-demo',
  context?: AgentContext
): Promise<AgentResponse> {
  // Auto-initialize if needed
  if (!_initialized) {
    initializeAgent();
  }

  const requestId = uuidv4();
  const startTime = Date.now();

  const request: AgentRequest = {
    requestId,
    orgId,
    intent,
    context,
    maxIterations: _config.maxIterations,
  };

  if (_config.verbose) {
    console.log(`[Agent] Processing request ${requestId}: "${intent}"`);
  }

  try {
    // Step 1: Route the intent
    const routingDecision = routeIntent(request);

    await logRoutingDecision(
      requestId,
      routingDecision.category,
      routingDecision.confidence,
      routingDecision.reasoning
    );

    if (_config.verbose) {
      console.log(`[Agent] Routed to category: ${routingDecision.category}`);
      console.log(`[Agent] Confidence: ${(routingDecision.confidence * 100).toFixed(0)}%`);
    }

    // Step 2: Determine execution strategy
    const strategy = getExecutionStrategy(routingDecision);

    if (_config.verbose) {
      console.log(`[Agent] Strategy: ${strategy.strategy}`);
      console.log(`[Agent] Tools: ${strategy.tools.join(', ')}`);
    }

    // Step 3: Execute
    const toolRegistry = createToolRegistry();

    if (strategy.strategy === 'direct') {
      // Direct execution - just run the first tool
      const toolName = strategy.tools[0];
      const tool = toolRegistry.get(toolName);

      if (tool) {
        const result = await tool.execute({ query: intent });

        await logFinalAnswer(requestId, result.output, 'Direct execution completed');

        return {
          requestId,
          success: result.success,
          result: result.output,
          trace: {
            request,
            steps: [],
            finalAnswer: result.output,
            toolCallCount: 1,
            startedAt: new Date(startTime).toISOString(),
            endedAt: new Date().toISOString(),
          },
          durationMs: Date.now() - startTime,
        };
      }
    }

    // ReAct loop execution
    const response = await executeReactLoop(request, {
      maxIterations: strategy.maxIterations,
      tools: toolRegistry,
      routingDecision,
    });

    return response;
  } catch (error) {
    return {
      requestId,
      success: false,
      error: (error as Error).message,
      trace: {
        request,
        steps: [],
        toolCallCount: 0,
        startedAt: new Date(startTime).toISOString(),
        endedAt: new Date().toISOString(),
      },
      durationMs: Date.now() - startTime,
    };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get list of available tools
 */
export function getAvailableTools(): string[] {
  return ALL_TOOLS.map((t) => t.name);
}

/**
 * Get tool descriptions
 */
export function getToolDescriptions(): Array<{ name: string; description: string }> {
  return ALL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
  }));
}
