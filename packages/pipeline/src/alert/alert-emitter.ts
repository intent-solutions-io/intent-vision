/**
 * Alert Emitter - Generate and emit alert artifacts
 *
 * Task ID: intentvision-eol
 */

import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../../../../db/config.js';
import type {
  AlertTrigger,
  AlertRule,
  AlertSeverity,
  AlertTriggerType,
  Anomaly,
  ForecastPoint,
  CanonicalMetric,
} from '../../../contracts/src/index.js';

// =============================================================================
// Types
// =============================================================================

export interface AlertContext {
  metric: CanonicalMetric;
  anomaly?: Anomaly;
  forecast?: ForecastPoint;
  threshold?: { operator: string; value: number };
}

export interface EmitResult {
  success: boolean;
  alertId?: string;
  alert?: AlertTrigger;
  error?: string;
}

// =============================================================================
// Alert Generation
// =============================================================================

/**
 * Generate an alert from an anomaly detection
 */
export function generateAnomalyAlert(
  anomaly: Anomaly,
  metric: CanonicalMetric,
  ruleId: string = 'auto-anomaly'
): AlertTrigger {
  const alertId = `alert-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  return {
    alert_id: alertId,
    rule_id: ruleId,
    org_id: metric.org_id,
    triggered_at: now,
    severity: mapAnomalySeverityToAlert(anomaly.severity),
    status: 'firing',
    trigger_type: 'anomaly',
    title: `Anomaly detected: ${metric.metric_key}`,
    description: anomaly.description,
    metric_context: {
      metric_key: metric.metric_key,
      dimensions: metric.dimensions,
      current_value: anomaly.observed_value,
      recent_values: anomaly.context?.before || [],
    },
    trigger_details: {
      type: 'anomaly',
      anomaly: anomaly,
      detection_method: 'statistical',
    },
    routing: {
      channels: [
        { type: 'webhook', destination: '/api/alerts' },
      ],
      dedup_key: `anomaly-${metric.org_id}-${metric.metric_key}-${anomaly.type}`,
    },
    lifecycle: {
      triggered_at: now,
      notification_count: 0,
    },
  };
}

/**
 * Generate an alert from a forecast prediction
 */
export function generateForecastAlert(
  forecast: ForecastPoint,
  metric: CanonicalMetric,
  threshold: number,
  ruleId: string = 'auto-forecast'
): AlertTrigger {
  const alertId = `alert-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const severity = determineForecastSeverity(forecast.value, threshold);

  return {
    alert_id: alertId,
    rule_id: ruleId,
    org_id: metric.org_id,
    triggered_at: now,
    severity,
    status: 'firing',
    trigger_type: 'forecast',
    title: `Forecast predicts threshold breach: ${metric.metric_key}`,
    description: `Predicted value ${forecast.value.toFixed(2)} will exceed threshold ${threshold}`,
    metric_context: {
      metric_key: metric.metric_key,
      dimensions: metric.dimensions,
      current_value: metric.value,
    },
    trigger_details: {
      type: 'forecast',
      predicted_value: forecast.value,
      prediction_timestamp: forecast.timestamp,
      confidence_interval: forecast.intervals?.['0.95'],
      threshold_will_breach_at: forecast.timestamp,
    },
    routing: {
      channels: [
        { type: 'webhook', destination: '/api/alerts' },
      ],
      dedup_key: `forecast-${metric.org_id}-${metric.metric_key}`,
    },
    lifecycle: {
      triggered_at: now,
      notification_count: 0,
    },
  };
}

/**
 * Generate a threshold-based alert
 */
export function generateThresholdAlert(
  metric: CanonicalMetric,
  threshold: number,
  operator: 'gt' | 'lt' | 'gte' | 'lte',
  ruleId: string = 'auto-threshold'
): AlertTrigger {
  const alertId = `alert-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const operatorText = {
    gt: 'exceeded',
    lt: 'fell below',
    gte: 'reached or exceeded',
    lte: 'reached or fell below',
  }[operator];

  return {
    alert_id: alertId,
    rule_id: ruleId,
    org_id: metric.org_id,
    triggered_at: now,
    severity: 'warning',
    status: 'firing',
    trigger_type: 'threshold',
    title: `Threshold ${operatorText}: ${metric.metric_key}`,
    description: `Value ${metric.value.toFixed(2)} ${operatorText} threshold ${threshold}`,
    metric_context: {
      metric_key: metric.metric_key,
      dimensions: metric.dimensions,
      current_value: metric.value,
    },
    trigger_details: {
      type: 'threshold',
      operator,
      threshold,
      actual_value: metric.value,
    },
    routing: {
      channels: [
        { type: 'webhook', destination: '/api/alerts' },
      ],
      dedup_key: `threshold-${metric.org_id}-${metric.metric_key}-${operator}-${threshold}`,
    },
    lifecycle: {
      triggered_at: now,
      notification_count: 0,
    },
  };
}

// =============================================================================
// Alert Persistence
// =============================================================================

/**
 * Store alert to database
 */
export async function persistAlert(alert: AlertTrigger): Promise<EmitResult> {
  const client = getClient();

  try {
    await client.execute({
      sql: `
        INSERT INTO alerts
        (alert_id, rule_id, org_id, triggered_at, severity, status, trigger_type,
         title, description, metric_context, trigger_details, routing, lifecycle)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        alert.alert_id,
        alert.rule_id,
        alert.org_id,
        alert.triggered_at,
        alert.severity,
        alert.status,
        alert.trigger_type,
        alert.title,
        alert.description,
        JSON.stringify(alert.metric_context),
        JSON.stringify(alert.trigger_details),
        JSON.stringify(alert.routing),
        JSON.stringify(alert.lifecycle),
      ],
    });

    return { success: true, alertId: alert.alert_id, alert };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Emit alert (log and persist)
 */
export async function emitAlert(alert: AlertTrigger): Promise<EmitResult> {
  // Log the alert
  console.log(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.title}`);
  console.log(`        ${alert.description}`);
  console.log(`        Metric: ${alert.metric_context.metric_key}`);
  console.log(`        Value: ${alert.metric_context.current_value}`);

  // Persist to database
  return persistAlert(alert);
}

// =============================================================================
// Helpers
// =============================================================================

function mapAnomalySeverityToAlert(severity: Anomaly['severity']): AlertSeverity {
  const mapping: Record<Anomaly['severity'], AlertSeverity> = {
    low: 'info',
    medium: 'warning',
    high: 'error',
    critical: 'critical',
  };
  return mapping[severity];
}

function determineForecastSeverity(
  predictedValue: number,
  threshold: number
): AlertSeverity {
  const deviation = Math.abs(predictedValue - threshold) / threshold;

  if (deviation > 0.5) return 'critical';
  if (deviation > 0.25) return 'error';
  if (deviation > 0.1) return 'warning';
  return 'info';
}
