# Acceptance Criteria for Features

> IntentVision - Time Series Forecasting and Anomaly Detection Platform

---

## Document Information

| Field | Value |
|-------|-------|
| **Project** | IntentVision |
| **Document Type** | Acceptance Criteria |
| **Version** | 1.0 |
| **Last Updated** | 2025-12-15 |
| **Status** | Active |

---

## Overview

This document defines the acceptance criteria for all major features in IntentVision. Each feature includes functional requirements, performance requirements, and verification procedures.

### Acceptance Criteria Format
Each criterion uses the format:
> **Given** [precondition], **When** [action], **Then** [expected result]

---

## Feature 1: Metric Ingestion

### Feature Summary
| Attribute | Value |
|-----------|-------|
| **Feature ID** | F-001 |
| **Epic** | Data Ingestion |
| **Phase** | 4, 7 |
| **Status** | Implemented |

### Functional Acceptance Criteria

#### AC-1.1: Single Metric Ingestion
**Given** a valid metric payload with org_id, metric_key, value, and timestamp
**When** the metric is submitted via POST /api/v1/ingest
**Then** the response returns success:true with accepted:1

**Verification:**
```bash
curl -X POST /api/v1/ingest \
  -H "Authorization: Bearer iv_xxxxx" \
  -d '{"org_id":"test","source_id":"api","metrics":[{"metric_key":"cpu.usage","value":45.5}]}'

# Expected: {"success":true,"accepted":1,"rejected":0}
```

#### AC-1.2: Batch Metric Ingestion
**Given** a batch of 100 valid metrics
**When** submitted in a single request
**Then** all 100 metrics are accepted and stored

**Verification:**
- Generate 100 metrics
- Submit via API
- Query database to confirm 100 records
- Response shows accepted:100

#### AC-1.3: Partial Failure Handling
**Given** a batch with 3 valid and 2 invalid metrics
**When** submitted via API
**Then** response shows accepted:3, rejected:2 with error details

**Verification:**
```json
{
  "success": false,
  "accepted": 3,
  "rejected": 2,
  "errors": [
    {"index": 1, "code": "INVALID_METRIC_KEY", "message": "..."},
    {"index": 4, "code": "INVALID_VALUE", "message": "..."}
  ]
}
```

#### AC-1.4: Idempotent Request
**Given** a request with idempotency_key
**When** the same request is submitted twice
**Then** the second response matches the first with same request_id

**Verification:**
- Submit request with idempotency_key="test-123"
- Note request_id in response
- Submit identical request
- Verify same request_id returned

#### AC-1.5: Metric Validation
**Given** a metric with invalid data (empty key, NaN value, future timestamp)
**When** submitted via API
**Then** the metric is rejected with specific error code

**Test Cases:**
| Input | Expected Error Code |
|-------|---------------------|
| Empty metric_key | INVALID_METRIC_KEY |
| metric_key starts with number | INVALID_METRIC_KEY |
| value is NaN | INVALID_VALUE |
| value is Infinity | INVALID_VALUE |
| timestamp > now + 5min | INVALID_TIMESTAMP |
| dimensions > 20 keys | INVALID_DIMENSIONS |

### Performance Acceptance Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Single metric latency | < 50ms | p95 response time |
| Batch (100) latency | < 200ms | p95 response time |
| Batch (1000) latency | < 1s | p95 response time |
| Throughput | > 10K metrics/sec | Sustained load test |

---

## Feature 2: Time Series Forecasting

### Feature Summary
| Attribute | Value |
|-----------|-------|
| **Feature ID** | F-002 |
| **Epic** | Forecasting |
| **Phase** | 4, B |
| **Status** | Implemented |

### Functional Acceptance Criteria

#### AC-2.1: Basic Forecast Generation
**Given** a time series with at least 10 data points
**When** a forecast is requested with horizon=12
**Then** 12 prediction points are returned

