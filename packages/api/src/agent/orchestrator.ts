/**
 * Agent Orchestrator
 *
 * Phase 17: Operator Assistant Agent
 *
 * Coordinates multiple specialist agents to analyze incidents and generate summaries.
 *
 * Agents:
 * - ForemanAgent: Decides how to summarize an incident, coordinates specialists
 * - MetricsExplainerAgent: Analyzes metric patterns and explains anomalies
 * - AlertSummarizerAgent: Summarizes alerts in plain language
 *
 * Main entry point:
 * - generateIncidentSummary(orgId, incidentId, llmConfig?): Generates comprehensive incident summary
 */

import type { LLMClient, LLMConfig, LLMMessage, LLMChatOptions } from '../llm/provider.js';
import { createLLMClient, getLLMClient, isLLMConfigured } from '../llm/providers/index.js';
import {
  getIncident,
  listIncidentAlerts,
  listRelatedMetrics,
  getMetricTimeseries,
  getForecast,
  type IncidentDetails,
  type AlertSummary,
  type MetricWithStats,
  type ForecastSummary,
  type DataPoint,
} from './tools.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Incident summary output
 */
export interface IncidentSummaryResult {
  /** Plain-language summary of the incident */
  summary: string;
  /** Key highlights/takeaways */
  highlights: string[];
  /** Recommended checks or actions */
  recommendedChecks: string[];
  /** LLM provider that generated the summary */
  providerUsed: string;
  /** Model that generated the summary */
  modelUsed: string;
  /** Generation time in ms */
  durationMs: number;
  /** Token usage if available */
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * Agent context - shared state between agents
 */
interface AgentContext {
  orgId: string;
  incidentId: string;
  incident?: IncidentDetails;
  alerts?: AlertSummary[];
  metrics?: MetricWithStats[];
  timeseries?: Map<string, DataPoint[]>;
  forecasts?: Map<string, ForecastSummary>;
}

/**
 * LLM chat options for agents
 */
const AGENT_CHAT_OPTIONS: LLMChatOptions = {
  temperature: 0.3, // Lower temperature for more consistent outputs
  maxTokens: 2048,
};

// =============================================================================
// System Prompts
// =============================================================================

const FOREMAN_SYSTEM_PROMPT = `You are an expert SRE incident analyst. Your job is to coordinate the analysis of incidents and produce clear, actionable summaries.

You will receive data about an incident including:
- Incident details (status, duration, related metrics/alerts)
- Alert summaries (what triggered, when, thresholds)
- Metric analysis (patterns, anomalies)
- Forecast insights (predictions, trends)

Your output should be:
1. A clear, concise summary (2-3 paragraphs) explaining what happened
2. Key highlights (3-5 bullet points)
3. Recommended checks or actions (3-5 items)

Focus on:
- Root cause indicators
- Timeline of events
- Impact assessment
- Correlation between metrics
- Actionable next steps

Use plain language. Avoid jargon. Be specific about values and times.`;

const METRICS_EXPLAINER_SYSTEM_PROMPT = `You are a metrics analysis expert. Your job is to analyze metric data and explain patterns and anomalies.

Given metric data including:
- Metric definitions (name, unit, description)
- Recent time series values
- Statistical summaries (min, max, avg)
- Forecast predictions

Provide:
1. Pattern description (trend, seasonality, volatility)
2. Anomaly identification (unusual values, sudden changes)
3. Correlation hints (metrics that move together)
4. Impact assessment (severity of observed changes)

Be specific about numbers and percentages. Identify the most significant changes.`;

const ALERT_SUMMARIZER_SYSTEM_PROMPT = `You are an alert analysis expert. Your job is to summarize alerts in plain language and identify patterns.

Given alert data including:
- Alert events (metric, trigger value, threshold, time)
- Alert conditions (above/below, comparison operators)
- Delivery status

Provide:
1. Plain-language description of what triggered
2. Timeline of events
3. Pattern identification (recurring alerts, escalating severity)
4. Threshold analysis (how far over/under threshold)

Be specific about times and values. Group related alerts together.`;

// =============================================================================
// ForemanAgent
// =============================================================================

/**
 * Foreman Agent
 *
 * Coordinates incident analysis and produces the final summary.
 * Calls specialist agents for detailed analysis.
 */
export class ForemanAgent {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Generate a comprehensive incident summary
   */
  async summarize(context: AgentContext): Promise<IncidentSummaryResult> {
    const startTime = Date.now();

    // Build the analysis input
    const analysisInput = this.buildAnalysisInput(context);

    // Generate summary using LLM
    const messages: LLMMessage[] = [
      { role: 'system', content: FOREMAN_SYSTEM_PROMPT },
      { role: 'user', content: analysisInput },
    ];

    const response = await this.llmClient.chat(messages, AGENT_CHAT_OPTIONS);

    // Parse the response
    const parsed = this.parseResponse(response.content);

    return {
      ...parsed,
      providerUsed: response.provider,
      modelUsed: response.model,
      durationMs: Date.now() - startTime,
      tokenUsage: response.usage
        ? {
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
          }
        : undefined,
    };
  }

