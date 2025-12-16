/**
 * Statistical Forecast Backend
 *
 * Phase 1: Firestore-backed MVP Core
 * Beads Task: intentvision-002
 *
 * Default forecast backend using simple statistical methods.
 * No external API dependencies - always available.
 *
 * Methods implemented:
 * - Simple Moving Average (SMA)
 * - Exponential Weighted Moving Average (EWMA)
 * - Linear Trend Extrapolation
 */

import type { ForecastPoint, TimeSeriesPoint } from '../firestore/schema.js';

// =============================================================================
// Types
// =============================================================================

export interface ForecastBackend {
  readonly type: string;
  readonly name: string;

  forecast(
    points: TimeSeriesPoint[],
    options: ForecastOptions
  ): Promise<ForecastResult>;
}

export interface ForecastOptions {
  horizonDays: number;
  confidenceLevel?: number;
  method?: 'sma' | 'ewma' | 'linear';
}

export interface ForecastResult {
  predictions: ForecastPoint[];
  modelInfo: {
    name: string;
    version: string;
    parameters: Record<string, unknown>;
  };
  metrics: {
    inputPoints: number;
    outputPoints: number;
    durationMs: number;
  };
}

// =============================================================================
// Statistical Backend Implementation
// =============================================================================

export class StatisticalForecastBackend implements ForecastBackend {
  readonly type = 'statistical';
  readonly name = 'Statistical Forecast Backend';

  /**
   * Generate forecast using statistical methods.
   * Default method is EWMA (Exponential Weighted Moving Average).
   */
  async forecast(
    points: TimeSeriesPoint[],
    options: ForecastOptions
  ): Promise<ForecastResult> {
    const startTime = Date.now();
    const { horizonDays, confidenceLevel = 0.95, method = 'ewma' } = options;

    if (points.length < 2) {
      throw new Error('Insufficient data points for forecasting (minimum 2 required)');
    }

    // Sort points by timestamp
    const sortedPoints = [...points].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate forecast based on method
    let predictions: ForecastPoint[];
    let modelParams: Record<string, unknown>;

    switch (method) {
      case 'sma':
        ({ predictions, params: modelParams } = this.simpleMovingAverage(sortedPoints, horizonDays, confidenceLevel));
        break;
      case 'linear':
        ({ predictions, params: modelParams } = this.linearTrendExtrapolation(sortedPoints, horizonDays, confidenceLevel));
        break;
      case 'ewma':
      default:
        ({ predictions, params: modelParams } = this.exponentialWeightedMA(sortedPoints, horizonDays, confidenceLevel));
        break;
    }

    return {
      predictions,
      modelInfo: {
        name: `Statistical ${method.toUpperCase()}`,
        version: '1.0.0',
        parameters: modelParams,
      },
      metrics: {
        inputPoints: points.length,
        outputPoints: predictions.length,
        durationMs: Date.now() - startTime,
      },
    };
  }

  // ===========================================================================
  // Statistical Methods
  // ===========================================================================

