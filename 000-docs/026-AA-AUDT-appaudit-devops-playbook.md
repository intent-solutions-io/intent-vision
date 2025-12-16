# IntentVision: Operator-Grade System Analysis & Operations Guide
*For: DevOps Engineer*
*Generated: 2025-12-15*
*System Version: 0697bb0 (latest)*

---

## Table of Contents
1. Executive Summary
2. Operator & Customer Journey
3. System Architecture Overview
4. Directory Deep-Dive
5. Automation & Agent Surfaces
6. Operational Reference
7. Security, Compliance & Access
8. Cost & Performance
9. Development Workflow
10. Dependencies & Supply Chain
11. Integration with Existing Documentation
12. Current State Assessment
13. Quick Reference
14. Recommendations Roadmap

---

## 1. Executive Summary

### Business Purpose

IntentVision is a **Universal Prediction Engine** designed to democratize time-series forecasting and anomaly detection for SaaS applications. The platform follows a clear data flow: **Connect sources -> Normalize metrics -> Forecast/anomaly -> Explain -> Alert/API/dashboard/agent**.

The system is architected as a multi-tenant SaaS platform with pluggable forecast backends (Nixtla TimeGPT, Statistical Holt-Winters, Stub for testing). It uses Turso (libSQL) for SQLite-compatible edge-ready storage, avoiding vendor lock-in with BigQuery.

**Current operational status**: The platform has completed 13 development phases with **307 tests passing** (220 pipeline + 87 operator). All core functionality is implemented including ingestion, normalization, storage, forecasting, anomaly detection, alerting, and multi-tenant operator controls. The system is **ready for stress testing** and production deployment.

**Strategic positioning**: IntentVision aligns with Intent Solutions' **Private AI** and **Automation** offerings - providing customers predictive intelligence without exposing data to external services (Statistical backend requires no external API). The Nixtla TimeGPT integration offers foundation model capabilities for customers who want state-of-the-art forecasting.

### Operational Status Matrix

| Environment | Status | Uptime Target | Current Uptime | Release Cadence | Active Users |
|-------------|--------|---------------|----------------|-----------------|--------------|
| Production  | Not Deployed | 99.9% | N/A | On merge to main | 0 |
| Staging     | Not Deployed | 99.0% | N/A | On PR | 0 |
| Development | Active | N/A | 100% | Continuous | 1 |

### Technology Stack Summary

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | 5.3+ | Primary language |
| Runtime | Node.js | 20+ | Server runtime |
| Database | Turso/libSQL | 0.15.15 | SQLite-compatible storage |
| Deployment | Cloud Run | - | Container hosting |
| CI/CD | GitHub Actions | v4 | Automated pipelines |
| Testing | Vitest | 1.6.1 | Test framework |
| Forecast | Nixtla TimeGPT | API | Foundation model forecasting |

---

## 2. Operator & Customer Journey

### Primary Personas

- **Operators (Internal)**: DevOps engineers, platform administrators who manage deployments, monitor system health, and troubleshoot issues.
- **External Customers**: SaaS product teams who integrate IntentVision to add forecasting/anomaly detection to their applications.
- **Reseller Partners**: Intent Solutions partners who embed prediction capabilities in their offerings.
- **Automation Bots**: Webhook ingestion sources (Stripe, PostHog, custom) that push metric data.

### End-to-End Journey Map

```
Awareness -> Onboarding -> Core Workflows -> Support/Feedback -> Renewal
    |            |               |                 |              |
    v            v               v                 v              v
Marketing    API Key       Ingest/Forecast    Dashboard     Usage-based
  Site       Creation       Alert Setup        Metrics        Billing
```

**Critical Touchpoints:**
1. **API Key Creation** - First interaction; must be frictionless
2. **Webhook Setup** - Data source connection; needs clear docs
3. **First Forecast** - Value demonstration moment
4. **Alert Configuration** - Ongoing value; retention driver

### SLA Commitments (Targets)

| Metric | Target | Current | Owner |
|--------|--------|---------|-------|
| API Uptime | 99.9% | N/A (not deployed) | DevOps |
| Forecast Response | < 5s | ~2s (mock) | Engineering |
| Ingestion Latency | < 500ms | ~100ms | Engineering |
| Alert Delivery | < 60s | ~1s | Engineering |

