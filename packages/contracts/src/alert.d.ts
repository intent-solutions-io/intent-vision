/**
 * IntentVision Alert Contract
 *
 * Defines the format for alert triggers and the alerting pipeline.
 * Alerts are generated when metrics, forecasts, or anomalies meet
 * defined conditions.
 */
import { OrgId, MetricKey, ISOTimestamp, Dimensions } from './metrics-spine.js';
import { Anomaly, AnomalySeverity } from './anomaly.js';
/**
 * AlertTrigger is the canonical format for an alert event.
 * This is what gets routed to notification channels.
 */
export interface AlertTrigger {
    /** Unique identifier for this alert instance */
    alert_id: string;
    /** Alert rule that triggered this alert */
    rule_id: string;
    /** Organization */
    org_id: OrgId;
    /** When the alert was triggered */
    triggered_at: ISOTimestamp;
    /** Alert severity */
    severity: AlertSeverity;
    /** Alert status */
    status: AlertStatus;
    /** Type of condition that triggered the alert */
    trigger_type: AlertTriggerType;
    /** Human-readable title */
    title: string;
    /** Detailed description */
    description: string;
    /** The metric(s) involved */
    metric_context: AlertMetricContext;
    /** Trigger details (varies by trigger type) */
    trigger_details: AlertTriggerDetails;
    /** Notification routing */
    routing: AlertRouting;
    /** Alert lifecycle timestamps */
    lifecycle: AlertLifecycle;
}
/**
 * Alert severity levels (aligned with anomaly severity)
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
/**
 * Alert status
 */
export type AlertStatus = 'firing' | 'pending' | 'resolved' | 'acknowledged' | 'suppressed';
/**
 * What triggered the alert
 */
export type AlertTriggerType = 'threshold' | 'anomaly' | 'forecast' | 'rate_of_change' | 'missing_data' | 'composite';
/**
 * Context about the metric(s) that triggered the alert
 */
export interface AlertMetricContext {
    /** Primary metric key */
    metric_key: MetricKey;
    /** Dimensions of the metric */
    dimensions: Dimensions;
    /** Current/triggering value */
    current_value: number;
    /** Recent values (for context) */
    recent_values?: Array<{
        timestamp: ISOTimestamp;
        value: number;
    }>;
    /** Related metrics (for composite alerts) */
    related_metrics?: Array<{
        metric_key: MetricKey;
        dimensions: Dimensions;
        value: number;
    }>;
}
/**
 * Details about what triggered the alert (varies by type)
 */
export type AlertTriggerDetails = ThresholdTriggerDetails | AnomalyTriggerDetails | ForecastTriggerDetails | RateOfChangeTriggerDetails | MissingDataTriggerDetails | CompositeTriggerDetails;
/**
 * Threshold-based trigger details
 */
export interface ThresholdTriggerDetails {
    type: 'threshold';
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
    threshold: number;
    actual_value: number;
    duration_over_threshold_ms?: number;
}
/**
 * Anomaly-based trigger details
 */
export interface AnomalyTriggerDetails {
    type: 'anomaly';
    anomaly: Anomaly;
    detection_method: string;
}
/**
 * Forecast-based trigger details
 */
export interface ForecastTriggerDetails {
    type: 'forecast';
    predicted_value: number;
    prediction_timestamp: ISOTimestamp;
    confidence_interval?: {
        lower: number;
        upper: number;
    };
    threshold_will_breach_at?: ISOTimestamp;
}
/**
 * Rate of change trigger details
 */
export interface RateOfChangeTriggerDetails {
    type: 'rate_of_change';
    rate: number;
    rate_unit: string;
    max_allowed_rate: number;
    window_ms: number;
}
/**
 * Missing data trigger details
 */
export interface MissingDataTriggerDetails {
    type: 'missing_data';
    expected_interval_ms: number;
    last_seen_at?: ISOTimestamp;
    missing_duration_ms: number;
}
/**
 * Composite (multiple conditions) trigger details
 */
export interface CompositeTriggerDetails {
    type: 'composite';
    conditions: Array<{
        condition_id: string;
        description: string;
        met: boolean;
    }>;
    operator: 'all' | 'any' | 'count';
    threshold_count?: number;
}
/**
 * How the alert should be routed
 */
export interface AlertRouting {
    /** Notification channels */
    channels: AlertChannel[];
    /** Escalation policy (if any) */
    escalation_policy?: string;
    /** Suppression rules that may apply */
    suppression_rules?: string[];
    /** Deduplication key (for grouping) */
    dedup_key?: string;
}
/**
 * Notification channel
 */
export interface AlertChannel {
    /** Channel type */
    type: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms';
    /** Channel identifier/destination */
    destination: string;
    /** Channel-specific config */
    config?: Record<string, unknown>;
}
/**
 * Alert lifecycle timestamps
 */
export interface AlertLifecycle {
    /** When alert was first triggered */
    triggered_at: ISOTimestamp;
    /** When alert was acknowledged (if applicable) */
    acknowledged_at?: ISOTimestamp;
    /** Who acknowledged */
    acknowledged_by?: string;
    /** When alert was resolved (if applicable) */
    resolved_at?: ISOTimestamp;
    /** How it was resolved */
    resolution_type?: 'auto' | 'manual';
    /** Last notification sent */
    last_notified_at?: ISOTimestamp;
    /** Notification count */
    notification_count: number;
}
/**
 * Configuration for an alert rule
 */
export interface AlertRule {
    /** Rule identifier */
    rule_id: string;
    /** Organization */
    org_id: OrgId;
    /** Rule name */
    name: string;
    /** Rule description */
    description: string;
    /** Whether rule is enabled */
    enabled: boolean;
    /** Metric to monitor */
    metric_key: MetricKey;
    /** Dimension filters */
    dimension_filters?: Dimensions;
    /** Trigger condition */
    condition: AlertCondition;
    /** Severity to assign */
    severity: AlertSeverity;
    /** Routing configuration */
    routing: AlertRouting;
    /** Suppression configuration */
    suppression?: AlertSuppression;
}
/**
 * Alert condition (what triggers the alert)
 */
export type AlertCondition = {
    type: 'threshold';
    operator: string;
    value: number;
    duration_ms?: number;
} | {
    type: 'anomaly';
    min_severity: AnomalySeverity;
} | {
    type: 'forecast';
    horizon_hours: number;
    threshold: number;
} | {
    type: 'rate_of_change';
    max_rate: number;
    rate_unit: string;
} | {
    type: 'missing_data';
    expected_interval_ms: number;
};
/**
 * Alert suppression configuration
 */
export interface AlertSuppression {
    /** Suppress duplicate alerts for this duration */
    dedup_window_ms?: number;
    /** Time windows when alerts are suppressed */
    mute_windows?: Array<{
        start: string;
        end: string;
        days?: number[];
    }>;
    /** Suppress if these conditions are met */
    suppress_if?: AlertCondition[];
}
//# sourceMappingURL=alert.d.ts.map