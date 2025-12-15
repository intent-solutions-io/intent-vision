/**
 * Forecast Stub - Simple forecast backend for development
 *
 * Task ID: intentvision-0k9
 *
 * This is a stub implementation that:
 * 1. Uses simple moving average for predictions
 * 2. Demonstrates the pluggable forecast interface
 * 3. Will be replaced with Nixtla/Vertex AI in production
 */

import type {
  ForecastRequest,
  ForecastResponse,
  ForecastBackend,
  ForecastCapabilities,
  ForecastPoint,
} from '../../../contracts/src/index.js';

// =============================================================================
// Stub Forecast Backend
// =============================================================================

export class StubForecastBackend implements ForecastBackend {
  readonly type = 'custom' as const;
  readonly name = 'Stub Forecast (Moving Average)';

  async forecast(request: ForecastRequest): Promise<ForecastResponse> {
    const startTime = Date.now();

    try {
      const predictions = this.generatePredictions(request);

      return {
        request_id: request.request_id,
        success: true,
        forecast: {
          predictions,
          model_info: {
            name: 'StubMovingAverage',
            version: '1.0.0',
            training_metrics: {
              window_size: Math.min(request.series.data_points.length, 5),
            },
          },
        },
        backend: 'custom',
        metadata: {
          generated_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          input_points: request.series.data_points.length,
          output_points: predictions.length,
        },
      };
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: (error as Error).message,
        backend: 'custom',
        metadata: {
          generated_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          input_points: request.series.data_points.length,
          output_points: 0,
        },
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  capabilities(): ForecastCapabilities {
    return {
      max_horizon: 100,
      supported_frequencies: ['1m', '5m', '15m', '30m', '1h', '6h', '1d'],
      supports_intervals: true,
      supports_batch: false,
      supports_exogenous: false,
    };
  }

  // ==========================================================================
  // Internal Methods
  // ==========================================================================

  private generatePredictions(request: ForecastRequest): ForecastPoint[] {
    const { series, horizon, frequency } = request;
    const dataPoints = series.data_points;

    if (dataPoints.length === 0) {
      throw new Error('Cannot forecast with empty time series');
    }

    // Calculate moving average parameters
    const windowSize = Math.min(dataPoints.length, 5);
    const recentValues = dataPoints.slice(-windowSize).map((p) => p.value);
    const mean = recentValues.reduce((a, b) => a + b, 0) / windowSize;

    // Calculate standard deviation for intervals
    const variance =
      recentValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / windowSize;
    const stdDev = Math.sqrt(variance);

    // Calculate trend (simple linear)
    const trend = this.calculateTrend(dataPoints.slice(-windowSize));

    // Parse frequency to milliseconds
    const intervalMs = this.parseFrequency(frequency);

    // Generate predictions
    const predictions: ForecastPoint[] = [];
    let lastTimestamp = new Date(dataPoints[dataPoints.length - 1].timestamp).getTime();

    for (let i = 1; i <= horizon; i++) {
      const timestamp = new Date(lastTimestamp + i * intervalMs).toISOString();

      // Simple prediction: mean + trend adjustment + small decay
      const trendAdjustment = trend * i * 0.9; // Decay trend over time
      const predictedValue = mean + trendAdjustment;

      // Confidence intervals widen over time
      const uncertaintyFactor = 1 + (i / horizon) * 0.5;
      const interval80 = stdDev * 1.28 * uncertaintyFactor;
      const interval95 = stdDev * 1.96 * uncertaintyFactor;

      predictions.push({
        timestamp,
        value: Math.max(0, predictedValue), // Ensure non-negative
        intervals: {
          '0.80': {
            lower: Math.max(0, predictedValue - interval80),
            upper: predictedValue + interval80,
            confidence: 0.8,
          },
          '0.95': {
            lower: Math.max(0, predictedValue - interval95),
            upper: predictedValue + interval95,
            confidence: 0.95,
          },
        },
      });
    }

    return predictions;
  }

  private calculateTrend(points: Array<{ timestamp: string; value: number }>): number {
    if (points.length < 2) return 0;

    // Simple linear regression slope
    const n = points.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    points.forEach((p, i) => {
      sumX += i;
      sumY += p.value;
      sumXY += i * p.value;
      sumX2 += i * i;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return isFinite(slope) ? slope : 0;
  }

  private parseFrequency(freq: string): number {
    const match = freq.match(/^(\d+)(m|h|d)$/);
    if (!match) {
      throw new Error(`Unsupported frequency format: ${freq}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown frequency unit: ${unit}`);
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a stub forecast backend instance
 */
export function createStubForecastBackend(): ForecastBackend {
  return new StubForecastBackend();
}
