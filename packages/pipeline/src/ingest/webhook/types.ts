/**
 * Webhook Ingestion Types
 *
 * Task ID: intentvision-79x.1
 */

// =============================================================================
// Ingest Request Types
// =============================================================================

/**
 * Single metric data point from external source
 */
export interface IngestMetricPoint {
  /** Metric name/key (e.g., "system.cpu.usage") */
  metric_key: string;
  /** Metric value */
  value: number;
  /** ISO timestamp (optional - defaults to now) */
  timestamp?: string;
  /** Dimension key-value pairs */
  dimensions?: Record<string, string>;
  /** Optional tags for categorization */
  tags?: string[];
}

/**
 * Batch ingestion request
 */
export interface IngestRequest {
  /** Organization ID */
  org_id: string;
  /** Source identifier (e.g., "prometheus-exporter", "datadog-agent") */
  source_id: string;
  /** Batch of metric points */
  metrics: IngestMetricPoint[];
  /** Idempotency key for deduplication */
  idempotency_key?: string;
  /** Request timestamp */
  sent_at?: string;
}

/**
 * Ingestion response
 */
export interface IngestResponse {
  /** Request was accepted */
  success: boolean;
  /** Request ID for tracking */
  request_id: string;
  /** Number of metrics accepted */
  accepted: number;
  /** Number of metrics rejected */
  rejected: number;
  /** Validation errors if any */
  errors?: IngestError[];
  /** Processing duration in ms */
  duration_ms: number;
}

/**
 * Individual metric error
 */
export interface IngestError {
  /** Index in the batch */
  index: number;
  /** Metric key if available */
  metric_key?: string;
  /** Error code */
  code: IngestErrorCode;
  /** Human-readable message */
  message: string;
}

export type IngestErrorCode =
  | 'INVALID_METRIC_KEY'
  | 'INVALID_VALUE'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_DIMENSIONS'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'DUPLICATE_IDEMPOTENCY_KEY'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

// =============================================================================
// Dead Letter Types
// =============================================================================

/**
 * Dead letter entry for failed ingestion
 */
export interface DeadLetterEntry {
  /** Unique ID */
  id: string;
  /** Original request */
  request: IngestRequest;
  /** Failure reason */
  error: IngestError;
  /** When it failed */
  failed_at: string;
  /** Retry count */
  retry_count: number;
  /** Next retry time (null if exhausted) */
  next_retry_at: string | null;
  /** Status */
  status: 'pending' | 'retrying' | 'exhausted' | 'resolved';
}

// =============================================================================
// Idempotency Types
// =============================================================================

/**
 * Idempotency record for deduplication
 */
export interface IdempotencyRecord {
  /** The idempotency key */
  key: string;
  /** Request ID that processed this key */
  request_id: string;
  /** When this key was first seen */
  created_at: string;
  /** When this key expires */
  expires_at: string;
  /** Result of the original request */
  response: IngestResponse;
}

// =============================================================================
// Replay/Backfill Types
// =============================================================================

/**
 * Backfill request for historical data
 */
export interface BackfillRequest {
  /** Organization ID */
  org_id: string;
  /** Source identifier */
  source_id: string;
  /** Start time for backfill */
  start_time: string;
  /** End time for backfill */
  end_time: string;
  /** Metric keys to backfill (empty = all) */
  metric_keys?: string[];
  /** Strategy for handling existing data */
  conflict_strategy: 'skip' | 'overwrite' | 'error';
}

/**
 * Backfill status
 */
export interface BackfillStatus {
  /** Backfill job ID */
  job_id: string;
  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Progress percentage */
  progress: number;
  /** Metrics processed */
  processed: number;
  /** Metrics skipped (conflicts) */
  skipped: number;
  /** Start time */
  started_at: string;
  /** End time (if completed) */
  completed_at?: string;
  /** Error message (if failed) */
  error?: string;
}