**Verification:**
```typescript
const response = await forecastService.forecast({
  request_id: 'test-001',
  org_id: 'test-org',
  series: timeSeries,  // 100 points
  horizon: 12,
  frequency: '1h',
});

expect(response.success).toBe(true);
expect(response.forecast.predictions.length).toBe(12);
```

#### AC-2.2: Prediction Intervals
**Given** a forecast request with confidence_levels=[0.80, 0.95]
**When** the forecast is generated
**Then** each prediction includes 80% and 95% intervals

**Verification:**
```typescript
const prediction = response.forecast.predictions[0];
expect(prediction.intervals['80']).toBeDefined();
expect(prediction.intervals['95']).toBeDefined();
expect(prediction.intervals['80'].lower).toBeGreaterThan(prediction.intervals['95'].lower);
expect(prediction.intervals['80'].upper).toBeLessThan(prediction.intervals['95'].upper);
```

#### AC-2.3: Backend Selection
**Given** multiple forecast backends registered
**When** a forecast is requested with backend='nixtla-timegpt'
**Then** the response indicates the specified backend was used

**Verification:**
- Request with backend='nixtla-timegpt'
- Verify response.backend === 'nixtla-timegpt'
- Request with backend='statistical'
- Verify response.backend === 'statistical'

#### AC-2.4: Insufficient Data Handling
**Given** a time series with only 1 data point
**When** a forecast is requested
**Then** the response returns success:false with appropriate error

**Verification:**
```typescript
const response = await forecastService.forecast({
  series: { data_points: [{ timestamp: '...', value: 42 }] },
  horizon: 12,
});

expect(response.success).toBe(false);
expect(response.error).toContain('Insufficient data');
```

#### AC-2.5: Forecast Persistence
**Given** a successful forecast
**When** checking the database
**Then** the forecast is stored with all metadata

**Verification:**
- Generate forecast
- Query forecasts table by request_id
- Verify predictions, model_info, duration_ms stored

### Performance Acceptance Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Nixtla forecast latency | < 5s | p95 response time |
| Statistical forecast latency | < 500ms | p95 response time |
| Stub forecast latency | < 50ms | p95 response time |
| Forecast with 1000 points | < 10s | p95 response time |

---

## Feature 3: Anomaly Detection

### Feature Summary
| Attribute | Value |
|-----------|-------|
| **Feature ID** | F-003 |
| **Epic** | Anomaly Detection |
| **Phase** | 4, B |
| **Status** | Implemented |

### Functional Acceptance Criteria

#### AC-3.1: Basic Anomaly Detection
**Given** a time series with an obvious spike (10x normal value)
**When** anomaly detection is run
**Then** the spike is identified as an anomaly

**Verification:**
```typescript
// Create series with spike at index 50
const series = generateNormalSeries(100);
series.data_points[50].value *= 10;

const response = await anomalyDetector.detect(series);

expect(response.anomalies.length).toBeGreaterThan(0);
expect(response.anomalies.some(a =>
  a.timestamp === series.data_points[50].timestamp
)).toBe(true);
```

#### AC-3.2: Anomaly Severity Classification
**Given** anomalies of varying magnitudes
**When** detected
**Then** severity is correctly classified (low, medium, high, critical)

**Verification:**
| Z-Score Range | Expected Severity |
|---------------|-------------------|
| 2-2.5 | low |
| 2.5-3 | medium |
| 3-4 | high |
| > 4 | critical |

#### AC-3.3: Anomaly Context
**Given** include_context:true in detection options
**When** an anomaly is detected
**Then** context includes before/after data points and statistics

**Verification:**
```typescript
const anomaly = response.anomalies[0];
expect(anomaly.context).toBeDefined();
expect(anomaly.context.before.length).toBe(5);  // default window
expect(anomaly.context.after.length).toBe(5);
expect(anomaly.context.statistics.mean).toBeGreaterThan(0);
expect(anomaly.context.statistics.std_dev).toBeGreaterThan(0);
```

#### AC-3.4: Sensitivity Control
**Given** sensitivity=0.8 (high sensitivity)
**When** anomaly detection is run
**Then** more anomalies are detected than with sensitivity=0.3

