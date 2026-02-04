# 🏛️ System Architecture Design

**IntentVision - Technical Architecture Specification**

**Metadata**
- Last Updated: 2025-12-15
- Maintainer: Intent Solutions IO
- Version: Phase B

---

## 🔍 1. Architecture Context

### 1.1 Business Context
**System Purpose:** Multi-tenant time series forecasting and anomaly detection platform with pluggable ML backends.

**Business Drivers:**
- **Scalability:** Multi-tenant SaaS with isolated organizations
- **Reliability:** 99.9% uptime, graceful degradation
- **Security:** SHA-256 API keys, role-based access
- **Performance:** <200ms API response, real-time ingestion

### 1.2 Technical Constraints
**Technology Stack:**
- **Runtime:** Node.js 20+, TypeScript 5.x
- **Database:** Turso/libSQL (SQLite-compatible, edge-ready)
- **ML Backend:** Nixtla TimeGPT API
- **Package Manager:** npm with workspaces

**Compliance:**
- Cloud-agnostic (no vendor lock-in)
- GDPR-ready data handling
- Audit trail via AgentFS

---

## 🏗️ 2. System Architecture Overview

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         INTENTVISION                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│   │   INGEST    │───▶│  NORMALIZE  │───▶│    STORE    │         │
│   │  (Webhook)  │    │  (Metrics)  │    │   (Turso)   │         │
│   └─────────────┘    └─────────────┘    └──────┬──────┘         │
│                                                  │                │
│                                                  ▼                │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│   │    ALERT    │◀───│   ANOMALY   │◀───│  FORECAST   │         │
│   │  (Emit)     │    │  (Detect)   │    │ (TimeGPT)   │         │
│   └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│                         OPERATOR                                  │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│   │  API KEYS   │    │   TENANCY   │    │  DASHBOARD  │         │
│   │  (SHA-256)  │    │  (Multi-Org)│    │   (API)     │         │
│   └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│                         DATABASE                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  TURSO / LibSQL                          │   │
│   │  organizations │ metrics │ forecasts │ anomalies │ ...   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Package Structure

```
intentvision/
├── packages/
│   ├── contracts/          # Shared TypeScript interfaces
│   │   └── src/
│   │       ├── metric.ts           # CanonicalMetric
│   │       ├── time-series.ts      # TimeSeries, DataPoint
│   │       ├── forecast.ts         # ForecastBackend interface
│   │       ├── anomaly.ts          # AnomalyDetector interface
│   │       └── alert.ts            # Alert types
│   │
│   ├── pipeline/           # Core data processing
│   │   └── src/
│   │       ├── ingest/             # Data ingestion
│   │       │   ├── fixture-loader.ts
│   │       │   └── webhook/
│   │       │       ├── handler.ts
│   │       │       ├── idempotency.ts
│   │       │       └── dead-letter.ts
│   │       ├── normalize/          # Normalization
│   │       │   └── normalizer.ts
│   │       ├── store/              # Storage
│   │       │   └── metric-store.ts
│   │       ├── forecast/           # Forecasting ⭐
│   │       │   ├── nixtla-timegpt.ts     # Nixtla backend
│   │       │   ├── forecast-service.ts   # Orchestrator
│   │       │   ├── statistical-forecast.ts
│   │       │   ├── forecast-stub.ts
│   │       │   └── index.ts
│   │       ├── anomaly/            # Detection
│   │       │   └── ensemble-detector.ts
│   │       ├── alert/              # Alerting
│   │       │   └── alert-emitter.ts
│   │       ├── eval/               # Evaluation
│   │       │   └── metrics.ts
│   │       └── observability/      # Logging
│   │           └── logger.ts
│   │
│   └── operator/           # SaaS control plane
│       └── src/
│           ├── auth/               # Authentication
│           │   └── api-key.ts      # SHA-256 key management
│           ├── tenancy/            # Multi-tenancy
│           │   └── org-manager.ts
│           └── dashboard/          # Dashboard API
│               └── routes.ts
│
├── db/
│   ├── config.ts                   # LibSQL client
│   └── migrations/
│       ├── 001_initial_schema.sql  # Core tables
│       └── 002_saas_tables.sql     # SaaS tables
│
└── .beads/                         # Beads issue tracker
    └── issues.jsonl
```

---

## 🔧 3. Component Architecture

### 3.1 Forecast Backend System

```
                    ┌─────────────────────┐
                    │   ForecastService   │
                    │   (Orchestrator)    │
                    └──────────┬──────────┘
                               │
      ┌────────────────────────┼────────────────────────┐
      │                        │                        │
      ▼                        ▼                        ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│NixtlaTimeGPT  │    │ Statistical   │    │    Stub       │
│   Backend     │    │   Backend     │    │   Backend     │
├───────────────┤    ├───────────────┤    ├───────────────┤
│type: nixtla-  │    │type: custom   │    │type: custom   │
│      timegpt  │    │               │    │               │
│API: nixtla.io │    │Holt-Winters   │    │Moving Avg     │
│Mock: ✓        │    │No external    │    │Dev/test       │
└───────────────┘    └───────────────┘    └───────────────┘
```

