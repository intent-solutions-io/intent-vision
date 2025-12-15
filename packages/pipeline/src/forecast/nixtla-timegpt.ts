/**
 * Nixtla TimeGPT Forecast Backend
 *
 * Task ID: intentvision-jet
 * Phase B: Nixtla TimeGPT Forecasting + Anomaly Service
 *
 * Production-ready TimeGPT integration for:
 * - Time series forecasting
 * - Anomaly detection
 * - Multi-horizon predictions
 */

import type {
  ForecastRequest,
  ForecastResponse,
  ForecastBackend,
  ForecastCapabilities,
  ForecastPoint,
  ModelInfo,
  TimeSeries,
} from '../../../contracts/src/index.js';
import { getClient } from '../../../../db/config.js';

// =============================================================================
// Types
// =============================================================================

export interface NixtlaConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

interface TimeGPTForecastRequest {
  timestamp: string[];
  value: number[];
  fh: number;
  freq?: string;
  level?: number[];
  finetune_steps?: number;
}

interface TimeGPTForecastResponse {
  timestamp: string[];
  value: number[];
  lo_80?: number[];
  hi_80?: number[];
  lo_95?: number[];
  hi_95?: number[];
}

interface TimeGPTAnomalyRequest {
  timestamp: string[];
  value: number[];
}

interface TimeGPTAnomalyResponse {
  timestamp: string[];
  value: number[];
  anomaly: boolean[];
  anomaly_score: number[];
}

// =============================================================================
// Nixtla TimeGPT Backend
// =============================================================================

export class NixtlaTimeGPTBackend implements ForecastBackend {
  readonly type = 'nixtla-timegpt' as const;
  readonly name = 'Nixtla TimeGPT';

  private config: NixtlaConfig;
  private mockMode: boolean = false;
  private mockResponses: Map<string, unknown> = new Map();

