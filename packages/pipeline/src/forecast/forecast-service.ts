/**
 * Forecast Service Orchestrator
 *
 * Task ID: intentvision-jet.2
 * Phase: Forecast Service Integration
 *
 * Central orchestrator that:
 * - Routes forecast requests to appropriate backends (Nixtla TimeGPT, Statistical, Stub)
 * - Manages backend registration and health checks
 * - Stores forecast jobs in database
 * - Provides anomaly detection via Nixtla
 * - Supports mock mode for testing
 */

import type {
  ForecastRequest,
  ForecastResponse,
  ForecastBackend,
  ForecastBackendType,
  ForecastCapabilities,
  TimeSeries,
} from '../../../contracts/src/index.js';
import { NixtlaTimeGPTBackend } from './nixtla-timegpt.js';
import { StatisticalForecastBackend } from './statistical-forecast.js';
import { StubForecastBackend } from './forecast-stub.js';
import { logger, type LogContext } from '../observability/logger.js';
import { getClient } from '../../../../db/config.js';

// =============================================================================
// Types
// =============================================================================

export interface ForecastServiceConfig {
  /** Default backend to use if not specified in request */
  defaultBackend?: ForecastBackendType;

  /** Nixtla API key (required for Nixtla backend) */
  nixtlaApiKey?: string;

  /** Enable mock mode for testing */
  mockMode?: boolean;

  /** Skip database job tracking (useful for tests) */
  skipJobTracking?: boolean;
}

export interface BackendHealthStatus {
  type: ForecastBackendType;
  name: string;
  healthy: boolean;
  capabilities: ForecastCapabilities;
  lastChecked: string;
}

export interface AnomalyDetectionResult {
  success: boolean;
  anomalies: Array<{
    timestamp: string;
    value: number;
    score: number;
    isAnomaly: boolean;
  }>;
  error?: string;
  metadata: {
    detectionTime: string;
    durationMs: number;
    pointsAnalyzed: number;
    anomaliesFound: number;
  };
}

// =============================================================================
// Forecast Service
// =============================================================================

export class ForecastService {
  private backends: Map<ForecastBackendType, ForecastBackend> = new Map();
  private defaultBackendType: ForecastBackendType;
  private mockMode: boolean;
  private skipJobTracking: boolean;
  private serviceLogger = logger.child({ component: 'ForecastService' });

  constructor(config?: ForecastServiceConfig) {
    this.mockMode = config?.mockMode || false;
    this.skipJobTracking = config?.skipJobTracking ?? config?.mockMode ?? false;
    this.defaultBackendType = this.determineDefaultBackend(config);

    // Register default backends
    this.initializeBackends(config);

    this.serviceLogger.info('ForecastService initialized', {
      defaultBackend: this.defaultBackendType,
      mockMode: this.mockMode,
      availableBackends: Array.from(this.backends.keys()),
    });
  }

  /**
   * Register a forecast backend
   */
  registerBackend(backend: ForecastBackend): void {
    this.backends.set(backend.type, backend);
    this.serviceLogger.info('Backend registered', {
      type: backend.type,
      name: backend.name,
    });
  }

  /**
   * Generate a forecast
   *
   * @param request - Forecast request with series, horizon, and options
   * @param backendType - Optional backend type override
   * @returns Forecast response with predictions
   */
  async forecast(
    request: ForecastRequest,
    backendType?: ForecastBackendType
  ): Promise<ForecastResponse> {
    const context: LogContext = {
      correlationId: request.request_id,
      orgId: request.org_id,
      metricKey: request.series.metric_key,
    };

    const startTime = Date.now();
    const selectedBackend = backendType || request.options?.backend || this.defaultBackendType;

    this.serviceLogger.info('Forecast request received', {
      backend: selectedBackend,
      horizon: request.horizon,
      frequency: request.frequency,
      dataPoints: request.series.data_points.length,
    }, context);

    // Create forecast job record (skip in test/mock mode)
    let jobId: string | null = null;
    if (!this.skipJobTracking) {
      jobId = await this.createForecastJob(request, selectedBackend);
    }

    try {
      // Get backend
      const backend = this.backends.get(selectedBackend);
      if (!backend) {
        throw new Error(`Backend not available: ${selectedBackend}`);
      }

      // Update job status to running (if tracking)
      if (jobId) {
        await this.updateForecastJob(jobId, 'running', { started_at: new Date().toISOString() });
      }

      // Generate forecast
      const response = await backend.forecast(request);

      // Update job status based on response
      if (response.success) {
        if (jobId) {
          await this.updateForecastJob(jobId, 'completed', {
            completed_at: new Date().toISOString(),
            forecast_id: response.request_id,
          });
        }

        this.serviceLogger.info('Forecast completed', {
          backend: selectedBackend,
          success: true,
          durationMs: Date.now() - startTime,
          outputPoints: response.metadata.output_points,
        }, context);
      } else {
        if (jobId) {
          await this.updateForecastJob(jobId, 'failed', {
            completed_at: new Date().toISOString(),
            error: response.error || 'Unknown error',
          });
        }

        this.serviceLogger.error('Forecast failed', {
          backend: selectedBackend,
          error: response.error,
          durationMs: Date.now() - startTime,
        }, context);
      }

      return response;
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Update job to failed (if tracking)
      if (jobId) {
        await this.updateForecastJob(jobId, 'failed', {
          completed_at: new Date().toISOString(),
          error: errorMessage,
        });
      }

      this.serviceLogger.error('Forecast error', {
        backend: selectedBackend,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      }, context);

      // Return error response
      return {
        request_id: request.request_id,
        success: false,
        error: errorMessage,
        backend: selectedBackend,
        metadata: {
          generated_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          input_points: request.series.data_points.length,
          output_points: 0,
        },
      };
    }
  }