**Verification:**
- Run detection with sensitivity=0.8
- Note anomaly count
- Run detection with sensitivity=0.3
- Verify high sensitivity finds more anomalies

#### AC-3.5: No False Positives on Normal Data
**Given** a normally distributed time series with no outliers
**When** anomaly detection is run with default settings
**Then** no anomalies are detected (or very few)

**Verification:**
- Generate 100 points from normal distribution
- Run detection
- Verify anomaly count < 2 (statistical noise)

### Performance Acceptance Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Detection latency (100 points) | < 100ms | p95 response time |
| Detection latency (1000 points) | < 500ms | p95 response time |
| Detection latency (10000 points) | < 2s | p95 response time |

---

## Feature 4: Alerting Rules Engine

### Feature Summary
| Attribute | Value |
|-----------|-------|
| **Feature ID** | F-004 |
| **Epic** | Alerting |
| **Phase** | 9 |
| **Status** | Implemented |

### Functional Acceptance Criteria

#### AC-4.1: Threshold Alert Trigger
**Given** a rule with condition {type:'threshold', operator:'gt', value:90}
**When** a metric with value=95 is evaluated
**Then** an alert trigger is created

**Verification:**
```typescript
const rule = createRule({
  condition: { type: 'threshold', operator: 'gt', value: 90 }
});
const metric = createMetric({ value: 95 });

const results = rulesEngine.evaluateRules({ metric });

expect(results[0].matched).toBe(true);
expect(results[0].trigger).toBeDefined();
expect(results[0].trigger.trigger_type).toBe('threshold');
```

#### AC-4.2: All Threshold Operators
**Given** rules with each operator (gt, gte, lt, lte, eq, neq)
**When** metrics are evaluated
**Then** operators behave correctly

| Operator | Value | Threshold | Expected |
|----------|-------|-----------|----------|
| gt | 95 | 90 | Match |
| gt | 90 | 90 | No Match |
| gte | 90 | 90 | Match |
| lt | 85 | 90 | Match |
| lt | 90 | 90 | No Match |
| lte | 90 | 90 | Match |
| eq | 90 | 90 | Match |
| neq | 95 | 90 | Match |

#### AC-4.3: Anomaly-Based Alert
**Given** a rule with condition {type:'anomaly', min_severity:'medium'}
**When** evaluated with a high-severity anomaly
**Then** an alert trigger is created

**Verification:**
```typescript
const results = rulesEngine.evaluateRules({
  metric,
  anomalies: [{ severity: 'high', ... }]
});

expect(results[0].matched).toBe(true);
expect(results[0].trigger.trigger_type).toBe('anomaly');
```

#### AC-4.4: Forecast-Based Alert
**Given** a rule with condition {type:'forecast', horizon_hours:24, threshold:100}
**When** forecast predicts value > 100 within 24 hours
**Then** an alert trigger is created

**Verification:**
```typescript
const results = rulesEngine.evaluateRules({
  metric,
  forecasts: [
    { timestamp: inHours(12), value: 120 }
  ]
});

expect(results[0].matched).toBe(true);
expect(results[0].trigger.trigger_details.type).toBe('forecast');
```

#### AC-4.5: Missing Data Alert
**Given** a rule with condition {type:'missing_data', expected_interval_ms:60000}
**When** last data was 5 minutes ago
**Then** an alert trigger is created

**Verification:**
```typescript
const results = rulesEngine.evaluateRules({
  lastSeenAt: fiveMinutesAgo
});

expect(results[0].matched).toBe(true);
expect(results[0].trigger.trigger_type).toBe('missing_data');
```

#### AC-4.6: Dimension Filtering
**Given** a rule with dimension_filters {env:'prod'}
**When** metrics from different environments are evaluated
**Then** only 'prod' metrics trigger alerts

**Verification:**
- Evaluate metric with env:'prod' -> Match
- Evaluate metric with env:'dev' -> No Match
- Evaluate metric with no env -> No Match

