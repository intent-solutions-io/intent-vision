/**
 * Anomaly Detection Stub - Simple statistical anomaly detector
 *
 * Task ID: intentvision-kgx
 *
 * This is a stub implementation that:
 * 1. Uses Z-score based detection
 * 2. Demonstrates the anomaly detection interface
 * 3. Will be enhanced with ML models in production
 */

import type {
  AnomalyDetectionRequest,
  AnomalyDetectionResponse,
  AnomalyDetector,
  AnomalyDetectionMethod,
  Anomaly,
  AnomalySeverity,
} from '../../../contracts/src/index.js';

// =============================================================================
// Stub Anomaly Detector
// =============================================================================

export class StubAnomalyDetector implements AnomalyDetector {
  readonly method: AnomalyDetectionMethod = 'statistical';

  async detect(request: AnomalyDetectionRequest): Promise<AnomalyDetectionResponse> {
    const startTime = Date.now();

    try {
      const anomalies = this.detectAnomalies(request);

      return {
        request_id: request.request_id,
        success: true,
        anomalies,
        metadata: {
          detected_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          input_points: request.series.data_points.length,
          anomaly_count: anomalies.length,
          method: this.method,
          sensitivity: request.options?.sensitivity || 0.5,
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
          sensitivity: request.options?.sensitivity || 0.5,
        },
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  // ==========================================================================
  // Internal Methods
  // ==========================================================================

  private detectAnomalies(request: AnomalyDetectionRequest): Anomaly[] {
    const { series, options } = request;
    const dataPoints = series.data_points;

    if (dataPoints.length < 3) {
      return []; // Not enough data for anomaly detection
    }

    const sensitivity = options?.sensitivity || 0.5;
    const threshold = options?.threshold || 0.7;
    const includeContext = options?.include_context ?? true;
    const contextWindow = options?.context_window || 3;

    // Calculate statistics
    const values = dataPoints.map((p) => p.value);
    const { mean, stdDev, min, max } = this.calculateStats(values);

    // Avoid division by zero
    if (stdDev === 0) {
      return [];
    }

    // Adjust Z-score threshold based on sensitivity
    // Higher sensitivity = lower threshold = more anomalies
    const zThreshold = 3 - sensitivity * 2; // Range: 1 to 3

    const anomalies: Anomaly[] = [];
    let anomalyCounter = 0;

    dataPoints.forEach((point, index) => {
      const zScore = Math.abs((point.value - mean) / stdDev);
      const anomalyScore = Math.min(1, zScore / 4); // Normalize to 0-1

      if (anomalyScore >= threshold && zScore >= zThreshold) {
        anomalyCounter++;

        const anomaly: Anomaly = {
          anomaly_id: `anom-${request.request_id}-${anomalyCounter}`,
          timestamp: point.timestamp,
          observed_value: point.value,
          expected_value: mean,
          score: anomalyScore,
          type: this.classifyAnomalyType(point.value, mean, stdDev, index, dataPoints),
          severity: this.calculateSeverity(anomalyScore),
          description: this.generateDescription(point.value, mean, stdDev),
        };

        // Add context if requested
        if (includeContext) {
          anomaly.context = {
            before: dataPoints
              .slice(Math.max(0, index - contextWindow), index)
              .map((p) => ({ timestamp: p.timestamp, value: p.value })),
            after: dataPoints
              .slice(index + 1, index + 1 + contextWindow)
              .map((p) => ({ timestamp: p.timestamp, value: p.value })),
            statistics: { mean, std_dev: stdDev, min, max },
          };
        }

        anomalies.push(anomaly);
      }
    });

    return anomalies;
  }

  private calculateStats(values: number[]): {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  } {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { mean, stdDev, min, max };
  }

  private classifyAnomalyType(
    value: number,
    mean: number,
    stdDev: number,
    index: number,
    dataPoints: Array<{ timestamp: string; value: number }>
  ): Anomaly['type'] {
    // Simple classification based on context
    const zScore = (value - mean) / stdDev;

    // Check for level shift (sustained change)
    if (index > 5) {
      const recentValues = dataPoints.slice(Math.max(0, index - 5), index);
      const recentMean =
        recentValues.reduce((a, p) => a + p.value, 0) / recentValues.length;
      const recentZScore = (recentMean - mean) / stdDev;

      if (Math.abs(recentZScore) > 1.5) {
        return 'level_shift';
      }
    }

    // Check for trend change
    if (index > 2 && index < dataPoints.length - 2) {
      const before = dataPoints.slice(Math.max(0, index - 3), index);
      const after = dataPoints.slice(index + 1, index + 4);

      if (before.length >= 2 && after.length >= 2) {
        const beforeTrend = before[before.length - 1].value - before[0].value;
        const afterTrend = after[after.length - 1].value - after[0].value;

        if (Math.sign(beforeTrend) !== Math.sign(afterTrend)) {
          return 'trend_change';
        }
      }
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

  private generateDescription(
    observed: number,
    expected: number,
    stdDev: number
  ): string {
    const deviation = observed - expected;
    const zScore = deviation / stdDev;
    const direction = deviation > 0 ? 'above' : 'below';
    const absZScore = Math.abs(zScore).toFixed(1);

    return `Value ${observed.toFixed(2)} is ${absZScore} standard deviations ${direction} expected ${expected.toFixed(2)}`;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a stub anomaly detector instance
 */
export function createStubAnomalyDetector(): AnomalyDetector {
  return new StubAnomalyDetector();
}
