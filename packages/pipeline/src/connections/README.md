# External Connections Module

Phase D implementation for IntentVision - robust connection handling for external services.

## Overview

This module provides production-ready connection management for:
- **Turso/libSQL database pooling**
- **Nixtla API client with resilience**
- **Webhook signature verification**
- **Connection health monitoring**

## Components

### 1. TursoPool - Database Connection Pooling

```typescript
import { TursoPool, getTursoPool } from './connections';

// Create a pool
const pool = new TursoPool({
  url: 'libsql://your-database.turso.io',
  authToken: process.env.TURSO_TOKEN,
  poolSize: 5,
  connectionTimeoutMs: 10000,
});

// Acquire and use connection
const client = await pool.getConnection();
try {
  await client.execute('SELECT * FROM metrics');
} finally {
  pool.releaseConnection(client);
}

// Or use the helper
await pool.withConnection(async (client) => {
  return client.execute('SELECT * FROM metrics');
});

// Health check
const healthy = await pool.healthCheck();

// Graceful shutdown
await pool.drain();
```

### 2. NixtlaClient - Resilient API Client

```typescript
import { NixtlaClient } from './connections';

const client = new NixtlaClient({
  apiKey: process.env.NIXTLA_API_KEY,
  maxRetries: 3,
  baseDelayMs: 1000,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 30000,
});

// Forecast with automatic retry and circuit breaker
const result = await client.forecast({
  timeseries: [
    { timestamp: '2024-01-01T00:00:00Z', value: 100 },
    { timestamp: '2024-01-01T01:00:00Z', value: 105 },
  ],
  horizon: 24,
  frequency: '1h',
  confidenceLevels: [0.8, 0.95],
});

// Check circuit breaker state
const state = client.getCircuitBreakerState();
console.log(`Circuit breaker: ${state.state}, failures: ${state.failures}`);

// Health check
const healthy = await client.healthCheck();
```

### 3. WebhookVerifier - Signature Verification

```typescript
import { WebhookVerifier, verifyWebhookSignature } from './connections';

// Create verifier
const verifier = new WebhookVerifier({
  secret: process.env.WEBHOOK_SECRET,
  maxAgeMs: 300000, // 5 minutes
});

// Verify webhook
const result = verifier.verify(
  requestBody,
  request.headers['x-webhook-signature']
);

if (!result.valid) {
  console.error(`Webhook verification failed: ${result.reason}`);
  return res.status(401).json({ error: 'Invalid signature' });
}

// Sign outgoing webhook
const signature = verifier.sign(payload);
// Send with header: X-Webhook-Signature: ${signature}

// Standalone function
const isValid = verifyWebhookSignature(payload, signature, secret);
```

### 4. HealthMonitor - Connection Health Tracking

```typescript
import { HealthMonitor, registerHealthCheck } from './connections';

const monitor = new HealthMonitor();

// Register health checkers
monitor.register('database', async () => {
  const client = await pool.getConnection();
  try {
    await client.execute('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    pool.releaseConnection(client);
  }
});

monitor.register('nixtla-api', async () => {
  return await nixtlaClient.healthCheck();
}, true); // true = critical

monitor.register('cache', async () => {
  return await redis.ping();
}, false); // false = non-critical

// Check all services
const report = await monitor.checkAll();
console.log(`Overall status: ${report.status}`);
console.log(`Healthy: ${report.summary.healthy}/${report.summary.total}`);

// Check specific service
const dbHealth = await monitor.check('database');
console.log(`Database: ${dbHealth.status} (${dbHealth.latencyMs}ms)`);

// Get statistics
const stats = monitor.getStats('database');
console.log(`Success rate: ${stats.successRate * 100}%`);
console.log(`Avg latency: ${stats.avgLatencyMs}ms`);
```

## Features

### Turso Pool
- ✅ Configurable pool size (default: 5)
- ✅ Connection acquisition with timeout
- ✅ Automatic connection reuse
- ✅ Graceful shutdown with drain
- ✅ Idle connection cleanup
- ✅ Connection statistics

### Nixtla Client
- ✅ Exponential backoff retry (3 retries, 1s base)
- ✅ Circuit breaker (5 failures = open for 30s)
- ✅ Request timeout (30s default)
- ✅ Health check endpoint
- ✅ Forecast and anomaly detection

### Webhook Verifier
- ✅ HMAC-SHA256 signatures
- ✅ Timestamp validation (5 min max age)
- ✅ Multiple signature formats (Stripe, GitHub, raw)
- ✅ Timing-safe comparison
- ✅ Sign and verify operations

### Health Monitor
- ✅ Register multiple checkers
- ✅ Parallel health checks
- ✅ Critical vs non-critical services
- ✅ Status: healthy, degraded, unhealthy
- ✅ History tracking
- ✅ Statistics (success rate, latency)

## Test Coverage

45 comprehensive tests covering:
- Pool acquisition/release (8 tests)
- Connection timeout handling (3 tests)
- Graceful shutdown (3 tests)
- Circuit breaker states (3 tests)
- Webhook verification (8 tests)
- Signature formats (4 tests)
- Health monitoring (16 tests)

All tests passing ✅

## Usage in Pipeline

```typescript
import {
  getTursoPool,
  getNixtlaClient,
  getHealthMonitor,
  registerHealthCheck,
} from './connections';

// Initialize connections
const pool = getTursoPool();
const nixtla = getNixtlaClient();
const monitor = getHealthMonitor();

// Register health checks
registerHealthCheck('database', () => pool.healthCheck());
registerHealthCheck('nixtla', () => nixtla.healthCheck());

// Use in pipeline
const metrics = await pool.withConnection(async (client) => {
  return client.execute('SELECT * FROM metrics WHERE org_id = ?', [orgId]);
});

const forecast = await nixtla.forecast({
  timeseries: metrics.rows.map(r => ({
    timestamp: r.timestamp,
    value: r.value,
  })),
  horizon: 24,
  frequency: '1h',
});
```
