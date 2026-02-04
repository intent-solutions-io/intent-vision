# Architecture Decision Records (ADR)

> IntentVision - Time Series Forecasting and Anomaly Detection Platform

---

## Document Information

| Field | Value |
|-------|-------|
| **Project** | IntentVision |
| **Document Type** | Architecture Decision Records |
| **Version** | 1.0 |
| **Last Updated** | 2025-12-15 |
| **Status** | Active |

---

## Table of Contents

1. [ADR-001: Pluggable Forecast Backend Architecture](#adr-001-pluggable-forecast-backend-architecture)
2. [ADR-002: Turso/libSQL for Primary Storage](#adr-002-tursolibsql-for-primary-storage)
3. [ADR-003: SHA-256 API Key Hashing](#adr-003-sha-256-api-key-hashing)
4. [ADR-004: Multi-Tenant Organization Isolation](#adr-004-multi-tenant-organization-isolation)
5. [ADR-005: Canonical Metrics Spine Design](#adr-005-canonical-metrics-spine-design)
6. [ADR-006: Nixtla TimeGPT as Primary Forecast Backend](#adr-006-nixtla-timegpt-as-primary-forecast-backend)
7. [ADR-007: ESM-First TypeScript Architecture](#adr-007-esm-first-typescript-architecture)
8. [ADR-008: Webhook-Based Ingestion with Dead Letter Queue](#adr-008-webhook-based-ingestion-with-dead-letter-queue)
9. [ADR-009: Rules Engine for Alert Evaluation](#adr-009-rules-engine-for-alert-evaluation)
10. [ADR-010: Monorepo Package Structure](#adr-010-monorepo-package-structure)

---

## ADR-001: Pluggable Forecast Backend Architecture

### Status
**Accepted** - Phase 4

### Context
IntentVision needs to support multiple forecasting algorithms and services. Different use cases require different capabilities:
- Foundation models (Nixtla TimeGPT) for zero-shot forecasting
- Statistical models (Holt-Winters) for interpretable results
- Custom models for domain-specific requirements

### Decision
Implement a **pluggable forecast backend interface** (`ForecastBackend`) that allows different forecasting engines to be registered and selected at runtime.

```typescript
interface ForecastBackend {
  readonly type: ForecastBackendType;
  readonly name: string;
  forecast(request: ForecastRequest): Promise<ForecastResponse>;
  healthCheck(): Promise<boolean>;
  capabilities(): ForecastCapabilities;
}
```

### Consequences
**Positive:**
- Easy to add new forecast backends without changing core pipeline
- Supports A/B testing between models
- Graceful fallback when primary backend unavailable
- Clear capability introspection for API consumers

**Negative:**
- Additional complexity in backend registry
- Must maintain compatibility across all backend implementations
- Testing burden increases with each new backend

### Implementation
- Location: `packages/pipeline/src/forecast/`
- Registry: `packages/pipeline/src/backends/registry.ts`
- Backends: `nixtla-timegpt.ts`, `statistical-forecast.ts`, `forecast-stub.ts`

---

## ADR-002: Turso/libSQL for Primary Storage

### Status
**Accepted** - Phase A

### Context
The platform needed a database solution that:
- Works locally for development (SQLite compatibility)
- Scales for production (edge-ready, multi-region)
- Avoids BigQuery vendor lock-in
- Supports TypeScript with minimal ORM overhead

### Decision
Use **Turso** (libSQL) as the primary database with SQLite compatibility:

```typescript
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.INTENTVISION_DB_URL || 'file:db/intentvision.db',
  authToken: process.env.INTENTVISION_DB_AUTH_TOKEN,
});
```

### Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Turso/libSQL** | SQLite compatibility, edge-ready, low latency | Newer ecosystem | **Selected** |
| **BigQuery** | Powerful analytics, GCP integration | Expensive for real-time, vendor lock-in | Rejected |
| **PostgreSQL** | Battle-tested, rich features | Operational overhead | Rejected |
| **Supabase** | PostgreSQL + API layer | Additional abstraction | Rejected |

### Consequences
**Positive:**
- Zero-config local development with SQLite files
- Production deployment via Turso Cloud with edge replication
- SQL-based migrations with simple migration runner
- No ORM required - direct SQL queries

**Negative:**
- SQLite limitations (concurrent writes, JSON functions)
- Turso is relatively new (founded 2022)
- Limited tooling compared to PostgreSQL ecosystem

### Implementation
- Config: `db/config.ts`
- Migrations: `db/migrations/*.sql`
- Environment: `INTENTVISION_DB_URL`, `INTENTVISION_DB_AUTH_TOKEN`

---

## ADR-003: SHA-256 API Key Hashing

### Status
**Accepted** - Phase A

### Context
API key authentication requires secure storage of keys. Options considered:
- Plain text storage (insecure)
- bcrypt hashing (slow for high-volume validation)
- SHA-256 hashing (fast, cryptographically secure)

### Decision
Use **SHA-256** for API key hashing:

```typescript
import { createHash } from 'crypto';

function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}
```

### Rationale
- API keys are randomly generated (high entropy) - no salting needed
- Fast validation required for every API request
- Cryptographic security sufficient for non-password credentials
- Industry standard (Stripe, AWS use similar approaches)

### Key Format
```
iv_[base64url-encoded-24-bytes]
```
- Prefix `iv_` for easy identification
- 24 bytes of cryptographically secure random data
- URL-safe encoding

### Consequences
**Positive:**
- Sub-millisecond key validation
- Secure storage (one-way hash)
- Easy key rotation support
- Familiar pattern for API consumers

**Negative:**
- No rate limiting built into hash (must implement separately)
- Key compromise requires regeneration (cannot be rotated in-place)

### Implementation
- Location: `packages/operator/src/auth/api-key.ts`
- Database: `api_keys` table with `key_hash` column

---

## ADR-004: Multi-Tenant Organization Isolation

### Status
**Accepted** - Phase 10

### Context
IntentVision is a multi-tenant SaaS platform. Data isolation between organizations is critical for:
- Security and privacy compliance
- Performance isolation
- Simplified query patterns

### Decision
Implement **organization-based isolation** with `org_id` as the primary tenant identifier:

1. **Every table includes `org_id`** as a foreign key
2. **All queries filter by `org_id`** before other conditions
3. **Tenant context propagation** through request lifecycle
4. **API key binding** to specific organizations

### Schema Pattern
```sql
CREATE TABLE metrics (
    id INTEGER PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    metric_key TEXT NOT NULL,
    -- ... other columns
);

CREATE INDEX idx_metrics_org_key ON metrics(org_id, metric_key);
```

### Context Propagation
```typescript
interface TenantContext {
  requestId: string;
  orgId: string;
  userId?: string;
  apiKey?: ApiKey;
}
```

### Consequences
**Positive:**
- Strong data isolation by default
- Simple audit trail (all operations scoped to org)
- Efficient indexing on `org_id` prefix
- Clear ownership model

**Negative:**
- Cross-tenant queries require special handling
- Additional join overhead for all queries
- Must validate `org_id` at every boundary

### Implementation
- Context: `packages/operator/src/tenant/context.ts`
- Middleware: `packages/operator/src/auth/middleware.ts`
- Tables: All 14 tables include `org_id`

---

## ADR-005: Canonical Metrics Spine Design

### Status
**Accepted** - Phase 3

### Context
Time series data from multiple sources needs a unified format for:
- Consistent processing through the pipeline
- Standardized storage and querying
- Clear provenance tracking

### Decision
Define a **Canonical Metric** as the core data structure:

```typescript
interface CanonicalMetric {
  org_id: OrgId;
  metric_key: MetricKey;
  timestamp: ISOTimestamp;
  value: MetricValue;
  dimensions: Dimensions;
  provenance: Provenance;
}
```

### Design Principles
1. **Always numeric values** - no strings or complex types
2. **ISO 8601 timestamps** - UTC timezone, millisecond precision
3. **Flat dimensions** - key-value pairs only
4. **Provenance tracking** - source, ingestion time, transformations

### Naming Convention
```
snake_case.hierarchical.metric_name
```
Examples:
- `system.cpu.usage`
- `app.request.count`
- `business.revenue.daily`

### Consequences
**Positive:**
- Single data format throughout pipeline
- Clear validation rules at ingestion boundary
- Efficient storage (numeric values only)
- Strong typing in TypeScript

**Negative:**
- Requires transformation from source formats
- Limited flexibility for complex data types
- Dimension cardinality must be managed

### Implementation
- Types: `packages/contracts/src/metrics-spine.ts`
- Validation: `validateCanonicalMetric()`
- Factory: `createCanonicalMetric()`

---

## ADR-006: Nixtla TimeGPT as Primary Forecast Backend

### Status
**Accepted** - Phase B

### Context
Selecting a primary forecasting engine requires balancing:
- Accuracy (foundation model vs statistical)
- Latency (API calls vs local computation)
- Cost (per-prediction pricing vs infrastructure)
- Ease of use (zero-shot vs model training)

### Decision
Use **Nixtla TimeGPT** as the primary forecast backend with fallback to statistical methods:

```typescript
const backend = getNixtlaBackend({
  apiKey: process.env.NIXTLA_API_KEY,
  baseUrl: 'https://api.nixtla.io',
  timeout: 30000,
});
```

### Capabilities Comparison

| Capability | Nixtla TimeGPT | Statistical | Stub |
|------------|----------------|-------------|------|
| Max Horizon | 720 periods | 168 periods | 100 periods |
| Prediction Intervals | 80%, 95% | None | None |
| Batch Support | Yes | No | No |
| Exogenous Variables | Yes | No | No |
| External API | Yes | No | No |

### Mock Mode
For testing without network calls:
```typescript
backend.enableMockMode();
```

### Consequences
**Positive:**
- Zero-shot forecasting (no model training)
- State-of-the-art accuracy for most time series
- Automatic seasonality detection
- Prediction intervals included

**Negative:**
- External API dependency
- Per-prediction cost
- Network latency (~500ms per request)
- Rate limits for high-volume usage

### Implementation
- Backend: `packages/pipeline/src/forecast/nixtla-timegpt.ts`
- Service: `packages/pipeline/src/forecast/forecast-service.ts`
- Environment: `NIXTLA_API_KEY`

---

## ADR-007: ESM-First TypeScript Architecture

### Status
**Accepted** - Phase 3

### Context
Node.js supports both CommonJS and ES Modules. Modern TypeScript development benefits from ESM for:
- Tree-shaking in bundlers
- Native browser compatibility
- Cleaner import/export syntax
- Top-level await support

### Decision
Adopt **ESM-first** architecture with explicit `.js` extensions:

```json
// package.json
{
  "type": "module"
}
```

```typescript
// Explicit .js extension required
import { getClient } from './config.js';
```

### Consequences
**Positive:**
- Modern JavaScript standard
- Better tooling support (Vite, esbuild)
- Top-level await support
- Cleaner dynamic imports

**Negative:**
- Requires explicit `.js` extensions
- Some libraries have ESM compatibility issues
- `__dirname` not available (requires workaround)

### Workaround for `__dirname`
```typescript
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

### Implementation
- All packages use `"type": "module"`
- TypeScript configured with `"module": "ESNext"`
- tsx used for development execution

---

## ADR-008: Webhook-Based Ingestion with Dead Letter Queue

### Status
**Accepted** - Phase 7

### Context
Data ingestion needs to handle:
- High-volume metric streams
- Unreliable data sources
- Partial failures in batches
- Idempotent retry behavior

### Decision
Implement **webhook-based ingestion** with:
1. **Idempotency keys** - prevent duplicate processing
2. **Dead letter queue** - capture failed records
3. **Partial success** - accept valid metrics, reject invalid

### Architecture
```
Request → Validation → Idempotency Check → Normalize → Store
                                              ↓
                                    Dead Letter Queue (failures)
```

### Request Format
```typescript
interface IngestRequest {
  org_id: string;
  source_id: string;
  metrics: RawMetric[];
  idempotency_key?: string;
}
```

### Response Format
```typescript
interface IngestResponse {
  success: boolean;
  request_id: string;
  accepted: number;
  rejected: number;
  errors?: ValidationError[];
}
```

### Consequences
**Positive:**
- Reliable ingestion with retry support
- Detailed error reporting per metric
- Audit trail for failed records
- Scalable webhook architecture

**Negative:**
- Additional storage for dead letter queue
- Idempotency key management complexity
- TTL management for cached responses

### Implementation
- Handler: `packages/pipeline/src/ingest/webhook/handler.ts`
- Validator: `packages/pipeline/src/ingest/webhook/validator.ts`
- Idempotency: `packages/pipeline/src/ingest/webhook/idempotency.ts`
- Dead Letter: `packages/pipeline/src/ingest/webhook/dead-letter.ts`

---

## ADR-009: Rules Engine for Alert Evaluation

### Status
**Accepted** - Phase 9

### Context
Alert generation requires evaluating conditions against:
- Real-time metrics
- Forecast predictions
- Anomaly detections
- Historical patterns

### Decision
Implement a **rules engine** supporting multiple condition types:

```typescript
type AlertCondition =
  | { type: 'threshold'; operator: string; value: number }
  | { type: 'anomaly'; min_severity: AnomalySeverity }
  | { type: 'forecast'; horizon_hours: number; threshold: number }
  | { type: 'rate_of_change'; max_rate: number; rate_unit: string }
  | { type: 'missing_data'; expected_interval_ms: number };
```

### Evaluation Flow
```
Metric → Find Applicable Rules → Evaluate Conditions → Generate Triggers
```

### Rule Matching
1. Match `metric_key` exactly
2. Match `org_id` (tenant isolation)
3. Match dimension filters (if specified)
4. Evaluate condition against context

### Consequences
**Positive:**
- Flexible condition types
- Extensible for new conditions
- Database-backed rule storage
- Clear separation from notification

**Negative:**
- Complex rule evaluation logic
- Performance overhead for many rules
- Testing complexity for edge cases

### Implementation
- Engine: `packages/pipeline/src/alert/rules-engine.ts`
- Deduplication: `packages/pipeline/src/alert/deduplication.ts`
- Notification: `packages/pipeline/src/alert/notification-channels.ts`
- Lifecycle: `packages/pipeline/src/alert/lifecycle.ts`

---

## ADR-010: Monorepo Package Structure

### Status
**Accepted** - Phase 1

### Context
IntentVision consists of multiple components:
- Shared contracts (TypeScript interfaces)
- Data pipeline (ingest, forecast, alert)
- Operator plane (auth, tenancy, API)

### Decision
Organize as a **monorepo with npm workspaces**:

```
intentvision/
├── packages/
│   ├── contracts/      # Shared TypeScript types
│   ├── pipeline/       # Data processing pipeline
│   └── operator/       # SaaS control plane
├── db/                 # Database config and migrations
├── 000-docs/           # Documentation
└── package.json        # Workspace root
```

### Package Dependencies
```
operator → contracts
pipeline → contracts
```

### Consequences
**Positive:**
- Shared types prevent drift
- Single test run for all packages
- Atomic commits across packages
- Clear package boundaries

**Negative:**
- More complex build configuration
- Larger repository size
- Must manage inter-package dependencies

### Implementation
- Root: `package.json` with workspaces
- Contracts: Pure TypeScript types
- Pipeline: Data processing logic
- Operator: SaaS-specific logic

---

## Decision Summary Matrix

| ADR | Decision | Phase | Impact |
|-----|----------|-------|--------|
| 001 | Pluggable Forecast Backend | 4 | High |
| 002 | Turso/libSQL Storage | A | High |
| 003 | SHA-256 API Keys | A | Medium |
| 004 | Multi-Tenant Isolation | 10 | High |
| 005 | Canonical Metrics Spine | 3 | High |
| 006 | Nixtla TimeGPT | B | High |
| 007 | ESM-First TypeScript | 3 | Medium |
| 008 | Webhook Ingestion + DLQ | 7 | High |
| 009 | Rules Engine | 9 | High |
| 010 | Monorepo Structure | 1 | Medium |

---

## References

- [Nixtla TimeGPT Documentation](https://docs.nixtla.io)
- [Turso/libSQL Documentation](https://docs.turso.tech)
- [TypeScript ESM Configuration](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Architecture Decision Records](https://adr.github.io/)

---

*Intent Solutions IO - Confidential*
