/**
 * Metric Normalizer - Validate and normalize metrics to spine format
 *
 * Task ID: intentvision-n0l
 */

import type { CanonicalMetric, Dimensions } from '../../../contracts/src/index.js';

// =============================================================================
// Types
// =============================================================================

export interface NormalizeResult {
  success: boolean;
  metric?: CanonicalMetric;
  errors: string[];
  warnings: string[];
}

export interface NormalizeOptions {
  /** Validate metric key format */
  validateMetricKey?: boolean;
  /** Validate timestamp format */
  validateTimestamp?: boolean;
  /** Apply dimension normalization */
  normalizeDimensions?: boolean;
  /** Default dimensions to add */
  defaultDimensions?: Dimensions;
}

// =============================================================================
// Normalizer
// =============================================================================

const METRIC_KEY_PATTERN = /^[a-z][a-z0-9_.]*[a-z0-9]$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/**
 * Normalize a single metric
 */
export function normalizeMetric(
  metric: unknown,
  options: NormalizeOptions = {}
): NormalizeResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Type guard
  if (!metric || typeof metric !== 'object') {
    return { success: false, errors: ['Metric must be an object'], warnings };
  }

  const m = metric as Record<string, unknown>;

  // Required field validation
  if (!m.org_id || typeof m.org_id !== 'string') {
    errors.push('org_id is required and must be a string');
  }

  if (!m.metric_key || typeof m.metric_key !== 'string') {
    errors.push('metric_key is required and must be a string');
  } else if (options.validateMetricKey !== false) {
    // Normalize metric key to lowercase with dots/underscores
    const normalizedKey = normalizeMetricKey(m.metric_key);
    if (!METRIC_KEY_PATTERN.test(normalizedKey)) {
      warnings.push(`metric_key "${m.metric_key}" normalized to "${normalizedKey}"`);
    }
    m.metric_key = normalizedKey;
  }

  if (!m.timestamp || typeof m.timestamp !== 'string') {
    errors.push('timestamp is required and must be a string');
  } else if (options.validateTimestamp !== false) {
    const normalized = normalizeTimestamp(m.timestamp);
    if (!ISO_TIMESTAMP_PATTERN.test(normalized)) {
      errors.push(`Invalid timestamp format: ${m.timestamp}`);
    } else {
      m.timestamp = normalized;
    }
  }

  if (typeof m.value !== 'number' || !isFinite(m.value)) {
    errors.push('value must be a finite number');
  }

  // Normalize dimensions
  if (!m.dimensions || typeof m.dimensions !== 'object') {
    m.dimensions = {};
  }

  if (options.normalizeDimensions !== false) {
    m.dimensions = normalizeDimensions(m.dimensions as Dimensions);
  }

  // Add default dimensions
  if (options.defaultDimensions) {
    m.dimensions = {
      ...options.defaultDimensions,
      ...(m.dimensions as Dimensions),
    };
  }

  // Ensure provenance exists
  if (!m.provenance || typeof m.provenance !== 'object') {
    m.provenance = {
      source_id: 'unknown',
      ingested_at: new Date().toISOString(),
    };
    warnings.push('provenance was missing, created default');
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  return {
    success: true,
    metric: m as unknown as CanonicalMetric,
    errors,
    warnings,
  };
}

/**
 * Normalize a batch of metrics
 */
export function normalizeMetricBatch(
  metrics: unknown[],
  options: NormalizeOptions = {}
): {
  successful: CanonicalMetric[];
  failed: Array<{ index: number; errors: string[] }>;
  warnings: Array<{ index: number; warnings: string[] }>;
} {
  const successful: CanonicalMetric[] = [];
  const failed: Array<{ index: number; errors: string[] }> = [];
  const warnings: Array<{ index: number; warnings: string[] }> = [];

  metrics.forEach((metric, index) => {
    const result = normalizeMetric(metric, options);

    if (result.success && result.metric) {
      successful.push(result.metric);
    } else {
      failed.push({ index, errors: result.errors });
    }

    if (result.warnings.length > 0) {
      warnings.push({ index, warnings: result.warnings });
    }
  });

  return { successful, failed, warnings };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize metric key to canonical format
 */
function normalizeMetricKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Normalize timestamp to ISO 8601 format
 */
function normalizeTimestamp(ts: string): string {
  const date = new Date(ts);
  if (isNaN(date.getTime())) {
    return ts; // Return original if invalid, let validation catch it
  }
  return date.toISOString();
}

/**
 * Normalize dimension keys and values
 */
function normalizeDimensions(dims: Dimensions): Dimensions {
  const normalized: Dimensions = {};

  for (const [key, value] of Object.entries(dims)) {
    // Normalize key to lowercase snake_case
    const normalizedKey = key
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Convert value to string if not already a primitive
    if (typeof value === 'boolean' || typeof value === 'number') {
      normalized[normalizedKey] = value;
    } else if (typeof value === 'string') {
      normalized[normalizedKey] = value.trim();
    } else {
      normalized[normalizedKey] = String(value);
    }
  }

  return normalized;
}