---

## 3. System Architecture Overview

### Technology Stack (Detailed)

| Layer | Technology | Version | Source of Truth | Purpose | Owner |
|-------|------------|---------|-----------------|---------|-------|
| API Server | Node.js HTTP | Native | `packages/api/src/index.ts` | REST endpoints | Backend |
| Pipeline | TypeScript | 5.3+ | `packages/pipeline/` | Data processing | Backend |
| Operator | TypeScript | 5.3+ | `packages/operator/` | Multi-tenancy/auth | Backend |
| Contracts | TypeScript | 5.3+ | `packages/contracts/` | Type definitions | Backend |
| Database | Turso/libSQL | 0.15.15 | `db/config.ts` | Data persistence | DevOps |
| Agent | agentfs-sdk | 0.2.3 | `packages/agent/` | AI agent workflow | ML Eng |
| Forecast | Nixtla API | External | `packages/pipeline/src/forecast/` | Time-series prediction | ML Eng |

### Environment Matrix

| Environment | Purpose | Hosting | Data Source | Release Cadence | IaC Source | Notes |
|-------------|---------|---------|-------------|-----------------|------------|-------|
| local | Development | localhost:8080 | SQLite file | N/A | None | `db/intentvision.db` |
| test | CI validation | GitHub Actions | In-memory SQLite | Every commit | `.github/workflows/ci.yml` | Isolated per test |
| staging | Pre-production | Cloud Run | Turso staging | On PR merge | Dockerfile | Not yet deployed |
| prod | Production | Cloud Run | Turso production | On main merge | Dockerfile | Not yet deployed |

### Cloud & Platform Services

| Service | Purpose | Environment(s) | Key Config | Cost/Limits | Owner | Vendor Risk |
|---------|---------|----------------|------------|-------------|-------|-------------|
| Cloud Run | API hosting | staging, prod | 8080 port, managed | Pay-per-use | DevOps | Low (GCP) |
| Turso | Database | all | libSQL protocol | Free tier: 500 DBs | DevOps | Medium |
| Nixtla TimeGPT | Forecasting | prod | API key auth | Pay-per-call | Engineering | Medium |
| GitHub Actions | CI/CD | all | Workload Identity | Free (public) | DevOps | Low |
| Secret Manager | Secrets | staging, prod | turso-* | Minimal | DevOps | Low (GCP) |

### Architecture Diagram

```
                              ┌─────────────────────────────────────────────┐
                              │              EXTERNAL SOURCES               │
                              │  Stripe │ PostHog │ Webhooks │ APIs        │
                              └──────────────────┬──────────────────────────┘
                                                 │
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD RUN (API SERVER)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    packages/api/src/index.ts                        │   │
│  │  Endpoints: /health, /pipeline, /forecast, /ingest, /anomalies     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────┐     │
│  │                          OPERATOR LAYER                            │     │
│  │  packages/operator/                                                │     │
│  │  ├── auth/        API Keys, JWT, RBAC                             │     │
│  │  ├── tenant/      Multi-org context                                │     │
│  │  └── api/         REST router                                      │     │
│  └─────────────────────────────────┼─────────────────────────────────┘     │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────┐     │
│  │                         PIPELINE LAYER                             │     │
│  │  packages/pipeline/src/                                            │     │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │     │
│  │  │  INGEST  │─▶│ NORMALIZE │─▶│  STORE   │─▶│    FORECAST      │  │     │
│  │  │ webhook/ │  │normalizer │  │metric-   │  │ ├─ nixtla-timegpt│  │     │
│  │  │handler.ts│  │.ts        │  │store.ts  │  │ ├─ statistical   │  │     │
│  │  └──────────┘  └───────────┘  └──────────┘  │ └─ stub          │  │     │
│  │       │                            │        └──────────────────┘  │     │
│  │       │                            │                │              │     │
│  │       ▼                            │                ▼              │     │
│  │  ┌──────────┐                      │        ┌──────────────────┐  │     │
│  │  │DEAD LETER│                      │        │    ANOMALY       │  │     │
│  │  │  QUEUE   │                      │        │ ensemble-detector│  │     │
│  │  └──────────┘                      │        └────────┬─────────┘  │     │
│  │                                    │                 │             │     │
│  │                                    ▼                 ▼             │     │
│  │                           ┌────────────────────────────────┐      │     │
│  │                           │           ALERT               │      │     │
│  │                           │  rules-engine, lifecycle,     │      │     │
│  │                           │  notification-channels        │      │     │
│  │                           └────────────────────────────────┘      │     │
│  └───────────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │           TURSO/libSQL         │
                    │  Organizations, Metrics,       │
                    │  Forecasts, Anomalies, Alerts, │
                    │  Users, API Keys, Connections  │
                    │  (14 tables across 2 migrations)│
                    └───────────────────────────────┘
```