#### AC-4.7: Alert Deduplication
**Given** a rule with suppression {dedup_window_ms:300000}
**When** same alert triggers twice within 5 minutes
**Then** second alert is suppressed

**Verification:**
- First trigger -> Alert created
- Second trigger (2 min later) -> Suppressed
- Third trigger (10 min later) -> Alert created (new window)

### Performance Acceptance Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Single rule evaluation | < 1ms | Average time |
| 100 rules evaluation | < 50ms | Total time |
| 1000 rules evaluation | < 500ms | Total time |

---

## Feature 5: API Key Authentication

### Feature Summary
| Attribute | Value |
|-----------|-------|
| **Feature ID** | F-005 |
| **Epic** | Authentication |
| **Phase** | 10, A |
| **Status** | Implemented |

### Functional Acceptance Criteria

#### AC-5.1: Key Generation
**Given** a request to create a new API key
**When** the key is generated
**Then** the raw key is returned only once and the hash is stored

**Verification:**
```typescript
const { key, rawKey } = await manager.createKey({
  orgId: 'test-org',
  name: 'Test Key'
});

expect(rawKey).toMatch(/^iv_/);
expect(key.keyHash).not.toBe(rawKey);
expect(key.keyHash.length).toBe(64);  // SHA-256 hex
```

#### AC-5.2: Key Validation - Valid Key
**Given** a valid API key
**When** validated
**Then** returns valid:true with key details

**Verification:**
```typescript
const result = await manager.validateKey(rawKey);

expect(result.valid).toBe(true);
expect(result.key.orgId).toBe('test-org');
```

#### AC-5.3: Key Validation - Invalid Format
**Given** a key without 'iv_' prefix
**When** validated
**Then** returns valid:false with error

**Verification:**
```typescript
const result = await manager.validateKey('invalid-key');

expect(result.valid).toBe(false);
expect(result.error).toBe('Invalid key format');
```

#### AC-5.4: Key Validation - Not Found
**Given** a well-formed but non-existent key
**When** validated
**Then** returns valid:false with error

**Verification:**
```typescript
const result = await manager.validateKey('iv_nonexistent');

expect(result.valid).toBe(false);
expect(result.error).toBe('Key not found');
```

#### AC-5.5: Key Expiration
**Given** a key with expiresInDays:1 created yesterday
**When** validated
**Then** returns valid:false with error

**Verification:**
- Create key with 1-day expiry
- Manually set expiresAt to yesterday
- Validate key
- Verify error is 'Key has expired'

#### AC-5.6: Key Revocation
**Given** a valid key
**When** the key is revoked
**Then** subsequent validation returns valid:false

**Verification:**
```typescript
await manager.revokeKey(key.keyId);
const result = await manager.validateKey(rawKey);

expect(result.valid).toBe(false);
expect(result.error).toBe('Key is disabled');
```

#### AC-5.7: Scope Checking
**Given** a key with scopes:['read']
**When** checking for 'write' scope
**Then** returns false

**Verification:**
```typescript
expect(manager.hasScope(key, 'read')).toBe(true);
expect(manager.hasScope(key, 'write')).toBe(false);
expect(manager.hasScope(keyWithWildcard, 'anything')).toBe(true);
```

### Security Acceptance Criteria

| Criterion | Verification |
|-----------|--------------|
| Keys never stored in plaintext | Inspect database, only hash present |
| Hash is SHA-256 | Key hash is 64 hex characters |
| Raw key is cryptographically random | Key passes randomness tests |
| Last used timestamp updated | Verify timestamp after validation |

---

## Feature 6: Multi-Tenant Isolation

### Feature Summary
| Attribute | Value |
|-----------|-------|
| **Feature ID** | F-006 |
| **Epic** | Multi-Tenancy |
| **Phase** | 10 |
| **Status** | Implemented |

### Functional Acceptance Criteria

#### AC-6.1: Data Isolation
**Given** two organizations with their own data
**When** querying metrics for org-a
**Then** only org-a's metrics are returned

