/**
 * Schema Validation at Ingest Boundary
 *
 * Task ID: intentvision-79x.3
 *
 * Validates incoming webhook payloads before processing.
 * Rejects invalid data early to prevent downstream issues.
 */

import type {
  IngestRequest,
  IngestMetricPoint,
  IngestError,
  IngestErrorCode,
} from './types.js';

// =============================================================================
// Validation Configuration
// =============================================================================

export interface ValidationConfig {
  /** Maximum batch size */
  maxBatchSize: number;
  /** Maximum metric key length */
  maxMetricKeyLength: number;
  /** Maximum number of dimensions */
  maxDimensions: number;
  /** Maximum dimension key length */
  maxDimensionKeyLength: number;
  /** Maximum dimension value length */
  maxDimensionValueLength: number;
  /** Maximum timestamp age (ms) - reject old data */
  maxTimestampAge: number;
  /** Maximum future timestamp (ms) - reject future data */
  maxFutureTimestamp: number;
  /** Allowed metric key pattern */
  metricKeyPattern: RegExp;
}

const DEFAULT_CONFIG: ValidationConfig = {
  maxBatchSize: 1000,
  maxMetricKeyLength: 256,
  maxDimensions: 20,
  maxDimensionKeyLength: 64,
  maxDimensionValueLength: 256,
  maxTimestampAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxFutureTimestamp: 5 * 60 * 1000, // 5 minutes
  metricKeyPattern: /^[a-zA-Z][a-zA-Z0-9._-]*$/,
};

// =============================================================================
// Validation Results
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: IngestError[];
  validMetrics: IngestMetricPoint[];
  invalidMetrics: Array<{ index: number; metric: IngestMetricPoint; error: IngestError }>;
}

// =============================================================================
// Validators
// =============================================================================

/**
 * Validate entire ingest request
 */
export function validateIngestRequest(
  request: unknown,
  config: ValidationConfig = DEFAULT_CONFIG
): ValidationResult {
  const errors: IngestError[] = [];
  const validMetrics: IngestMetricPoint[] = [];
  const invalidMetrics: Array<{ index: number; metric: IngestMetricPoint; error: IngestError }> = [];

  // Type guard
  if (!isIngestRequest(request)) {
    errors.push({
      index: -1,
      code: 'SCHEMA_VALIDATION_FAILED',
      message: 'Invalid request structure: missing required fields (org_id, source_id, metrics)',
    });
    return { valid: false, errors, validMetrics, invalidMetrics };
  }

  // Validate org_id
  if (!request.org_id || typeof request.org_id !== 'string' || request.org_id.trim() === '') {
    errors.push({
      index: -1,
      code: 'SCHEMA_VALIDATION_FAILED',
      message: 'org_id is required and must be a non-empty string',
    });
  }

  // Validate source_id
  if (!request.source_id || typeof request.source_id !== 'string' || request.source_id.trim() === '') {
    errors.push({
      index: -1,
      code: 'SCHEMA_VALIDATION_FAILED',
      message: 'source_id is required and must be a non-empty string',
    });
  }

  // Validate metrics array
  if (!Array.isArray(request.metrics)) {
    errors.push({
      index: -1,
      code: 'SCHEMA_VALIDATION_FAILED',
      message: 'metrics must be an array',
    });
    return { valid: false, errors, validMetrics, invalidMetrics };
  }

  // Check batch size
  if (request.metrics.length > config.maxBatchSize) {
    errors.push({
      index: -1,
      code: 'SCHEMA_VALIDATION_FAILED',
      message: `Batch size ${request.metrics.length} exceeds maximum ${config.maxBatchSize}`,
    });
    return { valid: false, errors, validMetrics, invalidMetrics };
  }

  // Validate each metric
  const now = Date.now();
  request.metrics.forEach((metric, index) => {
    const metricError = validateMetricPoint(metric, index, config, now);
    if (metricError) {
      invalidMetrics.push({ index, metric, error: metricError });
    } else {
      validMetrics.push(metric);
    }
  });

  return {
    valid: errors.length === 0 && invalidMetrics.length === 0,
    errors: [...errors, ...invalidMetrics.map((m) => m.error)],
    validMetrics,
    invalidMetrics,
  };
}

/**
 * Validate single metric point
 */