  /**
   * Build the analysis input from context
   */
  private buildAnalysisInput(context: AgentContext): string {
    const sections: string[] = [];

    // Incident overview
    if (context.incident) {
      const { incident, alertCount, metricCount, durationMinutes, isResolved } = context.incident;
      sections.push(`## Incident Overview
- ID: ${incident.id}
- Title: ${incident.title}
- Status: ${incident.status}
- Started: ${formatDate(incident.startedAt)}
- Duration: ${durationMinutes ? `${durationMinutes} minutes` : 'Ongoing'}
- Resolved: ${isResolved ? 'Yes' : 'No'}
- Related Alerts: ${alertCount}
- Related Metrics: ${metricCount}
${incident.summary ? `- Auto-Summary: ${incident.summary}` : ''}
${incident.rootCauseHints?.length ? `- Root Cause Hints: ${incident.rootCauseHints.join(', ')}` : ''}`);
    }

    // Alert details
    if (context.alerts && context.alerts.length > 0) {
      const alertLines = context.alerts.map(a => {
        const threshold = a.condition
          ? `${a.condition.operator} ${a.condition.value}`
          : `${a.direction || 'crossed'} ${a.threshold}`;
        return `- [${formatDate(a.triggeredAt)}] ${a.metricName}: value=${a.triggerValue.toFixed(2)}, threshold=${threshold}, status=${a.deliveryStatus}`;
      });
      sections.push(`## Alerts (${context.alerts.length} total)
${alertLines.join('\n')}`);
    }

    // Metric analysis
    if (context.metrics && context.metrics.length > 0) {
      const metricLines = context.metrics.map(m => {
        const stats = m.latestValue !== undefined
          ? `latest=${m.latestValue.toFixed(2)}, min=${m.minValue?.toFixed(2) || 'N/A'}, max=${m.maxValue?.toFixed(2) || 'N/A'}, avg=${m.avgValue?.toFixed(2) || 'N/A'}`
          : 'No recent data';
        return `- ${m.metric.name}${m.metric.unit ? ` (${m.metric.unit})` : ''}: ${stats}`;
      });
      sections.push(`## Related Metrics
${metricLines.join('\n')}`);
    }

    // Forecast insights
    if (context.forecasts && context.forecasts.size > 0) {
      const forecastLines: string[] = [];
      context.forecasts.forEach((forecast, metricName) => {
        const { summary } = forecast;
        forecastLines.push(`- ${metricName}: trend=${summary.trend}, predicted range=[${summary.minPredicted?.toFixed(2) || 'N/A'}, ${summary.maxPredicted?.toFixed(2) || 'N/A'}]`);
      });
      sections.push(`## Forecast Insights
${forecastLines.join('\n')}`);
    }

    // Time series patterns
    if (context.timeseries && context.timeseries.size > 0) {
      const tsLines: string[] = [];
      context.timeseries.forEach((points, metricName) => {
        if (points.length > 0) {
          const values = points.map(p => p.value);
          const latest = values[values.length - 1];
          const min = Math.min(...values);
          const max = Math.max(...values);
          const volatility = max - min;
          tsLines.push(`- ${metricName}: ${points.length} points, latest=${latest.toFixed(2)}, range=[${min.toFixed(2)}, ${max.toFixed(2)}], volatility=${volatility.toFixed(2)}`);
        }
      });
      if (tsLines.length > 0) {
        sections.push(`## Time Series Patterns (24h)
${tsLines.join('\n')}`);
      }
    }

    sections.push(`## Task
Based on the above data, provide:
1. A clear summary (2-3 paragraphs) of what happened
2. 3-5 key highlights
3. 3-5 recommended checks or actions

Format your response as:
SUMMARY:
[Your summary here]

HIGHLIGHTS:
- [Highlight 1]
- [Highlight 2]
...

RECOMMENDED CHECKS:
- [Check 1]
- [Check 2]
...`);

    return sections.join('\n\n');
  }

