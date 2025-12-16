/**
 * IntentVision Metrics Spine Specification
 *
 * The canonical metrics spine is the core data model that all components
 * of IntentVision use to represent time-series metrics.
 *
 * @see 000-docs/008-AT-SPEC-metrics-spine.md for full specification
 */
// =============================================================================
// Validation
// =============================================================================
/**
 * Validates a CanonicalMetric
 * @throws Error if validation fails
 */
export function validateCanonicalMetric(metric) {
    if (!metric || typeof metric !== 'object') {
        throw new Error('Metric must be an object');
    }
    const m = metric;
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
    const p = m.provenance;
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
function isValidISOTimestamp(s) {
    const date = new Date(s);
    return !isNaN(date.getTime()) && s.includes('T');
}
// =============================================================================
// Factory Functions
// =============================================================================
/**
 * Creates a CanonicalMetric with defaults
 */
export function createCanonicalMetric(org_id, metric_key, value, timestamp, dimensions = {}, source_id = 'unknown') {
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
//# sourceMappingURL=metrics-spine.js.map