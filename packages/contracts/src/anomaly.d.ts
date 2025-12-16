/**
 * IntentVision Anomaly Detection Contract
 *
 * Defines the interface for anomaly detection on time series metrics.
 * Anomaly detection identifies unusual patterns that may indicate issues
 * or opportunities.
 */
import { TimeSeries, OrgId, ISOTimestamp } from './metrics-spine.js';
/**
 * Request for anomaly detection
 */
export interface AnomalyDetectionRequest {
    /** Request identifier */
    request_id: string;
    /** Organization */
    org_id: OrgId;
    /** Time series to analyze */
    series: TimeSeries;
    /** Detection options */
    options?: AnomalyDetectionOptions;
}
/**
 * Options for anomaly detection
 */
export interface AnomalyDetectionOptions {
    /** Sensitivity (0-1, higher = more sensitive, more anomalies) */
    sensitivity?: number;
    /** Detection method */
    method?: AnomalyDetectionMethod;
    /** Minimum anomaly score threshold (0-1) */
    threshold?: number;
    /** Include context around anomalies */
    include_context?: boolean;
    /** Context window size (data points before/after anomaly) */
    context_window?: number;
}
/**
 * Anomaly detection methods
 */
export type AnomalyDetectionMethod = 'statistical' | 'forecast' | 'isolation' | 'cluster' | 'ensemble';
/**
 * Anomaly detection response
 */
export interface AnomalyDetectionResponse {
    /** Request ID (matches request) */
    request_id: string;
    /** Whether detection succeeded */
    success: boolean;
    /** Error message (if failure) */
    error?: string;
    /** Detected anomalies */
    anomalies: Anomaly[];
    /** Detection metadata */
    metadata: AnomalyDetectionMetadata;
}
/**
 * A detected anomaly
 */
export interface Anomaly {
    /** Unique identifier for this anomaly */
    anomaly_id: string;
    /** Timestamp of the anomaly */
    timestamp: ISOTimestamp;
    /** Observed value */
    observed_value: number;
    /** Expected value (baseline) */
    expected_value: number;
    /** Anomaly score (0-1, higher = more anomalous) */
    score: number;
    /** Type of anomaly */
    type: AnomalyType;
    /** Severity level */
    severity: AnomalySeverity;
    /** Human-readable description */
    description: string;
    /** Context around the anomaly (if requested) */
    context?: AnomalyContext;
}
/**
 * Types of anomalies
 */
export type AnomalyType = 'point' | 'contextual' | 'collective' | 'trend_change' | 'level_shift' | 'seasonality';
/**
 * Anomaly severity levels
 */
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
/**
 * Context around an anomaly
 */
export interface AnomalyContext {
    /** Data points before the anomaly */
    before: Array<{
        timestamp: ISOTimestamp;
        value: number;
    }>;
    /** Data points after the anomaly */
    after: Array<{
        timestamp: ISOTimestamp;
        value: number;
    }>;
    /** Statistical context */
    statistics: {
        /** Mean of the context window */
        mean: number;
        /** Standard deviation of context */
        std_dev: number;
        /** Min value in context */
        min: number;
        /** Max value in context */
        max: number;
    };
}
/**
 * Anomaly detection metadata
 */
export interface AnomalyDetectionMetadata {
    /** When detection was performed */
    detected_at: ISOTimestamp;
    /** Processing duration in milliseconds */
    duration_ms: number;
    /** Number of input data points */
    input_points: number;
    /** Number of anomalies detected */
    anomaly_count: number;
    /** Method used */
    method: AnomalyDetectionMethod;
    /** Sensitivity used */
    sensitivity: number;
}
/**
 * Contract for an anomaly detector implementation
 */
export interface AnomalyDetector {
    /** Detector method type */
    readonly method: AnomalyDetectionMethod;
    /**
     * Detect anomalies in a time series
     */
    detect(request: AnomalyDetectionRequest): Promise<AnomalyDetectionResponse>;
    /**
     * Check if detector is available/healthy
     */
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=anomaly.d.ts.map