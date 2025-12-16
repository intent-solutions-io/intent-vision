# Phase E2E AAR - Single-Metric Forecast Demo

> End-to-end demonstration of metric ingestion, forecasting, and visualization

---

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | `E2E - Single-Metric Forecast Demo` |
| **Repo/App** | `intentvision` |
| **Owner** | Engineering |
| **Date/Time (CST)** | 2025-12-15 |
| **Status** | `FINAL` |
| **Related Issues/PRs** | Epic: `intentvision-r4j` |
| **Commit(s)** | Pending |

---

## Beads / Task IDs Touched

| Task ID | Status | Title |
|---------|--------|-------|
| `intentvision-r4j` | `open` | Phase E2E: Single-Metric Forecast Demo (Epic) |
| `intentvision-310` | `completed` | Implement Firestore MetricsRepository |
| `intentvision-bpz` | `completed` | Create forecast demo service |
| `intentvision-x8o` | `completed` | Add demo API endpoints |
| `intentvision-7ce` | `completed` | Add minimal demo UI |
| `intentvision-zun` | `completed` | Add E2E tests and demo script |
| `intentvision-g67` | `completed` | Create E2E Demo Phase AAR |

**Beads Status:** `Active`

---

## Executive Summary

- Created Firestore-backed MetricsRepository for demo metric data storage
- Implemented forecast demo service with stub, statistical, and TimeGPT backends
- Added demo API endpoints (`/v1/demo/*`) with proper auth and error handling
- Built minimal React demo UI at `/demo/forecast` for testing the flow
- Created unit tests and E2E demo script for validation
- Beads/AgentFS remain internal-only tools, never exposed as runtime dependencies

---

## What Changed

### Data Layer (`packages/api/src/data/metrics-repository.ts`)

| Type | Change | Purpose |
|------|--------|---------|
| `MetricPoint` | New interface | Timestamp + value pair for time series |
| `MetricDefinition` | New interface | Metric metadata (name, unit, description) |
| `ForecastResult` | New interface | Forecast output with points and model info |
| `MetricsRepository` | New interface | Repository pattern contract |
| `FirestoreMetricsRepository` | New class | Firestore-backed implementation |

**Collection Structure:**
```
orgs/{orgId}/demoMetrics/{metricId}          - metric definition
orgs/{orgId}/demoMetrics/{metricId}/points   - historical points (sub-collection)
orgs/{orgId}/demoMetrics/{metricId}/forecasts - forecast results (sub-collection)
```

### Service Layer (`packages/api/src/services/forecast-demo-service.ts`)

| Function | Purpose |
|----------|---------|
| `ingestDemoMetric()` | Ingest metric data, create metric definition |
| `runDemoForecast()` | Execute forecast with selected backend |
| `getDemoMetricData()` | Retrieve metric with recent points and forecast |
| `getAvailableBackends()` | List available forecast backends |
| `isTimeGptAvailable()` | Check if TimeGPT is configured |

**Backends:**
- `stub`: Synthetic forecast data for testing
- `stat`: Statistical methods (EWMA, SMA, Linear)
- `timegpt`: Nixtla TimeGPT API (requires `NIXTLA_API_KEY`)

### API Routes (`packages/api/src/routes/demo.ts`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/demo/ingest` | POST | Ingest demo metric data |
| `/v1/demo/forecast` | POST | Run forecast on demo metric |
| `/v1/demo/metric` | GET | Get metric with latest forecast |
| `/v1/demo/backends` | GET | List available backends |

**Scope Requirements:**
- `ingest:write` - POST /v1/demo/ingest
- `metrics:read` - POST /v1/demo/forecast, GET /v1/demo/metric

### Frontend (`packages/web/src/pages/ForecastDemoPage.tsx`)

| Feature | Description |
|---------|-------------|
| Configuration | API URL, API key, metric ID/name inputs |
| Data Ingestion | JSON editor with sample data generator |
| Forecast Control | Backend selector, horizon slider |
| Visualization | Bar chart with historical + forecast points |
| Results Display | Stats, model info, forecast points |

### Tests (`packages/api/src/tests/forecast-demo.test.ts`)

| Test Suite | Coverage |
|------------|----------|
| `getAvailableBackends` | Backend availability logic |
| `ingestDemoMetric` | Data ingestion with edge cases |
| `runDemoForecast` | Forecast execution with different backends |
| `getDemoMetricData` | Data retrieval and assembly |
| `E2E Flow` | Complete ingest → forecast → retrieve |

### Scripts (`packages/api/src/scripts/demo-e2e.ts`)

Interactive demo script demonstrating:
1. Sample MRR data generation (90 days)
2. Backend availability check
3. Stub forecast (7 days)
4. Statistical EWMA forecast (14 days)
5. Metric data retrieval

---

## Key Design Decisions

### 1. Separate Demo Collection

Demo metrics stored in `demoMetrics` collection (not production `metrics`):
- Isolates demo data from production
- Allows different schema/structure for experimentation
- Easy to clean up demo data without affecting production

### 2. Backend Abstraction

Flexible backend system allows:
- Quick testing with `stub` backend
- Production-quality with `stat` backend
- Premium forecasting with `timegpt` when configured
- Easy addition of new backends (Prophet, etc.)