**ForecastBackend Interface:**
```typescript
interface ForecastBackend {
  readonly type: ForecastBackendType;
  readonly name: string;
  forecast(request: ForecastRequest): Promise<ForecastResponse>;
  healthCheck(): Promise<boolean>;
  capabilities(): ForecastCapabilities;
}
```

### 3.2 Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                    TURSO SCHEMA (14 Tables)                      │
│                                                                   │
│  CORE (001_initial_schema)         SAAS (002_saas_tables)        │
│  ─────────────────────────         ──────────────────────        │
│  organizations ────────────────┐   users                         │
│  metrics       ◀───────────────┼── user_org_memberships          │
│  time_series   ◀───────────────┤   connections                   │
│  forecasts     ◀───────────────┤   api_keys ◀── SHA-256          │
│  anomalies     ◀───────────────┤   forecast_jobs                 │
│  alerts        ◀───────────────┤   notification_channels         │
│  alert_rules   ◀───────────────┤                                 │
│  ingestion_sources ◀───────────┘                                 │
│                                                                   │
│  All tables have org_id FK for multi-tenancy                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Data Flow

```
1. INGEST
   HTTP POST /webhook/metrics
   ├── Validate request
   ├── Check idempotency
   └── Convert to CanonicalMetric[]

2. NORMALIZE
   normalizeMetricBatch(metrics)
   ├── Validate metric keys
   ├── Check dimensions
   └── Return successful/failed

3. STORE
   storeMetricBatch(metrics)
   ├── Batch insert to Turso
   ├── Handle duplicates
   └── Return counts

4. FORECAST
   forecastService.forecast(request)
   ├── Create forecast job
   ├── Route to backend
   └── Store predictions

5. ANOMALY
   anomalyDetector.detect(series)
   ├── Calculate scores
   ├── Apply threshold
   └── Store anomalies

6. ALERT
   alertEmitter.emit(alert)
   ├── Check rules
   ├── Route to channels
   └── Store alert
```

---

## 🔒 4. Security Architecture

### 4.1 Authentication
- **API Keys:** SHA-256 hashed, stored in `api_keys` table
- **Scopes:** read, write, admin
- **Rotation:** Supported via key regeneration

```typescript
// packages/operator/src/auth/api-key.ts
hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}
```

### 4.2 Authorization
- **Roles:** owner, admin, member, viewer
- **Multi-tenant:** All queries filtered by `org_id`
- **Row-level security:** Enforced at application layer

### 4.3 Data Protection
- **In Transit:** TLS 1.3
- **At Rest:** SQLite encryption (Turso Cloud)
- **Keys:** Never stored in plaintext

---

## 📊 5. Observability

### 5.1 Structured Logging
```typescript
// packages/pipeline/src/observability/logger.ts
logger.info('Forecast completed', {
  correlationId: 'req_123',
  orgId: 'org_acme',
  backend: 'nixtla-timegpt',
  durationMs: 150,
});
```

### 5.2 Metrics
- Pipeline throughput
- Forecast latency
- Error rates
- Database connections

---

## 🚀 6. Deployment Architecture

### 6.1 Target Environment
```
┌─────────────────────────────────────────┐
│            Cloud Run / Container         │
│  ┌─────────────────────────────────┐    │
│  │     IntentVision API Server      │    │
│  │     (Node.js + TypeScript)       │    │
│  └─────────────────────────────────┘    │
│                    │                     │
│                    ▼                     │
│  ┌─────────────────────────────────┐    │
│  │         Turso Database           │    │
│  │     (SQLite at the edge)         │    │
│  └─────────────────────────────────┘    │
│                    │                     │
│                    ▼                     │
│  ┌─────────────────────────────────┐    │
│  │       Nixtla TimeGPT API         │    │
│  │     (External ML backend)        │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 6.2 Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `NIXTLA_API_KEY` | Production | TimeGPT authentication |
| `INTENTVISION_DB_URL` | Yes | Turso connection |
| `INTENTVISION_DB_AUTH_TOKEN` | Production | Turso Cloud auth |

---

## 📈 7. Scalability Considerations

### 7.1 Horizontal Scaling
- Stateless API servers
- Connection pooling for Turso
- Queue-based forecast processing (future)

### 7.2 Performance Targets
| Metric | Target |
|--------|--------|
| API Response | <200ms p95 |
| Forecast Latency | <2s |
| Ingestion | 1000 metrics/s |
| Concurrent Orgs | 100K |

---

## 🔗 8. Integration Points

### 8.1 External Services
| Service | Purpose | Integration |
|---------|---------|-------------|
| Nixtla TimeGPT | ML Forecasting | REST API |
| Turso Cloud | Database | LibSQL SDK |

### 8.2 Future Integrations
- Airbyte (data sources)
- Slack/PagerDuty (alerts)
- Prometheus (metrics export)

---

**✅ Architecture Status:** Production-ready for delivered phases
