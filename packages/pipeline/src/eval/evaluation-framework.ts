/**
 * Evaluation Framework
 *
 * Task ID: intentvision-8fa.3
 *
 * Comprehensive evaluation system for forecast and anomaly detection:
 * - Forecast metrics: MAE, MAPE, RMSE, SMAPE
 * - Anomaly metrics: Precision, Recall, F1, AUC
 * - Backtesting with walk-forward validation
 * - Benchmark data generation
 */

import type {
  TimeSeries,
  ForecastBackend,
  ForecastRequest,
  AnomalyDetector,
  AnomalyDetectionRequest,
  Anomaly,
} from '../../../contracts/src/index.js';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Types
// =============================================================================

export interface ForecastMetrics {
  mae: number; // Mean Absolute Error
  mape: number; // Mean Absolute Percentage Error
  rmse: number; // Root Mean Square Error
  smape: number; // Symmetric MAPE
  mse: number; // Mean Square Error
  r2: number; // R-squared (coefficient of determination)
  coverage80: number; // Interval coverage at 80%
  coverage95: number; // Interval coverage at 95%
  horizon: number;
  dataPoints: number;
}

export interface AnomalyMetrics {
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  totalAnomalies: number;
  detectedAnomalies: number;
}

export interface BacktestResult {
  folds: number;
  forecastMetrics: ForecastMetrics[];
  averageMetrics: ForecastMetrics;
  anomalyMetrics?: AnomalyMetrics[];
  averageAnomalyMetrics?: AnomalyMetrics;
  executionTimeMs: number;
}

export interface BenchmarkDataset {
  name: string;
  series: TimeSeries;
  knownAnomalies: Array<{ index: number; timestamp: string }>;
  description: string;
}

// =============================================================================
// Forecast Evaluator
// =============================================================================

export class ForecastEvaluator {
  /**
   * Evaluate forecast accuracy against actual values
   */
  evaluate(
    predictions: Array<{ timestamp: string; value: number; intervals?: Record<string, { lower: number; upper: number }> }>,
    actuals: Array<{ timestamp: string; value: number }>
  ): ForecastMetrics {
    if (predictions.length === 0 || actuals.length === 0) {
      return this.emptyMetrics();
    }

    // Match predictions to actuals by timestamp
    const paired: Array<{ predicted: number; actual: number; intervals?: Record<string, { lower: number; upper: number }> }> = [];

    for (const pred of predictions) {
      const actual = actuals.find((a) => a.timestamp === pred.timestamp);
      if (actual) {
        paired.push({
          predicted: pred.value,
          actual: actual.value,
          intervals: pred.intervals,
        });
      }
    }

    if (paired.length === 0) {
      return this.emptyMetrics();
    }

    const n = paired.length;
    const errors = paired.map((p) => p.actual - p.predicted);
    const absErrors = errors.map(Math.abs);
    const sqErrors = errors.map((e) => e * e);

    // Calculate metrics
    const mae = absErrors.reduce((a, b) => a + b, 0) / n;
    const mse = sqErrors.reduce((a, b) => a + b, 0) / n;
    const rmse = Math.sqrt(mse);

    // MAPE (skip zeros to avoid division by zero)
    const mapeSum = paired.reduce((sum, p) => {
      if (Math.abs(p.actual) < 1e-10) return sum;
      return sum + Math.abs((p.actual - p.predicted) / p.actual);
    }, 0);
    const mape = (mapeSum / n) * 100;

    // SMAPE (symmetric)
    const smapeSum = paired.reduce((sum, p) => {
      const denom = Math.abs(p.actual) + Math.abs(p.predicted);
      if (denom < 1e-10) return sum;
      return sum + (2 * Math.abs(p.actual - p.predicted)) / denom;
    }, 0);
    const smape = (smapeSum / n) * 100;

    // R-squared
    const actualMean = paired.reduce((s, p) => s + p.actual, 0) / n;
    const ssTotal = paired.reduce((s, p) => s + Math.pow(p.actual - actualMean, 2), 0);
    const ssResidual = sqErrors.reduce((a, b) => a + b, 0);
    const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    // Interval coverage
    let coverage80 = 0;
    let coverage95 = 0;
    let intervalCount = 0;

    for (const p of paired) {
      if (p.intervals) {
        intervalCount++;
        const int80 = p.intervals['0.8'] || p.intervals['0.80'];
        const int95 = p.intervals['0.95'];

        if (int80 && p.actual >= int80.lower && p.actual <= int80.upper) {
          coverage80++;
        }
        if (int95 && p.actual >= int95.lower && p.actual <= int95.upper) {
          coverage95++;
        }
      }
    }

    return {
      mae,
      mape,
      rmse,
      smape,
      mse,
      r2,
      coverage80: intervalCount > 0 ? coverage80 / intervalCount : 0,
      coverage95: intervalCount > 0 ? coverage95 / intervalCount : 0,
      horizon: predictions.length,
      dataPoints: n,
    };
  }

