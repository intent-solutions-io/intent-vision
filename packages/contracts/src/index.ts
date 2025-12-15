/**
 * IntentVision Contracts
 *
 * This package exports all canonical data contracts for the IntentVision
 * prediction engine. These contracts define the interfaces between components:
 *
 * - Metrics Spine: Core data model for time-series metrics
 * - Ingestion: Raw data → CanonicalMetric transformation
 * - Forecast: Pluggable forecast backend interface
 * - Anomaly: Anomaly detection interface
 * - Alert: Alert trigger and routing
 */

// =============================================================================
// Metrics Spine - Core Data Model
// =============================================================================

// Types
export type {
  ISOTimestamp,
  MetricValue,
  OrgId,
  MetricKey,
  Dimensions,
  Provenance,
  CanonicalMetric,
  MetricBatch,
  TimeSeries,
} from './metrics-spine.js';

// Functions
export { validateCanonicalMetric, createCanonicalMetric } from './metrics-spine.js';

// =============================================================================
// Ingestion - Data Intake Pipeline
// =============================================================================

export type {
  RawMetricData,
  IngestionRequest,
  IngestionOptions,
  IngestionItemResult,
  IngestionResponse,
  IngestionStats,
  IngestionHandler,
  IngestionSourceType,
  SourceAdapterConfig,
} from './ingestion.js';

// =============================================================================
// Forecast - Pluggable Prediction Backend
// =============================================================================

export type {
  ForecastRequest,
  ForecastOptions,
  SeasonalityHint,
  ForecastResponse,
  ForecastResult,
  ForecastPoint,
  PredictionInterval,
  ModelInfo,
  ForecastMetadata,
  ForecastBackendType,
  ForecastBackend,
  ForecastCapabilities,
  ForecastBackendConfig,
} from './forecast.js';

// =============================================================================
// Anomaly Detection
// =============================================================================

export type {
  AnomalyDetectionRequest,
  AnomalyDetectionOptions,
  AnomalyDetectionMethod,
  AnomalyDetectionResponse,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyContext,
  AnomalyDetectionMetadata,
  AnomalyDetector,
} from './anomaly.js';

// =============================================================================
// Alerts
// =============================================================================

export type {
  AlertTrigger,
  AlertSeverity,
  AlertStatus,
  AlertTriggerType,
  AlertMetricContext,
  AlertTriggerDetails,
  ThresholdTriggerDetails,
  AnomalyTriggerDetails,
  ForecastTriggerDetails,
  RateOfChangeTriggerDetails,
  MissingDataTriggerDetails,
  CompositeTriggerDetails,
  AlertRouting,
  AlertChannel,
  AlertLifecycle,
  AlertRule,
  AlertCondition,
  AlertSuppression,
} from './alert.js';
