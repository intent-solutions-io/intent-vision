# Phase 1 AAR - Firestore-Backed MVP Core

> First product slice that a paying user could plausibly use

---

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | `1 - Firestore-Backed MVP Core` |
| **Repo/App** | `intentvision` |
| **Owner** | Engineering |
| **Date/Time (CST)** | 2025-12-15 23:00 CST |
| **Status** | `FINAL` |
| **Related Issues/PRs** | Epic: `intentvision-91n` |
| **Commit(s)** | Pending |

---

## Beads / Task IDs Touched

| Task ID | Status | Title |
|---------|--------|-------|
| `intentvision-91n` | `in_progress` | Phase G Production Restructure Epic |
| `intentvision-002` | `completed` | Firestore MVP core implementation |

**Beads Status:** `Active`

---

## Executive Summary

- Implemented Firestore as the primary product datastore
- Created statistical forecast backend (no external API dependency)
- Built API key authentication middleware
- Implemented three core API endpoints for MVP user journey
- Created development seed script for local testing
- All customer data flows through Firestore, not Turso

---

## What Changed

### New Files Created

| File | Purpose |
|------|---------|
| `packages/api/src/firestore/schema.ts` | Firestore collection types and schema |
| `packages/api/src/firestore/client.ts` | Firebase Admin SDK client initialization |
| `packages/api/src/forecast/statistical-backend.ts` | Statistical forecast backend (EWMA, SMA, Linear) |
| `packages/api/src/auth/api-key.ts` | API key auth middleware and key management |
| `packages/api/src/routes/v1.ts` | V1 API route handlers |
| `packages/api/src/scripts/seed-dev.ts` | Development seed script |

### Files Modified

| File | Changes |
|------|---------|
| `packages/api/package.json` | Added firebase-admin, vitest; bumped to v0.2.0 |
| `packages/api/src/index.ts` | Rewrote for Firestore-backed MVP with v1 routes |

---

## Firestore Schema

### Collections

```
organizations/{orgId}
├── apiKeys/{keyId}
├── metrics/{metricId}
├── timeseries/{seriesId}
└── forecasts/{forecastId}
```

### Example Documents

**Organization**
```json
{
  "id": "org-dev-001",
  "name": "Development Organization",
  "status": "active",
  "createdAt": "2025-12-15T23:00:00Z",
  "settings": {
    "defaultForecastHorizon": 7,
    "defaultBackend": "statistical"
  }
}
```

**API Key**
```json
{
  "id": "key_abc123",
  "orgId": "org-dev-001",
  "name": "Development Key",
  "hashedKey": "<sha256-hash>",
  "keyPrefix": "iv_abc12",
  "scopes": ["ingest", "forecast", "read"],
  "status": "active",
  "createdAt": "2025-12-15T23:00:00Z"
}
```

**Metric**
```json
{
  "id": "metric_xyz789",
  "orgId": "org-dev-001",
  "name": "mrr",
  "description": "Monthly Recurring Revenue",
  "unit": "USD",
  "dataPointCount": 31,
  "createdAt": "2025-12-15T23:00:00Z"
}
```

**Time Series Document**
```json
{
  "id": "ts_abc123",
  "orgId": "org-dev-001",
  "metricId": "metric_xyz789",
  "metricName": "mrr",
  "pointCount": 31,
  "points": [
    { "timestamp": "2025-11-15T00:00:00Z", "value": 10000 },
    { "timestamp": "2025-11-16T00:00:00Z", "value": 10100 }
  ]
}
```

**Forecast**
```json
{
  "id": "fc_def456",
  "orgId": "org-dev-001",
  "metricName": "mrr",
  "horizonDays": 7,
  "backend": "statistical",
  "status": "completed",
  "predictions": [
    {
      "timestamp": "2025-12-16T00:00:00Z",
      "predictedValue": 13150.5,
      "confidenceLower": 12500.2,
      "confidenceUpper": 13800.8,
      "confidenceLevel": 0.95
    }
  ],
  "modelInfo": {
    "name": "Statistical EWMA",
    "version": "1.0.0"
  }
}
```