---

## 4. Directory Deep-Dive

### Project Structure Analysis

```
intentvision/                          # Project root
├── 000-docs/                          # Documentation (STRICTLY FLAT - no subdirs!)
│   ├── 6767-*.md                      # Canonical standards (7 docs)
│   ├── NNN-*.md                       # Project documents (26 docs)
│   └── product/                       # EXCEPTION: product docs subfolder
├── .beads/                            # Beads work tracking system
│   └── issues.jsonl                   # Task registry (37 tasks tracked)
├── .agentfs/                          # Agent state persistence
│   ├── intentvision.db                # AgentFS SQLite
│   └── snapshots/                     # State snapshots
├── .github/
│   └── workflows/
│       └── ci.yml                     # CI/CD pipeline (147 lines)
├── db/                                # Database layer
│   ├── config.ts                      # LibSQL client factory (166 lines)
│   ├── migrate.ts                     # Migration runner (43 lines)
│   └── migrations/
│       ├── 001_initial_schema.sql     # Core tables (188 lines)
│       └── 002_saas_tables.sql        # SaaS tables (131 lines)
├── packages/                          # npm workspaces monorepo
│   ├── api/                           # Production API server
│   │   └── src/index.ts               # HTTP server (448 lines)
│   ├── contracts/                     # Type definitions
│   │   └── src/
│   │       ├── metrics-spine.ts       # CanonicalMetric, TimeSeries
│   │       ├── forecast.ts            # ForecastBackend, ForecastRequest
│   │       ├── anomaly.ts             # AnomalyDetector, Anomaly
│   │       └── alert.ts               # AlertRule, AlertTrigger
│   ├── pipeline/                      # Core processing (10,347 lines)
│   │   ├── src/
│   │   │   ├── ingest/                # Data intake
│   │   │   │   ├── fixture-loader.ts  # Test fixtures
│   │   │   │   └── webhook/           # HTTP ingestion
│   │   │   │       ├── handler.ts     # Request processing
│   │   │   │       ├── validator.ts   # Schema validation
│   │   │   │       ├── idempotency.ts # Duplicate prevention
│   │   │   │       └── dead-letter.ts # Failed message queue
│   │   │   ├── normalize/
│   │   │   │   └── normalizer.ts      # Raw -> Canonical (207 lines)
│   │   │   ├── store/
│   │   │   │   └── metric-store.ts    # Turso storage (234 lines)
│   │   │   ├── forecast/
│   │   │   │   ├── forecast-service.ts # Multi-backend orchestrator (532 lines)
│   │   │   │   ├── nixtla-timegpt.ts  # Nixtla backend (564 lines)
│   │   │   │   ├── statistical-forecast.ts # Holt-Winters (615 lines)
│   │   │   │   └── forecast-stub.ts   # Test backend (202 lines)
│   │   │   ├── anomaly/
│   │   │   │   ├── ensemble-detector.ts # Multi-method detection
│   │   │   │   └── anomaly-stub.ts    # Test detector
│   │   │   ├── alert/
│   │   │   │   ├── rules-engine.ts    # Condition evaluation (566 lines)
│   │   │   │   ├── lifecycle.ts       # State management
│   │   │   │   ├── alert-emitter.ts   # Notification dispatch
│   │   │   │   └── notification-channels.ts
│   │   │   ├── connections/           # External integrations
│   │   │   │   ├── nixtla-client.ts   # Nixtla API wrapper
│   │   │   │   ├── turso-pool.ts      # Connection pooling
│   │   │   │   └── health-monitor.ts  # Service health
│   │   │   ├── eval/
│   │   │   │   └── evaluation-framework.ts # MAE, RMSE, MAPE (612 lines)
│   │   │   └── observability/
│   │   │       └── logger.ts          # Structured logging (233 lines)
│   │   └── tests/
│   │       ├── *.test.ts              # Unit/integration tests
│   │       ├── e2e/                   # End-to-end tests (4 files)
│   │       └── vitest-setup.ts        # Test database setup
│   ├── operator/                      # Multi-tenancy layer
│   │   └── src/
│   │       ├── auth/                  # Authentication
│   │       │   ├── index.ts           # API key management
│   │       │   ├── jwt.ts             # JWT tokens
│   │       │   ├── api-keys.ts        # SHA-256 key hashing
│   │       │   ├── middleware.ts      # Express middleware
│   │       │   └── rbac.ts            # Role-based access
│   │       ├── tenant/                # Organization context
│   │       │   └── index.ts           # Tenant management
│   │       └── api/                   # REST endpoints
│   │           ├── router.ts          # Route handlers
│   │           └── index.ts           # Router exports
│   ├── agent/                         # AI agent system
│   │   └── src/
│   │       ├── router/                # Intent routing
│   │       ├── react/                 # ReAct loop implementation
│   │       ├── logging/               # Decision logging
│   │       └── tools/                 # Agent tools
│   └── functions/                     # Cloud Functions (stub)
├── scripts/
│   └── ci/                            # ARV gate scripts
│       ├── arv-check.sh               # Master check runner
│       ├── check-docs-flat.sh         # 000-docs/ validation
│       ├── check-security.sh          # Secret detection
│       └── check-*.sh                 # Various checks
├── Dockerfile                         # Multi-stage production build (87 lines)
├── package.json                       # Root workspace config
├── tsconfig.json                      # TypeScript config
├── CLAUDE.md                          # AI assistant instructions
└── README.md                          # Project documentation
```

