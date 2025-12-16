/**
 * External Connections Tests
 *
 * Task ID: intentvision-wgk
 *
 * Comprehensive tests for connection modules:
 * - Turso connection pooling
 * - Nixtla client retry/circuit breaker
 * - Webhook signature verification
 * - Health monitoring
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TursoPool,
  resetTursoPool,
  NixtlaClient,
  resetNixtlaClient,
  WebhookVerifier,
  verifyWebhookSignature,
  signWebhookPayload,
  parseWebhookSignature,
  resetWebhookVerifiers,
  HealthMonitor,
  getHealthMonitor,
  resetHealthMonitor,
  registerHealthCheck,
  checkAllHealth,
  type HealthStatus,
} from '../src/connections/index.js';

// =============================================================================
// Turso Pool Tests
// =============================================================================

describe('TursoPool', () => {
  let pool: TursoPool;
  const trackedConnections: any[] = [];

  beforeEach(() => {
    pool = new TursoPool({
      url: 'file::memory:',
      poolSize: 3,
      connectionTimeoutMs: 1000,
    });
    trackedConnections.length = 0;
  });

  afterEach(async () => {
    // Release any tracked connections before draining
    for (const conn of trackedConnections) {
      try {
        pool.releaseConnection(conn);
      } catch {}
    }
    trackedConnections.length = 0;

    if (pool) {
      await pool.drain(2000);
    }
    await resetTursoPool();
  });

  describe('Connection Management', () => {
    it('should acquire connection from pool', async () => {
      const client = await pool.getConnection();
      trackedConnections.push(client);
      expect(client).toBeDefined();

      const stats = pool.getStats();
      expect(stats.total).toBe(1);
      expect(stats.inUse).toBe(1);
      expect(stats.available).toBe(0);
    });

    it('should release connection back to pool', async () => {
      const client = await pool.getConnection();
      pool.releaseConnection(client);

      const stats = pool.getStats();
      expect(stats.inUse).toBe(0);
      expect(stats.available).toBe(1);
    });

    it('should reuse released connections', async () => {
      const client1 = await pool.getConnection();
      pool.releaseConnection(client1);

      const client2 = await pool.getConnection();
      expect(client2).toBe(client1);

      const stats = pool.getStats();
      expect(stats.total).toBe(1);
    });

    it('should create new connections up to pool size', async () => {
      const clients = [];
      for (let i = 0; i < 3; i++) {
        const c = await pool.getConnection();
        clients.push(c);
        trackedConnections.push(c);
      }

      const stats = pool.getStats();
      expect(stats.total).toBe(3);
      expect(stats.inUse).toBe(3);

      // Cleanup
      clients.forEach((c) => pool.releaseConnection(c));
    });

    it('should wait when pool is exhausted', async () => {
      // Acquire all connections
      const clients = [];
      for (let i = 0; i < 3; i++) {
        clients.push(await pool.getConnection());
      }

      // Try to get one more (should wait)
      const promise = pool.getConnection();

      // Release one after delay
      setTimeout(() => pool.releaseConnection(clients[0]), 100);

      const client = await promise;
      expect(client).toBe(clients[0]);

      // Cleanup
      clients.slice(1).forEach((c) => pool.releaseConnection(c));
      pool.releaseConnection(client);
    });

    it('should timeout when waiting too long', async () => {
      const smallPool = new TursoPool({
        url: 'file::memory:',
        poolSize: 1,
        connectionTimeoutMs: 500,
      });

      const client1 = await smallPool.getConnection();

      await expect(smallPool.getConnection()).rejects.toThrow(
        'Connection timeout'
      );

      smallPool.releaseConnection(client1);
      await smallPool.drain();
    });
  });

  describe('Health Check', () => {
    it('should pass health check', async () => {
      const healthy = await pool.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should execute query during health check', async () => {
      const healthy = await pool.healthCheck();
      expect(healthy).toBe(true);

      // Pool should have created a connection
      const stats = pool.getStats();
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should drain pool', async () => {
      const client = await pool.getConnection();
      pool.releaseConnection(client);

      await pool.drain();

      const stats = pool.getStats();
      expect(stats.total).toBe(0);
    });

    it('should reject new connections after drain starts', async () => {
      const drainPromise = pool.drain();

      await expect(pool.getConnection()).rejects.toThrow(
        'Pool is shutting down'
      );

      await drainPromise;
    });

    it('should wait for active connections', async () => {
      const client = await pool.getConnection();

      // Start drain (should wait)
      const drainPromise = pool.drain(2000);

      // Release connection after delay
      setTimeout(() => pool.releaseConnection(client), 100);

      await drainPromise;

      const stats = pool.getStats();
      expect(stats.total).toBe(0);
    });
  });

  describe('withConnection Helper', () => {
    it('should auto-acquire and release connection', async () => {
      const result = await pool.withConnection(async (client) => {
        const res = await client.execute('SELECT 1 as value');
        return res.rows[0].value;
      });

      expect(result).toBe(1);

      const stats = pool.getStats();
      expect(stats.inUse).toBe(0);
      expect(stats.available).toBe(1);
    });

    it('should release connection even on error', async () => {
      await expect(
        pool.withConnection(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      const stats = pool.getStats();
      expect(stats.inUse).toBe(0);
    });
  });
});

// =============================================================================
// Nixtla Client Tests
// =============================================================================

describe('NixtlaClient', () => {
  let client: NixtlaClient;

  beforeEach(() => {
    client = new NixtlaClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com',
      maxRetries: 2,
      baseDelayMs: 100,
      circuitBreakerThreshold: 3,
      circuitBreakerResetMs: 1000,
    });
    resetNixtlaClient();
  });

  describe('Circuit Breaker', () => {
    it('should start in closed state', () => {
      const state = client.getCircuitBreakerState();
      expect(state.state).toBe('closed');
      expect(state.failures).toBe(0);
    });

    it('should open after threshold failures', async () => {
      // Mock failed requests - use a client that will actually make requests and fail
      const mockClient = new NixtlaClient({
        apiKey: 'invalid',
        baseUrl: 'https://invalid.url.that.does.not.exist',
        maxRetries: 0,
        circuitBreakerThreshold: 3,
        timeout: 1000,
      });

      // Cause 3 failures - these will fail due to network errors
      for (let i = 0; i < 3; i++) {
        try {
          await mockClient.forecast({
            timeseries: [{ timestamp: '2024-01-01T00:00:00Z', value: 1 }],
            horizon: 1,
            frequency: '1h',
          });
        } catch (error) {
          // Expected to fail
        }
      }

      const state = mockClient.getCircuitBreakerState();
      expect(state.state).toBe('open');
      expect(state.failures).toBeGreaterThanOrEqual(3);
    });

    it('should reset circuit breaker', () => {
      client.resetCircuitBreaker();
      const state = client.getCircuitBreakerState();
      expect(state.state).toBe('closed');
      expect(state.failures).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should return false for invalid API key', async () => {
      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });
});

// =============================================================================
// Webhook Verifier Tests
// =============================================================================

describe('WebhookVerifier', () => {
  const secret = 'test-secret-key-123';
  let verifier: WebhookVerifier;

  beforeEach(() => {
    verifier = new WebhookVerifier({ secret });
    resetWebhookVerifiers();
  });

  describe('Signature Verification', () => {
    it('should verify valid signature', () => {
      const payload = JSON.stringify({ event: 'test', data: 'hello' });
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signWebhookPayload(payload, secret, timestamp);

      const result = verifier.verify(payload, signature);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ event: 'test' });
      const wrongSignature = 't=1234567890,v1=invalid';

      const result = verifier.verify(payload, wrongSignature);
      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should reject tampered payload', () => {
      const originalPayload = JSON.stringify({ amount: 100 });
      const signature = signWebhookPayload(originalPayload, secret);

      const tamperedPayload = JSON.stringify({ amount: 999 });
      const result = verifier.verify(tamperedPayload, signature);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Signature mismatch');
    });

    it('should reject old webhooks', () => {
      const payload = JSON.stringify({ event: 'test' });
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s ago (> 5 min)
      const signature = signWebhookPayload(payload, secret, oldTimestamp);

      const result = verifier.verify(payload, signature);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too old');
    });

    it('should reject future webhooks', () => {
      const payload = JSON.stringify({ event: 'test' });
      const futureTimestamp = Math.floor(Date.now() / 1000) + 200; // 200s in future
      const signature = signWebhookPayload(payload, secret, futureTimestamp);

      const result = verifier.verify(payload, signature);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('future');
    });
  });

  describe('Signature Formats', () => {
    it('should parse Stripe-style signature', () => {
      const header = 't=1234567890,v1=abc123def456';
      const parsed = parseWebhookSignature(header);

      expect(parsed).toBeDefined();
      expect(parsed?.timestamp).toBe(1234567890);
      expect(parsed?.signature).toBe('abc123def456');
      expect(parsed?.version).toBe('v1');
    });

    it('should parse GitHub-style signature', () => {
      const header = 'sha256=abc123def456';
      const parsed = parseWebhookSignature(header);

      expect(parsed).toBeDefined();
      expect(parsed?.signature).toBe('abc123def456');
      expect(parsed?.version).toBe('sha256');
    });

    it('should parse raw signature', () => {
      const header = 'abc123def456';
      const parsed = parseWebhookSignature(header);

      expect(parsed).toBeDefined();
      expect(parsed?.signature).toBe('abc123def456');
    });

    it('should reject invalid format', () => {
      const header = 'invalid-format!!!';
      const parsed = parseWebhookSignature(header);

      expect(parsed).toBeNull();
    });
  });

  describe('Signing', () => {
    it('should sign payload with timestamp', () => {
      const payload = 'test payload';
      const signature = verifier.sign(payload);

      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
    });

    it('should use custom timestamp', () => {
      const payload = 'test';
      const timestamp = 1234567890;
      const signature = verifier.sign(payload, timestamp);

      expect(signature).toContain(`t=${timestamp}`);
    });
  });

  describe('Standalone Functions', () => {
    it('should verify with standalone function', () => {
      const payload = 'test data';
      const signature = signWebhookPayload(payload, secret);

      const isValid = verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    it('should reject with wrong secret', () => {
      const payload = 'test data';
      const signature = signWebhookPayload(payload, secret);

      const isValid = verifyWebhookSignature(
        payload,
        signature,
        'wrong-secret'
      );
      expect(isValid).toBe(false);
    });
  });
});

// =============================================================================
// Health Monitor Tests
// =============================================================================

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    resetHealthMonitor();
    monitor = new HealthMonitor();
  });

  describe('Registration', () => {
    it('should register health checker', () => {
      monitor.register('test-service', async () => true);

      const checkers = monitor.listCheckers();
      expect(checkers).toContain('test-service');
    });

    it('should unregister health checker', () => {
      monitor.register('test-service', async () => true);
      monitor.unregister('test-service');

      const checkers = monitor.listCheckers();
      expect(checkers).not.toContain('test-service');
    });

    it('should allow replacing checker', () => {
      monitor.register('test-service', async () => true);
      monitor.register('test-service', async () => false);

      const checkers = monitor.listCheckers();
      expect(checkers).toHaveLength(1);
    });
  });

  describe('Health Checks', () => {
    it('should check individual service', async () => {
      monitor.register('healthy-service', async () => true);

      const result = await monitor.check('healthy-service');

      expect(result.name).toBe('healthy-service');
      expect(result.healthy).toBe(true);
      expect(result.status).toBe('healthy');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should detect unhealthy service', async () => {
      monitor.register('unhealthy-service', async () => false);

      const result = await monitor.check('unhealthy-service');

      expect(result.healthy).toBe(false);
      expect(result.status).toBe('unhealthy');
    });

    it('should handle checker errors', async () => {
      monitor.register('error-service', async () => {
        throw new Error('Service unavailable');
      });

      const result = await monitor.check('error-service');

      expect(result.healthy).toBe(false);
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Service unavailable');
    });

    it('should check all services', async () => {
      monitor.register('service1', async () => true);
      monitor.register('service2', async () => true);
      monitor.register('service3', async () => false);

      const report = await monitor.checkAll();

      expect(report.checks).toHaveLength(3);
      expect(report.summary.total).toBe(3);
      expect(report.summary.healthy).toBe(2);
      expect(report.summary.unhealthy).toBe(1);
    });
  });

  describe('Status Reporting', () => {
    it('should report healthy when all checks pass', async () => {
      monitor.register('service1', async () => true);
      monitor.register('service2', async () => true);

      const report = await monitor.checkAll();
      expect(report.status).toBe('healthy');
    });

    it('should report unhealthy when critical check fails', async () => {
      monitor.register('critical-service', async () => false, true);
      monitor.register('normal-service', async () => true, false);

      const report = await monitor.checkAll();
      expect(report.status).toBe('unhealthy');
    });

    it('should report degraded when non-critical check fails', async () => {
      monitor.register('critical-service', async () => true, true);
      monitor.register('optional-service', async () => false, false);

      const report = await monitor.checkAll();
      expect(report.status).toBe('degraded');
    });
  });

  describe('History', () => {
    it('should track check history', async () => {
      monitor.register('test-service', async () => true);

      await monitor.check('test-service');
      await monitor.check('test-service');

      const history = monitor.getHistory('test-service');
      expect(history).toHaveLength(2);
    });

    it('should get last check result', async () => {
      monitor.register('test-service', async () => true);

      await monitor.check('test-service');

      const lastCheck = monitor.getLastCheck('test-service');
      expect(lastCheck).toBeDefined();
      expect(lastCheck?.healthy).toBe(true);
    });

    it('should calculate statistics', async () => {
      monitor.register('test-service', async () => true);

      await monitor.check('test-service');
      await monitor.check('test-service');

      const stats = monitor.getStats('test-service');
      expect(stats).toBeDefined();
      expect(stats?.totalChecks).toBe(2);
      expect(stats?.successRate).toBe(1.0);
    });
  });

  describe('Global Functions', () => {
    it('should register on global monitor', async () => {
      registerHealthCheck('global-service', async () => true);

      const monitor = getHealthMonitor();
      const checkers = monitor.listCheckers();
      expect(checkers).toContain('global-service');
    });

    it('should check all with global function', async () => {
      registerHealthCheck('service1', async () => true);
      registerHealthCheck('service2', async () => true);

      const report = await checkAllHealth();
      expect(report.checks).toHaveLength(2);
    });
  });
});