function validateMetricPoint(
  metric: IngestMetricPoint,
  index: number,
  config: ValidationConfig,
  now: number
): IngestError | null {
  // Validate metric_key
  if (!metric.metric_key || typeof metric.metric_key !== 'string') {
    return {
      index,
      metric_key: metric.metric_key,
      code: 'INVALID_METRIC_KEY',
      message: 'metric_key is required and must be a string',
    };
  }

  if (metric.metric_key.length > config.maxMetricKeyLength) {
    return {
      index,
      metric_key: metric.metric_key,
      code: 'INVALID_METRIC_KEY',
      message: `metric_key length ${metric.metric_key.length} exceeds maximum ${config.maxMetricKeyLength}`,
    };
  }

  if (!config.metricKeyPattern.test(metric.metric_key)) {
    return {
      index,
      metric_key: metric.metric_key,
      code: 'INVALID_METRIC_KEY',
      message: `metric_key "${metric.metric_key}" does not match required pattern (alphanumeric, dots, dashes, underscores, must start with letter)`,
    };
  }

  // Validate value
  if (typeof metric.value !== 'number' || !isFinite(metric.value)) {
    return {
      index,
      metric_key: metric.metric_key,
      code: 'INVALID_VALUE',
      message: `value must be a finite number, got ${typeof metric.value}`,
    };
  }

  // Validate timestamp if present
  if (metric.timestamp !== undefined) {
    const ts = new Date(metric.timestamp).getTime();
    if (isNaN(ts)) {
      return {
        index,
        metric_key: metric.metric_key,
        code: 'INVALID_TIMESTAMP',
        message: `Invalid timestamp format: ${metric.timestamp}`,
      };
    }

    const age = now - ts;
    if (age > config.maxTimestampAge) {
      return {
        index,
        metric_key: metric.metric_key,
        code: 'INVALID_TIMESTAMP',
        message: `Timestamp is too old (${Math.floor(age / 1000 / 60 / 60)} hours ago)`,
      };
    }

    if (age < -config.maxFutureTimestamp) {
      return {
        index,
        metric_key: metric.metric_key,
        code: 'INVALID_TIMESTAMP',
        message: `Timestamp is in the future (${Math.floor(-age / 1000 / 60)} minutes ahead)`,
      };
    }
  }

  // Validate dimensions if present
  if (metric.dimensions !== undefined) {
    if (typeof metric.dimensions !== 'object' || metric.dimensions === null) {
      return {
        index,
        metric_key: metric.metric_key,
        code: 'INVALID_DIMENSIONS',
        message: 'dimensions must be an object',
      };
    }

    const dimKeys = Object.keys(metric.dimensions);
    if (dimKeys.length > config.maxDimensions) {
      return {
        index,
        metric_key: metric.metric_key,
        code: 'INVALID_DIMENSIONS',
        message: `Too many dimensions (${dimKeys.length} > ${config.maxDimensions})`,
      };
    }

    for (const key of dimKeys) {
      if (key.length > config.maxDimensionKeyLength) {
        return {
          index,
          metric_key: metric.metric_key,
          code: 'INVALID_DIMENSIONS',
          message: `Dimension key "${key}" exceeds max length ${config.maxDimensionKeyLength}`,
        };
      }

      const value = metric.dimensions[key];
      if (typeof value !== 'string') {
        return {
          index,
          metric_key: metric.metric_key,
          code: 'INVALID_DIMENSIONS',
          message: `Dimension value for "${key}" must be a string`,
        };
      }

      if (value.length > config.maxDimensionValueLength) {
        return {
          index,
          metric_key: metric.metric_key,
          code: 'INVALID_DIMENSIONS',
          message: `Dimension value for "${key}" exceeds max length ${config.maxDimensionValueLength}`,
        };
      }
    }
  }

  return null;
}

/**
 * Type guard for IngestRequest
 */
function isIngestRequest(obj: unknown): obj is IngestRequest {
  if (typeof obj !== 'object' || obj === null) return false;
  const req = obj as Record<string, unknown>;
  return (
    typeof req.org_id === 'string' &&
    typeof req.source_id === 'string' &&
    Array.isArray(req.metrics)
  );
}

/**
 * Create validation config with overrides
 */
export function createValidationConfig(
  overrides: Partial<ValidationConfig> = {}
): ValidationConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
