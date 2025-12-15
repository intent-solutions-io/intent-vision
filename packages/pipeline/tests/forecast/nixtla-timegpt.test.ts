/**
 * Nixtla TimeGPT Backend Tests
 *
 * Task ID: intentvision-jet.3
 *
 * Comprehensive tests for TimeGPT forecast backend including:
 * - Mock mode operation
 * - Forecast generation with various horizons
 * - Anomaly detection
 * - Database storage verification
 * - Health checks and capabilities
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  NixtlaTimeGPTBackend,
  getNixtlaBackend,
  resetNixtlaBackend,
} from '../../src/forecast/nixtla-timegpt.js';
import type {
  ForecastRequest,
  ForecastResponse,
  TimeSeries,
} from '../../../contracts/src/index.js';
import { getClient, runMigrations, closeClient } from '../../../../db/config.js';

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_ORG_ID = 'test-org-nixtla';
const TEST_METRIC_KEY = 'system.cpu.usage';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestTimeSeries(
  dataPoints: number = 50,
  baseValue: number = 75,
  variance: number = 10
): TimeSeries {
  const now = Date.now();
  const hourInMs = 3600000;

  const points = Array.from({ length: dataPoints }, (_, i) => {
    const timestamp = new Date(now - (dataPoints - i - 1) * hourInMs).toISOString();
    const noise = (Math.random() - 0.5) * variance;
    const trend = i * 0.1;
    const value = baseValue + noise + trend;

    return {
      timestamp,
      value,
    };
  });

  return {
    metric_key: TEST_METRIC_KEY,
    dimensions: { host: 'server-1', region: 'us-east' },
    data_points: points,
    frequency: '1h',
  };
}

function createForecastRequest(
  horizon: number = 24,
  dataPoints: number = 50
): ForecastRequest {
  return {
    request_id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    org_id: TEST_ORG_ID,
    series: createTestTimeSeries(dataPoints),
    horizon,
    frequency: '1h',
    options: {
      confidence_levels: [0.8, 0.95],
    },
  };
}

// =============================================================================
// Setup / Teardown
// =============================================================================

beforeAll(async () => {
  // Run migrations to ensure core tables exist
  try {
    await runMigrations();
  } catch (e) {
    console.log('Migrations check:', (e as Error).message);
  }

  // Create test organization
  const client = getClient();
  await client.execute({
    sql: `INSERT OR IGNORE INTO organizations (org_id, name, created_at) VALUES (?, ?, ?)`,
    args: [TEST_ORG_ID, 'Nixtla Test Org', new Date().toISOString()],
  });
});

afterAll(async () => {
  // Clean up test data
  const client = getClient();

  try {
    await client.execute({
      sql: 'DELETE FROM forecasts WHERE org_id = ?',
      args: [TEST_ORG_ID],
    });
  } catch {}

  try {
    await client.execute({
      sql: 'DELETE FROM anomalies WHERE org_id = ?',
      args: [TEST_ORG_ID],
    });
  } catch {}

  try {
    await client.execute({
      sql: 'DELETE FROM organizations WHERE org_id = ?',
      args: [TEST_ORG_ID],
    });
  } catch {}

  await closeClient();
});

beforeEach(() => {
  // Reset singleton between tests
  resetNixtlaBackend();
});

// =============================================================================
// Mock Mode Tests
// =============================================================================

describe('NixtlaTimeGPTBackend - Mock Mode', () => {
  it('should enable and disable mock mode', () => {
    const backend = new NixtlaTimeGPTBackend();

    backend.enableMockMode();
    expect(backend['mockMode']).toBe(true);

    backend.disableMockMode();
    expect(backend['mockMode']).toBe(false);
  });

  it('should generate mock forecast responses', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(24);
    const response = await backend.forecast(request);

    expect(response.success).toBe(true);
    expect(response.request_id).toBe(request.request_id);
    expect(response.backend).toBe('nixtla-timegpt');
    expect(response.forecast).toBeDefined();
    expect(response.forecast!.predictions).toHaveLength(24);
  });

  it('should include prediction intervals in mock responses', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(12);
    const response = await backend.forecast(request);

    const firstPrediction = response.forecast!.predictions[0];
    expect(firstPrediction.value).toBeDefined();
    expect(firstPrediction.intervals).toBeDefined();
    expect(firstPrediction.intervals!['80']).toBeDefined();
    expect(firstPrediction.intervals!['80'].lower).toBeLessThan(firstPrediction.value);
    expect(firstPrediction.intervals!['80'].upper).toBeGreaterThan(firstPrediction.value);
    expect(firstPrediction.intervals!['80'].confidence).toBe(0.8);
  });

  it('should include 95% prediction intervals', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(6);
    const response = await backend.forecast(request);

    const prediction = response.forecast!.predictions[0];
    expect(prediction.intervals!['95']).toBeDefined();
    expect(prediction.intervals!['95'].confidence).toBe(0.95);

    // 95% interval should be wider than 80% interval
    const interval80Width =
      prediction.intervals!['80'].upper - prediction.intervals!['80'].lower;
    const interval95Width =
      prediction.intervals!['95'].upper - prediction.intervals!['95'].lower;
    expect(interval95Width).toBeGreaterThan(interval80Width);
  });

  it('should generate realistic forecasts based on historical data', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const series = createTestTimeSeries(100, 50, 5);
    const request: ForecastRequest = {
      request_id: `req_${Date.now()}`,
      org_id: TEST_ORG_ID,
      series,
      horizon: 10,
      frequency: '1h',
    };

    const response = await backend.forecast(request);

    // Forecast values should be in a reasonable range relative to input
    const inputMean =
      series.data_points.reduce((sum, p) => sum + p.value, 0) / series.data_points.length;
    const forecastValues = response.forecast!.predictions.map((p) => p.value);
    const forecastMean = forecastValues.reduce((sum, v) => sum + v, 0) / forecastValues.length;

    // Forecast mean should be within 50% of input mean
    expect(Math.abs(forecastMean - inputMean)).toBeLessThan(inputMean * 0.5);
  });

  it('should widen prediction intervals with horizon', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(20);
    const response = await backend.forecast(request);

    const predictions = response.forecast!.predictions;
    const firstInterval =
      predictions[0].intervals!['80'].upper - predictions[0].intervals!['80'].lower;
    const lastInterval =
      predictions[19].intervals!['80'].upper - predictions[19].intervals!['80'].lower;

    // Intervals should widen over time
    expect(lastInterval).toBeGreaterThan(firstInterval);
  });
});

// =============================================================================
// Forecast Tests
// =============================================================================

describe('NixtlaTimeGPTBackend - Forecast Generation', () => {
  it('should validate minimum data points (2 required)', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(10, 1);
    const response = await backend.forecast(request);

    expect(response.success).toBe(false);
    expect(response.error).toContain('Insufficient data points');
    expect(response.error).toContain('minimum 2 required');
  });

  it('should accept exactly 2 data points', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(5, 2);
    const response = await backend.forecast(request);

    expect(response.success).toBe(true);
    expect(response.forecast!.predictions).toHaveLength(5);
  });

  it('should forecast with different horizons', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const horizons = [1, 12, 24, 168, 720];

    for (const horizon of horizons) {
      const request = createForecastRequest(horizon);
      const response = await backend.forecast(request);

      expect(response.success).toBe(true);
      expect(response.forecast!.predictions).toHaveLength(horizon);
    }
  });

  it('should forecast with different frequencies', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const frequencies = ['1m', '5m', '15m', '30m', '1h', '1d', '1w', '1M'];

    for (const frequency of frequencies) {
      const request = createForecastRequest(10);
      request.frequency = frequency;

      const response = await backend.forecast(request);
      expect(response.success).toBe(true);
    }
  });

  it('should include model info in response', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(10, 50);
    const response = await backend.forecast(request);

    expect(response.forecast!.model_info).toBeDefined();
    expect(response.forecast!.model_info!.name).toBe('TimeGPT');
    expect(response.forecast!.model_info!.version).toBe('1.0');
    expect(response.forecast!.model_info!.training_metrics).toBeDefined();
    expect(response.forecast!.model_info!.training_metrics!.input_points).toBe(50);
    expect(response.forecast!.model_info!.training_metrics!.horizon).toBe(10);
  });

  it('should include metadata in response', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(20, 30);
    const response = await backend.forecast(request);

    expect(response.metadata).toBeDefined();
    expect(response.metadata.generated_at).toBeDefined();
    expect(response.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(response.metadata.input_points).toBe(30);
    expect(response.metadata.output_points).toBe(20);
  });

  it('should generate sequential timestamps', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(10);
    const response = await backend.forecast(request);

    const predictions = response.forecast!.predictions;

    for (let i = 1; i < predictions.length; i++) {
      const prevTime = new Date(predictions[i - 1].timestamp).getTime();
      const currTime = new Date(predictions[i].timestamp).getTime();

      // Timestamps should be sequential
      expect(currTime).toBeGreaterThan(prevTime);
    }
  });

  it('should start forecast after last historical point', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const series = createTestTimeSeries(20);
    const lastHistoricalTime = new Date(
      series.data_points[series.data_points.length - 1].timestamp
    ).getTime();

    const request: ForecastRequest = {
      request_id: `req_${Date.now()}`,
      org_id: TEST_ORG_ID,
      series,
      horizon: 5,
      frequency: '1h',
    };

    const response = await backend.forecast(request);
    const firstForecastTime = new Date(response.forecast!.predictions[0].timestamp).getTime();

    expect(firstForecastTime).toBeGreaterThan(lastHistoricalTime);
  });
});

// =============================================================================
// Database Storage Tests
// =============================================================================

describe('NixtlaTimeGPTBackend - Database Storage', () => {
  it('should store forecast in database', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(12);
    const response = await backend.forecast(request);

    expect(response.success).toBe(true);

    // Verify stored in database
    const client = getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM forecasts WHERE request_id = ?',
      args: [request.request_id],
    });

    expect(result.rows.length).toBe(1);
    const row = result.rows[0] as any;
    expect(row.org_id).toBe(TEST_ORG_ID);
    expect(row.metric_key).toBe(TEST_METRIC_KEY);
    expect(row.backend).toBe('nixtla-timegpt');
    expect(row.horizon).toBe(12);
    expect(row.frequency).toBe('1h');
  });

  it('should store predictions as JSON', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(6);
    await backend.forecast(request);

    const client = getClient();
    const result = await client.execute({
      sql: 'SELECT predictions FROM forecasts WHERE request_id = ?',
      args: [request.request_id],
    });

    const predictions = JSON.parse(result.rows[0].predictions as string);
    expect(Array.isArray(predictions)).toBe(true);
    expect(predictions).toHaveLength(6);
    expect(predictions[0]).toHaveProperty('timestamp');
    expect(predictions[0]).toHaveProperty('value');
    expect(predictions[0]).toHaveProperty('intervals');
  });

  it('should store model info as JSON', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(8);
    await backend.forecast(request);

    const client = getClient();
    const result = await client.execute({
      sql: 'SELECT model_info FROM forecasts WHERE request_id = ?',
      args: [request.request_id],
    });

    const modelInfo = JSON.parse(result.rows[0].model_info as string);
    expect(modelInfo.name).toBe('TimeGPT');
    expect(modelInfo.version).toBe('1.0');
  });

  it('should store dimensions as JSON', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(5);
    await backend.forecast(request);

    const client = getClient();
    const result = await client.execute({
      sql: 'SELECT dimensions FROM forecasts WHERE request_id = ?',
      args: [request.request_id],
    });

    const dimensions = JSON.parse(result.rows[0].dimensions as string);
    expect(dimensions.host).toBe('server-1');
    expect(dimensions.region).toBe('us-east');
  });

  it('should update forecast on duplicate request_id', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const requestId = `req_duplicate_${Date.now()}`;

    // First forecast
    const request1 = createForecastRequest(10);
    request1.request_id = requestId;
    await backend.forecast(request1);

    // Second forecast with same request_id
    const request2 = createForecastRequest(20);
    request2.request_id = requestId;
    await backend.forecast(request2);

    // Should only have one row
    const client = getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM forecasts WHERE request_id = ?',
      args: [requestId],
    });

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].horizon).toBe(20); // Updated value
  });

  it('should record processing duration', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(15);
    await backend.forecast(request);

    const client = getClient();
    const result = await client.execute({
      sql: 'SELECT duration_ms FROM forecasts WHERE request_id = ?',
      args: [request.request_id],
    });

    const durationMs = result.rows[0].duration_ms as number;
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(durationMs).toBeLessThan(10000); // Should be fast in mock mode
  });
});

// =============================================================================
// Anomaly Detection Tests
// =============================================================================

describe('NixtlaTimeGPTBackend - Anomaly Detection', () => {
  it('should validate minimum data points (10 required)', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const series = createTestTimeSeries(9);
    const result = await backend.detectAnomalies(
      series,
      TEST_ORG_ID,
      `req_${Date.now()}`
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient data points');
    expect(result.error).toContain('minimum 10 required');
  });

  it('should accept exactly 10 data points', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const series = createTestTimeSeries(10);
    const result = await backend.detectAnomalies(
      series,
      TEST_ORG_ID,
      `req_${Date.now()}`
    );

    expect(result.success).toBe(true);
    expect(result.anomalies).toHaveLength(10);
  });

  it('should calculate anomaly scores for all points', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const series = createTestTimeSeries(20);
    const result = await backend.detectAnomalies(
      series,
      TEST_ORG_ID,
      `req_${Date.now()}`
    );

    expect(result.success).toBe(true);
    expect(result.anomalies).toHaveLength(20);

    for (const anomaly of result.anomalies) {
      expect(anomaly.timestamp).toBeDefined();
      expect(anomaly.value).toBeDefined();
      expect(anomaly.score).toBeGreaterThanOrEqual(0);
      expect(typeof anomaly.isAnomaly).toBe('boolean');
    }
  });

  it('should detect anomalies based on z-score threshold', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    // Create data with obvious outliers
    const baseValue = 50;
    const now = Date.now();
    const points = [
      ...Array.from({ length: 15 }, (_, i) => ({
        timestamp: new Date(now - (20 - i) * 3600000).toISOString(),
        value: baseValue + (Math.random() - 0.5) * 2, // Normal values
      })),
      // Add extreme outliers
      {
        timestamp: new Date(now - 5 * 3600000).toISOString(),
        value: baseValue + 50, // Strong outlier
      },
      {
        timestamp: new Date(now - 4 * 3600000).toISOString(),
        value: baseValue - 50, // Strong outlier
      },
      ...Array.from({ length: 3 }, (_, i) => ({
        timestamp: new Date(now - (3 - i) * 3600000).toISOString(),
        value: baseValue + (Math.random() - 0.5) * 2, // Normal values
      })),
    ];

    const series: TimeSeries = {
      metric_key: TEST_METRIC_KEY,
      dimensions: { test: 'anomaly-detection' },
      data_points: points,
      frequency: '1h',
    };

    const result = await backend.detectAnomalies(
      series,
      TEST_ORG_ID,
      `req_${Date.now()}`
    );

    expect(result.success).toBe(true);

    // Should have detected at least the two extreme outliers
    const detectedAnomalies = result.anomalies.filter((a) => a.isAnomaly);
    expect(detectedAnomalies.length).toBeGreaterThan(0);

    // Outliers should have high scores
    const outlierScores = result.anomalies
      .filter((a) => Math.abs(a.value - baseValue) > 40)
      .map((a) => a.score);

    for (const score of outlierScores) {
      expect(score).toBeGreaterThan(2.0); // Above threshold
    }
  });

  it('should store detected anomalies in database', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const requestId = `req_anomaly_${Date.now()}`;

    // Create data with outliers
    const baseValue = 100;
    const now = Date.now();
    const points = [
      ...Array.from({ length: 18 }, (_, i) => ({
        timestamp: new Date(now - (20 - i) * 3600000).toISOString(),
        value: baseValue + (Math.random() - 0.5) * 5,
      })),
      {
        timestamp: new Date(now - 2 * 3600000).toISOString(),
        value: baseValue + 100, // Extreme outlier
      },
      {
        timestamp: new Date(now - 1 * 3600000).toISOString(),
        value: baseValue + (Math.random() - 0.5) * 5,
      },
    ];

    const series: TimeSeries = {
      metric_key: TEST_METRIC_KEY,
      dimensions: { storage: 'test' },
      data_points: points,
      frequency: '1h',
    };

    const result = await backend.detectAnomalies(series, TEST_ORG_ID, requestId);
    expect(result.success).toBe(true);

    // Check database for stored anomalies
    const client = getClient();
    const dbResult = await client.execute({
      sql: 'SELECT * FROM anomalies WHERE request_id = ? AND org_id = ?',
      args: [requestId, TEST_ORG_ID],
    });

    // Should have at least one stored anomaly
    expect(dbResult.rows.length).toBeGreaterThan(0);

    const anomaly = dbResult.rows[0] as any;
    expect(anomaly.anomaly_id).toBeDefined();
    expect(anomaly.metric_key).toBe(TEST_METRIC_KEY);
    expect(anomaly.score).toBeGreaterThan(0);
    expect(anomaly.type).toBe('point');
    expect(['low', 'medium', 'high']).toContain(anomaly.severity);
  });

  it('should only store anomalies where isAnomaly is true', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const requestId = `req_filter_${Date.now()}`;
    const series = createTestTimeSeries(15);

    await backend.detectAnomalies(series, TEST_ORG_ID, requestId);

    const client = getClient();
    const result = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM anomalies WHERE request_id = ?',
      args: [requestId],
    });

    const storedCount = result.rows[0].count as number;

    // In mock mode with normal data, should have few or no anomalies
    // (depends on random variance, but should not store all 15 points)
    expect(storedCount).toBeLessThan(15);
  });

  it('should assign severity based on score', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const requestId = `req_severity_${Date.now()}`;

    // Create extreme outlier to ensure high score
    const now = Date.now();
    const points = [
      ...Array.from({ length: 19 }, (_, i) => ({
        timestamp: new Date(now - (20 - i) * 3600000).toISOString(),
        value: 50,
      })),
      {
        timestamp: new Date(now - 1 * 3600000).toISOString(),
        value: 200, // Extreme outlier
      },
    ];

    const series: TimeSeries = {
      metric_key: TEST_METRIC_KEY,
      dimensions: { severity: 'test' },
      data_points: points,
      frequency: '1h',
    };

    await backend.detectAnomalies(series, TEST_ORG_ID, requestId);

    const client = getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM anomalies WHERE request_id = ? ORDER BY score DESC LIMIT 1',
      args: [requestId],
    });

    if (result.rows.length > 0) {
      const anomaly = result.rows[0] as any;
      const score = anomaly.score as number;

      // Verify severity assignment logic
      if (score > 3) {
        expect(anomaly.severity).toBe('high');
      } else if (score > 2.5) {
        expect(anomaly.severity).toBe('medium');
      } else {
        expect(anomaly.severity).toBe('low');
      }
    }
  });
});

// =============================================================================
// Capabilities Tests
// =============================================================================

describe('NixtlaTimeGPTBackend - Capabilities', () => {
  it('should return backend capabilities', () => {
    const backend = new NixtlaTimeGPTBackend();
    const capabilities = backend.capabilities();

    expect(capabilities.max_horizon).toBe(720);
    expect(capabilities.supports_intervals).toBe(true);
    expect(capabilities.supports_batch).toBe(true);
    expect(capabilities.supports_exogenous).toBe(true);
  });

  it('should support common frequencies', () => {
    const backend = new NixtlaTimeGPTBackend();
    const capabilities = backend.capabilities();

    const requiredFrequencies = ['1m', '5m', '15m', '30m', '1h', '1d', '1w', '1M'];
    for (const freq of requiredFrequencies) {
      expect(capabilities.supported_frequencies).toContain(freq);
    }
  });

  it('should have consistent type and name', () => {
    const backend = new NixtlaTimeGPTBackend();

    expect(backend.type).toBe('nixtla-timegpt');
    expect(backend.name).toBe('Nixtla TimeGPT');
  });
});

// =============================================================================
// Health Check Tests
// =============================================================================

describe('NixtlaTimeGPTBackend - Health Check', () => {
  it('should return true in mock mode', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const health = await backend.healthCheck();
    expect(health).toBe(true);
  });

  it('should return false without API key (non-mock)', async () => {
    const backend = new NixtlaTimeGPTBackend({ apiKey: '' });

    const health = await backend.healthCheck();
    expect(health).toBe(false);
  });

  it('should use API key from config', () => {
    const backend = new NixtlaTimeGPTBackend({ apiKey: 'test-key-123' });
    expect(backend['config'].apiKey).toBe('test-key-123');
  });

  it('should use API key from environment if not in config', () => {
    const originalKey = process.env.NIXTLA_API_KEY;
    process.env.NIXTLA_API_KEY = 'env-key-456';

    const backend = new NixtlaTimeGPTBackend();
    expect(backend['config'].apiKey).toBe('env-key-456');

    // Restore
    if (originalKey) {
      process.env.NIXTLA_API_KEY = originalKey;
    } else {
      delete process.env.NIXTLA_API_KEY;
    }
  });

  it('should use default configuration values', () => {
    const backend = new NixtlaTimeGPTBackend();

    expect(backend['config'].baseUrl).toBe('https://api.nixtla.io');
    expect(backend['config'].timeout).toBe(30000);
  });

  it('should allow custom configuration', () => {
    const backend = new NixtlaTimeGPTBackend({
      apiKey: 'custom-key',
      baseUrl: 'https://custom.api.com',
      timeout: 60000,
    });

    expect(backend['config'].apiKey).toBe('custom-key');
    expect(backend['config'].baseUrl).toBe('https://custom.api.com');
    expect(backend['config'].timeout).toBe(60000);
  });
});

// =============================================================================
// Factory Tests
// =============================================================================

describe('NixtlaTimeGPTBackend - Factory', () => {
  it('should return singleton instance', () => {
    const backend1 = getNixtlaBackend();
    const backend2 = getNixtlaBackend();

    expect(backend1).toBe(backend2);
  });

  it('should allow singleton reset', () => {
    const backend1 = getNixtlaBackend();
    resetNixtlaBackend();
    const backend2 = getNixtlaBackend();

    expect(backend1).not.toBe(backend2);
  });

  it('should accept configuration in factory', () => {
    resetNixtlaBackend();
    const backend = getNixtlaBackend({ apiKey: 'factory-key' });

    expect(backend['config'].apiKey).toBe('factory-key');
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('NixtlaTimeGPTBackend - Error Handling', () => {
  it('should handle forecast errors gracefully', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    // Create invalid request (0 data points)
    const request = createForecastRequest(10, 50);
    request.series.data_points = [];

    const response = await backend.forecast(request);

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.backend).toBe('nixtla-timegpt');
    expect(response.metadata.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('should handle anomaly detection errors gracefully', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const series = createTestTimeSeries(5); // Too few points

    const result = await backend.detectAnomalies(
      series,
      TEST_ORG_ID,
      `req_${Date.now()}`
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.anomalies).toHaveLength(0);
  });

  it('should include error message in failed responses', async () => {
    const backend = new NixtlaTimeGPTBackend();
    backend.enableMockMode();

    const request = createForecastRequest(10, 1);
    const response = await backend.forecast(request);

    expect(response.error).toBeTruthy();
    expect(typeof response.error).toBe('string');
    expect(response.error!.length).toBeGreaterThan(0);
  });
});