---

## API Endpoints

### POST /v1/ingest/timeseries

**Request**
```bash
curl -X POST http://localhost:8080/v1/ingest/timeseries \
  -H "Content-Type: application/json" \
  -H "X-API-Key: iv_abc123..." \
  -d '{
    "metricName": "mrr",
    "points": [
      { "timestamp": "2025-12-15T00:00:00Z", "value": 13000 },
      { "timestamp": "2025-12-16T00:00:00Z", "value": 13100 }
    ]
  }'
```

**Response**
```json
{
  "success": true,
  "requestId": "req-abc123",
  "timestamp": "2025-12-15T23:00:00Z",
  "data": {
    "metricId": "metric_xyz789",
    "metricName": "mrr",
    "pointsIngested": 2,
    "duplicatesSkipped": 0
  },
  "durationMs": 150
}
```

### POST /v1/forecast/run

**Request**
```bash
curl -X POST http://localhost:8080/v1/forecast/run \
  -H "Content-Type: application/json" \
  -H "X-API-Key: iv_abc123..." \
  -d '{
    "metricName": "mrr",
    "horizonDays": 7
  }'
```

**Response**
```json
{
  "success": true,
  "requestId": "req-def456",
  "timestamp": "2025-12-15T23:00:00Z",
  "data": {
    "forecastId": "fc_def456",
    "metricName": "mrr",
    "horizonDays": 7,
    "backend": "statistical",
    "pointsGenerated": 7,
    "status": "completed"
  },
  "durationMs": 250
}
```

### GET /v1/forecast

**Request**
```bash
curl "http://localhost:8080/v1/forecast?metricName=mrr&latestOnly=true" \
  -H "X-API-Key: iv_abc123..."
```

**Response**
```json
{
  "success": true,
  "requestId": "req-ghi789",
  "timestamp": "2025-12-15T23:00:00Z",
  "data": {
    "forecasts": [
      {
        "id": "fc_def456",
        "metricName": "mrr",
        "horizonDays": 7,
        "backend": "statistical",
        "status": "completed",
        "predictions": [...]
      }
    ],
    "total": 1
  }
}
```

---

## Statistical Forecast Backend

### Methods Implemented

| Method | Description |
|--------|-------------|
| `EWMA` (default) | Exponential Weighted Moving Average with trend |
| `SMA` | Simple Moving Average |
| `Linear` | Linear Trend Extrapolation (OLS regression) |

### Interface

```typescript
interface ForecastBackend {
  readonly type: string;
  readonly name: string;
  forecast(points: TimeSeriesPoint[], options: ForecastOptions): Promise<ForecastResult>;
}
```

### Confidence Intervals

All methods generate prediction intervals at configurable confidence levels (default 95%):
- Uses appropriate z-scores for normal distribution
- Intervals widen with forecast horizon (uncertainty increases)

---

## Authentication

### API Key Format

```
iv_<timestamp>_<random>
```

Example: `iv_m5x8n2_abc123def456`

### Auth Flow

1. Client sends `X-API-Key` header (or `Authorization: Bearer <key>`)
2. Server hashes key with SHA-256
3. Searches Firestore for matching active key
4. Returns org context with scopes

### Scopes

| Scope | Allows |
|-------|--------|
| `ingest` | POST /v1/ingest/timeseries |
| `forecast` | POST /v1/forecast/run |
| `read` | GET /v1/forecast |
| `admin` | All operations |

---

## How to Verify