  private emptyMetrics(): ForecastMetrics {
    return {
      mae: Infinity,
      mape: Infinity,
      rmse: Infinity,
      smape: Infinity,
      mse: Infinity,
      r2: 0,
      coverage80: 0,
      coverage95: 0,
      horizon: 0,
      dataPoints: 0,
    };
  }
}

// =============================================================================
// Anomaly Evaluator
// =============================================================================

export class AnomalyEvaluator {
  /**
   * Evaluate anomaly detection accuracy against known labels
   */
  evaluate(
    detectedAnomalies: Anomaly[],
    knownAnomalyIndices: number[],
    totalPoints: number
  ): AnomalyMetrics {
    const detected = new Set(
      detectedAnomalies.map((a) => {
        // Try to extract index from anomaly_id if available
        const match = a.anomaly_id.match(/-(\d+)$/);
        return match ? parseInt(match[1], 10) - 1 : -1;
      })
    );

    const known = new Set(knownAnomalyIndices);

    let tp = 0; // True positives
    let fp = 0; // False positives
    let fn = 0; // False negatives
    let tn = 0; // True negatives

    for (let i = 0; i < totalPoints; i++) {
      const isKnown = known.has(i);
      const isDetected = detected.has(i);

      if (isKnown && isDetected) tp++;
      else if (!isKnown && isDetected) fp++;
      else if (isKnown && !isDetected) fn++;
      else tn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const accuracy = totalPoints > 0 ? (tp + tn) / totalPoints : 0;

    return {
      precision,
      recall,
      f1,
      accuracy,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      totalAnomalies: known.size,
      detectedAnomalies: detected.size,
    };
  }

  /**
   * Evaluate using timestamp-based matching (with tolerance window)
   */
  evaluateByTimestamp(
    detectedAnomalies: Anomaly[],
    knownAnomalies: Array<{ timestamp: string }>,
    allTimestamps: string[],
    tolerancePoints: number = 1
  ): AnomalyMetrics {
    const detected = new Set(detectedAnomalies.map((a) => a.timestamp));
    const totalPoints = allTimestamps.length;

    let tp = 0;
    let fp = 0;
    let matchedKnown = new Set<string>();

    // Check each detected anomaly
    for (const detectedTs of detected) {
      const detectedIdx = allTimestamps.indexOf(detectedTs);
      let matched = false;

      // Check if any known anomaly is within tolerance
      for (const known of knownAnomalies) {
        const knownIdx = allTimestamps.indexOf(known.timestamp);
        if (Math.abs(detectedIdx - knownIdx) <= tolerancePoints) {
          matched = true;
          matchedKnown.add(known.timestamp);
          break;
        }
      }

      if (matched) tp++;
      else fp++;
    }

    const fn = knownAnomalies.length - matchedKnown.size;
    const tn = totalPoints - tp - fp - fn;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const accuracy = totalPoints > 0 ? (tp + tn) / totalPoints : 0;

    return {
      precision,
      recall,
      f1,
      accuracy,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      totalAnomalies: knownAnomalies.length,
      detectedAnomalies: detected.size,
    };
  }
}

// =============================================================================
// Backtester
// =============================================================================

export class Backtester {
  private forecastEvaluator = new ForecastEvaluator();
  private anomalyEvaluator = new AnomalyEvaluator();

