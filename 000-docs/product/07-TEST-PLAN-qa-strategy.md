# Test Plan and QA Strategy

> IntentVision - Time Series Forecasting and Anomaly Detection Platform

---

## Document Information

| Field | Value |
|-------|-------|
| **Project** | IntentVision |
| **Document Type** | Test Plan and QA Strategy |
| **Version** | 1.0 |
| **Last Updated** | 2025-12-15 |
| **Status** | Active |
| **Current Test Count** | 147 tests passing |

---

## Table of Contents

1. [Overview](#overview)
2. [Test Scope](#test-scope)
3. [Test Strategy](#test-strategy)
4. [Test Environment](#test-environment)
5. [Test Categories](#test-categories)
6. [Test Data Management](#test-data-management)
7. [Automated Testing](#automated-testing)
8. [Manual Testing](#manual-testing)
9. [Test Coverage](#test-coverage)
10. [Defect Management](#defect-management)
11. [Test Schedule](#test-schedule)

---

## Overview

### Purpose
This document defines the testing strategy, approach, and procedures for the IntentVision platform. It ensures comprehensive quality assurance across all components.

### Current Test Summary

| Package | Tests | Status |
|---------|-------|--------|
| Pipeline | 113 | Passing |
| Operator | 34 | Passing |
| Contracts | Included in Pipeline | Passing |
| **Total** | **147** | **All Passing** |

### Testing Philosophy
1. **Test at the boundaries** - Validate inputs/outputs at integration points
2. **Contract-driven testing** - TypeScript types as executable specifications
3. **Mock external dependencies** - Isolate from network and third-party services
4. **Continuous integration** - Tests run on every commit

---

## Test Scope

### In Scope

| Component | Description | Test Type |
|-----------|-------------|-----------|
| Contracts Package | TypeScript type definitions | Unit, Contract |
| Pipeline Package | Data processing pipeline | Unit, Integration |
| Operator Package | SaaS control plane | Unit, Integration |
| Database Migrations | Schema changes | Migration |
| API Endpoints | HTTP handlers | Integration, E2E |
| Forecast Backends | Nixtla, Statistical, Stub | Unit, Mock |
| Alert Rules Engine | Rule evaluation | Unit |
| Authentication | API key validation | Unit, Security |

### Out of Scope

| Item | Reason |
|------|--------|
| Nixtla API (live) | External service, mocked instead |
| Firebase Authentication | Future phase (Phase C) |
| Production Infrastructure | Separate deployment testing |
| UI/Frontend | No frontend yet |
| Load Testing | Separate performance testing phase |

---

## Test Strategy

### Testing Pyramid

```
                    /\
                   /  \
                  / E2E \      <- 5% (Critical paths)
                 /______\
                /        \
               /  Integ   \    <- 20% (API, Database)
              /____________\
             /              \
            /     Unit       \  <- 75% (Logic, Functions)
           /__________________\
```

### Strategy by Layer

#### Unit Tests (75%)
- **Purpose**: Validate individual functions and classes
- **Isolation**: No external dependencies
- **Speed**: < 10ms per test
- **Examples**:
  - Metric validation
  - Alert condition evaluation
  - API key hashing

#### Integration Tests (20%)
- **Purpose**: Validate component interactions
- **Dependencies**: Database, mocked external services
- **Speed**: < 500ms per test
- **Examples**:
  - Webhook ingestion pipeline
  - Forecast with mock backend
  - Alert lifecycle transitions

#### End-to-End Tests (5%)
- **Purpose**: Validate critical user journeys
- **Dependencies**: Full system stack
- **Speed**: < 5s per test
- **Examples**:
  - Ingest -> Forecast -> Alert flow
  - Authentication -> API access flow

---

## Test Environment

### Local Development
```bash
# Run all tests
npm test

# Run pipeline tests
npm test --workspace=packages/pipeline

# Run operator tests
npm test --workspace=packages/operator

# Run with coverage
npm test -- --coverage
```

### Environment Variables

| Variable | Test Value | Description |
|----------|------------|-------------|
| `INTENTVISION_DB_URL` | `file:test.db` | In-memory test database |
| `NIXTLA_API_KEY` | Not set (mock mode) | Nixtla mocked in tests |
| `NODE_ENV` | `test` | Test environment flag |

### Test Database
- **Engine**: SQLite (in-memory or temp file)
- **Setup**: Migrations run before each test suite
- **Teardown**: Database reset after each test
- **Isolation**: Each test gets clean state

---

## Test Categories

### 1. Contract Tests

**Purpose**: Validate type definitions against fixtures

**Location**: `packages/contracts/tests/contracts.test.ts`

**Test Cases**:
| Test | Description |
|------|-------------|
| Canonical Metric Validation | Valid metrics pass validation |
| Invalid Metric Rejection | Invalid metrics throw errors |
| Factory Function | createCanonicalMetric works correctly |
| Time Series Structure | TimeSeries object validates |
| Metric Batch Structure | MetricBatch validates |
| Forecast Request/Response | Forecast contracts validate |
| Anomaly Request/Response | Anomaly contracts validate |
| Alert Trigger/Rule | Alert contracts validate |
| Cross-Contract Integration | Types work together |

### 2. Pipeline Integration Tests

**Purpose**: Validate data flow through pipeline

**Location**: `packages/pipeline/tests/integration.test.ts`

**Test Cases**:
| Test | Description |
|------|-------------|
| Ingest Valid Metrics | Metrics stored successfully |
| Partial Failure Handling | Valid metrics accepted, invalid rejected |
| Idempotency | Duplicate requests return cached response |
| Query Stored Metrics | Metrics retrievable after ingestion |
| Build Time Series | Metrics aggregated into series |
| Dead Letter Queue | Failed metrics captured |
| Schema Validation | Invalid requests rejected at boundary |

### 3. Forecast Tests

**Purpose**: Validate forecast generation and evaluation

**Location**: `packages/pipeline/tests/forecast/nixtla-timegpt.test.ts`

**Test Cases**:
| Test | Description |
|------|-------------|
| Generate Forecast (Mock) | Mock backend returns predictions |
| Prediction Intervals | 80% and 95% intervals included |
| Insufficient Data | Graceful error for < 2 points |
| Backend Health Check | Health check returns status |
| Capabilities Query | Capabilities object valid |
| Anomaly Detection (Mock) | Anomalies detected in mock mode |
| Forecast Storage | Forecasts persisted to database |

### 4. Alerting Tests

**Purpose**: Validate alert rule evaluation

**Location**: `packages/pipeline/tests/alerting.test.ts`

**Test Cases**:
| Test | Description |
|------|-------------|
| Threshold Condition | All operators (gt, gte, lt, lte, eq, neq) |
| Anomaly Condition | Severity filtering works |
| Forecast Condition | Horizon and threshold evaluation |
| Rate of Change | Rate calculation and threshold |
| Missing Data | Missing duration detection |
| Rule Registration | Rules stored and retrieved |
| Rule Matching | Dimension filters applied |
| Alert Generation | Triggers created correctly |
| Deduplication | Duplicate alerts suppressed |
| Lifecycle Transitions | State machine works |

### 5. Operator Tests

**Purpose**: Validate SaaS control plane

**Location**: `packages/operator/tests/operator.test.ts`

**Test Cases**:
| Test | Description |
|------|-------------|
| Create API Key | Key generated with hash |
| Validate API Key | Valid key returns success |
| Invalid Key Format | Non-iv_ prefix rejected |
| Key Not Found | Unknown key rejected |
| Key Expiration | Expired key rejected |
| Key Disabled | Disabled key rejected |
| Key Scopes | Scope checking works |
| Rate Limit | Rate limit applied |
| List Keys | Keys listed by org |
| Revoke Key | Key disabled successfully |
| Delete Key | Key removed permanently |
| Tenant Context | Context created and cleared |
| Org Isolation | Cross-org access prevented |

### 6. Evaluation Tests

**Purpose**: Validate forecast accuracy metrics

**Location**: `packages/pipeline/tests/eval.test.ts`

**Test Cases**:
| Test | Description |
|------|-------------|
| MAE Calculation | Mean Absolute Error correct |
| RMSE Calculation | Root Mean Square Error correct |
| MAPE Calculation | Mean Absolute Percentage Error correct |
| Perfect Forecast | Zero error for perfect match |
| Empty Arrays | Graceful handling of edge cases |
| Single Point | Single point evaluation works |

---

## Test Data Management

### Fixture Files

| File | Purpose | Location |
|------|---------|----------|
| `sample-metrics.json` | Canonical metric examples | `packages/contracts/fixtures/` |
| `sample-forecast.json` | Forecast request/response | `packages/contracts/fixtures/` |
| `sample-anomaly.json` | Anomaly detection examples | `packages/contracts/fixtures/` |
| `sample-alert.json` | Alert trigger/rule examples | `packages/contracts/fixtures/` |

### Test Data Generation

```typescript
// Generate synthetic time series
function generateTimeSeries(points: number, baseValue: number): DataPoint[] {
  return Array.from({ length: points }, (_, i) => ({
    timestamp: new Date(Date.now() - (points - i) * 60000).toISOString(),
    value: baseValue + Math.sin(i * 0.1) * 10 + Math.random() * 5,
  }));
}
```

### Data Cleanup
- Test databases deleted after test suite
- No persistent state between test runs
- Unique org IDs per test to prevent collision

---

## Automated Testing

### CI/CD Integration

**GitHub Actions Workflow**:
```yaml
name: ARV Gate
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm test
```

### Test Runner Configuration

**Vitest Configuration** (`packages/pipeline/vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
```

### Pre-Commit Checks
1. TypeScript compilation
2. Lint checks
3. Unit tests
4. Integration tests

---

## Manual Testing

### Test Procedures

#### Procedure 1: Webhook Ingestion
1. Start local server
2. Send POST request with valid metrics
3. Verify response shows accepted count
4. Query database to confirm storage
5. Send duplicate with idempotency key
6. Verify cached response returned

#### Procedure 2: Forecast Generation
1. Ingest 100+ data points for a metric
2. Request forecast with 12-hour horizon
3. Verify predictions returned
4. Check prediction intervals present
5. Verify forecast stored in database

#### Procedure 3: Alert Triggering
1. Create threshold alert rule
2. Ingest metric exceeding threshold
3. Verify alert trigger created
4. Check notification channel invoked
5. Verify alert lifecycle tracking

### Exploratory Testing Charters

| Charter | Focus Area | Time Box |
|---------|------------|----------|
| ET-001 | Edge cases in metric validation | 1 hour |
| ET-002 | Forecast accuracy with various patterns | 2 hours |
| ET-003 | Alert rule configuration combinations | 1 hour |
| ET-004 | API key security scenarios | 1 hour |
| ET-005 | Multi-tenant isolation | 1 hour |

---

## Test Coverage

### Current Coverage Targets

| Package | Line Coverage | Branch Coverage | Target |
|---------|---------------|-----------------|--------|
| Pipeline | 85% | 75% | 80% |
| Operator | 90% | 85% | 80% |
| Contracts | 95% | 90% | 90% |

### Coverage Commands
```bash
# Generate coverage report
npm test -- --coverage

# View HTML report
open coverage/index.html
```

### Uncovered Areas (Technical Debt)
- Error recovery in forecast backends
- Complex alert suppression scenarios
- Database connection pooling
- Rate limiting implementation details

---

## Defect Management

### Defect Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| **Critical** | System unusable, data loss | 4 hours |
| **High** | Major feature broken | 24 hours |
| **Medium** | Feature degraded but usable | 1 week |
| **Low** | Minor issue, workaround exists | 2 weeks |

### Defect Workflow
```
New -> Triage -> In Progress -> Code Review -> Testing -> Closed
```

### Bug Report Template
```markdown
## Summary
Brief description of the issue

## Steps to Reproduce
1. Step one
2. Step two
3. Expected result vs actual result

## Environment
- Node version:
- OS:
- Package version:

## Logs/Screenshots
Relevant error output
```

---

## Test Schedule

### Continuous Testing
- **Pre-commit**: Unit tests (< 30 seconds)
- **PR checks**: Full test suite (< 2 minutes)
- **Merge to main**: Integration tests + coverage

### Phase Testing

| Phase | Testing Focus | Duration |
|-------|---------------|----------|
| C | User auth flows | 1 week |
| D | Connection pipeline | 1 week |
| E | End-to-end integration | 2 weeks |
| F | Production deployment | 1 week |

### Regression Testing
- Run before each release
- Full test suite execution
- Manual smoke testing of critical paths
- Performance baseline comparison

---

## Appendix: Test Commands Quick Reference

```bash
# Run all tests
npm test

# Run specific package
npm test --workspace=packages/pipeline

# Run single test file
npx vitest packages/pipeline/tests/alerting.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Update snapshots
npm test -- --update

# Run in CI mode
npm test -- --run

# Debug specific test
npx vitest packages/pipeline/tests/integration.test.ts --reporter=verbose
```

---

## Appendix: Test File Structure

```
intentvision/
├── packages/
│   ├── contracts/
│   │   ├── tests/
│   │   │   └── contracts.test.ts
│   │   └── fixtures/
│   │       ├── sample-metrics.json
│   │       ├── sample-forecast.json
│   │       ├── sample-anomaly.json
│   │       └── sample-alert.json
│   │
│   ├── pipeline/
│   │   ├── tests/
│   │   │   ├── integration.test.ts
│   │   │   ├── alerting.test.ts
│   │   │   ├── eval.test.ts
│   │   │   └── forecast/
│   │   │       └── nixtla-timegpt.test.ts
│   │   └── vitest.config.ts
│   │
│   └── operator/
│       ├── tests/
│       │   └── operator.test.ts
│       └── vitest.config.ts
```

---

*Intent Solutions IO - Confidential*