**Verification:**
```typescript
// Insert metrics for both orgs
await storeMetric({ org_id: 'org-a', value: 100 });
await storeMetric({ org_id: 'org-b', value: 200 });

// Query for org-a only
const results = await queryMetrics({ orgId: 'org-a' });

expect(results.every(m => m.org_id === 'org-a')).toBe(true);
expect(results.some(m => m.org_id === 'org-b')).toBe(false);
```

#### AC-6.2: API Key Binding
**Given** an API key bound to org-a
**When** attempting to access org-b's data
**Then** access is denied

**Verification:**
- Create key for org-a
- Use key to query org-b
- Verify 403 Forbidden response

#### AC-6.3: Cross-Org Alert Prevention
**Given** an alert rule for org-a
**When** a metric from org-b is evaluated
**Then** the rule does not trigger

**Verification:**
```typescript
const rule = createRule({ org_id: 'org-a' });
const metric = createMetric({ org_id: 'org-b' });

const results = rulesEngine.evaluateRules({ metric });

expect(results.find(r => r.ruleId === rule.rule_id)).toBeUndefined();
```

#### AC-6.4: Tenant Context Propagation
**Given** a request with tenant context
**When** processing the request
**Then** context is available throughout the request lifecycle

**Verification:**
```typescript
await withTenantContext({ orgId: 'test-org' }, async (ctx) => {
  expect(ctx.orgId).toBe('test-org');
  expect(ctx.requestId).toMatch(/^req_/);

  // Verify context accessible in nested calls
  const innerContext = getContext(ctx.requestId);
  expect(innerContext.orgId).toBe('test-org');
});
```

### Security Acceptance Criteria

| Criterion | Verification |
|-----------|--------------|
| All tables have org_id FK | Schema review |
| All queries filter by org_id | Code review |
| Cross-tenant access logged | Audit log inspection |
| Org_id cannot be spoofed | API testing |

---

## Verification Checklist

### Pre-Release Verification

| Feature | Unit Tests | Integration Tests | Manual Tests | Status |
|---------|------------|-------------------|--------------|--------|
| F-001: Metric Ingestion | Pass | Pass | Pass | Ready |
| F-002: Forecasting | Pass | Pass | Pass | Ready |
| F-003: Anomaly Detection | Pass | Pass | Pass | Ready |
| F-004: Alerting Rules | Pass | Pass | Pass | Ready |
| F-005: API Key Auth | Pass | Pass | Pass | Ready |
| F-006: Multi-Tenancy | Pass | Pass | Pass | Ready |

### Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| QA Lead | | | |
| Product Owner | | | |

---

## Appendix: Test Data

### Sample Valid Metric
```json
{
  "org_id": "test-org",
  "metric_key": "system.cpu.usage",
  "timestamp": "2025-12-15T14:30:00.000Z",
  "value": 45.5,
  "dimensions": {
    "host": "server-1",
    "region": "us-east"
  }
}
```

### Sample Forecast Request
```json
{
  "request_id": "req-001",
  "org_id": "test-org",
  "series": {
    "metric_key": "system.cpu.usage",
    "data_points": [/* 100 points */]
  },
  "horizon": 12,
  "frequency": "1h",
  "options": {
    "confidence_levels": [0.80, 0.95],
    "backend": "nixtla-timegpt"
  }
}
```

### Sample Alert Rule
```json
{
  "rule_id": "rule-001",
  "org_id": "test-org",
  "name": "High CPU Alert",
  "description": "Alert when CPU exceeds 90%",
  "enabled": true,
  "metric_key": "system.cpu.usage",
  "dimension_filters": { "env": "prod" },
  "condition": {
    "type": "threshold",
    "operator": "gt",
    "value": 90
  },
  "severity": "warning",
  "routing": {
    "channels": [
      { "type": "slack", "destination": "#alerts" }
    ]
  }
}
```

---

*Intent Solutions IO - Confidential*
