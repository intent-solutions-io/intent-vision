/**
 * Forecast Demo E2E Tests
 *
 * Phase E2E: Single-Metric Forecast Demo
 * Beads Task: intentvision-zun
 *
 * Tests for the single-metric forecast flow including:
 * - MetricsRepository operations
 * - Forecast service functions
 * - API endpoint behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ingestDemoMetric,
  runDemoForecast,
  getDemoMetricData,
  getAvailableBackends,
  type IngestDemoRequest,
  type ForecastDemoRequest,
} from '../services/forecast-demo-service.js';

// Mock the metrics repository
vi.mock('../data/metrics-repository.js', () => {
  const mockPoints: Map<string, Array<{ timestamp: string; value: number }>> = new Map();
  const mockMetrics: Map<string, { name: string; unit?: string; description?: string }> = new Map();
  const mockForecasts: Map<string, unknown> = new Map();

  return {
    getMetricsRepository: () => ({
      upsertMetric: vi.fn(async (def) => {
        const key = `${def.orgId}/${def.metricId}`;
        mockMetrics.set(key, { name: def.name, unit: def.unit, description: def.description });
      }),
      getMetric: vi.fn(async (orgId, metricId) => {
        const key = `${orgId}/${metricId}`;
        const meta = mockMetrics.get(key);
        if (!meta) return null;
        return {
          orgId,
          metricId,
          name: meta.name,
          unit: meta.unit,
          description: meta.description,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
      appendPoints: vi.fn(async (orgId, metricId, points) => {
        const key = `${orgId}/${metricId}`;
        const existing = mockPoints.get(key) || [];
        mockPoints.set(key, [...existing, ...points]);
        return points.length;
      }),
      getRecentPoints: vi.fn(async (orgId, metricId, limit) => {
        const key = `${orgId}/${metricId}`;
        const points = mockPoints.get(key) || [];
        return points.slice(-limit);
      }),
      saveForecast: vi.fn(async (result) => {
        const key = `${result.orgId}/${result.metricId}`;
        mockForecasts.set(key, result);
      }),
      getLatestForecast: vi.fn(async (orgId, metricId) => {
        const key = `${orgId}/${metricId}`;
        return mockForecasts.get(key) || null;
      }),
    }),
    resetMetricsRepository: vi.fn(),
  };
});

// Mock the statistical backend
vi.mock('../forecast/statistical-backend.js', () => ({
  getStatisticalBackend: () => ({
    forecast: vi.fn(async (points, options) => ({
      predictions: Array.from({ length: options.horizonDays }, (_, i) => ({
        timestamp: new Date(Date.now() + (i + 1) * 86400000),
        predictedValue: 100 + i * 5,
        confidenceLower: 90 + i * 5,
        confidenceUpper: 110 + i * 5,
        confidenceLevel: 0.95,
      })),
      modelInfo: {
        name: 'Statistical EWMA',
        version: '1.0.0',
        parameters: { alpha: 0.2, trend: 0.01 },
      },
      metrics: {
        inputPoints: points.length,
        outputPoints: options.horizonDays,
        durationMs: 10,
      },
    })),
  }),
  resetStatisticalBackend: vi.fn(),
}));

describe('Forecast Demo Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableBackends', () => {
    it('should return stub and stat backends by default', () => {
      const backends = getAvailableBackends();
      expect(backends).toContain('stub');
      expect(backends).toContain('stat');
    });

    it('should not include timegpt without API key', () => {
      const backends = getAvailableBackends();
      expect(backends).not.toContain('timegpt');
    });
  });

  describe('ingestDemoMetric', () => {
    it('should ingest metric data successfully', async () => {
      const request: IngestDemoRequest = {
        orgId: 'test-org',
        metricId: 'test-metric',
        metricName: 'Test Metric',
        unit: 'USD',
        description: 'A test metric',
        points: [
          { timestamp: '2025-01-01', value: 100 },
          { timestamp: '2025-01-02', value: 110 },
          { timestamp: '2025-01-03', value: 105 },
        ],
      };

      const result = await ingestDemoMetric(request);

      expect(result.orgId).toBe('test-org');
      expect(result.metricId).toBe('test-metric');
      expect(result.pointsIngested).toBe(3);
    });

    it('should handle empty points array', async () => {
      const request: IngestDemoRequest = {
        orgId: 'test-org',
        metricId: 'test-metric',
        metricName: 'Test Metric',
        points: [],
      };

      const result = await ingestDemoMetric(request);
      expect(result.pointsIngested).toBe(0);
    });
  });

  describe('runDemoForecast', () => {
    it('should run forecast with stub backend', async () => {
      // First ingest some data
      await ingestDemoMetric({
        orgId: 'test-org',
        metricId: 'forecast-test',
        metricName: 'Forecast Test',
        points: [
          { timestamp: '2025-01-01', value: 100 },
          { timestamp: '2025-01-02', value: 110 },
          { timestamp: '2025-01-03', value: 105 },
          { timestamp: '2025-01-04', value: 115 },
          { timestamp: '2025-01-05', value: 120 },
        ],
      });

      const request: ForecastDemoRequest = {
        orgId: 'test-org',
        metricId: 'forecast-test',
        horizonDays: 7,
        backend: 'stub',
      };

      const result = await runDemoForecast(request);

      expect(result.backend).toBe('stub');
      expect(result.horizonDays).toBe(7);
      expect(result.outputPointsCount).toBe(7);
      expect(result.points).toHaveLength(7);
      expect(result.forecastId).toBeTruthy();
    });

    it('should run forecast with stat backend', async () => {
      // First ingest some data
      await ingestDemoMetric({
        orgId: 'test-org',
        metricId: 'stat-test',
        metricName: 'Stat Test',
        points: [
          { timestamp: '2025-01-01', value: 100 },
          { timestamp: '2025-01-02', value: 110 },
          { timestamp: '2025-01-03', value: 105 },
        ],
      });

      const request: ForecastDemoRequest = {
        orgId: 'test-org',
        metricId: 'stat-test',
        horizonDays: 14,
        backend: 'stat',
      };

      const result = await runDemoForecast(request);

      expect(result.backend).toBe('stat');
      expect(result.horizonDays).toBe(14);
      expect(result.modelInfo?.name).toContain('Statistical');
    });

    it('should fail with insufficient data points', async () => {
      // Ingest only 1 point
      await ingestDemoMetric({
        orgId: 'test-org',
        metricId: 'insufficient-test',
        metricName: 'Insufficient Test',
        points: [{ timestamp: '2025-01-01', value: 100 }],
      });

      const request: ForecastDemoRequest = {
        orgId: 'test-org',
        metricId: 'insufficient-test',
        horizonDays: 7,
        backend: 'stat',
      };

      await expect(runDemoForecast(request)).rejects.toThrow('Insufficient data');
    });
  });

  describe('getDemoMetricData', () => {
    it('should return null for non-existent metric', async () => {
      const result = await getDemoMetricData('test-org', 'non-existent');
      expect(result).toBeNull();
    });

    it('should return metric data with points and forecast', async () => {
      // Ingest data
      await ingestDemoMetric({
        orgId: 'test-org',
        metricId: 'get-test',
        metricName: 'Get Test',
        points: [
          { timestamp: '2025-01-01', value: 100 },
          { timestamp: '2025-01-02', value: 110 },
          { timestamp: '2025-01-03', value: 105 },
        ],
      });

      // Run forecast
      await runDemoForecast({
        orgId: 'test-org',
        metricId: 'get-test',
        horizonDays: 7,
        backend: 'stub',
      });

      // Get data
      const result = await getDemoMetricData('test-org', 'get-test');

      expect(result).not.toBeNull();
      expect(result?.metric.name).toBe('Get Test');
      expect(result?.recentPoints.length).toBeGreaterThan(0);
      expect(result?.latestForecast).not.toBeNull();
    });
  });
});

describe('Forecast Demo E2E Flow', () => {
  it('should complete full ingest -> forecast -> retrieve flow', async () => {
    const orgId = 'e2e-test-org';
    const metricId = 'e2e-test-metric';

    // Step 1: Ingest data
    const ingestResult = await ingestDemoMetric({
      orgId,
      metricId,
      metricName: 'E2E Test MRR',
      unit: 'USD',
      points: Array.from({ length: 30 }, (_, i) => ({
        timestamp: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
        value: 10000 + i * 100 + Math.random() * 500,
      })),
    });

    expect(ingestResult.pointsIngested).toBe(30);

    // Step 2: Run forecast
    const forecastResult = await runDemoForecast({
      orgId,
      metricId,
      horizonDays: 7,
      backend: 'stat',
    });

    expect(forecastResult.inputPointsCount).toBe(30);
    expect(forecastResult.outputPointsCount).toBe(7);
    expect(forecastResult.forecastId).toBeTruthy();

    // Step 3: Retrieve data
    const metricData = await getDemoMetricData(orgId, metricId);

    expect(metricData).not.toBeNull();
    expect(metricData?.metric.name).toBe('E2E Test MRR');
    expect(metricData?.recentPoints.length).toBe(30);
    expect(metricData?.latestForecast?.points.length).toBe(7);
  });
});