  /**
   * Parse the LLM response into structured output
   */
  private parseResponse(content: string): {
    summary: string;
    highlights: string[];
    recommendedChecks: string[];
  } {
    // Default values
    let summary = content;
    let highlights: string[] = [];
    let recommendedChecks: string[] = [];

    // Try to parse structured response
    const summaryMatch = content.match(/SUMMARY:\s*([\s\S]*?)(?=HIGHLIGHTS:|$)/i);
    const highlightsMatch = content.match(/HIGHLIGHTS:\s*([\s\S]*?)(?=RECOMMENDED CHECKS:|$)/i);
    const checksMatch = content.match(/RECOMMENDED CHECKS:\s*([\s\S]*?)$/i);

    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    }

    if (highlightsMatch) {
      highlights = this.parseListItems(highlightsMatch[1]);
    }

    if (checksMatch) {
      recommendedChecks = this.parseListItems(checksMatch[1]);
    }

    // Fallback: if no structured response, generate basic highlights
    if (highlights.length === 0) {
      highlights = ['Review the incident timeline', 'Check metric thresholds', 'Verify alert configurations'];
    }

    if (recommendedChecks.length === 0) {
      recommendedChecks = ['Investigate root cause', 'Review related dashboards', 'Check service health'];
    }

    return { summary, highlights, recommendedChecks };
  }

  /**
   * Parse bullet point list items from text
   */
  private parseListItems(text: string): string[] {
    const lines = text.split('\n');
    const items: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Match lines starting with -, *, or numbers
      const match = trimmed.match(/^[-*\d.)\s]+(.+)$/);
      if (match) {
        items.push(match[1].trim());
      }
    }

    return items;
  }
}

// =============================================================================
// MetricsExplainerAgent
// =============================================================================

/**
 * Metrics Explainer Agent
 *
 * Analyzes metric patterns and explains anomalies.
 */
export class MetricsExplainerAgent {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Analyze metrics and generate explanation
   */
  async analyze(
    metrics: MetricWithStats[],
    timeseries: Map<string, DataPoint[]>,
    forecasts: Map<string, ForecastSummary>
  ): Promise<string> {
    if (metrics.length === 0) {
      return 'No metrics available for analysis.';
    }

    // Build analysis input
    const input = this.buildInput(metrics, timeseries, forecasts);

    const messages: LLMMessage[] = [
      { role: 'system', content: METRICS_EXPLAINER_SYSTEM_PROMPT },
      { role: 'user', content: input },
    ];

    const response = await this.llmClient.chat(messages, AGENT_CHAT_OPTIONS);
    return response.content;
  }