### Detailed Directory Analysis

#### packages/pipeline/ (Core Engine)

**Purpose**: The heart of IntentVision - processes metrics from ingestion to alerting.

**Key Files**:
- `src/index.ts:111` - `runPipeline()` orchestrates entire flow
- `src/forecast/forecast-service.ts:48` - `ForecastService` class with backend selection
- `src/alert/rules-engine.ts:58` - `RulesEngine` class for alert evaluation

**Patterns**:
- Factory pattern for backends (`createStubForecastBackend`, `getNixtlaBackend`)
- Interface segregation (each backend implements `ForecastBackend`)
- Structured logging with correlation IDs

**Entry Points**:
- `src/cli.ts` - Command-line interface
- `src/index.ts` - `runPipeline()` function

#### packages/operator/ (SaaS Layer)

**Purpose**: Multi-tenant authentication, authorization, and organization management.

**Authentication Flow**:
1. API key received in `X-API-Key` header
2. SHA-256 hash computed
3. Hash lookup in `api_keys` table
4. Org context established from key's `org_id`
5. Request proceeds with tenant isolation

**Code Quality**:
- Clean separation of auth/tenant/api modules
- 87 tests covering all auth paths
- Proper error handling with informative messages

#### db/ (Database Layer)

**Tools**: Turso/libSQL with WAL mode enabled

**Schema**: 14 tables across 2 migrations:
- Core: organizations, metrics, time_series, forecasts, anomalies, alerts, alert_rules, ingestion_sources
- SaaS: users, user_org_memberships, connections, api_keys, forecast_jobs, notification_channels

**State Management**:
- Migrations tracked in `_migrations` table
- `db/config.ts` handles client lifecycle
- In-memory mode for tests (`VITEST` env var detected)

---

## 5. Automation & Agent Surfaces

### Agent System (packages/agent/)

| Component | Purpose | Status |
|-----------|---------|--------|
| Intent Router | Pattern-match user requests | Implemented |
| ReAct Loop | Tool-calling execution | Implemented |
| Decision Logger | AgentFS persistence | Implemented |
| Stub Tools | Demo capabilities | Implemented |

### CI/CD Workflows (.github/workflows/)

| Workflow | Trigger | Stages | Duration |
|----------|---------|--------|----------|
| ci.yml | push/PR to main | test -> build -> deploy | ~3 min |

### ARV Gate (scripts/ci/)