### 3. Repository Pattern

Consistent data access pattern:
- Interface-based for testability
- Singleton pattern for connection reuse
- Firestore-specific implementation details hidden

### 4. Multi-tenant Isolation

All operations scoped by `orgId`:
- Metrics stored under `orgs/{orgId}/demoMetrics/*`
- API key authentication extracts orgId automatically
- No cross-organization data leakage

---

## How to Verify

```bash
# 1. Start Firestore emulator
firebase emulators:start --only firestore

# 2. Start API server (in another terminal)
cd packages/api
npm run dev

# 3. Run seed script to get API key
npm run seed:dev

# 4. Run E2E demo script
API_KEY=iv_xxx npm run demo:e2e

# 5. Start web UI (in another terminal)
cd packages/web
npm run dev

# 6. Navigate to http://localhost:5173/demo/forecast

# 7. Run tests
cd packages/api
npm test
```

---

## Risks / Gotchas

- **Firebase emulator required** - Demo won't work without Firestore emulator running
- **TimeGPT requires API key** - `NIXTLA_API_KEY` must be set for TimeGPT backend
- **No data validation** - Demo accepts any JSON array as points
- **No rate limiting** - Demo endpoints don't have rate limits
- **Chart is basic** - Bar chart is functional but not production-ready

---

## Rollback Plan

1. Remove `packages/api/src/data/metrics-repository.ts`
2. Remove `packages/api/src/services/forecast-demo-service.ts`
3. Remove `packages/api/src/routes/demo.ts`
4. Remove demo route imports and routing from `index.ts`
5. Remove `packages/web/src/pages/ForecastDemoPage.tsx`
6. Remove ForecastDemoPage route from `App.tsx`
7. Remove `packages/api/src/tests/forecast-demo.test.ts`
8. Remove `packages/api/src/scripts/demo-e2e.ts`
9. Revert `package.json` script changes

---

## Open Questions

- [ ] Should demo endpoints require specific demo scope?
- [ ] How long should demo data be retained?
- [ ] Should we add demo data cleanup endpoint?
- [ ] When to replace bar chart with proper charting library?
- [ ] Should demo support bulk forecast comparison?

---

## TODOs for Future Phases

- [ ] Add proper charting library (Chart.js, Recharts)
- [ ] Add demo data cleanup/reset endpoint
- [ ] Add forecast comparison view (multiple backends)
- [ ] Add confidence interval visualization
- [ ] Add export to CSV/JSON functionality
- [ ] Add demo data retention policy

---

## Next Actions

| Action | Owner | Due |
|--------|-------|-----|
| Phase 6: Production Dashboard | Engineering | Next phase |
| Firebase Auth integration | Engineering | Phase 6 |
| Charting library upgrade | Engineering | Phase 6 |

---

## Evidence Links / Artifacts

### Files Created

| File | Action | Purpose |
|------|--------|---------|
| `packages/api/src/data/metrics-repository.ts` | `created` | Firestore metrics repository |
| `packages/api/src/services/forecast-demo-service.ts` | `created` | Forecast orchestration service |
| `packages/api/src/routes/demo.ts` | `created` | Demo API endpoints |
| `packages/web/src/pages/ForecastDemoPage.tsx` | `created` | Demo UI page |
| `packages/api/src/tests/forecast-demo.test.ts` | `created` | Unit tests |
| `packages/api/src/scripts/demo-e2e.ts` | `created` | E2E demo script |
| `000-docs/036-AA-AACR-phase-e2e-single-metric-forecast-demo.md` | `created` | This AAR |

### Files Modified

| File | Action | Purpose |
|------|--------|---------|
| `packages/api/src/index.ts` | `modified` | Added demo routes, version 0.6.0 |
| `packages/api/package.json` | `modified` | Added demo:e2e script |
| `packages/web/src/App.tsx` | `modified` | Added /demo/forecast route |

### Commits

| Hash | Message |
|------|---------|
| `pending` | `feat: Phase E2E Single-Metric Forecast Demo [Epic: intentvision-r4j]` |

### AgentFS Snapshots

| Snapshot ID | Timestamp | Description |
|-------------|-----------|-------------|
| N/A | - | No snapshots this phase |

**AgentFS Status:** `Active` (not used this phase)

---

## Phase Completion Checklist

- [x] Firestore MetricsRepository implemented
- [x] Forecast demo service with multiple backends
- [x] Demo API endpoints (/v1/demo/*)
- [x] Minimal demo UI at /demo/forecast
- [x] Unit tests for service functions
- [x] E2E demo script for manual testing
- [x] Phase AAR with Beads Task IDs
- [x] Beads/AgentFS not exposed as runtime dependencies
- [x] Internal tools not exposed to public API

---

## Exit Criteria Summary

| Criterion | Status |
|-----------|--------|
| MetricsRepository in Firestore | PASS |
| Forecast service with backends | PASS |
| Demo API endpoints | PASS |
| Demo UI page | PASS |
| Unit tests | PASS |
| E2E demo script | PASS |
| Beads tracking throughout | PASS |
| AAR with Beads references | PASS |
| No Beads/AgentFS in runtime | PASS |

**Phase E2E Complete. Ready for Phase 6 (Production Dashboard).**

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
