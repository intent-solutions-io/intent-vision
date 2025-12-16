/**
 * IntentVision Metrics Spine Specification
 *
 * The canonical metrics spine is the core data model that all components
 * of IntentVision use to represent time-series metrics.
 *
 * @see 000-docs/008-AT-SPEC-metrics-spine.md for full specification
 */
/**
 * ISO 8601 timestamp string (e.g., "2025-12-15T14:30:00.000Z")
 */
export type ISOTimestamp = string;
/**
 * Metric value - always numeric for time series
 */
export type MetricValue = number;
/**
 * Unique identifier for an organization (tenant)
 */
export type OrgId = string;
/**
 * Unique identifier for a metric type (e.g., "cpu_usage", "revenue")
 */
export type MetricKey = string;
/**
 * Arbitrary key-value dimensions for slicing/filtering
 */
export type Dimensions = Record<string, string | number | boolean>;
/**
 * Provenance tracks the origin and processing history of a metric
 */
export interface Provenance {
    /** Source system identifier (e.g., "prometheus", "datadog", "custom-api") */
    source_id: string;
    /** Original identifier in source system */
    source_ref?: string;
    /** When the metric was ingested into IntentVision */
    ingested_at: ISOTimestamp;
    /** Pipeline version that processed this metric */
    pipeline_version?: string;
    /** Transformation chain applied (e.g., ["normalize", "dedupe"]) */
    transformations?: string[];
}
/**
 * CanonicalMetric is the standardized representation of a single metric
 * data point in IntentVision.
 *
 * This is the "spine" that all data flows through:
 * - Ingestion outputs CanonicalMetrics
 * - Forecast consumes CanonicalMetrics
 * - Anomaly detection consumes CanonicalMetrics
 * - Alerts are triggered by CanonicalMetrics
 */
export interface CanonicalMetric {
    /**
     * Organization/tenant identifier
     * Required for multi-tenant isolation
     */
    org_id: OrgId;
    /**
     * Metric type identifier
     * Naming convention: snake_case, hierarchical (e.g., "system.cpu.usage")
     */
    metric_key: MetricKey;
    /**
     * Timestamp of the metric observation
     * Must be ISO 8601 format in UTC
     */
    timestamp: ISOTimestamp;
    /**
     * The metric value
     * Always numeric (gauges, counters, histograms summarized as single value)
     */
    value: MetricValue;
    /**
     * Dimensional metadata for slicing/filtering
     * Examples: { region: "us-west-2", service: "api", environment: "prod" }
     */
    dimensions: Dimensions;
    /**
     * Provenance - origin and processing history
     */
    provenance: Provenance;
}
/**
 * MetricBatch is used for bulk ingestion and processing
 */
export interface MetricBatch {
    /** Batch identifier for tracking */
    batch_id: string;
    /** Organization for all metrics in batch (must be same org) */
    org_id: OrgId;
    /** Array of metrics */
    metrics: CanonicalMetric[];
    /** Batch metadata */
    metadata: {
        /** When the batch was created */
        created_at: ISOTimestamp;
        /** Source of the batch */
        source: string;
        /** Count of metrics (for validation) */
        count: number;
    };
}
/**
 * TimeSeries represents an ordered sequence of metrics for a single
 * metric_key + dimensions combination
 */
export interface TimeSeries {
    /** Organization */
    org_id: OrgId;
    /** Metric type */
    metric_key: MetricKey;
    /** Dimensions that identify this series */
    dimensions: Dimensions;
    /** Ordered data points (ascending by timestamp) */
    data_points: Array<{
        timestamp: ISOTimestamp;
        value: MetricValue;
    }>;
    /** Series metadata */
    metadata: {
        /** Earliest timestamp in series */
        start_time: ISOTimestamp;
        /** Latest timestamp in series */
        end_time: ISOTimestamp;
        /** Number of data points */
        count: number;
        /** Detected resolution (e.g., "1m", "5m", "1h") */
        resolution?: string;
    };
}
/**
 * Validates a CanonicalMetric
 * @throws Error if validation fails
 */
export declare function validateCanonicalMetric(metric: unknown): metric is CanonicalMetric;
/**
 * Creates a CanonicalMetric with defaults
 */
export declare function createCanonicalMetric(org_id: OrgId, metric_key: MetricKey, value: MetricValue, timestamp: ISOTimestamp, dimensions?: Dimensions, source_id?: string): CanonicalMetric;
//# sourceMappingURL=metrics-spine.d.ts.map