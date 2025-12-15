/**
 * Enhanced Statistical Forecast Backend
 *
 * Task ID: intentvision-8fa.1
 *
 * Production-ready forecast backend using statistical methods:
 * - Exponential Smoothing (Holt-Winters)
 * - Seasonal decomposition
 * - Automatic model selection
 * - Proper confidence intervals
 */

import type {
  ForecastRequest,
  ForecastResponse,
  ForecastBackend,
  ForecastCapabilities,
  ForecastPoint,
  PredictionInterval,
  ModelInfo,
} from '../../../contracts/src/index.js';

// =============================================================================
// Types
// =============================================================================

interface TimeSeriesStats {
  mean: number;
  variance: number;
  stdDev: number;
  min: number;
  max: number;
  trend: number;
  seasonalPeriod: number | null;
  seasonalStrength: number;
}

interface HoltWintersParams {
  alpha: number; // Level smoothing
  beta: number; // Trend smoothing
  gamma: number; // Seasonal smoothing
  seasonal: 'additive' | 'multiplicative' | 'none';
  period: number;
}

interface ForecastModel {
  name: string;
  params: HoltWintersParams;
  level: number;
  trend: number;
  seasonalFactors: number[];
  residualStdDev: number;
  mape: number;
}

// =============================================================================
// Statistical Forecast Backend
// =============================================================================

export class StatisticalForecastBackend implements ForecastBackend {
  readonly type = 'custom' as const;
  readonly name = 'Statistical Forecast (Holt-Winters)';

  async forecast(request: ForecastRequest): Promise<ForecastResponse> {
    const startTime = Date.now();

    try {
      const { series, horizon, frequency, options } = request;
      const dataPoints = series.data_points;

      if (dataPoints.length < 3) {
        throw new Error('Insufficient data points for forecasting (minimum 3 required)');
      }

      const values = dataPoints.map((p) => p.value);

      // Analyze time series characteristics
      const stats = this.analyzeTimeSeries(values, frequency);

      // Select and fit best model
      const model = this.fitModel(values, stats);

      // Generate predictions
      const intervalMs = this.parseFrequency(frequency);
      const lastTimestamp = new Date(dataPoints[dataPoints.length - 1].timestamp).getTime();

      const predictions = this.generatePredictions(
        model,
        horizon,
        lastTimestamp,
        intervalMs,
        options?.confidence_levels || [0.8, 0.95]
      );

      // Generate historical fit if requested
      let historyFit: ForecastPoint[] | undefined;
      if (options?.include_history) {
        historyFit = this.generateHistoryFit(model, dataPoints, values);
      }

      return {
        request_id: request.request_id,
        success: true,
        forecast: {
          predictions,
          history_fit: historyFit,
          model_info: this.getModelInfo(model, stats),
        },
        backend: 'custom',
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
      max_horizon: 365,
      supported_frequencies: ['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d', '7d'],
      supports_intervals: true,
      supports_batch: false,
      supports_exogenous: false,
    };
  }

  // ==========================================================================
  // Time Series Analysis
  // ==========================================================================

  private analyzeTimeSeries(values: number[], frequency: string): TimeSeriesStats {
    const n = values.length;

    // Basic statistics
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Trend estimation (linear regression slope)
    const trend = this.calculateTrend(values);

    // Seasonality detection
    const { period, strength } = this.detectSeasonality(values, frequency);

    return {
      mean,
      variance,
      stdDev,
      min,
      max,
      trend,
      seasonalPeriod: period,
      seasonalStrength: strength,
    };
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (Math.abs(denominator) < 1e-10) return 0;

    return (n * sumXY - sumX * sumY) / denominator;
  }

  private detectSeasonality(
    values: number[],
    frequency: string
  ): { period: number | null; strength: number } {
    const n = values.length;

    // Common seasonal periods based on frequency
    const frequencyPeriods: Record<string, number[]> = {
      '1m': [60, 1440], // Hour, Day
      '5m': [12, 288], // Hour, Day
      '15m': [4, 96], // Hour, Day
      '30m': [2, 48], // Hour, Day
      '1h': [24, 168], // Day, Week
      '6h': [4, 28], // Day, Week
      '12h': [2, 14], // Day, Week
      '1d': [7, 30], // Week, Month
      '7d': [4, 52], // Month, Year
    };

    const candidatePeriods = frequencyPeriods[frequency] || [7, 30];

    let bestPeriod: number | null = null;
    let bestStrength = 0;

    for (const period of candidatePeriods) {
      if (n < period * 2) continue;

      // Calculate autocorrelation at this period
      const strength = this.calculateAutocorrelation(values, period);

      if (strength > bestStrength && strength > 0.3) {
        bestStrength = strength;
        bestPeriod = period;
      }
    }

    return { period: bestPeriod, strength: bestStrength };
  }

  private calculateAutocorrelation(values: number[], lag: number): number {
    const n = values.length;
    if (lag >= n) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n - lag; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }

    for (let i = 0; i < n; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }

    if (Math.abs(denominator) < 1e-10) return 0;
    return numerator / denominator;
  }

