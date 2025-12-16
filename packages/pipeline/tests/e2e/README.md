# IntentVision E2E Integration Tests

Task ID: **intentvision-7yf** (Phase E: Integration Testing)

## Overview

Comprehensive end-to-end integration tests for the IntentVision pipeline, covering the complete data flow from ingestion through forecasting, anomaly detection, and alerting.

## Test Structure

### Test Files

1. **setup.ts** - Test utilities and helpers
   - `createTestDatabase()`: In-memory libSQL database setup
   - `seedTestData()`: Insert test fixtures
   - `cleanupTestData()`: Truncate tables
   - `generateSyntheticMetrics()`: Create test data
   - `generateSyntheticTimeSeries()`: Time series generation
   - Multi-tenant helpers and verification functions

2. **full-pipeline.test.ts** - Complete pipeline flow (13 tests)
   - Full pipeline execution with synthetic data
   - Fixture data processing
   - Multiple pipeline runs
   - Multi-tenant org isolation
   - Database state verification
   - High variance/anomaly detection
   - Forecast alert generation
   - Concurrent pipeline runs
   - Observability tracking
   - Minimal data handling
   - Time series querying
   - Webhook integration
   - Idempotency testing

3. **api-endpoints.test.ts** - HTTP endpoint testing (13 tests)
   - Valid POST request handling
   - CORS preflight (OPTIONS) validation
   - Non-POST method rejection (405)
   - Missing required fields validation
   - Response structure verification
   - Error response handling
   - Optional parameter acceptance
   - CORS headers in all responses
   - Unique request ID generation
   - Numeric parameter range validation
   - PipelineRequest interface validation
   - PipelineResponse interface validation
   - Timestamp format validation

4. **forecast-backends.test.ts** - Backend switching (21 tests)
   - StubBackend forecasting
   - StatisticalBackend forecasting
   - NixtlaBackend in mock mode
   - Backend health detection
   - Backend capabilities reporting
   - ForecastService default routing
   - Specific backend routing
   - Available backends listing
   - Health check on all backends
   - Backend error handling
   - Mock mode enable/disable
   - Anomaly detection with Nixtla
   - Backend registry registration
   - Backend listing
   - Default backend management
   - Registry health checks
   - Healthy backend filtering
   - Capabilities retrieval
   - Anomaly detector registry
   - Default detector management
   - Detector health checks

5. **data-integrity.test.ts** - Data consistency (15 tests)
   - Duplicate metric ingestion handling
   - Unique constraint enforcement
   - Overlapping batch handling
   - Invalid metric key rejection
   - Invalid value rejection
   - Timestamp validation
   - Dimension limits enforcement
   - Metric normalization
   - Organization existence enforcement
   - Referential integrity maintenance
   - Org_id isolation verification
   - Cross-org data protection
   - Forecast job isolation
   - Timestamp consistency
   - Dimension data integrity

## Test Statistics

- **Total Test Files**: 5 (4 test files + 1 setup file)
- **Total Test Cases**: 62
- **Test Coverage Areas**:
  - Full pipeline integration: 13 tests
  - API endpoints: 13 tests
  - Forecast backends: 21 tests
  - Data integrity: 15 tests

## Running Tests

### Run All E2E Tests

```bash
npm run test:pipeline
# or
npm run test:e2e
```

### Run Specific Test File

```bash
npx vitest run tests/e2e/full-pipeline.test.ts
npx vitest run tests/e2e/api-endpoints.test.ts
npx vitest run tests/e2e/forecast-backends.test.ts
npx vitest run tests/e2e/data-integrity.test.ts
```

### Run with Database Path

Due to SQLite locking issues with concurrent access, use an absolute path:

```bash
INTENTVISION_DB_URL="file:/absolute/path/to/db/intentvision.db" npm run test:pipeline
```

## Test Design Principles

### 1. Test Pyramid
- Many unit tests (forecast backends, validation)
- Fewer integration tests (pipeline flow)
- Minimal E2E tests (critical paths)

### 2. Arrange-Act-Assert Pattern
All tests follow AAA structure for clarity:
```typescript
// Arrange
const config = { orgId: 'test', ... };

// Act
const result = await runPipeline(config);

// Assert
expect(result.success).toBe(true);
```

### 3. Test Behavior, Not Implementation
Tests verify outcomes and contracts, not internal implementation details.

### 4. Deterministic Tests
- No flakiness through proper cleanup
- Synthetic data with controlled randomness
- Sequential execution for database access

### 5. Fast Feedback
- Parallel execution where possible
- Mocked external dependencies
- In-memory databases for setup.ts utilities

## Known Issues

### Database Locking
SQLite doesn't handle concurrent writes well. Tests use `fileParallelism: false` in vitest.config.ts to run test files sequentially, but tests within a single file may still encounter SQLITE_BUSY errors when accessing shared database.

**Workarounds:**
1. Use absolute database paths with `INTENTVISION_DB_URL`
2. Run tests sequentially with proper cleanup
3. Consider using separate test databases per suite
4. Future: Migrate to Turso remote database for tests

## Test Coverage

### Pipeline Stages Covered
✅ Ingest (webhook, fixture, synthetic)
✅ Normalize (validation, transformation)
✅ Store (metrics spine, deduplication)
✅ Forecast (stub, statistical, Nixtla)
✅ Anomaly (detection, scoring)
✅ Alert (generation, routing)
✅ Observability (logging, metrics)

### Multi-Tenancy Covered
✅ Org isolation verification
✅ Cross-org data protection
✅ Concurrent org operations
✅ Org-specific forecasts and alerts

### Error Scenarios Covered
✅ Invalid input validation
✅ Duplicate detection
✅ Backend failures
✅ Database constraints
✅ Timestamp violations
✅ Dimension limits

## Future Enhancements

1. **Performance Tests**: Add load testing for high-volume scenarios
2. **Chaos Testing**: Test resilience to partial failures
3. **Integration with Real Services**: Test against actual Nixtla API (with mocking fallback)
4. **Database Migration Tests**: Verify schema evolution
5. **Snapshot Testing**: Visual regression for dashboards
6. **Contract Tests**: Ensure API backward compatibility

## Contributing

When adding new tests:
1. Follow existing patterns in setup.ts
2. Use descriptive test names
3. Clean up test data in beforeEach/afterAll
4. Include both happy path and edge cases
5. Document any new test utilities
6. Ensure tests are deterministic

## Related Documentation

- [Phase E Implementation](../../../000-docs/phases/phase-e-testing.md)
- [Pipeline Architecture](../../../README.md)
- [Database Schema](../../../db/migrations/)
- [Vitest Configuration](../../vitest.config.ts)