| Check | Script | Purpose |
|-------|--------|---------|
| Docs flat | check-docs-flat.sh | No subdirs in 000-docs/ |
| Standards | check-standards-present.sh | 6767 docs exist |
| AAR template | check-aar-template.sh | Valid template |
| Phase AARs | check-phase-aars.sh | At least one AAR |
| Task IDs | check-task-ids.sh | Commits reference tasks |
| Lint | check-lint.sh | TypeScript format |
| Security | check-security.sh | No secrets committed |

### Work Tracking (Beads)

```bash
# View ready tasks
bd ready

# List all tasks
bd list

# Update task
bd update <task-id> --status in_progress

# Close task
bd close <task-id> --reason "Implemented"

# Sync with remote
bd sync
```

**Task ID Format**: `intentvision-xxx` where xxx is alphanumeric
**Commit Format**: `[Task: intentvision-xxx]` in commit message

---

## 6. Operational Reference

### Deployment Workflows

#### Local Development

**Prerequisites**:
- Node.js 20+
- npm 9+
- Git

**Environment Setup**:
```bash
# Clone and install
git clone git@github.com:intent-solutions-io/intentvision.git
cd intentvision
npm ci

# Environment variables (create .env)
INTENTVISION_DB_URL=file:db/intentvision.db
NODE_ENV=development
```

**Service Startup**:
```bash
# Run database migrations
npm run db:migrate

# Start API server (development mode)
npm run dev
# Server at http://localhost:8080

# Run pipeline CLI
npm run pipeline               # With fixtures
npm run pipeline:synthetic     # With synthetic data
```

**Verification**:
```bash
# Health check
curl http://localhost:8080/health

# Run tests
npm test

# TypeScript check
npm run typecheck
```

#### Staging Deployment

**Trigger**: Push to feature branch, open PR

**Pre-flight**:
1. All tests pass locally (`npm test`)
2. TypeScript compiles (`npm run typecheck`)
3. ARV gate passes (`./scripts/ci/arv-check.sh`)

**Execution**:
```bash
# CI runs automatically on PR
# See: .github/workflows/ci.yml

# Manual build test
docker build -t intentvision:test .
docker run -p 8080:8080 -e INTENTVISION_DB_URL=file::memory: intentvision:test
```

#### Production Deployment

**Trigger**: Merge to main branch

**Pre-deployment Checklist**:
- [ ] CI pipeline green
- [ ] All 307 tests passing
- [ ] Database migrations rehearsed in staging
- [ ] Secrets configured in Secret Manager
- [ ] Rollback plan documented

**Secrets Required** (in GCP Secret Manager):
- `turso-database-url` - Turso production connection string
- `turso-auth-token` - Turso authentication token
- `nixtla-api-key` - Nixtla TimeGPT API key (optional)

**Deployment Command** (CI runs this):
```bash
gcloud run deploy intentvision \
  --image gcr.io/$PROJECT_ID/intentvision:$SHA \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets "INTENTVISION_DB_URL=turso-database-url:latest,INTENTVISION_DB_AUTH_TOKEN=turso-auth-token:latest"
```

**Rollback Protocol**:
```bash
# List revisions
gcloud run revisions list --service intentvision

# Rollback to previous
gcloud run services update-traffic intentvision \
  --to-revisions=intentvision-PREVIOUS=100
```

### Monitoring & Alerting

