/**
 * IntentVision Ingestion Contract
 *
 * Defines the contract for data ingestion pipelines that transform
 * raw source data into CanonicalMetrics.
 *
 * Flow: Raw Source Data → Ingestion → CanonicalMetric[]
 */
import { CanonicalMetric, MetricBatch, OrgId, ISOTimestamp, Dimensions } from './metrics-spine.js';
/**
 * Raw metric data from a source system (before normalization)
 */
export interface RawMetricData {
    /** Raw data payload (structure varies by source) */
    payload: unknown;
    /** Source system identifier */
    source_id: string;
    /** Source-specific metadata */
    source_metadata?: Record<string, unknown>;
    /** When the raw data was received */
    received_at: ISOTimestamp;
}
/**
 * Ingestion request - a batch of raw data to be processed
 */
export interface IngestionRequest {
    /** Organization receiving the data */
    org_id: OrgId;
    /** Array of raw metric data */
    raw_data: RawMetricData[];
    /** Request metadata */
    request_id: string;
    /** Ingestion options */
    options?: IngestionOptions;
}
/**
 * Options for controlling ingestion behavior
 */
export interface IngestionOptions {
    /** Skip deduplication (default: false) */
    skip_dedupe?: boolean;
    /** Skip validation (default: false) */
    skip_validation?: boolean;
    /** Override dimensions to apply to all metrics */
    dimension_overrides?: Dimensions;
    /** Dry run - validate but don't persist (default: false) */
    dry_run?: boolean;
}
/**
 * Result of ingesting a single raw metric
 */
export interface IngestionItemResult {
    /** Whether this item was successfully ingested */
    success: boolean;
    /** The canonical metric (if success) */
    metric?: CanonicalMetric;
    /** Error message (if failure) */
    error?: string;
    /** Original index in the request */
    index: number;
}
/**
 * Ingestion response - result of processing an ingestion request
 */
export interface IngestionResponse {
    /** Request ID (matches request) */
    request_id: string;
    /** Whether the overall request succeeded */
    success: boolean;
    /** Batch of successfully ingested metrics */
    batch?: MetricBatch;
    /** Individual results for each item */
    results: IngestionItemResult[];
    /** Summary statistics */
    stats: IngestionStats;
    /** Processing timestamp */
    processed_at: ISOTimestamp;
}
/**
 * Statistics about the ingestion process
 */
export interface IngestionStats {
    /** Total items received */
    received: number;
    /** Successfully processed */
    processed: number;
    /** Failed items */
    failed: number;
    /** Duplicates skipped */
    deduplicated: number;
    /** Processing duration in milliseconds */
    duration_ms: number;
}
/**
 * Contract for an ingestion handler implementation.
 *
 * Implementations must:
 * 1. Parse raw source data into CanonicalMetrics
 * 2. Validate metrics against the spine spec
 * 3. Handle deduplication
 * 4. Record provenance
 */
export interface IngestionHandler {
    /** Source ID this handler processes */
    readonly sourceId: string;
    /**
     * Process an ingestion request
     */
    ingest(request: IngestionRequest): Promise<IngestionResponse>;
    /**
     * Parse raw data into canonical metrics
     * (Exposed for testing individual transformations)
     */
    parse(raw: RawMetricData, org_id: OrgId): Promise<CanonicalMetric[]>;
    /**
     * Validate a canonical metric
     */
    validate(metric: CanonicalMetric): boolean;
}
/**
 * Supported ingestion source types
 */
export type IngestionSourceType = 'prometheus' | 'datadog' | 'cloudwatch' | 'custom-api' | 'csv-upload' | 'webhook';
/**
 * Source adapter configuration
 */
export interface SourceAdapterConfig {
    /** Source type */
    type: IngestionSourceType;
    /** Source-specific configuration */
    config: Record<string, unknown>;
    /** Default dimensions to add to all metrics from this source */
    default_dimensions?: Dimensions;
    /** Metric key mappings (source name → canonical name) */
    metric_mappings?: Record<string, string>;
}
//# sourceMappingURL=ingestion.d.ts.map