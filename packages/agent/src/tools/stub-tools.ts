/**
 * Stub Tools - Demonstration tools for agent workflow
 *
 * Task ID: intentvision-6g7.2
 *
 * These are stub implementations that demonstrate the tool interface.
 * No external API calls are made.
 */

import type { Tool, ToolResult } from '../types.js';

// =============================================================================
// Query Tools
// =============================================================================

export const queryMetricsTool: Tool = {
  name: 'queryMetrics',
  description: 'Query metrics from the database for a given time range and filters',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language query' },
      metricKey: { type: 'string', description: 'Specific metric key to query' },
      timeRange: { type: 'string', description: 'Time range (e.g., "1h", "1d", "7d")' },
    },
    required: ['query'],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const params = input as { query?: string; metricKey?: string; timeRange?: string };

    // Stub response
    return {
      success: true,
      output: {
        query: params.query,
        metricKey: params.metricKey || 'system.cpu.usage',
        timeRange: params.timeRange || '1h',
        results: [
          { timestamp: new Date().toISOString(), value: 45.2 },
          { timestamp: new Date(Date.now() - 300000).toISOString(), value: 52.1 },
          { timestamp: new Date(Date.now() - 600000).toISOString(), value: 48.7 },
        ],
        count: 3,
        source: 'stub',
      },
    };
  },
};

export const queryAlertsTool: Tool = {
  name: 'queryAlerts',
  description: 'Query active or historical alerts',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language query' },
      status: { type: 'string', enum: ['firing', 'resolved', 'all'] },
      severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'] },
    },
    required: ['query'],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const params = input as { query?: string; status?: string; severity?: string };

    return {
      success: true,
      output: {
        query: params.query,
        status: params.status || 'all',
        alerts: [
          {
            alertId: 'alert-001',
            title: 'High CPU usage detected',
            severity: 'warning',
            status: 'firing',
            triggeredAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
        count: 1,
        source: 'stub',
      },
    };
  },
};

export const queryForecastsTool: Tool = {
  name: 'queryForecasts',
  description: 'Query forecast predictions for a metric',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language query' },
      metricKey: { type: 'string', description: 'Metric to forecast' },
      horizon: { type: 'number', description: 'Forecast horizon in hours' },
    },
    required: ['query'],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const params = input as { query?: string; metricKey?: string; horizon?: number };

    return {
      success: true,
      output: {
        query: params.query,
        metricKey: params.metricKey || 'system.cpu.usage',
        horizon: params.horizon || 6,
        predictions: [
          { timestamp: new Date(Date.now() + 3600000).toISOString(), value: 55.0 },
          { timestamp: new Date(Date.now() + 7200000).toISOString(), value: 58.2 },
          { timestamp: new Date(Date.now() + 10800000).toISOString(), value: 52.1 },
        ],
        source: 'stub',
      },
    };
  },
};

// =============================================================================
// Action Tools
// =============================================================================

export const runPipelineTool: Tool = {
  name: 'runPipeline',
  description: 'Execute the IntentVision pipeline',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Pipeline execution request' },
      orgId: { type: 'string', description: 'Organization ID' },
      useSynthetic: { type: 'boolean', description: 'Use synthetic data' },
    },
    required: ['query'],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const params = input as { query?: string; orgId?: string; useSynthetic?: boolean };

    return {
      success: true,
      output: {
        status: 'completed',
        orgId: params.orgId || 'org-demo',
        useSynthetic: params.useSynthetic ?? true,
        metrics: { processed: 100, stored: 100 },
        forecasts: { generated: 6 },
        anomalies: { detected: 0 },
        alerts: { emitted: 0 },
        durationMs: 50,
        source: 'stub',
      },
    };
  },
};

// =============================================================================
// Analysis Tools
// =============================================================================

export const analyzeMetricsTool: Tool = {
  name: 'analyzeMetrics',
  description: 'Analyze metrics for patterns, trends, and anomalies',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Analysis request' },
      metricKey: { type: 'string', description: 'Metric to analyze' },
      analysisType: {
        type: 'string',
        enum: ['trend', 'anomaly', 'correlation', 'summary'],
      },
    },
    required: ['query'],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const params = input as {
      query?: string;
      metricKey?: string;
      analysisType?: string;
    };

    return {
      success: true,
      output: {
        query: params.query,
        metricKey: params.metricKey || 'system.cpu.usage',
        analysisType: params.analysisType || 'summary',
        analysis: {
          trend: 'slightly_increasing',
          mean: 50.2,
          stdDev: 8.5,
          min: 32.1,
          max: 78.4,
          anomalyCount: 0,
          recommendation: 'Monitor for potential threshold breach',
        },
        source: 'stub',
      },
    };
  },
};

export const detectAnomaliesTool: Tool = {
  name: 'detectAnomalies',
  description: 'Detect anomalies in metric data',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Anomaly detection request' },
      metricKey: { type: 'string', description: 'Metric to analyze' },
      sensitivity: { type: 'number', description: 'Detection sensitivity (0-1)' },
    },
    required: ['query'],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const params = input as {
      query?: string;
      metricKey?: string;
      sensitivity?: number;
    };

    return {
      success: true,
      output: {
        query: params.query,
        metricKey: params.metricKey || 'system.cpu.usage',
        sensitivity: params.sensitivity || 0.7,
        anomalies: [],
        summary: 'No anomalies detected in the current time window',
        source: 'stub',
      },
    };
  },
};

// =============================================================================
// Tool Registry
// =============================================================================

export const ALL_TOOLS: Tool[] = [
  queryMetricsTool,
  queryAlertsTool,
  queryForecastsTool,
  runPipelineTool,
  analyzeMetricsTool,
  detectAnomaliesTool,
];

export function createToolRegistry(): Map<string, Tool> {
  const registry = new Map<string, Tool>();
  for (const tool of ALL_TOOLS) {
    registry.set(tool.name, tool);
  }
  return registry;
}
