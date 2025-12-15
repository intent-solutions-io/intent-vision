/**
 * Webhook Ingestion Handler
 *
 * Task ID: intentvision-79x.1
 *
 * Main entry point for webhook-based metric ingestion.
 * Coordinates validation, idempotency, normalization, and storage.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  IngestRequest,
  IngestResponse,
  IngestError,
  IngestMetricPoint,
  BackfillRequest,
  BackfillStatus,
} from './types.js';
import { validateIngestRequest, ValidationConfig, createValidationConfig } from './validator.js';
import { IdempotencyManager, createIdempotencyManager } from './idempotency.js';
import { DeadLetterQueue, createDeadLetterQueue } from './dead-letter.js';
import { normalizeMetricBatch } from '../../normalize/normalizer.js';
import { storeMetricBatch, ensureOrganization } from '../../store/metric-store.js';
import { logger, createExecutionContext } from '../../observability/logger.js';
import type { CanonicalMetric } from '../../../../contracts/src/index.js';

// =============================================================================
// Handler Configuration
// =============================================================================

export interface WebhookHandlerConfig {
  validation: Partial<ValidationConfig>;
  enableIdempotency: boolean;
  enableDeadLetter: boolean;
}

const DEFAULT_CONFIG: WebhookHandlerConfig = {
  validation: {},
  enableIdempotency: true,
  enableDeadLetter: true,
};

// =============================================================================
// Webhook Handler
// =============================================================================

export class WebhookHandler {
  private config: WebhookHandlerConfig;
  private validationConfig: ValidationConfig;
  private idempotencyManager: IdempotencyManager | null = null;
  private deadLetterQueue: DeadLetterQueue | null = null;
  private initialized = false;

  constructor(config: Partial<WebhookHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.validationConfig = createValidationConfig(this.config.validation);
  }

  /**
   * Initialize handler dependencies
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.config.enableIdempotency) {
      this.idempotencyManager = createIdempotencyManager();
      await this.idempotencyManager.initialize();
    }

    if (this.config.enableDeadLetter) {
      this.deadLetterQueue = createDeadLetterQueue();
      await this.deadLetterQueue.initialize();
    }

    this.initialized = true;
  }

  /**
   * Handle incoming webhook request
   */
  async handle(payload: unknown): Promise<IngestResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();
    const ctx = createExecutionContext({
      component: 'webhook-handler',
      taskId: 'intentvision-79x.1',
    });
    const log = logger.child({ ...ctx, requestId });

    await this.initialize();

    try {
      // Step 1: Validate request schema
      const validation = validateIngestRequest(payload, this.validationConfig);

      if (!validation.valid && validation.validMetrics.length === 0) {
        log.warn('Request validation failed', { errors: validation.errors.length });
        return this.createResponse(requestId, startTime, 0, validation.errors.length, validation.errors);
      }

      const request = payload as IngestRequest;
      log.info('Processing ingest request', {
        orgId: request.org_id,
        sourceId: request.source_id,
        totalMetrics: request.metrics.length,
        validMetrics: validation.validMetrics.length,
      });

      // Step 2: Check idempotency
      if (this.config.enableIdempotency && this.idempotencyManager) {
        const idempotencyKey = request.idempotency_key ||
          IdempotencyManager.generateKey(
            request.org_id,
            request.source_id,
            IdempotencyManager.hashMetrics(request.metrics)
          );

        const existing = await this.idempotencyManager.check(idempotencyKey);
        if (existing) {
          log.info('Idempotent request detected', { key: idempotencyKey });
          return existing.response;
        }
      }

      // Step 3: Ensure organization exists
      await ensureOrganization(request.org_id);

      // Step 4: Convert to canonical metrics
      const canonicalMetrics = this.toCanonicalMetrics(
        validation.validMetrics,
        request.org_id,
        request.source_id
      );

      // Step 5: Normalize
      const { successful: normalizedMetrics, failed: normalizationFailures } =
        normalizeMetricBatch(canonicalMetrics);

      // Step 6: Store
      const storeResult = await storeMetricBatch(normalizedMetrics);

      // Step 7: Handle failures
      const allErrors = [
        ...validation.errors,
        ...normalizationFailures.map((f) => ({
          index: -1,
          metric_key: f.metric.metric_key,
          code: 'SCHEMA_VALIDATION_FAILED' as const,
          message: f.error,
        })),
        ...storeResult.errors.map((e) => ({
          index: -1,
          code: 'INTERNAL_ERROR' as const,
          message: e,
        })),
      ];

      // Send to dead letter if we have failures
      if (this.config.enableDeadLetter && this.deadLetterQueue && allErrors.length > 0) {
        for (const error of allErrors.slice(0, 10)) {
          await this.deadLetterQueue.add(request, error);
        }
      }

      // Step 8: Create response
      const response = this.createResponse(
        requestId,
        startTime,
        storeResult.stored,
        allErrors.length,
        allErrors.length > 0 ? allErrors : undefined
      );

      // Step 9: Store idempotency record
      if (this.config.enableIdempotency && this.idempotencyManager && request.idempotency_key) {
        await this.idempotencyManager.store(request.idempotency_key, requestId, response);
      }

      log.info('Ingest request completed', {
        accepted: response.accepted,
        rejected: response.rejected,
        durationMs: response.duration_ms,
      });

      return response;
    } catch (error) {
      const errorMessage = (error as Error).message;
      log.error('Ingest request failed', { error: errorMessage });

      return this.createResponse(requestId, startTime, 0, 1, [{
        index: -1,
        code: 'INTERNAL_ERROR',
        message: errorMessage,
      }]);
    }
  }

  /**
   * Convert ingest metrics to canonical format
   */
  private toCanonicalMetrics(
    metrics: IngestMetricPoint[],
    orgId: string,
    sourceId: string
  ): CanonicalMetric[] {
    const now = new Date().toISOString();

    return metrics.map((m) => ({
      org_id: orgId,
      metric_key: m.metric_key,
      timestamp: m.timestamp || now,
      value: m.value,
      dimensions: m.dimensions || {},
      provenance: {
        source_id: sourceId,
        ingested_at: now,
        pipeline_version: '1.0.0',
        transformations: ['webhook-ingest'],
      },
    }));
  }

  /**
   * Create standardized response
   */
  private createResponse(
    requestId: string,
    startTime: number,
    accepted: number,
    rejected: number,
    errors?: IngestError[]
  ): IngestResponse {
    return {
      success: rejected === 0,
      request_id: requestId,
      accepted,
      rejected,
      errors,
      duration_ms: Date.now() - startTime,
    };
  }

  /**
   * Get dead letter queue stats
   */
  async getDeadLetterStats(): Promise<ReturnType<DeadLetterQueue['getStats']> | null> {
    if (!this.deadLetterQueue) return null;
    return this.deadLetterQueue.getStats();
  }

  /**
   * Process dead letter retries
   */
  async processDeadLetterRetries(limit: number = 10): Promise<number> {
    if (!this.deadLetterQueue) return 0;

    const entries = await this.deadLetterQueue.getReadyForRetry(limit);
    let processed = 0;

    for (const entry of entries) {
      await this.deadLetterQueue.markRetrying(entry.id);

      try {
        const response = await this.handle(entry.request);
        if (response.success) {
          await this.deadLetterQueue.markResolved(entry.id);
          processed++;
        } else {
          await this.deadLetterQueue.handleRetryFailure(
            entry.id,
            response.errors?.[0] || entry.error
          );
        }
      } catch (error) {
        await this.deadLetterQueue.handleRetryFailure(entry.id, {
          index: -1,
          code: 'INTERNAL_ERROR',
          message: (error as Error).message,
        });
      }
    }

    return processed;
  }

  /**
   * Cleanup expired idempotency keys
   */
  async cleanupIdempotencyKeys(): Promise<number> {
    if (!this.idempotencyManager) return 0;
    return this.idempotencyManager.cleanup();
  }
}