```bash
# Step 1: Navigate to API package
cd packages/api

# Step 2: Install dependencies
npm install

# Step 3: Start Firestore emulator (in separate terminal)
firebase emulators:start --only firestore

# Step 4: Start API server with emulator
export FIRESTORE_EMULATOR_HOST=localhost:8081
npm run dev:api

# Step 5: Run seed script (in another terminal)
npm run seed:dev
# Save the API key output

# Step 6: Test ingest endpoint
curl -X POST http://localhost:8080/v1/ingest/timeseries \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -d '{"metricName": "test", "points": [{"timestamp": "2025-12-15T00:00:00Z", "value": 100}]}'

# Step 7: Test forecast endpoint
curl -X POST http://localhost:8080/v1/forecast/run \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -d '{"metricName": "mrr", "horizonDays": 7}'

# Step 8: Verify forecast retrieval
curl "http://localhost:8080/v1/forecast?metricName=mrr" \
  -H "X-API-Key: <YOUR_API_KEY>"
```

---

## Risks / Gotchas

- **Firestore emulator required**: Local dev needs Firebase emulator running
- **Existing tests use SQLite**: Pipeline/operator tests still use Turso; API tests need separate setup
- **No rate limiting yet**: Production needs rate limiting on API endpoints
- **No key rotation**: API keys cannot be rotated without creating new key

---

## Rollback Plan

1. Revert `packages/api/src/` changes via git
2. Restore original `packages/api/src/index.ts`
3. Remove new files: `firestore/`, `auth/`, `routes/`, `forecast/`, `scripts/`
4. Revert `packages/api/package.json`

---

## Open Questions

- [ ] Firebase project ID for production?
- [ ] Firestore security rules deployment strategy?
- [ ] Should API keys include org hint for faster lookups?
- [ ] Rate limiting strategy (per key? per org?)

---

## Next Actions

| Action | Owner | Due |
|--------|-------|-----|
| Phase 2: Alert rules + notification delivery | Engineering | Next phase |
| Add Firestore security rules | Engineering | Phase 2 |
| Implement rate limiting | Engineering | Phase 2 |
| Add unit tests for statistical backend | Engineering | Phase 2 |

---

## Evidence Links / Artifacts

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `packages/api/src/firestore/schema.ts` | `created` | Firestore types |
| `packages/api/src/firestore/client.ts` | `created` | Firebase client |
| `packages/api/src/forecast/statistical-backend.ts` | `created` | Forecast engine |
| `packages/api/src/auth/api-key.ts` | `created` | Auth middleware |
| `packages/api/src/routes/v1.ts` | `created` | API routes |
| `packages/api/src/scripts/seed-dev.ts` | `created` | Dev seeding |
| `packages/api/src/index.ts` | `modified` | Main server |
| `packages/api/package.json` | `modified` | Dependencies |

### Commits

| Hash | Message |
|------|---------|
| `pending` | `feat: Phase 1 Firestore-backed MVP core [Task: intentvision-002]` |

### AgentFS Snapshots

| Snapshot ID | Timestamp | Description |
|-------------|-----------|-------------|
| N/A | - | No snapshots this phase |

**AgentFS Status:** `Active` (not used this phase)

---

## Phase Completion Checklist

- [x] Firestore defined and wired for orgs, apiKeys, timeseries, forecasts
- [x] POST /v1/ingest/timeseries endpoint exists
- [x] POST /v1/forecast/run endpoint exists
- [x] GET /v1/forecast endpoint exists
- [x] Statistical forecast backend with clean interface
- [x] API key -> org resolution works end-to-end
- [x] Phase 1 AAR created with Doc-Filing v4
- [x] Beads Task IDs referenced
- [x] Firestore schema documented
- [x] No internal tooling (AgentFS, Beads, Turso) in public API

---

## Exit Criteria Summary

| Criterion | Status |
|-----------|--------|
| Firestore is backing store for orgs/keys/metrics/forecasts | PASS |
| /v1/ingest/timeseries endpoint works | PASS |
| /v1/forecast/run endpoint works | PASS |
| /v1/forecast GET endpoint works | PASS |
| Statistical backend with clean interface | PASS |
| API key auth end-to-end | PASS |
| Phase 1 AAR with Beads Task IDs | PASS |
| No internal tools in public API | PASS |

**Phase 1 Complete. Ready for Phase 2 (Alerts + Notifications).**

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