  // ==========================================================================
  // Model Fitting
  // ==========================================================================

  private fitModel(values: number[], stats: TimeSeriesStats): ForecastModel {
    // Determine if seasonal model is appropriate
    const useSeasonal = stats.seasonalPeriod !== null && stats.seasonalStrength > 0.3;

    // Grid search for best parameters
    const alphas = [0.1, 0.2, 0.3, 0.5, 0.7];
    const betas = [0.0, 0.1, 0.2, 0.3];
    const gammas = useSeasonal ? [0.1, 0.2, 0.3, 0.5] : [0];

    let bestModel: ForecastModel | null = null;
    let bestMAPE = Infinity;

    for (const alpha of alphas) {
      for (const beta of betas) {
        for (const gamma of gammas) {
          const params: HoltWintersParams = {
            alpha,
            beta,
            gamma,
            seasonal: useSeasonal ? 'additive' : 'none',
            period: stats.seasonalPeriod || 1,
          };

          const model = this.fitHoltWinters(values, params);

          if (model.mape < bestMAPE) {
            bestMAPE = model.mape;
            bestModel = model;
          }
        }
      }
    }

    return bestModel || this.fitSimpleExponentialSmoothing(values);
  }

  private fitHoltWinters(values: number[], params: HoltWintersParams): ForecastModel {
    const n = values.length;
    const { alpha, beta, gamma, seasonal, period } = params;

    // Initialize components
    let level = values.slice(0, Math.min(period, n)).reduce((a, b) => a + b, 0) / Math.min(period, n);
    let trend = n >= 2 ? (values[Math.min(period, n) - 1] - values[0]) / Math.min(period, n) : 0;

    // Initialize seasonal factors
    let seasonalFactors: number[] = [];
    if (seasonal !== 'none' && period > 1 && n >= period) {
      seasonalFactors = new Array(period).fill(0);
      for (let i = 0; i < period; i++) {
        let sum = 0;
        let count = 0;
        for (let j = i; j < n; j += period) {
          if (seasonal === 'additive') {
            sum += values[j] - level;
          } else {
            sum += level > 0 ? values[j] / level : 1;
          }
          count++;
        }
        seasonalFactors[i] = sum / count;
      }
    }

    // Fit model and calculate errors
    const fitted: number[] = [];
    const errors: number[] = [];

    for (let t = 0; t < n; t++) {
      const seasonIndex = t % period;
      let seasonalFactor = seasonalFactors.length > 0 ? seasonalFactors[seasonIndex] : 0;

      // Calculate fitted value
      let fittedValue: number;
      if (seasonal === 'additive') {
        fittedValue = level + trend + seasonalFactor;
      } else if (seasonal === 'multiplicative') {
        fittedValue = (level + trend) * (seasonalFactor || 1);
      } else {
        fittedValue = level + trend;
      }

      fitted.push(fittedValue);
      const error = values[t] - fittedValue;
      errors.push(error);

      // Update components
      const prevLevel = level;
      const prevTrend = trend;

      if (seasonal === 'additive') {
        level = alpha * (values[t] - seasonalFactor) + (1 - alpha) * (prevLevel + prevTrend);
        trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
        if (seasonalFactors.length > 0) {
          seasonalFactors[seasonIndex] =
            gamma * (values[t] - level) + (1 - gamma) * seasonalFactor;
        }
      } else if (seasonal === 'multiplicative') {
        level =
          alpha * (values[t] / (seasonalFactor || 1)) + (1 - alpha) * (prevLevel + prevTrend);
        trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
        if (seasonalFactors.length > 0) {
          seasonalFactors[seasonIndex] =
            gamma * (values[t] / level) + (1 - gamma) * (seasonalFactor || 1);
        }
      } else {
        level = alpha * values[t] + (1 - alpha) * (prevLevel + prevTrend);
        trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
      }
    }

    // Calculate error metrics
    const absErrors = errors.map(Math.abs);
    const residualStdDev = Math.sqrt(
      errors.reduce((sum, e) => sum + e * e, 0) / (n - 1)
    );

    const mape =
      values.reduce((sum, v, i) => {
        if (Math.abs(v) < 1e-10) return sum;
        return sum + Math.abs(errors[i] / v);
      }, 0) / n;

    return {
      name: `HoltWinters(${alpha.toFixed(1)},${beta.toFixed(1)},${gamma.toFixed(1)})`,
      params,
      level,
      trend,
      seasonalFactors,
      residualStdDev,
      mape: mape * 100,
    };
  }

