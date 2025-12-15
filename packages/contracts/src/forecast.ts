/**
 * IntentVision Forecast Contract
 *
 * Defines the pluggable interface for forecast backends.
 * The forecast backend is intentionally pluggable to support:
 * - Nixtla (TimeGPT, StatsForecast)
 * - Vertex AI
 * - Classical models (Prophet, ARIMA)
 * - Custom models
 *
 * Critical design constraint: forecast backend is pluggable
 */

import {
  TimeSeries,
  CanonicalMetric,
  OrgId,
  MetricKey,
  ISOTimestamp,
  Dimensions,
} from './metrics-spine.js';

// =============================================================================
// Forecast Request
// =============================================================================

/**
 * Request for a forecast
 */
export interface ForecastRequest {
  /** Request identifier */
  request_id: string;

  /** Organization */
  org_id: OrgId;

  /** Time series to forecast */
  series: TimeSeries;

  /** Forecast horizon (number of periods) */
  horizon: number;

  /** Frequency/resolution (e.g., "1h", "1d") */
  frequency: string;

  /** Forecast options */
  options?: ForecastOptions;
}

/**
 * Options for forecast generation
 */
export interface ForecastOptions {
  /** Confidence levels for prediction intervals (e.g., [0.80, 0.95]) */
  confidence_levels?: number[];

  /** Include historical fit in response */
  include_history?: boolean;

  /** Model-specific parameters */
  model_params?: Record<string, unknown>;

  /** Preferred backend (if not specified, uses default) */
  backend?: ForecastBackendType;

  /** Seasonality hints */
  seasonality?: SeasonalityHint[];
}

/**
 * Seasonality hint for models that support it
 */
export interface SeasonalityHint {
  /** Period name */
  name: string;

  /** Period length in observations */
  period: number;
}

// =============================================================================
// Forecast Response
// =============================================================================

/**
 * Forecast response
 */
export interface ForecastResponse {
  /** Request ID (matches request) */
  request_id: string;

  /** Whether forecast succeeded */
  success: boolean;

  /** Error message (if failure) */
  error?: string;

  /** Forecast result */
  forecast?: ForecastResult;

  /** Backend that generated the forecast */
  backend: ForecastBackendType;

  /** Processing metadata */
  metadata: ForecastMetadata;
}

/**
 * Forecast result with predictions and intervals
 */
export interface ForecastResult {
  /** Point predictions */
  predictions: ForecastPoint[];

  /** Historical fit (if requested) */
  history_fit?: ForecastPoint[];

  /** Model information */
  model_info?: ModelInfo;
}

/**
 * A single forecast point
 */
export interface ForecastPoint {
  /** Timestamp of the prediction */
  timestamp: ISOTimestamp;

  /** Point prediction (mean/expected value) */
  value: number;

  /** Prediction intervals keyed by confidence level */
  intervals?: Record<string, PredictionInterval>;
}

/**
 * Prediction interval (lower/upper bounds)
 */
export interface PredictionInterval {
  /** Lower bound */
  lower: number;

  /** Upper bound */
  upper: number;

  /** Confidence level (e.g., 0.95 for 95%) */
  confidence: number;
}

/**
 * Information about the model used
 */
export interface ModelInfo {
  /** Model name/type */
  name: string;

  /** Model version */
  version?: string;

  /** Training metrics */
  training_metrics?: Record<string, number>;
}

/**
 * Forecast processing metadata
 */
export interface ForecastMetadata {
  /** When forecast was generated */
  generated_at: ISOTimestamp;

  /** Processing duration in milliseconds */
  duration_ms: number;

  /** Number of input data points */
  input_points: number;

  /** Number of forecast points */
  output_points: number;
}

// =============================================================================
// Pluggable Backend Interface
// =============================================================================

/**
 * Supported forecast backend types
 */
export type ForecastBackendType =
  | 'nixtla-timegpt'
  | 'nixtla-statsforecast'
  | 'vertex-ai'
  | 'prophet'
  | 'arima'
  | 'custom';

/**
 * Contract for a forecast backend implementation.
 *
 * Implementations must:
 * 1. Accept a ForecastRequest
 * 2. Return a ForecastResponse
 * 3. Handle errors gracefully
 * 4. Be stateless (no side effects)
 */
export interface ForecastBackend {
  /** Backend type identifier */
  readonly type: ForecastBackendType;

  /** Human-readable name */
  readonly name: string;

  /**
   * Generate a forecast
   */
  forecast(request: ForecastRequest): Promise<ForecastResponse>;

  /**
   * Check if backend is available/healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get backend capabilities
   */
  capabilities(): ForecastCapabilities;
}

/**
 * Capabilities of a forecast backend
 */
export interface ForecastCapabilities {
  /** Maximum horizon supported */
  max_horizon: number;

  /** Supported frequencies */
  supported_frequencies: string[];

  /** Whether prediction intervals are supported */
  supports_intervals: boolean;

  /** Whether multiple series can be forecast at once */
  supports_batch: boolean;

  /** Whether exogenous variables are supported */
  supports_exogenous: boolean;
}

// =============================================================================
// Backend Registry
// =============================================================================

/**
 * Configuration for a forecast backend
 */
export interface ForecastBackendConfig {
  /** Backend type */
  type: ForecastBackendType;

  /** Whether this is the default backend */
  is_default?: boolean;

  /** Backend-specific configuration */
  config: Record<string, unknown>;
}