  /**
   * Walk-forward cross-validation for forecast models
   */
  async backtestForecast(
    series: TimeSeries,
    backend: ForecastBackend,
    options: {
      folds?: number;
      horizon?: number;
      minTrainSize?: number;
    } = {}
  ): Promise<BacktestResult> {
    const startTime = Date.now();
    const { folds = 5, horizon = 6, minTrainSize = 20 } = options;
    const dataPoints = series.data_points;
    const n = dataPoints.length;

    if (n < minTrainSize + horizon) {
      throw new Error(`Insufficient data for backtesting (need ${minTrainSize + horizon}, have ${n})`);
    }

    const foldSize = Math.floor((n - minTrainSize - horizon) / folds);
    const metrics: ForecastMetrics[] = [];

    for (let fold = 0; fold < folds; fold++) {
      const trainEnd = minTrainSize + fold * foldSize;
      const testEnd = Math.min(trainEnd + horizon, n);

      // Create training series
      const trainSeries: TimeSeries = {
        ...series,
        data_points: dataPoints.slice(0, trainEnd),
      };

      // Get actual values for test period
      const actualValues = dataPoints.slice(trainEnd, testEnd);

      // Generate forecast
      const request: ForecastRequest = {
        request_id: `backtest-${fold}`,
        org_id: series.org_id,
        series: trainSeries,
        horizon: actualValues.length,
        frequency: series.metadata.resolution || '5m',
        options: {
          confidence_levels: [0.8, 0.95],
        },
      };

      const response = await backend.forecast(request);

      if (response.success && response.forecast) {
        const foldMetrics = this.forecastEvaluator.evaluate(
          response.forecast.predictions,
          actualValues
        );
        metrics.push(foldMetrics);
      }
    }

    // Calculate average metrics
    const averageMetrics = this.averageForecastMetrics(metrics);

    return {
      folds: metrics.length,
      forecastMetrics: metrics,
      averageMetrics,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Evaluate anomaly detector on labeled dataset
   */
  async backtestAnomaly(
    series: TimeSeries,
    detector: AnomalyDetector,
    knownAnomalies: Array<{ index: number; timestamp: string }>,
    options: {
      sensitivity?: number;
      threshold?: number;
    } = {}
  ): Promise<AnomalyMetrics> {
    const request: AnomalyDetectionRequest = {
      request_id: `anomaly-eval-${uuidv4()}`,
      org_id: series.org_id,
      series,
      options: {
        sensitivity: options.sensitivity ?? 0.5,
        threshold: options.threshold ?? 0.7,
        include_context: false,
      },
    };

    const response = await detector.detect(request);

    if (!response.success) {
      throw new Error(`Anomaly detection failed: ${response.error}`);
    }

    return this.anomalyEvaluator.evaluateByTimestamp(
      response.anomalies,
      knownAnomalies,
      series.data_points.map((p) => p.timestamp),
      1
    );
  }

  private averageForecastMetrics(metrics: ForecastMetrics[]): ForecastMetrics {
    if (metrics.length === 0) {
      return {
        mae: 0,
        mape: 0,
        rmse: 0,
        smape: 0,
        mse: 0,
        r2: 0,
        coverage80: 0,
        coverage95: 0,
        horizon: 0,
        dataPoints: 0,
      };
    }

    const n = metrics.length;
    return {
      mae: metrics.reduce((s, m) => s + m.mae, 0) / n,
      mape: metrics.reduce((s, m) => s + m.mape, 0) / n,
      rmse: metrics.reduce((s, m) => s + m.rmse, 0) / n,
      smape: metrics.reduce((s, m) => s + m.smape, 0) / n,
      mse: metrics.reduce((s, m) => s + m.mse, 0) / n,
      r2: metrics.reduce((s, m) => s + m.r2, 0) / n,
      coverage80: metrics.reduce((s, m) => s + m.coverage80, 0) / n,
      coverage95: metrics.reduce((s, m) => s + m.coverage95, 0) / n,
      horizon: Math.round(metrics.reduce((s, m) => s + m.horizon, 0) / n),
      dataPoints: Math.round(metrics.reduce((s, m) => s + m.dataPoints, 0) / n),
    };
  }
}

// =============================================================================
// Benchmark Data Generator
// =============================================================================

export class BenchmarkGenerator {
  /**
   * Generate synthetic time series with known characteristics
   */
  generateForecastBenchmark(options: {
    name?: string;
    points?: number;
    trend?: number;
    seasonalPeriod?: number;
    seasonalAmplitude?: number;
    noiseLevel?: number;
  } = {}): BenchmarkDataset {
    const {
      name = 'forecast-benchmark',
      points = 100,
      trend = 0.1,
      seasonalPeriod = 24,
      seasonalAmplitude = 10,
      noiseLevel = 5,
    } = options;

    const baseTime = Date.now() - points * 60 * 60 * 1000; // 1 hour intervals
    const dataPoints: Array<{ timestamp: string; value: number }> = [];

    for (let i = 0; i < points; i++) {
      const trendComponent = trend * i;
      const seasonalComponent = seasonalAmplitude * Math.sin((2 * Math.PI * i) / seasonalPeriod);
      const noise = (Math.random() - 0.5) * 2 * noiseLevel;

      const value = 50 + trendComponent + seasonalComponent + noise;

      dataPoints.push({
        timestamp: new Date(baseTime + i * 60 * 60 * 1000).toISOString(),
        value: Math.max(0, value),
      });
    }

    return {
      name,
      series: {
        series_id: `benchmark-${name}`,
        org_id: 'benchmark-org',
        metric_key: 'benchmark.metric',
        dimensions: {},
        data_points: dataPoints,
        metadata: {
          resolution: '1h',
          aggregation: 'avg',
        },
      },
      knownAnomalies: [],
      description: `Forecast benchmark: trend=${trend}, seasonal_period=${seasonalPeriod}, noise=${noiseLevel}`,
    };
  }

  /**
   * Generate time series with known anomalies
   */
  generateAnomalyBenchmark(options: {
    name?: string;
    points?: number;
    anomalyRate?: number;
    anomalyMagnitude?: number;
  } = {}): BenchmarkDataset {
    const {
      name = 'anomaly-benchmark',
      points = 200,
      anomalyRate = 0.05,
      anomalyMagnitude = 3,
    } = options;

    const baseTime = Date.now() - points * 5 * 60 * 1000; // 5 minute intervals
    const dataPoints: Array<{ timestamp: string; value: number }> = [];
    const knownAnomalies: Array<{ index: number; timestamp: string }> = [];

    // Generate base values
    let level = 50;
    const baseNoise = 5;

    for (let i = 0; i < points; i++) {
      // Small random walk
      level += (Math.random() - 0.5) * 0.5;

      let value = level + (Math.random() - 0.5) * 2 * baseNoise;

      // Inject anomalies
      if (Math.random() < anomalyRate) {
        const direction = Math.random() > 0.5 ? 1 : -1;
        value += direction * anomalyMagnitude * baseNoise;

        const timestamp = new Date(baseTime + i * 5 * 60 * 1000).toISOString();
        knownAnomalies.push({ index: i, timestamp });
      }

      dataPoints.push({
        timestamp: new Date(baseTime + i * 5 * 60 * 1000).toISOString(),
        value: Math.max(0, value),
      });
    }

    return {
      name,
      series: {
        series_id: `benchmark-${name}`,
        org_id: 'benchmark-org',
        metric_key: 'benchmark.metric',
        dimensions: {},
        data_points: dataPoints,
        metadata: {
          resolution: '5m',
          aggregation: 'avg',
        },
      },
      knownAnomalies,
      description: `Anomaly benchmark: ${knownAnomalies.length} anomalies (${(anomalyRate * 100).toFixed(1)}% rate), magnitude=${anomalyMagnitude}x noise`,
    };
  }

  /**
   * Generate dataset with level shift anomaly
   */
  generateLevelShiftBenchmark(): BenchmarkDataset {
    const points = 100;
    const baseTime = Date.now() - points * 60 * 60 * 1000;
    const dataPoints: Array<{ timestamp: string; value: number }> = [];
    const knownAnomalies: Array<{ index: number; timestamp: string }> = [];

    const shiftPoint = 50;

    for (let i = 0; i < points; i++) {
      const baseLevel = i < shiftPoint ? 50 : 80; // Level shift at midpoint
      const noise = (Math.random() - 0.5) * 10;
      const value = baseLevel + noise;

      const timestamp = new Date(baseTime + i * 60 * 60 * 1000).toISOString();
      dataPoints.push({ timestamp, value });

      // Mark the shift point as anomaly
      if (i === shiftPoint) {
        knownAnomalies.push({ index: i, timestamp });
      }
    }

    return {
      name: 'level-shift',
      series: {
        series_id: 'benchmark-level-shift',
        org_id: 'benchmark-org',
        metric_key: 'benchmark.level_shift',
        dimensions: {},
        data_points: dataPoints,
        metadata: {
          resolution: '1h',
          aggregation: 'avg',
        },
      },
      knownAnomalies,
      description: 'Level shift benchmark: sudden change from 50 to 80 at midpoint',
    };
  }
}

