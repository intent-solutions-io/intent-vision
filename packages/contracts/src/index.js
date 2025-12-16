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
// Functions
export { validateCanonicalMetric, createCanonicalMetric } from './metrics-spine.js';
//# sourceMappingURL=index.js.map