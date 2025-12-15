/**
 * IntentVision Pipeline - Minimal Vertical Slice
 *
 * End-to-end flow:
 * ingest (fixture) → normalize → store → forecast → anomaly → alert
 *
 * Phase 4 Task IDs:
 * - intentvision-k4p: Ingest
 * - intentvision-n0l: Normalize
 * - intentvision-1c6: Store
 * - intentvision-0k9: Forecast
 * - intentvision-kgx: Anomaly
 * - intentvision-eol: Alert
 * - intentvision-8vu: Observability
 */

// Re-export all components
export * from './ingest/fixture-loader.js';
export * from './ingest/webhook/index.js';
export * from './normalize/normalizer.js';
export * from './store/metric-store.js';
export * from './forecast/forecast-stub.js';
export * from './forecast/statistical-forecast.js';
export * from './forecast/nixtla-timegpt.js';
export * from './anomaly/anomaly-stub.js';
export * from './anomaly/ensemble-detector.js';
export * from './alert/alert-emitter.js';
export * from './observability/logger.js';
export * from './eval/index.js';
export * from './backends/index.js';
export * from './alert/index.js';

// =============================================================================
// Pipeline Orchestrator
// =============================================================================

import {
  loadMetricsFixture,
  generateSyntheticSeries,
  timeSeriesToMetrics,
} from './ingest/fixture-loader.js';
import { normalizeMetricBatch } from './normalize/normalizer.js';
import {
  storeMetricBatch,
  ensureOrganization,
  getTimeSeries,
} from './store/metric-store.js';
import { createStubForecastBackend } from './forecast/forecast-stub.js';
import { createStubAnomalyDetector } from './anomaly/anomaly-stub.js';
import {
  generateAnomalyAlert,
  generateForecastAlert,
  emitAlert,
} from './alert/alert-emitter.js';
import {
  logger,
  createExecutionContext,
  createPipelineMetrics,
  finalizePipelineMetrics,
} from './observability/logger.js';

import { v4 as uuidv4 } from 'uuid';
import type { TimeSeries } from '../../contracts/src/index.js';

export interface PipelineConfig {
  /** Organization ID */
  orgId: string;
  /** Use synthetic data instead of fixtures */
  useSynthetic?: boolean;
  /** Synthetic data options */
  syntheticOptions?: {
    metricKey: string;
    pointCount: number;
    intervalMs: number;
    baseValue: number;
    variance: number;
  };
  /** Forecast horizon */
  forecastHorizon?: number;
  /** Anomaly detection sensitivity (0-1) */
  anomalySensitivity?: number;
  /** Threshold for forecast alerts */
  forecastThreshold?: number;
}

export interface PipelineResult {
  success: boolean;
  metrics: {
    processed: number;
    stored: number;
    duplicates: number;
  };
  forecast: {
    generated: boolean;
    predictions: number;
  };
  anomaly: {
    detected: number;
  };
  alerts: {
    emitted: number;
  };
  errors: string[];
  durationMs: number;
}

/**
 * Run the complete pipeline
 */