  /**
   * Detect anomalies using Nixtla TimeGPT
   *
   * @param series - Time series to analyze
   * @param orgId - Organization ID
   * @param requestId - Optional request ID for correlation
   * @returns Anomaly detection result
   */
  async detectAnomalies(
    series: TimeSeries,
    orgId: string,
    requestId?: string
  ): Promise<AnomalyDetectionResult> {
    const correlationId = requestId || `anom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const context: LogContext = {
      correlationId,
      orgId,
      metricKey: series.metric_key,
    };

    const startTime = Date.now();

    this.serviceLogger.info('Anomaly detection request', {
      dataPoints: series.data_points.length,
    }, context);

    try {
      // Get Nixtla backend (preferred for anomaly detection)
      const backend = this.backends.get('nixtla-timegpt') as NixtlaTimeGPTBackend | undefined;

      if (!backend) {
        throw new Error('Nixtla TimeGPT backend not available for anomaly detection');
      }

      // Call anomaly detection
      const result = await backend.detectAnomalies(series, orgId, correlationId);

      const durationMs = Date.now() - startTime;
      const anomaliesFound = result.anomalies.filter((a) => a.isAnomaly).length;

      this.serviceLogger.info('Anomaly detection completed', {
        success: result.success,
        durationMs,
        pointsAnalyzed: result.anomalies.length,
        anomaliesFound,
      }, context);

      return {
        success: result.success,
        anomalies: result.anomalies,
        error: result.error,
        metadata: {
          detectionTime: new Date().toISOString(),
          durationMs,
          pointsAnalyzed: result.anomalies.length,
          anomaliesFound,
        },
      };
    } catch (error) {
      const errorMessage = (error as Error).message;

      this.serviceLogger.error('Anomaly detection error', {
        error: errorMessage,
        durationMs: Date.now() - startTime,
      }, context);

      return {
        success: false,
        anomalies: [],
        error: errorMessage,
        metadata: {
          detectionTime: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          pointsAnalyzed: 0,
          anomaliesFound: 0,
        },
      };
    }
  }

  /**
   * Get list of available backends
   */
  getAvailableBackends(): ForecastBackendType[] {
    const types: ForecastBackendType[] = [];
    this.backends.forEach((_, type) => {
      types.push(type);
    });
    return types;
  }

  /**
   * Health check all registered backends
   *
   * @returns Health status for each backend
   */
  async healthCheck(): Promise<BackendHealthStatus[]> {
    const results: BackendHealthStatus[] = [];

    const promises: Promise<void>[] = [];
    this.backends.forEach((backend, type) => {
      const promise = (async () => {
        try {
          const healthy = await backend.healthCheck();
          results.push({
            type,
            name: backend.name,
            healthy,
            capabilities: backend.capabilities(),
            lastChecked: new Date().toISOString(),
          });

          this.serviceLogger.debug('Backend health check', {
            backend: type,
            healthy,
          });
        } catch (error) {
          results.push({
            type,
            name: backend.name,
            healthy: false,
            capabilities: backend.capabilities(),
            lastChecked: new Date().toISOString(),
          });

          this.serviceLogger.warn('Backend health check failed', {
            backend: type,
            error: (error as Error).message,
          });
        }
      })();
      promises.push(promise);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get backend by type
   */
  getBackend(type: ForecastBackendType): ForecastBackend | undefined {
    return this.backends.get(type);
  }

  /**
   * Enable mock mode on Nixtla backend (for testing)
   */
  enableMockMode(responses?: Map<string, unknown>): void {
    const nixtlaBackend = this.backends.get('nixtla-timegpt') as NixtlaTimeGPTBackend | undefined;
    if (nixtlaBackend) {
      nixtlaBackend.enableMockMode(responses);
      this.serviceLogger.info('Mock mode enabled on Nixtla backend');
    }
  }

  /**
   * Disable mock mode on Nixtla backend
   */
  disableMockMode(): void {
    const nixtlaBackend = this.backends.get('nixtla-timegpt') as NixtlaTimeGPTBackend | undefined;
    if (nixtlaBackend) {
      nixtlaBackend.disableMockMode();
      this.serviceLogger.info('Mock mode disabled on Nixtla backend');
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private initializeBackends(config?: ForecastServiceConfig): void {
    // Always register stub backend
    this.registerBackend(new StubForecastBackend());

    // Always register statistical backend
    this.registerBackend(new StatisticalForecastBackend());

    // Register Nixtla backend if API key is available
    const nixtlaApiKey = config?.nixtlaApiKey || process.env.NIXTLA_API_KEY;
    if (nixtlaApiKey) {
      const nixtlaBackend = new NixtlaTimeGPTBackend({ apiKey: nixtlaApiKey });

      // Enable mock mode if configured
      if (this.mockMode) {
        nixtlaBackend.enableMockMode();
      }

      this.registerBackend(nixtlaBackend);
      this.serviceLogger.info('Nixtla TimeGPT backend registered');
    } else {
      this.serviceLogger.warn('Nixtla API key not found, skipping Nixtla backend registration');
    }
  }

  private determineDefaultBackend(config?: ForecastServiceConfig): ForecastBackendType {
    // Priority:
    // 1. Explicit config
    // 2. Nixtla if API key is available
    // 3. Statistical backend
    // 4. Stub backend

    if (config?.defaultBackend) {
      return config.defaultBackend;
    }

    const nixtlaApiKey = config?.nixtlaApiKey || process.env.NIXTLA_API_KEY;
    if (nixtlaApiKey) {
      return 'nixtla-timegpt';
    }

    return 'custom'; // Statistical or Stub
  }

  private async createForecastJob(
    request: ForecastRequest,
    backend: ForecastBackendType
  ): Promise<string> {
    const client = getClient();
    const jobId = `fjob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await client.execute({
      sql: `
        INSERT INTO forecast_jobs
        (job_id, org_id, metric_key, dimensions, backend, status, horizon, frequency, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        jobId,
        request.org_id,
        request.series.metric_key,
        JSON.stringify(request.series.dimensions),
        backend,
        'pending',
        request.horizon,
        request.frequency,
        new Date().toISOString(),
      ],
    });

    return jobId;
  }

  private async updateForecastJob(
    jobId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    updates: {
      started_at?: string;
      completed_at?: string;
      error?: string;
      forecast_id?: string;
    }
  ): Promise<void> {
    const client = getClient();

    const setClauses: string[] = ['status = ?'];
    const args: (string | number | null)[] = [status];

    if (updates.started_at) {
      setClauses.push('started_at = ?');
      args.push(updates.started_at);
    }

    if (updates.completed_at) {
      setClauses.push('completed_at = ?');
      args.push(updates.completed_at);
    }

    if (updates.error) {
      setClauses.push('error = ?');
      args.push(updates.error);
    }

    if (updates.forecast_id) {
      setClauses.push('forecast_id = ?');
      args.push(updates.forecast_id);
    }

    args.push(jobId);

    await client.execute({
      sql: `UPDATE forecast_jobs SET ${setClauses.join(', ')} WHERE job_id = ?`,
      args,
    });
  }
}

// =============================================================================
// Factory & Singleton
// =============================================================================

let _forecastService: ForecastService | null = null;

/**
 * Get the singleton forecast service instance
 *
 * @param config - Optional configuration (only used on first call)
 * @returns ForecastService instance
 */
export function getForecastService(config?: ForecastServiceConfig): ForecastService {
  if (!_forecastService) {
    _forecastService = new ForecastService(config);
  }
  return _forecastService;
}

/**
 * Reset the forecast service singleton (for testing)
 */
export function resetForecastService(): void {
  _forecastService = null;
}
