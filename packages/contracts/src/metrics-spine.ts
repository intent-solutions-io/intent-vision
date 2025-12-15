/**
 * IntentVision Metrics Spine Specification
 *
 * The canonical metrics spine is the core data model that all components
 * of IntentVision use to represent time-series metrics.
 *
 * @see 000-docs/008-AT-SPEC-metrics-spine.md for full specification
 */

// =============================================================================
// Core Types
// =============================================================================

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

// =============================================================================
// Provenance - Where did this metric come from?
// =============================================================================

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

// =============================================================================
// Canonical Metric Record - The Core Data Structure
// =============================================================================

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

// =============================================================================
// Metric Batch - For Bulk Operations
// =============================================================================

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

// =============================================================================
// Time Series - Ordered sequence of metrics
// =============================================================================

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

// =============================================================================
// Validation
// =============================================================================

/**
 * Validates a CanonicalMetric
 * @throws Error if validation fails
 */
export function validateCanonicalMetric(metric: unknown): metric is CanonicalMetric {
  if (!metric || typeof metric !== 'object') {
    throw new Error('Metric must be an object');
  }

  const m = metric as Record<string, unknown>;

  // Required fields
  if (typeof m.org_id !== 'string' || !m.org_id) {
    throw new Error('org_id is required and must be a non-empty string');
  }

  if (typeof m.metric_key !== 'string' || !m.metric_key) {
    throw new Error('metric_key is required and must be a non-empty string');
  }

  if (typeof m.timestamp !== 'string' || !isValidISOTimestamp(m.timestamp)) {
    throw new Error('timestamp must be a valid ISO 8601 string');
  }

  if (typeof m.value !== 'number' || !isFinite(m.value)) {
    throw new Error('value must be a finite number');
  }

  if (!m.dimensions || typeof m.dimensions !== 'object') {
    throw new Error('dimensions must be an object');
  }

  if (!m.provenance || typeof m.provenance !== 'object') {
    throw new Error('provenance must be an object');
  }

  const p = m.provenance as Record<string, unknown>;
  if (typeof p.source_id !== 'string' || !p.source_id) {
    throw new Error('provenance.source_id is required');
  }

  if (typeof p.ingested_at !== 'string' || !isValidISOTimestamp(p.ingested_at)) {
    throw new Error('provenance.ingested_at must be a valid ISO 8601 string');
  }

  return true;
}

/**
 * Checks if a string is a valid ISO 8601 timestamp
 */
function isValidISOTimestamp(s: string): boolean {
  const date = new Date(s);
  return !isNaN(date.getTime()) && s.includes('T');
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a CanonicalMetric with defaults
 */
export function createCanonicalMetric(
  org_id: OrgId,
  metric_key: MetricKey,
  value: MetricValue,
  timestamp: ISOTimestamp,
  dimensions: Dimensions = {},
  source_id: string = 'unknown'
): CanonicalMetric {
  const now = new Date().toISOString();

  return {
    org_id,
    metric_key,
    timestamp,
    value,
    dimensions,
    provenance: {
      source_id,
      ingested_at: now,
    },
  };
}