  /**
   * Simple Moving Average forecast
   */
  private simpleMovingAverage(
    points: TimeSeriesPoint[],
    horizonDays: number,
    confidenceLevel: number
  ): { predictions: ForecastPoint[]; params: Record<string, unknown> } {
    const values = points.map((p) => p.value);
    const windowSize = Math.min(Math.floor(values.length / 2), 10);

    // Calculate SMA
    const recentValues = values.slice(-windowSize);
    const sma = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;

    // Calculate standard deviation for confidence intervals
    const variance = recentValues.reduce((sum, v) => sum + Math.pow(v - sma, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);

    // Z-score for confidence level
    const zScore = this.getZScore(confidenceLevel);

    // Generate predictions
    const lastTimestamp = new Date(points[points.length - 1].timestamp);
    const intervalMs = this.detectInterval(points);
    const predictions: ForecastPoint[] = [];

    for (let i = 0; i < horizonDays; i++) {
      const timestamp = new Date(lastTimestamp.getTime() + (i + 1) * intervalMs);
      const margin = zScore * stdDev * Math.sqrt(1 + (i + 1) / windowSize);

      predictions.push({
        timestamp,
        predictedValue: sma,
        confidenceLower: sma - margin,
        confidenceUpper: sma + margin,
        confidenceLevel,
      });
    }

    return {
      predictions,
      params: { windowSize, sma, stdDev },
    };
  }

  /**
   * Exponential Weighted Moving Average forecast
   */
  private exponentialWeightedMA(
    points: TimeSeriesPoint[],
    horizonDays: number,
    confidenceLevel: number
  ): { predictions: ForecastPoint[]; params: Record<string, unknown> } {
    const values = points.map((p) => p.value);

    // Smoothing factor (alpha)
    const alpha = 2 / (Math.min(values.length, 10) + 1);

    // Calculate EWMA
    let ewma = values[0];
    for (let i = 1; i < values.length; i++) {
      ewma = alpha * values[i] + (1 - alpha) * ewma;
    }

    // Calculate weighted variance for confidence intervals
    let ewmVariance = 0;
    let weightSum = 0;
    for (let i = 0; i < values.length; i++) {
      const weight = Math.pow(1 - alpha, values.length - 1 - i);
      ewmVariance += weight * Math.pow(values[i] - ewma, 2);
      weightSum += weight;
    }
    const stdDev = Math.sqrt(ewmVariance / weightSum);

    // Z-score for confidence level
    const zScore = this.getZScore(confidenceLevel);

    // Generate predictions with trend
    const lastTimestamp = new Date(points[points.length - 1].timestamp);
    const intervalMs = this.detectInterval(points);

    // Simple trend calculation
    const recentSlope = (values[values.length - 1] - values[values.length - Math.min(5, values.length)]) /
      Math.min(5, values.length);

    const predictions: ForecastPoint[] = [];

    for (let i = 0; i < horizonDays; i++) {
      const timestamp = new Date(lastTimestamp.getTime() + (i + 1) * intervalMs);
      const predictedValue = ewma + recentSlope * (i + 1);
      const margin = zScore * stdDev * Math.sqrt(1 + (i + 1) * 0.1);

      predictions.push({
        timestamp,
        predictedValue,
        confidenceLower: predictedValue - margin,
        confidenceUpper: predictedValue + margin,
        confidenceLevel,
      });
    }

    return {
      predictions,
      params: { alpha, ewma, stdDev, trend: recentSlope },
    };
  }

  /**
   * Linear Trend Extrapolation forecast
   */
  private linearTrendExtrapolation(
    points: TimeSeriesPoint[],
    horizonDays: number,
    confidenceLevel: number
  ): { predictions: ForecastPoint[]; params: Record<string, unknown> } {
    const values = points.map((p) => p.value);
    const n = values.length;

    // Calculate linear regression
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // Calculate standard error
    let sse = 0;
    for (let i = 0; i < n; i++) {
      const predicted = intercept + slope * i;
      sse += Math.pow(values[i] - predicted, 2);
    }
    const mse = sse / (n - 2);
    const stdError = Math.sqrt(mse);

    // Z-score for confidence level
    const zScore = this.getZScore(confidenceLevel);

    // Generate predictions
    const lastTimestamp = new Date(points[points.length - 1].timestamp);
    const intervalMs = this.detectInterval(points);
    const predictions: ForecastPoint[] = [];

    for (let i = 0; i < horizonDays; i++) {
      const x = n + i;
      const timestamp = new Date(lastTimestamp.getTime() + (i + 1) * intervalMs);
      const predictedValue = intercept + slope * x;

      // Prediction interval widens with distance
      const predictionError = stdError * Math.sqrt(1 + 1/n + Math.pow(x - xMean, 2) / denominator);
      const margin = zScore * predictionError;

      predictions.push({
        timestamp,
        predictedValue,
        confidenceLower: predictedValue - margin,
        confidenceUpper: predictedValue + margin,
        confidenceLevel,
      });
    }

    return {
      predictions,
      params: { slope, intercept, stdError, r2: 1 - sse / this.calculateTSS(values) },
    };
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Detect time interval between points
   */
  private detectInterval(points: TimeSeriesPoint[]): number {
    if (points.length < 2) return 86400000; // Default to 1 day

    const intervals: number[] = [];
    for (let i = 1; i < Math.min(points.length, 10); i++) {
      const diff = new Date(points[i].timestamp).getTime() - new Date(points[i - 1].timestamp).getTime();
      if (diff > 0) intervals.push(diff);
    }

    if (intervals.length === 0) return 86400000;

    // Return median interval
    intervals.sort((a, b) => a - b);
    return intervals[Math.floor(intervals.length / 2)];
  }

  /**
   * Get Z-score for confidence level
   */
  private getZScore(confidenceLevel: number): number {
    // Common confidence levels
    const zScores: Record<number, number> = {
      0.80: 1.28,
      0.85: 1.44,
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };

    return zScores[confidenceLevel] || 1.96;
  }

  /**
   * Calculate Total Sum of Squares
   */
  private calculateTSS(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
  }
}

// =============================================================================
// Factory
// =============================================================================

let _backend: StatisticalForecastBackend | null = null;

export function getStatisticalBackend(): StatisticalForecastBackend {
  if (!_backend) {
    _backend = new StatisticalForecastBackend();
  }
  return _backend;
}

export function resetStatisticalBackend(): void {
  _backend = null;
}
