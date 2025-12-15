/**
 * Intent Router - Routes requests to appropriate handlers based on intent
 *
 * Task ID: intentvision-6g7.1
 *
 * The router analyzes incoming requests and determines:
 * 1. Intent category (query, action, analysis, pipeline)
 * 2. Required tools for the intent
 * 3. Execution strategy (direct vs ReAct loop)
 */

import type {
  AgentRequest,
  IntentCategory,
  RoutingDecision,
} from '../types.js';

// =============================================================================
// Intent Patterns
// =============================================================================

interface IntentPattern {
  category: IntentCategory;
  patterns: RegExp[];
  suggestedTools: string[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    category: 'query',
    patterns: [
      /^(what|who|where|when|how|why|which|show|list|get|find|search)/i,
      /\?$/,
    ],
    suggestedTools: ['queryMetrics', 'queryAlerts', 'queryForecasts'],
  },
  {
    category: 'action',
    patterns: [
      /^(create|add|update|delete|remove|set|configure|enable|disable)/i,
      /^(run|execute|trigger|start|stop)/i,
    ],
    suggestedTools: ['runPipeline', 'createAlert', 'updateConfig'],
  },
  {
    category: 'analysis',
    patterns: [
      /^(analyze|compare|evaluate|assess|check|inspect|review)/i,
      /(trend|pattern|anomaly|correlation|insight)/i,
    ],
    suggestedTools: ['analyzeMetrics', 'detectAnomalies', 'generateForecast'],
  },
  {
    category: 'pipeline',
    patterns: [
      /(pipeline|forecast|anomaly|alert)/i,
      /(ingest|normalize|store)/i,
    ],
    suggestedTools: ['runPipeline', 'checkPipelineStatus', 'getPipelineMetrics'],
  },
];

// =============================================================================
// Router
// =============================================================================

/**
 * Route an agent request to determine handling strategy
 */
export function routeIntent(request: AgentRequest): RoutingDecision {
  const { intent } = request;
  const normalizedIntent = intent.toLowerCase().trim();

  // Find matching patterns
  const matches: Array<{ pattern: IntentPattern; confidence: number }> = [];

  for (const pattern of INTENT_PATTERNS) {
    let matchScore = 0;

    for (const regex of pattern.patterns) {
      if (regex.test(normalizedIntent)) {
        matchScore += 1;
      }
    }

    if (matchScore > 0) {
      matches.push({
        pattern,
        confidence: Math.min(1, matchScore / pattern.patterns.length + 0.3),
      });
    }
  }

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence);

  // Return best match or unknown
  if (matches.length > 0) {
    const best = matches[0];
    return {
      category: best.pattern.category,
      confidence: best.confidence,
      suggestedTools: best.pattern.suggestedTools,
      reasoning: `Intent "${intent}" matched ${best.pattern.category} patterns with ${(best.confidence * 100).toFixed(0)}% confidence`,
    };
  }

  return {
    category: 'unknown',
    confidence: 0,
    suggestedTools: [],
    reasoning: `Intent "${intent}" did not match any known patterns`,
  };
}

/**
 * Determine if request requires ReAct loop or direct execution
 */
export function requiresReactLoop(decision: RoutingDecision): boolean {
  // Complex intents that need iterative reasoning
  if (decision.category === 'analysis') return true;
  if (decision.category === 'unknown') return true;

  // Multiple tools needed
  if (decision.suggestedTools.length > 1) return true;

  // Low confidence needs exploration
  if (decision.confidence < 0.6) return true;

  return false;
}

/**
 * Get execution strategy for a routing decision
 */
export function getExecutionStrategy(decision: RoutingDecision): {
  strategy: 'direct' | 'react';
  maxIterations: number;
  tools: string[];
} {
  const useReact = requiresReactLoop(decision);

  return {
    strategy: useReact ? 'react' : 'direct',
    maxIterations: useReact ? 10 : 1,
    tools: decision.suggestedTools,
  };
}