  constructor(config?: Partial<NixtlaConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.NIXTLA_API_KEY || '',
      baseUrl: config?.baseUrl || 'https://api.nixtla.io',
      timeout: config?.timeout || 30000,
    };
  }

  /**
   * Enable mock mode for testing
   */
  enableMockMode(responses?: Map<string, unknown>): void {
    this.mockMode = true;
    if (responses) {
      this.mockResponses = responses;
    }
  }

  /**
   * Disable mock mode
   */
  disableMockMode(): void {
    this.mockMode = false;
    this.mockResponses.clear();
  }

  /**
   * Generate a forecast using TimeGPT
   */
  async forecast(request: ForecastRequest): Promise<ForecastResponse> {
    const startTime = Date.now();

    try {
      const { series, horizon, frequency, options } = request;
      const dataPoints = series.data_points;

      if (dataPoints.length < 2) {
        throw new Error('Insufficient data points for forecasting (minimum 2 required)');
      }

      // Prepare TimeGPT request
      const timestamps = dataPoints.map((p) => p.timestamp);
      const values = dataPoints.map((p) => p.value);

      let forecastResponse: TimeGPTForecastResponse;

      if (this.mockMode) {
        // Use mock response for testing
        forecastResponse = this.generateMockForecast(timestamps, values, horizon);
      } else {
        // Call TimeGPT API
        forecastResponse = await this.callTimeGPT(timestamps, values, horizon, frequency);
      }

      // Convert response to standard format
      const predictions: ForecastPoint[] = forecastResponse.timestamp.map((ts, i) => {
        const point: ForecastPoint = {
          timestamp: ts,
          value: forecastResponse.value[i],
        };

        // Add prediction intervals if available
        if (forecastResponse.lo_80 && forecastResponse.hi_80) {
          point.intervals = {
            '80': {
              lower: forecastResponse.lo_80[i],
              upper: forecastResponse.hi_80[i],
              confidence: 0.8,
            },
          };

          if (forecastResponse.lo_95 && forecastResponse.hi_95) {
            point.intervals['95'] = {
              lower: forecastResponse.lo_95[i],
              upper: forecastResponse.hi_95[i],
              confidence: 0.95,
            };
          }
        }

        return point;
      });

      const modelInfo: ModelInfo = {
        name: 'TimeGPT',
        version: '1.0',
        training_metrics: {
          input_points: dataPoints.length,
          horizon: horizon,
        },
      };

      // Store forecast in database
      await this.storeForecast(request, predictions, modelInfo, Date.now() - startTime);

      return {
        request_id: request.request_id,
        success: true,
        forecast: {
          predictions,
          model_info: modelInfo,
        },
        backend: this.type,
        metadata: {
          generated_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          input_points: dataPoints.length,
          output_points: predictions.length,
        },
      };
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: (error as Error).message,
        backend: this.type,
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
   * Detect anomalies using TimeGPT
   */
  async detectAnomalies(
    series: TimeSeries,
    orgId: string,
    requestId: string
  ): Promise<{
    success: boolean;
    anomalies: Array<{
      timestamp: string;
      value: number;
      score: number;
      isAnomaly: boolean;
    }>;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const dataPoints = series.data_points;

      if (dataPoints.length < 10) {
        throw new Error('Insufficient data points for anomaly detection (minimum 10 required)');
      }

      const timestamps = dataPoints.map((p) => p.timestamp);
      const values = dataPoints.map((p) => p.value);

      let anomalyResponse: TimeGPTAnomalyResponse;

      if (this.mockMode) {
        anomalyResponse = this.generateMockAnomalies(timestamps, values);
      } else {
        anomalyResponse = await this.callTimeGPTAnomaly(timestamps, values);
      }

      const anomalies = anomalyResponse.timestamp.map((ts, i) => ({
        timestamp: ts,
        value: anomalyResponse.value[i],
        score: anomalyResponse.anomaly_score[i],
        isAnomaly: anomalyResponse.anomaly[i],
      }));

      // Store detected anomalies in database
      const detectedAnomalies = anomalies.filter((a) => a.isAnomaly);
      for (const anomaly of detectedAnomalies) {
        await this.storeAnomaly(
          orgId,
          series.metric_key,
          series.dimensions,
          anomaly,
          requestId
        );
      }

      return {
        success: true,
        anomalies,
      };
    } catch (error) {
      return {
        success: false,
        anomalies: [],
        error: (error as Error).message,
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (this.mockMode) return true;

    if (!this.config.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get backend capabilities
   */
  capabilities(): ForecastCapabilities {
    return {
      max_horizon: 720, // Up to 720 periods (30 days at hourly)
      supported_frequencies: ['1m', '5m', '15m', '30m', '1h', '1d', '1w', '1M'],
      supports_intervals: true,
      supports_batch: true,
      supports_exogenous: true,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async callTimeGPT(
    timestamps: string[],
    values: number[],
    horizon: number,
    frequency: string
  ): Promise<TimeGPTForecastResponse> {
    const requestBody: TimeGPTForecastRequest = {
      timestamp: timestamps,
      value: values,
      fh: horizon,
      freq: this.convertFrequency(frequency),
      level: [80, 95],
    };

    const response = await fetch(`${this.config.baseUrl}/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TimeGPT API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private async callTimeGPTAnomaly(
    timestamps: string[],
    values: number[]
  ): Promise<TimeGPTAnomalyResponse> {
    const requestBody: TimeGPTAnomalyRequest = {
      timestamp: timestamps,
      value: values,
    };

    const response = await fetch(`${this.config.baseUrl}/anomaly_detection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TimeGPT Anomaly API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private generateMockForecast(
    timestamps: string[],
    values: number[],
    horizon: number
  ): TimeGPTForecastResponse {
    // Generate realistic mock forecast based on historical data
    const lastTimestamp = new Date(timestamps[timestamps.length - 1]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );

    // Calculate trend from last few points
    const recentValues = values.slice(-10);
    const trend =
      (recentValues[recentValues.length - 1] - recentValues[0]) / recentValues.length;

    const forecastTimestamps: string[] = [];
    const forecastValues: number[] = [];
    const lo80: number[] = [];
    const hi80: number[] = [];
    const lo95: number[] = [];
    const hi95: number[] = [];

    // Detect rough interval from data
    const intervalMs =
      timestamps.length > 1
        ? new Date(timestamps[1]).getTime() - new Date(timestamps[0]).getTime()
        : 3600000; // Default 1 hour

    for (let i = 0; i < horizon; i++) {
      const futureTime = new Date(lastTimestamp.getTime() + (i + 1) * intervalMs);
      forecastTimestamps.push(futureTime.toISOString());

      // Simple forecast with trend and noise
      const baseValue = values[values.length - 1] + trend * (i + 1);
      const noise = (Math.random() - 0.5) * stdDev * 0.5;
      const forecastValue = baseValue + noise;

      forecastValues.push(forecastValue);

      // Prediction intervals widen with horizon
      const uncertaintyFactor = 1 + i * 0.1;
      lo80.push(forecastValue - stdDev * 1.28 * uncertaintyFactor);
      hi80.push(forecastValue + stdDev * 1.28 * uncertaintyFactor);
      lo95.push(forecastValue - stdDev * 1.96 * uncertaintyFactor);
      hi95.push(forecastValue + stdDev * 1.96 * uncertaintyFactor);
    }

    return {
      timestamp: forecastTimestamps,
      value: forecastValues,
      lo_80: lo80,
      hi_80: hi80,
      lo_95: lo95,
      hi_95: hi95,
    };
  }

  private generateMockAnomalies(
    timestamps: string[],
    values: number[]
  ): TimeGPTAnomalyResponse {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );

    const anomalyThreshold = 2.5; // Standard deviations
    const anomalies: boolean[] = [];
    const scores: number[] = [];

    for (const value of values) {
      const zScore = Math.abs((value - mean) / stdDev);
      scores.push(zScore);
      anomalies.push(zScore > anomalyThreshold);
    }

    return {
      timestamp: timestamps,
      value: values,
      anomaly: anomalies,
      anomaly_score: scores,
    };
  }

  private convertFrequency(frequency: string): string {
    // Convert IntentVision frequency format to Nixtla format
    const mapping: Record<string, string> = {
      '1m': 'T',
      '5m': '5T',
      '15m': '15T',
      '30m': '30T',
      '1h': 'H',
      '1d': 'D',
      '1w': 'W',
      '1M': 'MS',
    };

    return mapping[frequency] || 'H';
  }

  private async storeForecast(
    request: ForecastRequest,
    predictions: ForecastPoint[],
    modelInfo: ModelInfo,
    durationMs: number
  ): Promise<void> {
    const client = getClient();

    await client.execute({
      sql: `
        INSERT OR REPLACE INTO forecasts
        (request_id, org_id, metric_key, dimensions, backend, horizon, frequency,
         predictions, model_info, generated_at, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        request.request_id,
        request.org_id,
        request.series.metric_key,
        JSON.stringify(request.series.dimensions),
        this.type,
        request.horizon,
        request.frequency,
        JSON.stringify(predictions),
        JSON.stringify(modelInfo),
        new Date().toISOString(),
        durationMs,
      ],
    });
  }

  private async storeAnomaly(
    orgId: string,
    metricKey: string,
    dimensions: Record<string, unknown>,
    anomaly: {
      timestamp: string;
      value: number;
      score: number;
      isAnomaly: boolean;
    },
    requestId: string
  ): Promise<void> {
    const client = getClient();
    const anomalyId = `anom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Calculate expected value (mean of recent data would be better, using value as placeholder)
    const expectedValue = anomaly.value * 0.9; // Placeholder

    await client.execute({
      sql: `
        INSERT OR IGNORE INTO anomalies
        (anomaly_id, request_id, org_id, metric_key, dimensions, timestamp,
         observed_value, expected_value, score, type, severity, description, detected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        anomalyId,
        requestId,
        orgId,
        metricKey,
        JSON.stringify(dimensions),
        anomaly.timestamp,
        anomaly.value,
        expectedValue,
        anomaly.score,
        'point',
        anomaly.score > 3 ? 'high' : anomaly.score > 2.5 ? 'medium' : 'low',
        `Anomaly detected with score ${anomaly.score.toFixed(2)}`,
        new Date().toISOString(),
      ],
    });
  }
}

// =============================================================================
// Factory
// =============================================================================

let _backend: NixtlaTimeGPTBackend | null = null;

export function getNixtlaBackend(config?: Partial<NixtlaConfig>): NixtlaTimeGPTBackend {
  if (!_backend) {
    _backend = new NixtlaTimeGPTBackend(config);
  }
  return _backend;
}

export function resetNixtlaBackend(): void {
  _backend = null;
}