export async function runPipeline(config: PipelineConfig): Promise<PipelineResult> {
  const ctx = createExecutionContext({
    component: 'pipeline',
    taskId: 'intentvision-dki',
  });
  const pipelineLogger = logger.child(ctx);
  const pipelineMetrics = createPipelineMetrics();
  const errors: string[] = [];

  pipelineLogger.info('Starting pipeline execution', { config });

  try {
    // 1. Ensure organization exists
    await ensureOrganization(config.orgId);
    pipelineLogger.info('Organization ensured', { orgId: config.orgId });

    // 2. Load/generate data
    let series: TimeSeries;

    if (config.useSynthetic) {
      const opts = config.syntheticOptions || {
        metricKey: 'system.cpu.usage',
        pointCount: 100,
        intervalMs: 5 * 60 * 1000, // 5 minutes
        baseValue: 50,
        variance: 20,
      };

      series = generateSyntheticSeries({
        orgId: config.orgId,
        ...opts,
        startTime: new Date(Date.now() - opts.pointCount * opts.intervalMs),
      });
      pipelineLogger.info('Generated synthetic series', { points: series.data_points.length });
    } else {
      const fixture = loadMetricsFixture();
      series = fixture.time_series;
      // Override org_id from config
      series.org_id = config.orgId;
      pipelineLogger.info('Loaded fixture data', { points: series.data_points.length });
    }

    // 3. Convert to canonical metrics and normalize
    const rawMetrics = timeSeriesToMetrics(series, 'pipeline-ingest');
    const { successful: normalizedMetrics, failed } = normalizeMetricBatch(rawMetrics);

    pipelineMetrics.metricsProcessed = rawMetrics.length;
    pipelineLogger.info('Normalized metrics', {
      total: rawMetrics.length,
      successful: normalizedMetrics.length,
      failed: failed.length,
    });

    if (failed.length > 0) {
      errors.push(`Normalization failed for ${failed.length} metrics`);
    }

    // 4. Store metrics
    const storeResult = await storeMetricBatch(normalizedMetrics);
    pipelineMetrics.metricsStored = storeResult.stored;
    pipelineLogger.info('Stored metrics', storeResult);

    if (!storeResult.success) {
      errors.push(...storeResult.errors);
    }

    // 5. Run forecast
    const forecastBackend = createStubForecastBackend();
    const forecastRequest = {
      request_id: uuidv4(),
      org_id: config.orgId,
      series,
      horizon: config.forecastHorizon || 6,
      frequency: series.metadata.resolution || '5m',
    };

    const forecastResponse = await forecastBackend.forecast(forecastRequest);
    pipelineMetrics.forecastsGenerated = forecastResponse.forecast?.predictions.length || 0;
    pipelineLogger.info('Generated forecast', {
      success: forecastResponse.success,
      predictions: pipelineMetrics.forecastsGenerated,
    });

    // 6. Run anomaly detection
    const anomalyDetector = createStubAnomalyDetector();
    const anomalyRequest = {
      request_id: uuidv4(),
      org_id: config.orgId,
      series,
      options: {
        sensitivity: config.anomalySensitivity || 0.7,
        include_context: true,
      },
    };

    const anomalyResponse = await anomalyDetector.detect(anomalyRequest);
    pipelineMetrics.anomaliesDetected = anomalyResponse.anomalies.length;
    pipelineLogger.info('Detected anomalies', {
      success: anomalyResponse.success,
      count: pipelineMetrics.anomaliesDetected,
    });

    // 7. Emit alerts
    let alertsEmitted = 0;

    // Alert on anomalies
    for (const anomaly of anomalyResponse.anomalies) {
      const lastMetric = normalizedMetrics[normalizedMetrics.length - 1];
      const alert = generateAnomalyAlert(anomaly, lastMetric);
      const emitResult = await emitAlert(alert);

      if (emitResult.success) {
        alertsEmitted++;
      } else {
        errors.push(`Failed to emit alert: ${emitResult.error}`);
      }
    }

    // Alert on forecast threshold breaches
    if (forecastResponse.success && forecastResponse.forecast) {
      const threshold = config.forecastThreshold || 80;

      for (const prediction of forecastResponse.forecast.predictions) {
        if (prediction.value > threshold) {
          const lastMetric = normalizedMetrics[normalizedMetrics.length - 1];
          const alert = generateForecastAlert(prediction, lastMetric, threshold);
          const emitResult = await emitAlert(alert);

          if (emitResult.success) {
            alertsEmitted++;
          } else {
            errors.push(`Failed to emit forecast alert: ${emitResult.error}`);
          }
        }
      }
    }

    pipelineMetrics.alertsEmitted = alertsEmitted;
    pipelineLogger.info('Emitted alerts', { count: alertsEmitted });

    // Finalize metrics
    finalizePipelineMetrics(pipelineMetrics, pipelineLogger);

    return {
      success: errors.length === 0,
      metrics: {
        processed: pipelineMetrics.metricsProcessed,
        stored: pipelineMetrics.metricsStored,
        duplicates: storeResult.duplicates,
      },
      forecast: {
        generated: forecastResponse.success,
        predictions: pipelineMetrics.forecastsGenerated,
      },
      anomaly: {
        detected: pipelineMetrics.anomaliesDetected,
      },
      alerts: {
        emitted: alertsEmitted,
      },
      errors,
      durationMs: (pipelineMetrics.endTime || Date.now()) - pipelineMetrics.startTime,
    };
  } catch (error) {
    pipelineMetrics.errors++;
    const errorMessage = (error as Error).message;
    errors.push(errorMessage);
    pipelineLogger.error('Pipeline execution failed', { error: errorMessage });

    return {
      success: false,
      metrics: { processed: 0, stored: 0, duplicates: 0 },
      forecast: { generated: false, predictions: 0 },
      anomaly: { detected: 0 },
      alerts: { emitted: 0 },
      errors,
      durationMs: Date.now() - pipelineMetrics.startTime,
    };
  }
}
