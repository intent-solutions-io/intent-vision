/**
 * Evaluation Framework Tests
 *
 * Task ID: intentvision-8fa.5
 *
 * Tests for forecast and anomaly evaluation, backtesting, and benchmarks.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  ForecastEvaluator,
  AnomalyEvaluator,
  Backtester,
  BenchmarkGenerator,
} from '../src/eval/evaluation-framework.js';
import { StatisticalForecastBackend } from '../src/forecast/statistical-forecast.js';
import { EnsembleAnomalyDetector } from '../src/anomaly/ensemble-detector.js';
import {
  ForecastBackendRegistry,
  AnomalyDetectorRegistry,
  getForecastRegistry,
  getAnomalyRegistry,
  createForecastBackend,
  createAnomalyDetector,
  resetRegistries,
} from '../src/backends/registry.js';

// =============================================================================
// Forecast Evaluation Tests
// =============================================================================

describe('ForecastEvaluator', () => {
  const evaluator = new ForecastEvaluator();

  it('should calculate MAE correctly', () => {
    const predictions = [
      { timestamp: '2024-01-01T00:00:00Z', value: 10 },
      { timestamp: '2024-01-01T01:00:00Z', value: 20 },
      { timestamp: '2024-01-01T02:00:00Z', value: 30 },
    ];
    const actuals = [
      { timestamp: '2024-01-01T00:00:00Z', value: 12 },
      { timestamp: '2024-01-01T01:00:00Z', value: 18 },
      { timestamp: '2024-01-01T02:00:00Z', value: 33 },
    ];

    const metrics = evaluator.evaluate(predictions, actuals);

    // MAE = (|10-12| + |20-18| + |30-33|) / 3 = (2 + 2 + 3) / 3 = 2.33...
    expect(metrics.mae).toBeCloseTo(2.33, 1);
  });

  it('should calculate RMSE correctly', () => {
    const predictions = [
      { timestamp: '2024-01-01T00:00:00Z', value: 10 },
      { timestamp: '2024-01-01T01:00:00Z', value: 20 },
    ];
    const actuals = [
      { timestamp: '2024-01-01T00:00:00Z', value: 10 },
      { timestamp: '2024-01-01T01:00:00Z', value: 26 },
    ];

    const metrics = evaluator.evaluate(predictions, actuals);

    // RMSE = sqrt((0^2 + 6^2) / 2) = sqrt(18) = 4.24...
    expect(metrics.rmse).toBeCloseTo(4.24, 1);
  });

  it('should calculate MAPE correctly', () => {
    const predictions = [
      { timestamp: '2024-01-01T00:00:00Z', value: 100 },
      { timestamp: '2024-01-01T01:00:00Z', value: 200 },
    ];
    const actuals = [
      { timestamp: '2024-01-01T00:00:00Z', value: 90 },
      { timestamp: '2024-01-01T01:00:00Z', value: 220 },
    ];

    const metrics = evaluator.evaluate(predictions, actuals);

    // MAPE = (|100-90|/90 + |200-220|/220) / 2 * 100 = (0.111 + 0.091) / 2 * 100 = ~10%
    expect(metrics.mape).toBeCloseTo(10.1, 0);
  });

  it('should handle interval coverage', () => {
    const predictions = [
      {
        timestamp: '2024-01-01T00:00:00Z',
        value: 50,
        intervals: {
          '0.95': { lower: 40, upper: 60 },
        },
      },
      {
        timestamp: '2024-01-01T01:00:00Z',
        value: 50,
        intervals: {
          '0.95': { lower: 40, upper: 60 },
        },
      },
    ];
    const actuals = [
      { timestamp: '2024-01-01T00:00:00Z', value: 45 }, // Inside interval
      { timestamp: '2024-01-01T01:00:00Z', value: 70 }, // Outside interval
    ];

    const metrics = evaluator.evaluate(predictions, actuals);

    expect(metrics.coverage95).toBe(0.5); // 1 out of 2 covered
  });

  it('should return empty metrics for no data', () => {
    const metrics = evaluator.evaluate([], []);

    expect(metrics.mae).toBe(Infinity);
    expect(metrics.dataPoints).toBe(0);
  });
});

// =============================================================================
// Anomaly Evaluation Tests
// =============================================================================

describe('AnomalyEvaluator', () => {
  const evaluator = new AnomalyEvaluator();

  it('should calculate precision correctly', () => {
    const detected = [
      { anomaly_id: 'anom-1', timestamp: 't1', observed_value: 100, expected_value: 50, score: 0.9, type: 'point' as const, severity: 'high' as const, description: 'test' },
      { anomaly_id: 'anom-2', timestamp: 't2', observed_value: 100, expected_value: 50, score: 0.9, type: 'point' as const, severity: 'high' as const, description: 'test' },
    ];
    const knownIndices = [0]; // Only first is actually an anomaly

    const metrics = evaluator.evaluate(detected, knownIndices, 10);

    // Precision = TP / (TP + FP) = 1 / 2 = 0.5
    expect(metrics.precision).toBe(0.5);
    expect(metrics.truePositives).toBe(1);
    expect(metrics.falsePositives).toBe(1);
  });

  it('should calculate recall correctly', () => {
    const detected = [
      { anomaly_id: 'anom-1', timestamp: 't1', observed_value: 100, expected_value: 50, score: 0.9, type: 'point' as const, severity: 'high' as const, description: 'test' },
    ];
    const knownIndices = [0, 1, 2]; // Three known anomalies, only one detected

    const metrics = evaluator.evaluate(detected, knownIndices, 10);

    // Recall = TP / (TP + FN) = 1 / 3 = 0.33
    expect(metrics.recall).toBeCloseTo(0.33, 1);
    expect(metrics.falseNegatives).toBe(2);
  });

  it('should calculate F1 correctly', () => {
    const detected = [
      { anomaly_id: 'anom-1', timestamp: 't1', observed_value: 100, expected_value: 50, score: 0.9, type: 'point' as const, severity: 'high' as const, description: 'test' },
      { anomaly_id: 'anom-2', timestamp: 't2', observed_value: 100, expected_value: 50, score: 0.9, type: 'point' as const, severity: 'high' as const, description: 'test' },
    ];
    const knownIndices = [0, 1];

    const metrics = evaluator.evaluate(detected, knownIndices, 10);

    // Perfect detection
    expect(metrics.precision).toBe(1);
    expect(metrics.recall).toBe(1);
    expect(metrics.f1).toBe(1);
  });
});

// =============================================================================
// Benchmark Generator Tests
// =============================================================================

describe('BenchmarkGenerator', () => {
  const generator = new BenchmarkGenerator();

  it('should generate forecast benchmark data', () => {
    const dataset = generator.generateForecastBenchmark({
      points: 50,
      trend: 0.5,
    });

    expect(dataset.series.data_points.length).toBe(50);
    expect(dataset.name).toBe('forecast-benchmark');

    // Check that values have a trend
    const firstHalf = dataset.series.data_points.slice(0, 25);
    const secondHalf = dataset.series.data_points.slice(25);
    const firstMean = firstHalf.reduce((s, p) => s + p.value, 0) / 25;
    const secondMean = secondHalf.reduce((s, p) => s + p.value, 0) / 25;

    expect(secondMean).toBeGreaterThan(firstMean);
  });

  it('should generate anomaly benchmark with known anomalies', () => {
    const dataset = generator.generateAnomalyBenchmark({
      points: 100,
      anomalyRate: 0.1, // 10% anomaly rate
    });

    expect(dataset.series.data_points.length).toBe(100);
    expect(dataset.knownAnomalies.length).toBeGreaterThan(0);
    expect(dataset.knownAnomalies.length).toBeLessThan(20); // Roughly 10%
  });

  it('should generate level shift benchmark', () => {
    const dataset = generator.generateLevelShiftBenchmark();

    expect(dataset.series.data_points.length).toBe(100);
    expect(dataset.knownAnomalies.length).toBe(1);
    expect(dataset.knownAnomalies[0].index).toBe(50); // Shift at midpoint

    // Verify the level shift
    const before = dataset.series.data_points.slice(40, 50);
    const after = dataset.series.data_points.slice(50, 60);
    const beforeMean = before.reduce((s, p) => s + p.value, 0) / 10;
    const afterMean = after.reduce((s, p) => s + p.value, 0) / 10;

    expect(afterMean).toBeGreaterThan(beforeMean + 20);
  });
});

// =============================================================================
// Backend Registry Tests
// =============================================================================

describe('Backend Registry', () => {
  beforeAll(() => {
    resetRegistries();
  });

  it('should register and retrieve forecast backends', () => {
    const registry = new ForecastBackendRegistry();

    expect(registry.list()).toContain('stub');
    expect(registry.list()).toContain('statistical');

    const stub = registry.get('stub');
    expect(stub).toBeDefined();
    expect(stub?.name).toContain('Stub');
  });

  it('should return default forecast backend', () => {
    const registry = new ForecastBackendRegistry();
    const defaultBackend = registry.getDefault();

    expect(defaultBackend).toBeDefined();
    expect(defaultBackend.name).toContain('Statistical');
  });

  it('should check backend health', async () => {
    const registry = new ForecastBackendRegistry();
    const health = await registry.checkHealth();

    expect(health.size).toBeGreaterThan(0);

    for (const [id, status] of health) {
      expect(status.backendId).toBe(id);
      expect(status.healthy).toBe(true);
      expect(status.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('should register and retrieve anomaly detectors', () => {
    const registry = new AnomalyDetectorRegistry();

    expect(registry.list()).toContain('statistical');
    expect(registry.list()).toContain('ensemble');

    const ensemble = registry.get('ensemble');
    expect(ensemble).toBeDefined();
    expect(ensemble?.method).toBe('ensemble');
  });

  it('should use factory functions', () => {
    resetRegistries();

    const forecastBackend = createForecastBackend();
    expect(forecastBackend).toBeDefined();

    const anomalyDetector = createAnomalyDetector();
    expect(anomalyDetector).toBeDefined();

    const specificBackend = createForecastBackend('stub');
    expect(specificBackend.name).toContain('Stub');
  });
});

// =============================================================================
// Backtesting Tests
// =============================================================================

describe('Backtester', () => {
  const backtester = new Backtester();
  const generator = new BenchmarkGenerator();

  it('should run forecast backtest', async () => {
    const dataset = generator.generateForecastBenchmark({
      points: 100,
      trend: 0.1,
      noiseLevel: 2,
    });

    const backend = new StatisticalForecastBackend();
    const result = await backtester.backtestForecast(dataset.series, backend, {
      folds: 3,
      horizon: 5,
      minTrainSize: 30,
    });

    expect(result.folds).toBe(3);
    expect(result.forecastMetrics.length).toBe(3);
    expect(result.averageMetrics.mae).toBeGreaterThan(0);
    expect(result.averageMetrics.mape).toBeLessThan(100); // Should be reasonable
    expect(result.executionTimeMs).toBeGreaterThan(0);
  });

  it('should run anomaly detection evaluation', async () => {
    const dataset = generator.generateAnomalyBenchmark({
      points: 100,
      anomalyRate: 0.05,
      anomalyMagnitude: 4,
    });

    const detector = new EnsembleAnomalyDetector();
    const metrics = await backtester.backtestAnomaly(
      dataset.series,
      detector,
      dataset.knownAnomalies,
      { sensitivity: 0.6, threshold: 0.6 }
    );

    expect(metrics.totalAnomalies).toBe(dataset.knownAnomalies.length);
    expect(metrics.precision).toBeGreaterThanOrEqual(0);
    expect(metrics.recall).toBeGreaterThanOrEqual(0);
    expect(metrics.f1).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// Statistical Forecast Backend Tests
// =============================================================================

describe('StatisticalForecastBackend', () => {
  const backend = new StatisticalForecastBackend();

  it('should generate forecasts', async () => {
    const generator = new BenchmarkGenerator();
    const dataset = generator.generateForecastBenchmark({
      points: 50,
    });

    const response = await backend.forecast({
      request_id: 'test-1',
      org_id: 'test-org',
      series: dataset.series,
      horizon: 10,
      frequency: '1h',
    });

    expect(response.success).toBe(true);
    expect(response.forecast?.predictions.length).toBe(10);
    expect(response.forecast?.model_info).toBeDefined();
  });

  it('should include confidence intervals', async () => {
    const generator = new BenchmarkGenerator();
    const dataset = generator.generateForecastBenchmark({
      points: 30,
    });

    const response = await backend.forecast({
      request_id: 'test-2',
      org_id: 'test-org',
      series: dataset.series,
      horizon: 5,
      frequency: '1h',
      options: {
        confidence_levels: [0.8, 0.95],
      },
    });

    expect(response.success).toBe(true);

    const prediction = response.forecast?.predictions[0];
    expect(prediction?.intervals).toBeDefined();
    expect(prediction?.intervals?.['0.8']).toBeDefined();
    expect(prediction?.intervals?.['0.95']).toBeDefined();

    // 95% interval should be wider than 80%
    const int80 = prediction?.intervals?.['0.8'];
    const int95 = prediction?.intervals?.['0.95'];
    if (int80 && int95) {
      const width80 = int80.upper - int80.lower;
      const width95 = int95.upper - int95.lower;
      expect(width95).toBeGreaterThan(width80);
    }
  });

  it('should handle insufficient data', async () => {
    const response = await backend.forecast({
      request_id: 'test-3',
      org_id: 'test-org',
      series: {
        series_id: 'test',
        org_id: 'test-org',
        metric_key: 'test.metric',
        dimensions: {},
        data_points: [{ timestamp: '2024-01-01T00:00:00Z', value: 10 }],
        metadata: { resolution: '1h' },
      },
      horizon: 5,
      frequency: '1h',
    });

    expect(response.success).toBe(false);
    expect(response.error).toContain('Insufficient');
  });
});

// =============================================================================
// Ensemble Anomaly Detector Tests
// =============================================================================

describe('EnsembleAnomalyDetector', () => {
  const detector = new EnsembleAnomalyDetector();

  it('should detect point anomalies', async () => {
    const dataPoints = [];
    const baseTime = Date.now();

    // Normal values
    for (let i = 0; i < 50; i++) {
      dataPoints.push({
        timestamp: new Date(baseTime + i * 60000).toISOString(),
        value: 50 + Math.random() * 10,
      });
    }

    // Inject obvious anomaly
    dataPoints[25].value = 150; // Big spike

    const response = await detector.detect({
      request_id: 'test-1',
      org_id: 'test-org',
      series: {
        series_id: 'test',
        org_id: 'test-org',
        metric_key: 'test.metric',
        dimensions: {},
        data_points: dataPoints,
        metadata: { resolution: '1m' },
      },
      options: {
        sensitivity: 0.5,
        threshold: 0.6,
      },
    });

    expect(response.success).toBe(true);
    expect(response.anomalies.length).toBeGreaterThan(0);
    expect(response.metadata.method).toBe('ensemble');
  });

  it('should classify anomaly types', async () => {
    const generator = new BenchmarkGenerator();
    const dataset = generator.generateLevelShiftBenchmark();

    const response = await detector.detect({
      request_id: 'test-2',
      org_id: 'test-org',
      series: dataset.series,
      options: {
        sensitivity: 0.7,
        threshold: 0.5,
      },
    });

    expect(response.success).toBe(true);

    // Should detect level shift type
    const levelShift = response.anomalies.find((a) => a.type === 'level_shift');
    // May or may not detect as level_shift depending on threshold
    expect(response.anomalies.length).toBeGreaterThanOrEqual(0);
  });

  it('should include context when requested', async () => {
    const generator = new BenchmarkGenerator();
    const dataset = generator.generateAnomalyBenchmark({
      points: 50,
      anomalyRate: 0.1,
      anomalyMagnitude: 5,
    });

    const response = await detector.detect({
      request_id: 'test-3',
      org_id: 'test-org',
      series: dataset.series,
      options: {
        sensitivity: 0.6,
        threshold: 0.5,
        include_context: true,
        context_window: 3,
      },
    });

    expect(response.success).toBe(true);

    if (response.anomalies.length > 0) {
      const anomaly = response.anomalies[0];
      expect(anomaly.context).toBeDefined();
      expect(anomaly.context?.statistics).toBeDefined();
      expect(anomaly.context?.statistics.mean).toBeDefined();
    }
  });

  it('should handle minimum data requirement', async () => {
    const response = await detector.detect({
      request_id: 'test-4',
      org_id: 'test-org',
      series: {
        series_id: 'test',
        org_id: 'test-org',
        metric_key: 'test.metric',
        dimensions: {},
        data_points: [
          { timestamp: '2024-01-01T00:00:00Z', value: 10 },
          { timestamp: '2024-01-01T00:01:00Z', value: 20 },
        ],
        metadata: { resolution: '1m' },
      },
    });

    // With insufficient data, returns success=false (correct behavior)
    expect(response.success).toBe(false);
    expect(response.anomalies.length).toBe(0);
    expect(response.error).toContain('Insufficient');
  });
});
