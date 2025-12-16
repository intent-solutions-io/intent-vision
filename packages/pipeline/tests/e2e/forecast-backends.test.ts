/**
 * E2E Test: Forecast Backend Switching
 *
 * Task ID: intentvision-7yf.3
 * Phase: E - Integration Testing
 *
 * Tests forecast backend routing and switching:
 * - NixtlaBackend with mocks
 * - StatisticalBackend
 * - StubBackend
 * - ForecastService routing
 * - Fallback behavior
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ForecastService, resetForecastService } from '../../src/forecast/forecast-service.js';
import { NixtlaTimeGPTBackend } from '../../src/forecast/nixtla-timegpt.js';
import { StatisticalForecastBackend } from '../../src/forecast/statistical-forecast.js';
import { StubForecastBackend } from '../../src/forecast/forecast-stub.js';
import {
  ForecastBackendRegistry,
  AnomalyDetectorRegistry,
  resetRegistries,
} from '../../src/backends/registry.js';
import type { ForecastRequest } from '../../../../contracts/src/index.js';
import { getClient, closeClient } from '../../../../db/config.js';
import { cleanupTestData, generateSyntheticTimeSeries } from './setup.js';

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_ORG = 'forecast-backend-test';

// =============================================================================
// Setup / Teardown
// =============================================================================

beforeAll(async () => {
  const client = getClient();
  await cleanupTestData(client, TEST_ORG);
  // Create test organization (required for foreign key constraints)
  await client.execute({
    sql: 'INSERT OR IGNORE INTO organizations (org_id, name) VALUES (?, ?)',
    args: [TEST_ORG, 'Forecast Backend Test Org'],
  });
});

afterAll(async () => {
  const client = getClient();
  await cleanupTestData(client, TEST_ORG);
  await closeClient();
});

beforeEach(() => {
  // Reset registries and service before each test
  resetRegistries();
  resetForecastService();
});

// =============================================================================
// Backend Tests
// =============================================================================

describe('Forecast Backend Tests', () => {
  it('should use StubBackend for basic forecasting', async () => {
    const backend = new StubForecastBackend();
    const series = generateSyntheticTimeSeries({
      orgId: TEST_ORG,
      metricKey: 'test.stub.metric',
      pointCount: 30,
    });

    const request: ForecastRequest = {
      request_id: 'stub-test-1',
      org_id: TEST_ORG,
      series,
      horizon: 6,
      frequency: '5m',
    };

    const response = await backend.forecast(request);

    expect(response.success).toBe(true);
    expect(response.backend).toBe('custom'); // StubForecastBackend uses 'custom' type
    expect(response.forecast).toBeDefined();
    expect(response.forecast?.predictions.length).toBe(6);
    expect(response.metadata.input_points).toBe(30);
    expect(response.metadata.output_points).toBe(6);
  });

  it('should use StatisticalBackend for forecasting', async () => {
    const backend = new StatisticalForecastBackend();
    const series = generateSyntheticTimeSeries({
      orgId: TEST_ORG,
      metricKey: 'test.statistical.metric',
      pointCount: 50,
    });

    const request: ForecastRequest = {
      request_id: 'statistical-test-1',
      org_id: TEST_ORG,
      series,
      horizon: 10,
      frequency: '5m',
    };

    const response = await backend.forecast(request);

    expect(response.success).toBe(true);
    expect(response.backend).toBe('custom');
    expect(response.forecast).toBeDefined();
    expect(response.forecast?.predictions.length).toBe(10);

    // Statistical backend should produce reasonable forecasts
    const predictions = response.forecast!.predictions;
    for (const pred of predictions) {
      expect(pred.value).toBeGreaterThanOrEqual(0);
      expect(pred.timestamp).toBeDefined();
    }
  });

  it('should use NixtlaBackend in mock mode', async () => {
    const backend = new NixtlaTimeGPTBackend({
      apiKey: 'mock-key',
    });

    // Enable mock mode
    backend.enableMockMode();

    const series = generateSyntheticTimeSeries({
      orgId: TEST_ORG,
      metricKey: 'test.nixtla.metric',
      pointCount: 40,
    });

    const request: ForecastRequest = {
      request_id: 'nixtla-test-1',
      org_id: TEST_ORG,
      series,
      horizon: 8,
      frequency: '5m',
    };

    const response = await backend.forecast(request);

    expect(response.success).toBe(true);
    expect(response.backend).toBe('nixtla-timegpt');
    expect(response.forecast).toBeDefined();
    expect(response.forecast?.predictions.length).toBe(8);

    // Mock should return predictions with intervals
    const predictions = response.forecast!.predictions;
    for (const pred of predictions) {
      expect(pred.value).toBeDefined();
      expect(pred.timestamp).toBeDefined();
      // Mock mode includes prediction intervals
      if (pred.intervals) {
        expect(pred.intervals['80']).toBeDefined();
      }
    }
  });

  it('should detect health status of backends', async () => {
    const stubBackend = new StubForecastBackend();
    const statisticalBackend = new StatisticalForecastBackend();
    const nixtlaBackend = new NixtlaTimeGPTBackend({ apiKey: 'test-key' });
    nixtlaBackend.enableMockMode();

    const stubHealth = await stubBackend.healthCheck();
    const statisticalHealth = await statisticalBackend.healthCheck();
    const nixtlaHealth = await nixtlaBackend.healthCheck();

    expect(stubHealth).toBe(true);
    expect(statisticalHealth).toBe(true);
    expect(nixtlaHealth).toBe(true); // Mock mode is always healthy
  });

  it('should report backend capabilities', () => {
    const stubBackend = new StubForecastBackend();
    const statisticalBackend = new StatisticalForecastBackend();
    const nixtlaBackend = new NixtlaTimeGPTBackend({ apiKey: 'test-key' });

    const stubCapabilities = stubBackend.capabilities();
    const statisticalCapabilities = statisticalBackend.capabilities();
    const nixtlaCapabilities = nixtlaBackend.capabilities();

    // All should have max_horizon (indicates forecast capability)
    expect(stubCapabilities.max_horizon).toBeGreaterThan(0);
    expect(statisticalCapabilities.max_horizon).toBeGreaterThan(0);
    expect(nixtlaCapabilities.max_horizon).toBeGreaterThan(0);

    // Check interval support
    expect(stubCapabilities.supports_intervals).toBeDefined();
    expect(nixtlaCapabilities.supports_intervals).toBe(true);
  });
});

// =============================================================================
// ForecastService Routing Tests
// =============================================================================

describe('ForecastService Routing', () => {
  it('should route to default backend when none specified', async () => {
    const service = new ForecastService({
      mockMode: true,
    });

    const series = generateSyntheticTimeSeries({
      orgId: TEST_ORG,
      metricKey: 'test.default.routing',
      pointCount: 30,
    });

    const request: ForecastRequest = {
      request_id: 'routing-test-1',
      org_id: TEST_ORG,
      series,
      horizon: 6,
      frequency: '5m',
    };

    const response = await service.forecast(request);

    expect(response.success).toBe(true);
    expect(response.forecast).toBeDefined();
  });

  it('should route to specific backend when requested', async () => {
    const service = new ForecastService({
      mockMode: true,
      nixtlaApiKey: 'test-key',
    });

    const series = generateSyntheticTimeSeries({
      orgId: TEST_ORG,
      metricKey: 'test.specific.routing',
      pointCount: 30,
    });

    const request: ForecastRequest = {
      request_id: 'routing-test-2',
      org_id: TEST_ORG,
      series,
      horizon: 6,
      frequency: '5m',
      options: {
        backend: 'stub',
      },
    };

    // StubForecastBackend uses 'custom' type, not 'stub'
    const response = await service.forecast(request, 'custom');

    expect(response.success).toBe(true);
    expect(response.backend).toBe('custom');
  });

  it('should list available backends', () => {
    const service = new ForecastService({
      nixtlaApiKey: 'test-key',
    });

    const backends = service.getAvailableBackends();

    // Both Stub and Statistical use 'custom' type, so we only get 'custom' once
    expect(backends).toContain('custom');
    expect(backends).toContain('nixtla-timegpt');
    expect(backends.length).toBeGreaterThanOrEqual(2);
  });

  it('should perform health check on all backends', async () => {
    const service = new ForecastService({
      mockMode: true,
      nixtlaApiKey: 'test-key',
    });

    const healthStatuses = await service.healthCheck();

    expect(healthStatuses.length).toBeGreaterThan(0);

    for (const status of healthStatuses) {
      expect(status).toHaveProperty('type');
      expect(status).toHaveProperty('name');
      expect(status).toHaveProperty('healthy');
      expect(status).toHaveProperty('capabilities');
      expect(status).toHaveProperty('lastChecked');
    }
  });

  it('should handle backend errors gracefully', async () => {
    const service = new ForecastService();

    const series = generateSyntheticTimeSeries({
      orgId: TEST_ORG,
      metricKey: 'test.error.handling',
      pointCount: 1, // Insufficient data
    });

    const request: ForecastRequest = {
      request_id: 'error-test-1',
      org_id: TEST_ORG,
      series,
      horizon: 6,
      frequency: '5m',
    };

    const response = await service.forecast(request);

    // Should fail gracefully
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });

  it('should support mock mode enable/disable', () => {
    const service = new ForecastService({
      nixtlaApiKey: 'test-key',
    });

    // Enable mock mode
    service.enableMockMode();

    // Check that Nixtla backend is in mock mode
    const nixtlaBackend = service.getBackend('nixtla-timegpt') as
      | NixtlaTimeGPTBackend
      | undefined;
    expect(nixtlaBackend).toBeDefined();

    // Disable mock mode
    service.disableMockMode();
  });

  it('should detect anomalies using Nixtla backend', async () => {
    const service = new ForecastService({
      mockMode: true,
      nixtlaApiKey: 'test-key',
    });

    const series = generateSyntheticTimeSeries({
      orgId: TEST_ORG,
      metricKey: 'test.anomaly.detection',
      pointCount: 50,
    });

    const result = await service.detectAnomalies(series, TEST_ORG);

    expect(result.success).toBe(true);
    expect(result.anomalies).toBeDefined();
    expect(Array.isArray(result.anomalies)).toBe(true);
    expect(result.metadata).toHaveProperty('detectionTime');
    expect(result.metadata).toHaveProperty('durationMs');
    expect(result.metadata).toHaveProperty('pointsAnalyzed');
  });
});

// =============================================================================
// Backend Registry Tests
// =============================================================================

describe('Backend Registry', () => {
  it('should register and retrieve forecast backends', () => {
    const registry = new ForecastBackendRegistry();
    const stubBackend = new StubForecastBackend();

    registry.register('test-stub', stubBackend);

    const retrieved = registry.get('test-stub');
    expect(retrieved).toBe(stubBackend);
  });

  it('should list all registered backends', () => {
    const registry = new ForecastBackendRegistry();

    const backends = registry.list();

    // Default backends include stub and statistical (both may use 'custom' type internally)
    expect(backends.length).toBeGreaterThan(0);
  });

  it('should set and get default backend', () => {
    const registry = new ForecastBackendRegistry();

    registry.setDefault('stub');

    const defaultBackend = registry.getDefault();
    expect(defaultBackend).toBeInstanceOf(StubForecastBackend);
  });

  it('should check health of all backends', async () => {
    const registry = new ForecastBackendRegistry();

    const healthMap = await registry.checkHealth();

    expect(healthMap.size).toBeGreaterThan(0);

    for (const [id, status] of healthMap) {
      expect(status.backendId).toBe(id);
      expect(status).toHaveProperty('healthy');
      expect(status).toHaveProperty('lastCheck');
    }
  });

  it('should list only healthy backends', async () => {
    const registry = new ForecastBackendRegistry();

    await registry.checkHealth();

    const healthyBackends = registry.listHealthy();
    expect(healthyBackends.length).toBeGreaterThan(0);
  });

  it('should get capabilities of all backends', () => {
    const registry = new ForecastBackendRegistry();

    const capabilities = registry.getCapabilities();

    expect(capabilities.size).toBeGreaterThan(0);

    for (const [id, caps] of capabilities) {
      expect(caps).toHaveProperty('max_horizon');
    }
  });
});

// =============================================================================
// Anomaly Detector Registry Tests
// =============================================================================

describe('Anomaly Detector Registry', () => {
  it('should register and retrieve anomaly detectors', () => {
    const registry = new AnomalyDetectorRegistry();

    const detectors = registry.list();

    // Default detectors: statistical and ensemble
    expect(detectors).toContain('statistical');
    expect(detectors).toContain('ensemble');
  });

  it('should get default detector', () => {
    const registry = new AnomalyDetectorRegistry();

    const defaultDetector = registry.getDefault();
    expect(defaultDetector).toBeDefined();
  });

  it('should check health of all detectors', async () => {
    const registry = new AnomalyDetectorRegistry();

    const healthMap = await registry.checkHealth();

    expect(healthMap.size).toBeGreaterThan(0);

    for (const [id, status] of healthMap) {
      expect(status.backendId).toBe(id);
      expect(status).toHaveProperty('healthy');
    }
  });
});