**Health Endpoint**: `GET /health`
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": true,
    "forecast": true
  }
}
```

**Logging**: Structured JSON via `packages/pipeline/src/observability/logger.ts`
- Correlation IDs: `cid` field
- Component tags: `comp` field
- Task IDs: `task` field

**Metrics** (future):
- Request latency (P50, P95, P99)
- Error rates by endpoint
- Forecast duration by backend
- Ingestion throughput

### Incident Response

| Severity | Definition | Response Time | Roles | Playbook |
|----------|------------|---------------|-------|----------|
| P0 | API unresponsive | Immediate | On-call DevOps | Restart Cloud Run, check Turso |
| P1 | Forecasts failing | 15 min | Engineering | Check Nixtla API, fallback to statistical |
| P2 | High latency | 1 hour | Engineering | Scale Cloud Run, optimize queries |
| P3 | Test failures | Next day | Engineering | Review CI logs |

### Backup & Recovery

**Database Backups**:
- Turso provides automatic point-in-time recovery
- Manual backup: `turso db shell intentvision ".backup backup.db"`

**RPO/RTO Targets**:
- RPO: 1 hour (Turso replication)
- RTO: 15 minutes (Cloud Run redeploy)

---

## 7. Security, Compliance & Access

### Identity & Access Management

| Account/Role | Purpose | Permissions | Provisioning | MFA | Used By |
|--------------|---------|-------------|--------------|-----|---------|
| API Key (customer) | Data ingestion | read, write scopes | Self-service | No | External apps |
| Admin API Key | Full access | admin scope | Manual | Should | Operators |
| Service Account | CI/CD | Cloud Run, Artifact Registry | Workload Identity | N/A | GitHub Actions |

### API Key Security

**Storage**: SHA-256 hash in `api_keys.key_hash` column
**Generation**: `packages/operator/src/auth/api-keys.ts`
**Scopes**: `["read"]`, `["read", "write"]`, `["admin"]`
**Rotation**: Set `expires_at`, create new key, deprecate old

### Secrets Management

| Secret | Location | Rotation Policy |
|--------|----------|-----------------|
| Turso DB URL | GCP Secret Manager | On breach |
| Turso Auth Token | GCP Secret Manager | Quarterly |
| Nixtla API Key | GCP Secret Manager | Annually |
| JWT Secret | GCP Secret Manager | On breach |

### Security Posture

**Authentication**:
- API keys via `X-API-Key` header
- JWT tokens for web dashboard (future)
- Firebase Auth integration (schema ready)

**Authorization**:
- RBAC with roles: owner, admin, member, viewer
- Org-scoped data isolation (all tables have `org_id` FK)

**Encryption**:
- In-transit: HTTPS (Cloud Run managed)
- At-rest: Turso encryption (provider managed)

**Known Gaps**:
- Rate limiting not implemented (schema ready: `api_keys.rate_limit`)
- Audit logging not implemented
- No WAF configured

---

## 8. Cost & Performance

### Current Costs (Estimated Production)

**Monthly Cloud Spend**: ~$50-200/month (low traffic)
- Cloud Run: $10-50 (pay-per-use)
- Turso: $0-29 (free tier to Scale)
- Nixtla: $0-100 (pay-per-forecast)
- Secret Manager: $1
- Artifact Registry: $5

### Performance Baseline

**Local Test Results**:
- 307 tests in ~6 seconds
- Pipeline execution: ~2-5 seconds (mock mode)
- Database queries: <100ms

**Capacity Projections**:
- Cloud Run: Auto-scales to demand
- Turso: 500 DBs free, 10,000+ paid
- Nixtla: Rate limited by API tier

### Optimization Opportunities

1. **Database Indexing**: Already optimized with composite indexes
2. **Batch Ingestion**: Dead letter queue enables retry without data loss
3. **Forecast Caching**: Store results in `forecasts` table (implemented)
4. **Statistical Fallback**: Avoid Nixtla costs for simple forecasts

---

## 9. Development Workflow

### Local Development

**Standard Environment**:
```bash
node --version  # v20+
npm --version   # v9+
```

**Bootstrap**:
```bash
npm ci                    # Install dependencies
npm run db:migrate        # Run migrations
npm run build             # Build all packages
npm test                  # Verify setup
```

**Common Tasks**:
```bash
# Feature development
git checkout -b feat/my-feature
# ... make changes ...
npm test                           # Run tests
./scripts/ci/arv-check.sh          # Validate compliance
git commit -m "feat: description [Task: intentvision-xxx]"
git push -u origin feat/my-feature
# Open PR
```

### CI/CD Pipeline

**Platform**: GitHub Actions

**Stages**:
1. **test**: Install deps, run all tests (contracts, pipeline, operator)
2. **build**: TypeScript compile, Docker build, container smoke test
3. **deploy**: Push to GCR, deploy to Cloud Run (main only)
4. **notify**: Report status

**Artifacts**:
- Docker image: `gcr.io/$PROJECT/intentvision:$SHA`
- Latest tag: `gcr.io/$PROJECT/intentvision:latest`

### Code Quality

**Linting**: TypeScript strict mode
**Testing**: Vitest with 307 tests
**Coverage**: Not currently tracked (recommendation: add Codecov)
**Review**: Require 1 approval for PRs

---

## 10. Dependencies & Supply Chain

### Direct Dependencies

```json
{
  "@libsql/client": "^0.15.15",  // Turso database client
  "agentfs-sdk": "^0.2.3",       // Agent state persistence
  "uuid": "^11.0.3"              // UUID generation
}
```

### Dev Dependencies

```json
{
  "@types/uuid": "^10.0.0",
  "tsx": "^4.7.0",               // TypeScript executor
  "typescript": "^5.3.0",
  "vitest": "^1.6.1"             // Test framework
}
```

### Third-Party Services

| Service | Purpose | Data Shared | Auth | SLA | Renewal | Owner |
|---------|---------|-------------|------|-----|---------|-------|
| Turso | Database | All metrics | Token | 99.9% | Annual | DevOps |
| Nixtla | Forecasting | Time series | API Key | Best effort | Monthly | Engineering |
| GitHub | Code hosting | Source code | OAuth | 99.9% | Free | DevOps |

---

## 11. Integration with Existing Documentation

### Documentation Inventory

| Document | Status | Last Updated | Notes |
|----------|--------|--------------|-------|
| README.md | Current | 2025-12-15 | Quick start guide |
| CLAUDE.md | Current | 2025-12-15 | AI assistant instructions |
| 000-docs/024-AA-SUMM-*.md | Current | 2025-12-15 | Comprehensive status |
| 000-docs/6767-*.md | Canonical | 2025-12-15 | Standards (7 docs) |

### Discrepancies Found

1. **README.md mentions Cloud Run** but deployment not yet active
2. **Test count** in 024-AA-SUMM says 147, actual is **307** (updated since)
3. **CLAUDE.md** deployment section outdated (still references old CI)

### Recommended Reading Order

1. `CLAUDE.md` - Development commands
2. `000-docs/024-AA-SUMM-project-status-comprehensive.md` - Architecture overview
3. `000-docs/003-AT-ARCH-cloud-implementation-plan.md` - Deployment strategy
4. `000-docs/6767-f-DR-STND-work-tracking-beads-taskids.md` - Task workflow

---

## 12. Current State Assessment

### What's Working Well

- **Test Coverage**: 307 tests passing, comprehensive coverage of critical paths
- **Pipeline Architecture**: Clean separation of ingest/normalize/store/forecast/anomaly/alert
- **Multi-Backend Support**: Nixtla TimeGPT + Statistical + Stub backends
- **Multi-Tenancy**: Proper org_id isolation across all tables
- **API Key Auth**: SHA-256 hashed keys with scopes
- **Work Tracking**: Beads task IDs in all commits
- **Documentation**: 26 documents covering all phases

### Areas Needing Attention

- **No Production Deployment**: Cloud Run not yet configured
- **No Monitoring**: Need dashboards, alerting for production
- **Rate Limiting**: Schema ready but not implemented
- **Audit Logging**: Not implemented
- **Test Coverage Metrics**: Not tracked in CI

### Immediate Priorities

| Priority | Issue | Impact | Action | Owner |
|----------|-------|--------|--------|-------|
| **P1** | Production deployment | Cannot serve customers | Configure Cloud Run, Turso prod | DevOps |
| **P1** | Secret configuration | Blocks deployment | Set up Secret Manager | DevOps |
| **P2** | Monitoring setup | No visibility in prod | Add Cloud Monitoring | DevOps |
| **P2** | Rate limiting | Vulnerable to abuse | Implement from schema | Engineering |
| **P3** | Audit logging | Compliance gap | Add audit table/logging | Engineering |

---

## 13. Quick Reference

### Operational Command Map

| Capability | Command/Tool | Source | Notes |
|------------|--------------|--------|-------|
| Local server | `npm run dev` | package.json | Port 8080 |
| Run tests | `npm test` | package.json | All 307 tests |
| Pipeline CLI | `npm run pipeline` | package.json | With fixtures |
| DB migrate | `npm run db:migrate` | package.json | Turso/libSQL |
| DB status | `npm run db:status` | package.json | Check migrations |
| ARV gate | `./scripts/ci/arv-check.sh` | scripts/ci/ | Pre-push validation |
| Docker build | `docker build -t intentvision .` | Dockerfile | Production image |
| Type check | `npm run typecheck` | package.json | TypeScript validation |

### Critical Endpoints & Resources

**API Endpoints**:
- `GET /health` - Health check
- `POST /pipeline` - Run full pipeline
- `POST /forecast` - Generate forecast
- `POST /ingest` - Ingest events
- `GET /anomalies?orgId=X` - List anomalies

**Development Resources**:
- GitHub: `github.com/intent-solutions-io/intentvision`
- Turso Console: `turso.tech` (when configured)
- Nixtla Docs: `docs.nixtla.io`

### First-Week Checklist (DevOps Engineer)

- [ ] Clone repo, run `npm ci`
- [ ] Run `npm test` - verify 307 tests pass
- [ ] Run `npm run dev` - start local server
- [ ] Read CLAUDE.md and this document
- [ ] Set up GCP project (or get access)
- [ ] Configure Workload Identity for GitHub Actions
- [ ] Create Turso production database
- [ ] Set up Secret Manager secrets
- [ ] Deploy to Cloud Run staging
- [ ] Configure monitoring/alerting
- [ ] Document deployment procedure
- [ ] Join on-call rotation

---

## 14. Recommendations Roadmap

### Week 1 - Critical Setup & Stabilization

**Goals**:
1. [ ] Production Cloud Run deployment operational
2. [ ] Turso production database configured
3. [ ] Secrets in GCP Secret Manager
4. [ ] Health endpoint returning 200

**Stakeholders**: DevOps, Engineering Lead
**Dependencies**: GCP project access, Turso account

### Month 1 - Foundation & Visibility

**Goals**:
1. [ ] Cloud Monitoring dashboards configured
2. [ ] Alerting rules for P0/P1 scenarios
3. [ ] Log aggregation in Cloud Logging
4. [ ] Rate limiting implemented
5. [ ] Staging environment validated

**Stakeholders**: DevOps, Engineering
**Dependencies**: Week 1 complete

### Quarter 1 - Strategic Enhancements

**Goals**:
1. [ ] Audit logging implemented
2. [ ] Customer-facing status page
3. [ ] Automated backup verification
4. [ ] Load testing completed (stress test ready)
5. [ ] Documentation site deployed

**Stakeholders**: DevOps, Engineering, Product
**Dependencies**: Month 1 complete

---

## Appendices

### Appendix A. Glossary

| Term | Definition |
|------|------------|
| ARV Gate | Automated Review & Validation gate in CI |
| Beads | Work tracking system using task IDs |
| CanonicalMetric | Normalized metric format in contracts |
| DLQ | Dead Letter Queue for failed ingestions |
| libSQL | SQLite-compatible protocol used by Turso |
| Nixtla TimeGPT | Foundation model for time-series forecasting |
| ReAct | Reasoning + Acting agent pattern |
| Turso | Edge-ready SQLite database service |

### Appendix B. Reference Links

| Resource | URL |
|----------|-----|
| Turso Documentation | https://docs.turso.tech |
| Nixtla TimeGPT | https://docs.nixtla.io |
| Cloud Run Documentation | https://cloud.google.com/run/docs |
| Vitest Documentation | https://vitest.dev |

### Appendix C. Troubleshooting Playbooks

**Problem**: Tests fail with "SQLITE_BUSY: database is locked"
**Solution**: Tests should use in-memory database. Check `VITEST` env var is set.

**Problem**: Nixtla API returns 401
**Solution**: Verify `NIXTLA_API_KEY` is set correctly in environment.

**Problem**: Forecast returns empty predictions
**Solution**: Ensure input time series has >10 data points. Check backend selection.

**Problem**: Docker build fails with "ENOENT"
**Solution**: Run `npm ci` before build. Check all package.json files exist.

### Appendix D. Change Management

**Release Calendar**: Continuous on merge to main
**Approval Process**: 1 PR approval required
**Audit Requirements**: Commits must reference task IDs

### Appendix E. Open Questions

1. What is the Turso production database name/URL?
2. What GCP project will host production?
3. What is the Nixtla API tier/rate limit?
4. Who is on-call for P0 incidents?
5. What is the customer-facing domain?

---

*Document: 026-AA-AUDT-appaudit-devops-playbook.md*
*Category: Analysis/Assessment - Audit*
*Generated by: Claude Code*
*Last Updated: 2025-12-15*
