/**
 * ReAct Loop - Reasoning and Acting loop for agent execution
 *
 * Task ID: intentvision-6g7.2
 *
 * Implements the ReAct pattern:
 * 1. Thought: Reason about what to do
 * 2. Action: Select and execute a tool
 * 3. Observation: Process the result
 * 4. Repeat until done or max iterations
 *
 * No external API calls - uses stub reasoning for demonstration.
 */

import type {
  AgentRequest,
  AgentResponse,
  AgentTrace,
  ReactStep,
  Tool,
  RoutingDecision,
} from '../types.js';
import { logDecision } from '../logging/decision-logger.js';

// =============================================================================
// ReAct Loop
// =============================================================================

export interface ReactLoopConfig {
  maxIterations: number;
  tools: Map<string, Tool>;
  routingDecision: RoutingDecision;
}

/**
 * Execute the ReAct loop for a given request
 */
export async function executeReactLoop(
  request: AgentRequest,
  config: ReactLoopConfig
): Promise<AgentResponse> {
  const startTime = Date.now();
  const trace: AgentTrace = {
    request,
    steps: [],
    toolCallCount: 0,
    startedAt: new Date().toISOString(),
    endedAt: '',
  };

  try {
    let currentStep = 0;
    let context = {
      intent: request.intent,
      observations: [] as unknown[],
      suggestedTools: config.routingDecision.suggestedTools,
    };

    while (currentStep < config.maxIterations) {
      currentStep++;

      // Generate thought (stub - would use LLM in production)
      const thought = generateThought(context, currentStep);

      // Log the thought
      await logDecision({
        logId: `${request.requestId}-thought-${currentStep}`,
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        type: 'tool_select',
        decision: { thought, step: currentStep },
        reasoning: thought,
      });

      // Determine action
      const { action, actionInput, isFinal } = determineAction(
        context,
        thought,
        config.tools
      );

      const step: ReactStep = {
        step: currentStep,
        thought,
        action,
        actionInput,
        isFinal,
        timestamp: new Date().toISOString(),
      };

      // If final, we're done
      if (isFinal) {
        step.observation = actionInput; // Final answer is in actionInput
        trace.steps.push(step);
        trace.finalAnswer = actionInput;
        break;
      }

      // Execute action if we have one
      if (action && config.tools.has(action)) {
        const tool = config.tools.get(action)!;

        // Log tool execution
        await logDecision({
          logId: `${request.requestId}-tool-${currentStep}`,
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
          type: 'tool_execute',
          decision: { tool: action, input: actionInput },
          reasoning: `Executing ${action} with provided input`,
        });

        const result = await tool.execute(actionInput);
        step.observation = result.output;
        trace.toolCallCount++;

        // Add observation to context
        context.observations.push({
          tool: action,
          result: result.output,
        });
      } else if (action) {
        step.observation = { error: `Tool "${action}" not found` };
      }

      trace.steps.push(step);

      // Check if we should stop based on observation
      if (shouldStop(step.observation, context)) {
        trace.finalAnswer = step.observation;
        break;
      }
    }

    // Finalize trace
    trace.endedAt = new Date().toISOString();

    // Log final answer
    await logDecision({
      logId: `${request.requestId}-final`,
      requestId: request.requestId,
      timestamp: trace.endedAt,
      type: 'final_answer',
      decision: { answer: trace.finalAnswer },
      reasoning: `Completed after ${trace.steps.length} steps, ${trace.toolCallCount} tool calls`,
      outcome: 'success',
    });

    return {
      requestId: request.requestId,
      success: true,
      result: trace.finalAnswer,
      trace,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    trace.endedAt = new Date().toISOString();

    return {
      requestId: request.requestId,
      success: false,
      error: (error as Error).message,
      trace,
      durationMs: Date.now() - startTime,
    };
  }
}

// =============================================================================
// Stub Reasoning (No External API)
// =============================================================================

interface ReasoningContext {
  intent: string;
  observations: unknown[];
  suggestedTools: string[];
}

/**
 * Generate a thought based on current context
 * Stub implementation - would use LLM in production
 */
function generateThought(context: ReasoningContext, step: number): string {
  const { intent, observations, suggestedTools } = context;

  if (step === 1) {
    return `I need to understand the intent "${intent}". ` +
      `Available tools: ${suggestedTools.join(', ')}. ` +
      `Let me start by gathering relevant data.`;
  }

  if (observations.length > 0) {
    const lastObs = observations[observations.length - 1];
    return `I've gathered ${observations.length} observation(s). ` +
      `The latest result helps me understand the current state. ` +
      `I should ${observations.length >= 2 ? 'synthesize these results' : 'gather more data'}.`;
  }

  return `Step ${step}: Continuing to work on "${intent}". ` +
    `I need to select an appropriate tool from ${suggestedTools.join(', ')}.`;
}

/**
 * Determine the next action based on thought and context
 * Stub implementation - would use LLM in production
 */
function determineAction(
  context: ReasoningContext,
  thought: string,
  tools: Map<string, Tool>
): { action?: string; actionInput?: unknown; isFinal: boolean } {
  const { observations, suggestedTools } = context;

  // If we have enough observations, synthesize and finish
  if (observations.length >= 2) {
    return {
      isFinal: true,
      actionInput: {
        summary: 'Analysis complete based on gathered observations',
        observationCount: observations.length,
        observations,
      },
    };
  }

  // Select first suggested tool that exists
  for (const toolName of suggestedTools) {
    if (tools.has(toolName)) {
      return {
        action: toolName,
        actionInput: { query: context.intent },
        isFinal: false,
      };
    }
  }

  // No suitable tool found, finish with current state
  return {
    isFinal: true,
    actionInput: {
      message: 'No suitable tools available for this intent',
      intent: context.intent,
    },
  };
}

/**
 * Determine if the loop should stop based on observation
 */
function shouldStop(observation: unknown, context: ReasoningContext): boolean {
  // Stop if we have an error
  if (observation && typeof observation === 'object' && 'error' in observation) {
    return true;
  }

  // Stop if we have enough observations
  if (context.observations.length >= 3) {
    return true;
  }

  return false;
}