  private buildInput(
    metrics: MetricWithStats[],
    timeseries: Map<string, DataPoint[]>,
    forecasts: Map<string, ForecastSummary>
  ): string {
    const sections: string[] = [];

    for (const m of metrics) {
      const lines: string[] = [`## ${m.metric.name}`];

      if (m.metric.description) {
        lines.push(`Description: ${m.metric.description}`);
      }
      if (m.metric.unit) {
        lines.push(`Unit: ${m.metric.unit}`);
      }

      // Statistics
      lines.push(`Statistics (24h):`);
      lines.push(`- Latest: ${m.latestValue?.toFixed(2) || 'N/A'}`);
      lines.push(`- Min: ${m.minValue?.toFixed(2) || 'N/A'}`);
      lines.push(`- Max: ${m.maxValue?.toFixed(2) || 'N/A'}`);
      lines.push(`- Avg: ${m.avgValue?.toFixed(2) || 'N/A'}`);
      lines.push(`- Points: ${m.recentPointCount}`);

      // Time series
      const ts = timeseries.get(m.metric.name);
      if (ts && ts.length > 0) {
        const recentValues = ts.slice(-10).map(p => p.value.toFixed(2)).join(', ');
        lines.push(`Recent values (last 10): ${recentValues}`);
      }

      // Forecast
      const forecast = forecasts.get(m.metric.name);
      if (forecast) {
        lines.push(`Forecast (${forecast.horizonDays}d):`);
        lines.push(`- Trend: ${forecast.summary.trend}`);
        lines.push(`- Predicted range: [${forecast.summary.minPredicted?.toFixed(2)}, ${forecast.summary.maxPredicted?.toFixed(2)}]`);
      }

      sections.push(lines.join('\n'));
    }

    return sections.join('\n\n') + '\n\nAnalyze these metrics and explain any patterns or anomalies.';
  }
}

// =============================================================================
// AlertSummarizerAgent
// =============================================================================

/**
 * Alert Summarizer Agent
 *
 * Summarizes alerts in plain language and identifies patterns.
 */
export class AlertSummarizerAgent {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Summarize alerts and identify patterns
   */
  async summarize(alerts: AlertSummary[]): Promise<string> {
    if (alerts.length === 0) {
      return 'No alerts to summarize.';
    }

    // Build analysis input
    const input = this.buildInput(alerts);

    const messages: LLMMessage[] = [
      { role: 'system', content: ALERT_SUMMARIZER_SYSTEM_PROMPT },
      { role: 'user', content: input },
    ];

    const response = await this.llmClient.chat(messages, AGENT_CHAT_OPTIONS);
    return response.content;
  }