  private fitSimpleExponentialSmoothing(values: number[]): ForecastModel {
    const n = values.length;
    const alpha = 0.3;

    let level = values[0];
    const errors: number[] = [];

    for (let t = 0; t < n; t++) {
      const error = values[t] - level;
      errors.push(error);
      level = alpha * values[t] + (1 - alpha) * level;
    }

    const residualStdDev = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / (n - 1));
    const mape =
      values.reduce((sum, v, i) => {
        if (Math.abs(v) < 1e-10) return sum;
        return sum + Math.abs(errors[i] / v);
      }, 0) / n;

    return {
      name: 'SimpleES(0.3)',
      params: { alpha: 0.3, beta: 0, gamma: 0, seasonal: 'none', period: 1 },
      level,
      trend: 0,
      seasonalFactors: [],
      residualStdDev,
      mape: mape * 100,
    };
  }

  // ==========================================================================
  // Prediction Generation
  // ==========================================================================

  private generatePredictions(
    model: ForecastModel,
    horizon: number,
    lastTimestamp: number,
    intervalMs: number,
    confidenceLevels: number[]
  ): ForecastPoint[] {
    const predictions: ForecastPoint[] = [];
    const { params, level, trend, seasonalFactors, residualStdDev } = model;
    const { seasonal, period } = params;

    for (let h = 1; h <= horizon; h++) {
      const timestamp = new Date(lastTimestamp + h * intervalMs).toISOString();

      // Calculate point forecast
      let pointForecast: number;
      const seasonIndex = (seasonalFactors.length > 0) ? (h - 1) % period : 0;
      const seasonalFactor = seasonalFactors.length > 0 ? seasonalFactors[seasonIndex] : 0;

      if (seasonal === 'additive') {
        pointForecast = level + h * trend + seasonalFactor;
      } else if (seasonal === 'multiplicative') {
        pointForecast = (level + h * trend) * (seasonalFactor || 1);
      } else {
        pointForecast = level + h * trend;
      }

      // Calculate prediction intervals (widening with horizon)
      const horizonFactor = Math.sqrt(h);
      const intervals: Record<string, PredictionInterval> = {};

      for (const confLevel of confidenceLevels) {
        // Z-score for confidence level
        const z = this.getZScore(confLevel);
        const margin = z * residualStdDev * horizonFactor;

        intervals[confLevel.toString()] = {
          lower: pointForecast - margin,
          upper: pointForecast + margin,
          confidence: confLevel,
        };
      }

      predictions.push({
        timestamp,
        value: Math.max(0, pointForecast),
        intervals,
      });
    }

    return predictions;
  }

  private generateHistoryFit(
    model: ForecastModel,
    dataPoints: Array<{ timestamp: string; value: number }>,
    values: number[]
  ): ForecastPoint[] {
    const { params, seasonalFactors, residualStdDev } = model;
    const { alpha, beta, gamma, seasonal, period } = params;

    let level = values.slice(0, Math.min(period, values.length)).reduce((a, b) => a + b, 0) /
      Math.min(period, values.length);
    let trend = values.length >= 2 ? (values[Math.min(period, values.length) - 1] - values[0]) /
      Math.min(period, values.length) : 0;

    const tempSeasonalFactors = [...seasonalFactors];
    const historyFit: ForecastPoint[] = [];

    for (let t = 0; t < values.length; t++) {
      const seasonIndex = t % period;
      const seasonalFactor = tempSeasonalFactors.length > 0 ? tempSeasonalFactors[seasonIndex] : 0;

      let fittedValue: number;
      if (seasonal === 'additive') {
        fittedValue = level + trend + seasonalFactor;
      } else if (seasonal === 'multiplicative') {
        fittedValue = (level + trend) * (seasonalFactor || 1);
      } else {
        fittedValue = level + trend;
      }

      historyFit.push({
        timestamp: dataPoints[t].timestamp,
        value: fittedValue,
        intervals: {
          '0.95': {
            lower: fittedValue - 1.96 * residualStdDev,
            upper: fittedValue + 1.96 * residualStdDev,
            confidence: 0.95,
          },
        },
      });

      // Update components
      const prevLevel = level;
      const prevTrend = trend;

      if (seasonal === 'additive') {
        level = alpha * (values[t] - seasonalFactor) + (1 - alpha) * (prevLevel + prevTrend);
        trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
        if (tempSeasonalFactors.length > 0) {
          tempSeasonalFactors[seasonIndex] =
            gamma * (values[t] - level) + (1 - gamma) * seasonalFactor;
        }
      } else if (seasonal === 'multiplicative') {
        level =
          alpha * (values[t] / (seasonalFactor || 1)) + (1 - alpha) * (prevLevel + prevTrend);
        trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
        if (tempSeasonalFactors.length > 0) {
          tempSeasonalFactors[seasonIndex] =
            gamma * (values[t] / level) + (1 - gamma) * (seasonalFactor || 1);
        }
      } else {
        level = alpha * values[t] + (1 - alpha) * (prevLevel + prevTrend);
        trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
      }
    }

    return historyFit;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private getZScore(confidence: number): number {
    // Common z-scores for prediction intervals
    const zScores: Record<number, number> = {
      0.5: 0.674,
      0.8: 1.282,
      0.9: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };

    return zScores[confidence] || 1.96;
  }

  private getModelInfo(model: ForecastModel, stats: TimeSeriesStats): ModelInfo {
    return {
      name: model.name,
      version: '2.0.0',
      training_metrics: {
        mape: model.mape,
        residual_std: model.residualStdDev,
        alpha: model.params.alpha,
        beta: model.params.beta,
        gamma: model.params.gamma,
        seasonal_period: stats.seasonalPeriod || 0,
        seasonal_strength: stats.seasonalStrength,
        trend: stats.trend,
      },
    };
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

export function createStatisticalForecastBackend(): ForecastBackend {
  return new StatisticalForecastBackend();
}
