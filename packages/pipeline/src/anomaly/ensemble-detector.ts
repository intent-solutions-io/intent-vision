/**
 * Ensemble Anomaly Detector
 *
 * Task ID: intentvision-8fa.2
 *
 * Production-ready anomaly detector combining multiple methods:
 * - Statistical (Z-score, IQR)
 * - Isolation-based (simplified isolation forest concept)
 * - Forecast-based (deviation from expected)
 *
 * Uses voting/averaging to reduce false positives while maintaining sensitivity.
 */

import type {
  AnomalyDetectionRequest,
  AnomalyDetectionResponse,
  AnomalyDetector,
  AnomalyDetectionMethod,
  Anomaly,
  AnomalySeverity,
  AnomalyType,
  AnomalyContext,
} from '../../../contracts/src/index.js';

// =============================================================================
// Types
// =============================================================================

interface DetectionScore {
  index: number;
  timestamp: string;
  value: number;
  statisticalScore: number;
  isolationScore: number;
  forecastScore: number;
  ensembleScore: number;
}

interface StatisticalContext {
  mean: number;
  stdDev: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  min: number;
  max: number;
}

// =============================================================================
// Ensemble Anomaly Detector
// =============================================================================

export class EnsembleAnomalyDetector implements AnomalyDetector {
  readonly method: AnomalyDetectionMethod = 'ensemble';

  private readonly weights = {
    statistical: 0.4,
    isolation: 0.3,
    forecast: 0.3,
  };