  private buildInput(alerts: AlertSummary[]): string {
    const lines: string[] = [`## Alerts (${alerts.length} total)`, ''];

    // Group by metric
    const byMetric = new Map<string, AlertSummary[]>();
    for (const alert of alerts) {
      const existing = byMetric.get(alert.metricName) || [];
      existing.push(alert);
      byMetric.set(alert.metricName, existing);
    }

    // Format each metric's alerts
    byMetric.forEach((metricAlerts, metricName) => {
      lines.push(`### ${metricName} (${metricAlerts.length} alerts)`);
      for (const a of metricAlerts) {
        const threshold = a.condition
          ? `${a.condition.operator} ${a.condition.value}`
          : `${a.direction || 'threshold'} ${a.threshold}`;
        lines.push(`- [${formatDate(a.triggeredAt)}] value=${a.triggerValue.toFixed(2)}, condition=${threshold}`);
      }
      lines.push('');
    });

    lines.push('Summarize these alerts in plain language. Identify any patterns or escalations.');

    return lines.join('\n');
  }
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Generate a comprehensive summary for an incident
 *
 * @param orgId - Organization ID
 * @param incidentId - Incident ID
 * @param llmConfig - Optional LLM configuration (uses default if not provided)
 * @returns Incident summary with highlights and recommended checks
 */
export async function generateIncidentSummary(
  orgId: string,
  incidentId: string,
  llmConfig?: LLMConfig
): Promise<IncidentSummaryResult> {
  // Get LLM client
  let llmClient: LLMClient;

  if (llmConfig) {
    llmClient = createLLMClient(llmConfig);
  } else if (isLLMConfigured()) {
    llmClient = getLLMClient();
  } else {
    // Return a stub response when no LLM is configured
    return generateStubSummary(orgId, incidentId);
  }

  // Build context by fetching all relevant data
  const context: AgentContext = {
    orgId,
    incidentId,
  };

  // Fetch incident details
  const incidentResult = await getIncident(orgId, incidentId);
  if (!incidentResult.success || !incidentResult.data) {
    throw new Error(incidentResult.error || 'Failed to get incident');
  }
  context.incident = incidentResult.data;

  // Fetch alerts
  const alertsResult = await listIncidentAlerts(orgId, incidentId);
  if (alertsResult.success && alertsResult.data) {
    context.alerts = alertsResult.data;
  }

  // Fetch related metrics
  const metricsResult = await listRelatedMetrics(orgId, incidentId);
  if (metricsResult.success && metricsResult.data) {
    context.metrics = metricsResult.data;

    // Fetch time series and forecasts for each metric
    context.timeseries = new Map();
    context.forecasts = new Map();

    for (const m of context.metrics) {
      // Get time series
      const tsResult = await getMetricTimeseries(orgId, m.metric.id, '24h');
      if (tsResult.success && tsResult.data) {
        context.timeseries.set(m.metric.name, tsResult.data);
      }

      // Get forecast
      const fcResult = await getForecast(orgId, m.metric.name);
      if (fcResult.success && fcResult.data) {
        context.forecasts.set(m.metric.name, fcResult.data);
      }
    }
  }

  // Use Foreman agent to generate summary
  const foreman = new ForemanAgent(llmClient);
  return foreman.summarize(context);
}

/**
 * Generate a stub summary when no LLM is configured
 */
async function generateStubSummary(
  orgId: string,
  incidentId: string
): Promise<IncidentSummaryResult> {
  const startTime = Date.now();

  // Fetch basic incident data
  const incidentResult = await getIncident(orgId, incidentId);
  const alertsResult = await listIncidentAlerts(orgId, incidentId);

  let summary = `Incident ${incidentId} requires LLM configuration for detailed analysis.`;
  const highlights: string[] = [];
  const recommendedChecks: string[] = ['Configure an LLM provider to enable AI-powered summaries'];

  if (incidentResult.success && incidentResult.data) {
    const { incident, alertCount, metricCount, isResolved } = incidentResult.data;
    summary = `Incident "${incident.title}" is currently ${incident.status}. It involves ${alertCount} alerts across ${metricCount} metrics. ${isResolved ? 'The incident has been resolved.' : 'The incident is still open.'}`;

    highlights.push(`Status: ${incident.status}`);
    highlights.push(`Alert count: ${alertCount}`);
    highlights.push(`Metric count: ${metricCount}`);

    if (incident.rootCauseHints?.length) {
      highlights.push(`Possible root causes: ${incident.rootCauseHints.join(', ')}`);
    }
  }

  if (alertsResult.success && alertsResult.data && alertsResult.data.length > 0) {
    const topAlert = alertsResult.data[0];
    recommendedChecks.push(`Review alert on ${topAlert.metricName} (triggered at ${formatDate(topAlert.triggeredAt)})`);
  }

  recommendedChecks.push('Review incident timeline');
  recommendedChecks.push('Check related metrics and dashboards');

  return {
    summary,
    highlights,
    recommendedChecks,
    providerUsed: 'stub',
    modelUsed: 'none',
    durationMs: Date.now() - startTime,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a date for display
 */
function formatDate(date: Date | FirebaseFirestore.Timestamp | unknown): string {
  if (date instanceof Date) {
    return date.toISOString();
  }
  if (date && typeof date === 'object' && 'toDate' in date) {
    return (date as FirebaseFirestore.Timestamp).toDate().toISOString();
  }
  return String(date);
}