/**
 * Create webhook handler instance
 */
export function createWebhookHandler(
  config: Partial<WebhookHandlerConfig> = {}
): WebhookHandler {
  return new WebhookHandler(config);
}

// =============================================================================
// Backfill Handler
// =============================================================================

/**
 * Handle backfill requests for historical data
 */
export async function handleBackfill(
  request: BackfillRequest,
  dataSource: AsyncGenerator<IngestMetricPoint[]>
): Promise<BackfillStatus> {
  const jobId = uuidv4();
  const startedAt = new Date().toISOString();
  const handler = createWebhookHandler({
    enableIdempotency: false, // Backfill doesn't need idempotency
    enableDeadLetter: true,
  });

  let processed = 0;
  let skipped = 0;

  try {
    for await (const batch of dataSource) {
      const ingestRequest: IngestRequest = {
        org_id: request.org_id,
        source_id: request.source_id,
        metrics: batch,
      };

      const response = await handler.handle(ingestRequest);
      processed += response.accepted;
      skipped += response.rejected;
    }

    return {
      job_id: jobId,
      status: 'completed',
      progress: 100,
      processed,
      skipped,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      job_id: jobId,
      status: 'failed',
      progress: 0,
      processed,
      skipped,
      started_at: startedAt,
      error: (error as Error).message,
    };
  }
}