  async detect(request: AnomalyDetectionRequest): Promise<AnomalyDetectionResponse> {
    const startTime = Date.now();

    try {
      const { series, options } = request;
      const dataPoints = series.data_points;

      if (dataPoints.length < 5) {
        return this.createEmptyResponse(request, startTime, 'Insufficient data (minimum 5 points)');
      }

      const sensitivity = options?.sensitivity ?? 0.5;
      const threshold = options?.threshold ?? 0.7;
      const includeContext = options?.include_context ?? true;
      const contextWindow = options?.context_window ?? 5;

      // Calculate scores for each detection method
      const values = dataPoints.map((p) => p.value);
      const stats = this.calculateStatistics(values);

      const scores = this.calculateEnsembleScores(dataPoints, stats);

      // Apply threshold and convert to anomalies
      const anomalies = this.scoresToAnomalies(
        scores,
        request.request_id,
        stats,
        sensitivity,
        threshold,
        includeContext,
        contextWindow,
        dataPoints
      );

      return {
        request_id: request.request_id,
        success: true,
        anomalies,
        metadata: {
          detected_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          input_points: dataPoints.length,
          anomaly_count: anomalies.length,
          method: this.method,
          sensitivity,
        },
      };
    } catch (error) {
      return {
        request_id: request.request_id,
        success: false,
        error: (error as Error).message,
        anomalies: [],
        metadata: {
          detected_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          input_points: request.series.data_points.length,
          anomaly_count: 0,
          method: this.method,
          sensitivity: request.options?.sensitivity ?? 0.5,
        },
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  // ==========================================================================
  // Statistical Detection
  // ==========================================================================

  private calculateStatistics(values: number[]): StatisticalContext {
    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;

    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const median = this.percentile(sorted, 0.5);
    const q1 = this.percentile(sorted, 0.25);
    const q3 = this.percentile(sorted, 0.75);
    const iqr = q3 - q1;

    return {
      mean,
      stdDev,
      median,
      q1,
      q3,
      iqr,
      min: sorted[0],
      max: sorted[n - 1],
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private calculateStatisticalScore(value: number, stats: StatisticalContext): number {
    // Z-score component
    const zScore = stats.stdDev > 0 ? Math.abs((value - stats.mean) / stats.stdDev) : 0;
    const zScoreNormalized = Math.min(1, zScore / 4);

    // IQR component (Tukey method)
    const lowerFence = stats.q1 - 1.5 * stats.iqr;
    const upperFence = stats.q3 + 1.5 * stats.iqr;

    let iqrScore = 0;
    if (value < lowerFence) {
      iqrScore = Math.min(1, Math.abs(value - lowerFence) / stats.iqr);
    } else if (value > upperFence) {
      iqrScore = Math.min(1, Math.abs(value - upperFence) / stats.iqr);
    }

    // Combined statistical score
    return Math.max(zScoreNormalized, iqrScore);
  }

  // ==========================================================================
  // Isolation-based Detection
  // ==========================================================================

  private calculateIsolationScore(
    index: number,
    values: number[],
    stats: StatisticalContext
  ): number {
    // Simplified isolation forest concept:
    // Points that are isolated from neighbors are more anomalous
    const value = values[index];
    const windowSize = Math.min(10, Math.floor(values.length / 2));

    // Local neighborhood
    const start = Math.max(0, index - windowSize);
    const end = Math.min(values.length, index + windowSize + 1);
    const neighbors = values.slice(start, end).filter((_, i) => start + i !== index);

    if (neighbors.length === 0) return 0;

    // Calculate distances to neighbors
    const distances = neighbors.map((n) => Math.abs(value - n));
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const minDistance = Math.min(...distances);

    // Normalize by the overall data range
    const range = stats.max - stats.min;
    if (range === 0) return 0;

    // Higher score if far from neighbors
    const isolationScore = Math.min(1, avgDistance / range);

    // Boost if even minimum distance is large
    const minDistanceScore = Math.min(1, minDistance / (range * 0.1));

    return Math.max(isolationScore, minDistanceScore * 0.8);
  }

  // ==========================================================================
  // Forecast-based Detection
  // ==========================================================================

  private calculateForecastScore(
    index: number,
    values: number[],
    stats: StatisticalContext
  ): number {
    // Simple local forecast: expected value based on recent trend
    if (index < 2) return 0;

    // Calculate local trend from previous points
    const lookback = Math.min(5, index);
    const recent = values.slice(index - lookback, index);

    // Simple exponential smoothing prediction
    const alpha = 0.3;
    let level = recent[0];
    for (let i = 1; i < recent.length; i++) {
      level = alpha * recent[i] + (1 - alpha) * level;
    }

    // Calculate trend
    const trend =
      recent.length >= 2
        ? (recent[recent.length - 1] - recent[0]) / (recent.length - 1)
        : 0;

    const expected = level + trend;
    const actual = values[index];
    const error = Math.abs(actual - expected);

    // Normalize by local variation
    const localStd =
      recent.length > 1
        ? Math.sqrt(
            recent.reduce((sum, v) => sum + Math.pow(v - level, 2), 0) /
              (recent.length - 1)
          )
        : stats.stdDev;

    if (localStd === 0) return 0;

    const forecastDeviation = error / localStd;
    return Math.min(1, forecastDeviation / 3);
  }

  // ==========================================================================
  // Ensemble Scoring
  // ==========================================================================

  private calculateEnsembleScores(
    dataPoints: Array<{ timestamp: string; value: number }>,
    stats: StatisticalContext
  ): DetectionScore[] {
    const values = dataPoints.map((p) => p.value);
    const scores: DetectionScore[] = [];

    for (let i = 0; i < dataPoints.length; i++) {
      const statistical = this.calculateStatisticalScore(values[i], stats);
      const isolation = this.calculateIsolationScore(i, values, stats);
      const forecast = this.calculateForecastScore(i, values, stats);

      // Weighted ensemble score
      const ensemble =
        this.weights.statistical * statistical +
        this.weights.isolation * isolation +
        this.weights.forecast * forecast;

      scores.push({
        index: i,
        timestamp: dataPoints[i].timestamp,
        value: values[i],
        statisticalScore: statistical,
        isolationScore: isolation,
        forecastScore: forecast,
        ensembleScore: ensemble,
      });
    }

    return scores;
  }

  // ==========================================================================
  // Anomaly Generation
  // ==========================================================================

  private scoresToAnomalies(
    scores: DetectionScore[],
    requestId: string,
    stats: StatisticalContext,
    sensitivity: number,
    baseThreshold: number,
    includeContext: boolean,
    contextWindow: number,
    dataPoints: Array<{ timestamp: string; value: number }>
  ): Anomaly[] {
    // Adjust threshold based on sensitivity
    // Higher sensitivity = lower threshold = more anomalies
    const threshold = baseThreshold - (sensitivity - 0.5) * 0.3;

    const anomalies: Anomaly[] = [];
    let anomalyCounter = 0;

    for (const score of scores) {
      if (score.ensembleScore >= threshold) {
        anomalyCounter++;

        const anomaly: Anomaly = {
          anomaly_id: `anom-${requestId}-${anomalyCounter}`,
          timestamp: score.timestamp,
          observed_value: score.value,
          expected_value: stats.mean,
          score: score.ensembleScore,
          type: this.classifyAnomalyType(score, scores, stats),
          severity: this.calculateSeverity(score.ensembleScore),
          description: this.generateDescription(score, stats),
        };

        if (includeContext) {
          anomaly.context = this.buildContext(score.index, dataPoints, contextWindow, stats);
        }

        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  private classifyAnomalyType(
    score: DetectionScore,
    allScores: DetectionScore[],
    stats: StatisticalContext
  ): AnomalyType {
    const idx = score.index;

    // Check for level shift (sustained change in level)
    if (idx >= 5 && idx < allScores.length - 2) {
      const beforeAvg =
        allScores.slice(Math.max(0, idx - 5), idx).reduce((s, sc) => s + sc.value, 0) / 5;
      const afterAvg =
        allScores.slice(idx, Math.min(allScores.length, idx + 3)).reduce((s, sc) => s + sc.value, 0) /
        3;

      const levelChange = Math.abs(afterAvg - beforeAvg) / stats.stdDev;
      if (levelChange > 2) {
        return 'level_shift';
      }
    }

    // Check for trend change
    if (idx >= 3 && idx < allScores.length - 3) {
      const beforeTrend = allScores[idx - 1].value - allScores[idx - 3].value;
      const afterTrend = allScores[idx + 2].value - allScores[idx].value;

      if (Math.sign(beforeTrend) !== Math.sign(afterTrend) && Math.abs(beforeTrend) > stats.stdDev) {
        return 'trend_change';
      }
    }

    // Check for collective anomaly (multiple consecutive anomalies)
    const nearbyHighScores = allScores
      .slice(Math.max(0, idx - 2), Math.min(allScores.length, idx + 3))
      .filter((s) => s.ensembleScore > 0.5).length;

    if (nearbyHighScores >= 3) {
      return 'collective';
    }

    // Default to point anomaly
    return 'point';
  }

  private calculateSeverity(score: number): AnomalySeverity {
    if (score >= 0.95) return 'critical';
    if (score >= 0.85) return 'high';
    if (score >= 0.75) return 'medium';
    return 'low';
  }

  private generateDescription(score: DetectionScore, stats: StatisticalContext): string {
    const deviation = score.value - stats.mean;
    const zScore = Math.abs(deviation) / stats.stdDev;
    const direction = deviation > 0 ? 'above' : 'below';

    const methodContributions: string[] = [];
    if (score.statisticalScore > 0.5) {
      methodContributions.push('statistical outlier');
    }
    if (score.isolationScore > 0.5) {
      methodContributions.push('isolated point');
    }
    if (score.forecastScore > 0.5) {
      methodContributions.push('forecast deviation');
    }

    const methods =
      methodContributions.length > 0 ? ` Detected as: ${methodContributions.join(', ')}.` : '';

    return `Value ${score.value.toFixed(2)} is ${zScore.toFixed(1)} std devs ${direction} mean (${stats.mean.toFixed(2)}).${methods}`;
  }

  private buildContext(
    index: number,
    dataPoints: Array<{ timestamp: string; value: number }>,
    windowSize: number,
    stats: StatisticalContext
  ): AnomalyContext {
    return {
      before: dataPoints
        .slice(Math.max(0, index - windowSize), index)
        .map((p) => ({ timestamp: p.timestamp, value: p.value })),
      after: dataPoints
        .slice(index + 1, Math.min(dataPoints.length, index + 1 + windowSize))
        .map((p) => ({ timestamp: p.timestamp, value: p.value })),
      statistics: {
        mean: stats.mean,
        std_dev: stats.stdDev,
        min: stats.min,
        max: stats.max,
      },
    };
  }

  private createEmptyResponse(
    request: AnomalyDetectionRequest,
    startTime: number,
    error?: string
  ): AnomalyDetectionResponse {
    return {
      request_id: request.request_id,
      success: !error,
      error,
      anomalies: [],
      metadata: {
        detected_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        input_points: request.series.data_points.length,
        anomaly_count: 0,
        method: this.method,
        sensitivity: request.options?.sensitivity ?? 0.5,
      },
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createEnsembleAnomalyDetector(): AnomalyDetector {
  return new EnsembleAnomalyDetector();
}
