# IntentVision: Operator-Grade System Analysis

*For: DevOps Engineer*
*Generated: 2026-01-31*
*Version: 0.13.0 (commit b63b38c)*
*Document ID: 063-AA-AUDT-appaudit-devops-playbook*

---

## 1. Executive Summary

### Business Purpose

IntentVision is a **Universal Prediction Engine** - a multi-tenant SaaS platform that connects business data sources, normalizes metrics, runs AI-powered forecasting and anomaly detection, and delivers actionable insights via alerts, APIs, dashboards, and agents. The platform targets SaaS companies seeking to forecast KPIs like MRR, churn, and user engagement with minimal integration overhead.

The system is at **pre-production maturity** with complete CI/CD automation, staging infrastructure, and core functionality validated. Version 0.13.0 includes production deployment infrastructure, billing plumbing (Stripe stub), usage metering, and multi-tenant architecture. The platform has progressed through 14+ implementation phases with comprehensive documentation (69 files in 000-docs/).

The technology foundation is TypeScript/Node.js 20 with an npm workspaces monorepo structure, Cloud Firestore for customer data, Turso/libSQL for internal tooling, and Cloud Run for compute. A dual forecasting backend supports both statistical methods (no dependencies) and Nixtla TimeGPT (ML-powered).

**Key risks** at this stage include: Terraform infrastructure not yet implemented (placeholder only), production environment not yet deployed (staging works), Firestore indexes may need optimization under load, and billing integration remains stubbed.

### Operational Status Matrix

| Environment | Status | Uptime Target | Release Cadence |
|-------------|--------|---------------|-----------------|
| Development | Active | N/A | Continuous |
| Staging | Active (CI/CD) | 99% | On push to main |
| Production | Not Deployed | 99.9% | Tags only (v*.*.*)|

### Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Runtime | Node.js | 20.x | Server runtime |
| Language | TypeScript | 5.3+ | Type-safe development |
| Package Manager | npm | 10.x | Workspace monorepo |
| Database (Customer) | Cloud Firestore | Latest | Multi-tenant data storage |
| Database (Internal) | Turso/libSQL | 0.15+ | Beads/AgentFS tooling |
| Compute | Cloud Run | Managed | API hosting |
| Hosting | Firebase Hosting | Latest | Dashboard/web UI |
| CI/CD | GitHub Actions | Latest | Automated pipelines |
| Container | Docker | 24+ | Multi-stage build |
| Forecasting | Nixtla TimeGPT | API | ML-powered predictions |
| Forecasting | StatisticalBackend | Built-in | Zero-dependency fallback |
| Auth | Firebase Auth | Latest | Dashboard users |
| Auth | API Keys | Custom | API authentication |

---

## 2. System Architecture

### Technology Stack (Detailed)

| Layer | Technology | Version | Purpose | Owner |
|-------|------------|---------|---------|-------|
| **Frontend** | React + Vite | 18.x / 5.x | Dashboard UI | packages/web |
| **API** | Node.js HTTP | 20.x | REST API server | packages/api |
| **Pipeline** | TypeScript | 5.3+ | Ingest → Forecast → Alert | packages/pipeline |
| **Contracts** | TypeScript | 5.3+ | Shared interfaces | packages/contracts |
| **Operator** | TypeScript | 5.3+ | Auth & multi-tenancy | packages/operator |
| **SDK** | TypeScript | 5.3+ | Customer SDK | packages/sdk |
| **Agent** | TypeScript | 5.3+ | AI agent tooling | packages/agent |
| **Functions** | Firebase | Latest | Serverless functions | packages/functions |
| **Database** | Firestore | Latest | Tenant data (prod) | GCP |
| **Database** | Turso/SQLite | 0.15+ | Internal tools | Turso Cloud |
| **Container** | Alpine Node | 20-alpine | Production image | Dockerfile |

### Architecture Diagram

```
                              ┌─────────────────────────────────────────────────┐
                              │                   CLIENTS                        │
                              │    [Dashboard UI]  [SDK]  [Direct API]           │
                              └──────────────────────┬──────────────────────────┘
                                                     │ HTTPS
                                                     ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                            CLOUD RUN (us-central1)                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         packages/api (index.ts)                           │  │
│  │  ┌───────────┐ ┌────────────┐ ┌─────────────┐ ┌──────────────────────┐   │  │
│  │  │ /v1/*     │ │ /admin/*   │ │ /dashboard  │ │ /health              │   │  │
│  │  │ Events    │ │ Usage      │ │ Alerts      │ │ Ready/Live/Detailed  │   │  │
│  │  │ Forecasts │ │ Billing    │ │ Settings    │ └──────────────────────┘   │  │
│  │  │ Alerts    │ │ Orgs       │ │ Preferences │                            │  │
│  │  └─────┬─────┘ └─────┬──────┘ └──────┬──────┘                            │  │
│  └────────┼─────────────┼───────────────┼───────────────────────────────────┘  │
│           │             │               │                                       │
│           ▼             ▼               ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │                      packages/operator                                   │    │
│  │         [Auth] [Multi-tenancy] [API Keys] [Plan Enforcement]            │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│           │                                                                     │
│           ▼                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │                      packages/pipeline                                   │    │
│  │   ┌─────────┐   ┌───────────┐   ┌─────────┐   ┌──────────┐   ┌───────┐ │    │
│  │   │ ingest/ │ → │ normalize/│ → │ store/  │ → │ forecast/│ → │ alert/│ │    │
│  │   └─────────┘   └───────────┘   └─────────┘   └──────────┘   └───────┘ │    │
│  │                                                      │                   │    │
│  │                                        ┌─────────────┴────────────────┐ │    │
│  │                                        │    Forecast Backends         │ │    │
│  │                                        │  [Statistical] [TimeGPT]     │ │    │
│  │                                        └──────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────────┘
           │                                                     │
           ▼                                                     ▼
┌─────────────────────────┐                       ┌─────────────────────────────┐
│    CLOUD FIRESTORE      │                       │     TURSO / LIBSQL          │
│  (Customer Data)        │                       │   (Internal Tooling)        │
│                         │                       │                             │
│  envs/{env}/            │                       │  .beads/ - Work tracking    │
│  ├── tenants/           │                       │  .agentfs/ - Agent state    │
│  ├── organizations/     │                       │  db/ - Local dev DB         │
│  ├── api_keys/          │                       │                             │
│  ├── metrics/           │                       │  Production: Turso Cloud    │
│  ├── forecasts/         │                       │  URL: libsql://intentvision-│
│  ├── alert_rules/       │                       │       *.turso.io            │
│  ├── alert_history/     │                       └─────────────────────────────┘
│  └── usage/             │
└─────────────────────────┘
```

### Data Flow

```
1. Ingestion Flow:
   POST /v1/events → API → Pipeline → Firestore (metrics collection)

2. Forecast Flow:
   POST /v1/forecast/run → API → Pipeline →
   ├── StatisticalBackend (default, no deps)
   └── NixtlaTimeGPTBackend (requires NIXTLA_API_KEY)
   → Firestore (forecasts collection)

3. Alert Flow:
   Scheduled/On-demand → Evaluate Rules →
   ├── Email (via configured provider)
   ├── Slack (webhook)
   └── Webhook (custom)
   → Firestore (alert_history collection)
```

---

## 3. Directory Analysis

### Project Structure

```
intentvision/
├── 000-docs/                 # Documentation (strictly flat, 69 files)
│   ├── 6767-*.md             # Canonical standards (7 files)
│   ├── NNN-AA-AACR-*.md      # Phase completion AARs
│   ├── NNN-DR-*.md           # Design records, guides
│   └── NNN-AT-RNBK-*.md      # Runbooks
├── .beads/                   # Beads work tracking (SQLite)
├── .agentfs/                 # Agent state snapshots (SQLite)
├── .github/workflows/        # CI/CD pipelines
│   ├── ci.yml                # Main CI/CD (test, build, deploy)
│   ├── arv-gate.yaml         # Documentation compliance
│   ├── agent-engine-deploy.yml
│   └── a2a-gateway-deploy.yml
├── adk/                      # Agent Development Kit scaffolding
├── db/                       # Database configuration
│   ├── config.ts             # libSQL client factory
│   ├── migrate.ts            # Migration runner
│   └── migrations/           # SQL migration files (2)
├── infrastructure/           # IaC (placeholder)
│   ├── cloudrun/             # Cloud Run configs
│   └── terraform/            # Terraform modules (empty)
├── packages/                 # npm workspaces monorepo
│   ├── api/                  # Production API (23MB)
│   ├── contracts/            # Shared interfaces (384KB)
│   ├── pipeline/             # Data processing (19MB)
│   ├── operator/             # Auth & tenancy (3.3MB)
│   ├── agent/                # AI tooling (2.9MB)
│   ├── sdk/                  # Customer SDK (2.8MB)
│   ├── web/                  # React dashboard (396KB)
│   └── functions/            # Firebase functions (20MB)
├── scripts/ci/               # CI check scripts (9 files)
├── services/                 # Cloud Run service configs
└── tools/                    # Development tools
```

### Key Directories

#### packages/api/ (23MB)
- **Purpose**: Production REST API server
- **Entry point**: `src/index.ts` (808 lines)
- **Key subdirectories**:
  - `src/routes/` - API route handlers (v1, admin, dashboard, demo)
  - `src/auth/` - API key authentication
  - `src/firestore/` - Firestore client
  - `src/billing/` - Billing snapshots & Stripe stub
  - `src/observability/` - Logging, metrics
  - `src/scripts/` - CLI tools (seed, load-test, smoke)
- **OpenAPI spec**: `openapi.yaml` (26KB)

#### packages/pipeline/ (19MB)
- **Purpose**: Data processing pipeline
- **Source**: 10,347 lines across pipeline stages
- **Key subdirectories**:
  - `src/ingest/` - Raw data intake
  - `src/normalize/` - Metric canonicalization
  - `src/store/` - Persistence layer
  - `src/forecast/` - Prediction engine
  - `src/anomaly/` - Anomaly detection
  - `src/alert/` - Alert triggering
  - `src/backends/` - Forecast backend implementations

#### packages/contracts/ (384KB)
- **Purpose**: Canonical TypeScript interfaces (zero dependencies)
- **Exports**: CanonicalMetric, ForecastRequest/Response, AlertRule, etc.
- **Tests**: 23 passing

#### packages/operator/ (3.3MB)
- **Purpose**: Authentication, multi-tenancy, API key management
- **Tests**: 87 passing

#### db/ (Database)
- **Technology**: libSQL/Turso
- **Migrations**: 2 files (001_initial_schema.sql, 002_saas_tables.sql)
- **Tables**: organizations, metrics, time_series, forecasts, anomalies, users, api_keys, connections, forecast_jobs

---

## 4. Operational Reference

### Deployment Workflows

#### Local Development

**Prerequisites**:
- Node.js 20+
- npm 10+
- Docker 24+ (for container builds)
- gcloud CLI (for GCP resources)
- firebase CLI (for emulators)

**Setup**:
```bash
# Clone repository
git clone git@github.com:intent-solutions-io/intent-vision.git
cd intentvision

# Install dependencies
npm ci

# Copy environment config
cp .env.example .env
# Edit .env with your values (see below)

# Run migrations (local SQLite)
npm run db:migrate

# Start development server
npm run dev
# Server runs at http://localhost:3000

# Alternatively, with Firebase emulators:
firebase emulators:start
npm run dev:api   # Uses FIRESTORE_EMULATOR_HOST
```

**Environment Variables (.env)**:
```bash
# Database - Local
INTENTVISION_DB_URL=file:db/intentvision.db

# Database - Turso Cloud (production)
# INTENTVISION_DB_URL=libsql://intentvision-*.turso.io
# INTENTVISION_DB_AUTH_TOKEN=<token>

# GCP
GCP_PROJECT_ID=intentvision
GCP_REGION=us-central1

# Pipeline
PIPELINE_ORG_ID=org-demo
PIPELINE_FORECAST_HORIZON=6
PIPELINE_ALERT_THRESHOLD=80
PIPELINE_ANOMALY_SENSITIVITY=0.7

# Optional: Nixtla TimeGPT
# NIXTLA_API_KEY=<your-key>
```

**Verification**:
```bash
# Run tests
npm test

# Type checking
npm run typecheck

# ARV gate (pre-push checks)
./scripts/ci/arv-check.sh

# Manual API test
curl http://localhost:3000/health
```

#### Production Deployment

**Current State**: Staging deployed, production pending.

**Pre-flight Checklist**:
- [ ] All tests passing (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] ARV gate passes (`./scripts/ci/arv-check.sh`)
- [ ] Docker build works (`docker build -t intentvision .`)
- [ ] Secrets configured in GCP Secret Manager

**CI/CD Pipeline** (automatic via GitHub Actions):

| Job | Trigger | Action |
|-----|---------|--------|
| test | All pushes/PRs | TypeScript check + unit tests |
| build | After test | Docker image build + smoke test |
| deploy-staging | Push to main | Deploy to Cloud Run staging |
| smoke-staging | After deploy | Cloud smoke tests |
| deploy-prod | Tag v*.*.* | Deploy to Cloud Run production |

**Manual Deployment** (if needed):
```bash
# Build Docker image
docker build -t intentvision:latest .

# Test locally
docker run -p 8080:8080 \
  -e INTENTVISION_DB_URL=file::memory: \
  intentvision:latest

# Push to Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev
docker tag intentvision:latest \
  us-central1-docker.pkg.dev/intentvision/intentvision/api:latest
docker push us-central1-docker.pkg.dev/intentvision/intentvision/api:latest

# Deploy to Cloud Run
gcloud run deploy intentvision-api \
  --image us-central1-docker.pkg.dev/intentvision/intentvision/api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "INTENTVISION_ENV=production,NODE_ENV=production" \
  --set-secrets "INTENTVISION_DB_URL=prod-turso-url:latest"
```

**Rollback Protocol**:
```bash
# List Cloud Run revisions
gcloud run revisions list --service intentvision-api --region us-central1

# Rollback to previous revision
gcloud run services update-traffic intentvision-api \
  --region us-central1 \
  --to-revisions REVISION_NAME=100

# Or rollback to specific tag
gcloud run deploy intentvision-api \
  --image us-central1-docker.pkg.dev/intentvision/intentvision/api:v0.12.0 \
  --region us-central1
```

### Monitoring & Alerting

**Health Endpoints**:
| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /health` | Basic liveness | `{"status":"healthy"}` |
| `GET /health/ready` | Readiness (DB check) | `{"status":"ready"}` |
| `GET /health/live` | Kubernetes liveness | `200 OK` |
| `GET /health/detailed` | Full diagnostics | JSON with all deps |

**Dashboards**: (To be configured)
- Cloud Run Service Dashboard
- Cloud Logging for application logs
- Error Reporting for exceptions

**SLIs/SLOs** (defined in 052-AT-RNBK):
| Metric | Target | Measurement |
|--------|--------|-------------|
| API Availability | 99.9% | 30-day window |
| Forecast Latency p50 | 500ms | Per request |
| Forecast Latency p99 | 3000ms | Per request |
| Ingestion Latency p50 | 100ms | Per request |
| Alert Delivery | 99.5% | Success rate |
| Error Rate | 0.1% | 4xx/5xx responses |

**On-call**: Not yet configured. Recommended: PagerDuty integration.

### Incident Response

| Severity | Definition | Response Time | Playbook |
|----------|------------|---------------|----------|
| P0 | Complete outage | Immediate | See 051-AT-RNBK-intentvision-deploy-rollback.md |
| P1 | Critical degradation | 15 min | Check /health/detailed, review logs |
| P2 | Partial impact | 1 hour | Monitor, investigate |
| P3 | Minor issue | 4 hours | Schedule fix |

---

## 5. Security & Access

### IAM

| Role | Purpose | Permissions | MFA |
|------|---------|-------------|-----|
| Owner | Full project access | All GCP resources | Required |
| DevOps | Deployment, monitoring | Cloud Run, Secret Manager, Logging | Required |
| Developer | Read logs, staging deploy | Cloud Run (staging), Logging read | Recommended |
| Viewer | Read-only monitoring | Logging read, Monitoring read | Optional |

### Secrets Management

**Storage**: GCP Secret Manager
**Naming Convention**: `{env}-{service}-{key}`

| Secret Name | Purpose | Rotation |
|-------------|---------|----------|
| staging-turso-url | Turso DB URL (staging) | On rotation |
| staging-turso-token | Turso auth token (staging) | 90 days |
| prod-turso-url | Turso DB URL (prod) | On rotation |
| prod-turso-token | Turso auth token (prod) | 90 days |
| nixtla-api-key | TimeGPT API key | As needed |

**Break-glass Procedure**:
1. Access GCP Console with owner credentials
2. Navigate to Secret Manager
3. Create new version of compromised secret
4. Redeploy affected services
5. Document in incident report

### API Authentication

**Customer API**: API Key via `X-API-Key` header
- Keys hashed before storage (SHA-256)
- Scoped permissions: `["read"]`, `["read", "write"]`, etc.
- Rate limiting per plan

**Dashboard**: Firebase Authentication
- Separate auth path from API keys
- JWT tokens validated server-side

### Firestore Security Rules

Location: `firestore.rules`

Key rules:
- All data scoped by `tenant_id`
- Service accounts have full access
- Tenant owners limited to their data
- API keys cannot access directly (server-side only)

---

## 6. Cost & Performance

### Monthly Costs (Estimated)

**Note**: Production not yet deployed. Estimates based on staging metrics.

| Resource | Staging | Production (Projected) |
|----------|---------|------------------------|
| Cloud Run | ~$5 | $50-200 |
| Firestore | ~$1 | $20-100 |
| Turso | $0 (free tier) | $29 (Pro) |
| Artifact Registry | ~$1 | ~$5 |
| Secret Manager | <$1 | <$1 |
| **Total** | ~$10/mo | $100-350/mo |

**Cost Optimization Opportunities**:
- Cloud Run min-instances=0 for dev/staging
- Firestore indexes only where needed
- Right-size Cloud Run CPU/memory

### Performance Baseline

**From Phase 14 test suite (381 tests)**:
- Contract tests: 23 tests, <5s
- Pipeline tests: 220 tests, <6s
- Operator tests: 87 tests, <2s
- Total: 381 tests, ~12s

**API Benchmarks** (local, synthetic):
- Ingest: <50ms per event
- Forecast (statistical): <500ms
- Forecast (TimeGPT): 1-3s (API latency)
- Health check: <10ms

**Load Test Profiles** (from 052-AT-RNBK):
| Profile | Orgs | Metrics/Org | Expected RPS |
|---------|------|-------------|--------------|
| Baseline | 100 | 10 | 50 |
| Growth | 300 | 25 | 150 |
| Stress | 1000 | 50 | 500 |

---

## 7. Current State Assessment

### What's Working

- **CI/CD Pipeline**: Fully automated test → build → deploy flow via GitHub Actions
- **Test Suite**: 381 tests passing (contracts: 23, pipeline: 220, operator: 87)
- **Multi-stage Docker**: Optimized 512MB production image with health checks
- **API Server**: Comprehensive REST API (800+ lines) with OpenAPI spec
- **Multi-tenant Architecture**: Tenant isolation via Firestore prefix (`envs/{env}/`)
- **Dual Forecast Backends**: Statistical (zero deps) + TimeGPT (ML)
- **Plan/Usage Metering**: Daily limits with 429 enforcement
- **Billing Plumbing**: Snapshot model ready (Stripe stubbed)
- **Documentation**: 69 documents, structured with AAR template
- **Work Tracking**: Beads integration for session continuity

### Areas Needing Attention

- **Terraform IaC**: Placeholder only, not implemented
- **Production Deploy**: Staging works, prod not yet activated
- **Firestore Indexes**: Need optimization audit under load
- **Load Testing**: Profiles defined but not executed at scale
- **Monitoring Dashboards**: Not yet configured
- **On-call Rotation**: Not established
- **DR/Backup**: Firestore backup policy not configured
- **Nixtla Rate Limits**: No fallback if TimeGPT quota exceeded
- **Frontend Tests**: packages/web has no test coverage

### Immediate Priorities

1. **[HIGH]** Deploy to Production
   - Impact: Enables customer onboarding
   - Owner: DevOps
   - Blocker: Need to configure production secrets, domain

2. **[HIGH]** Implement Terraform IaC
   - Impact: Reproducible infrastructure, audit trail
   - Owner: DevOps
   - Files: infrastructure/terraform/

3. **[MEDIUM]** Configure Cloud Monitoring
   - Impact: Visibility, SLO tracking
   - Owner: DevOps
   - Deliverable: Dashboard URL, alert policies

4. **[MEDIUM]** Load Test Staging
   - Impact: Validate performance before launch
   - Owner: Engineering
   - Command: `npm run load:test:staging`

5. **[LOW]** Add Frontend Tests
   - Impact: Web dashboard reliability
   - Owner: Engineering
   - Package: packages/web

---

## 8. Quick Reference

### Command Map

| Capability | Command | Notes |
|------------|---------|-------|
| Install deps | `npm ci` | Clean install |
| Build all | `npm run build` | All workspaces |
| Run tests | `npm test` | contracts + pipeline + operator |
| Type check | `npm run typecheck` | TypeScript validation |
| Dev server | `npm run dev` | localhost:3000 |
| ARV gate | `./scripts/ci/arv-check.sh` | Pre-push checks |
| Run pipeline | `npm run pipeline` | With fixtures |
| Synthetic data | `npm run pipeline:synthetic` | Generated data |
| DB migrate | `npm run db:migrate` | Apply migrations |
| DB status | `npm run db:status` | Check migration state |
| Seed demo | `npm run seed:demo --workspace=@intentvision/api` | Demo tenant |
| Load test | `npm run load:test --workspace=@intentvision/api` | Local |
| Smoke staging | `npm run smoke:staging --workspace=@intentvision/api` | Cloud |
| Docker build | `docker build -t intentvision .` | Multi-stage |
| Docker run | `docker run -p 8080:8080 -e INTENTVISION_DB_URL=file::memory: intentvision` | Local test |

### Critical URLs

| Environment | URL | Purpose |
|-------------|-----|---------|
| Production API | `https://api.intentvision.io` | Not yet deployed |
| Staging API | `https://stg.intentvision.intent-solutions.io` | Cloud Run |
| Staging Dashboard | `https://intentvision-staging.web.app` | Firebase |
| GCP Console | `https://console.cloud.google.com/run?project=intentvision` | Cloud Run services |
| GitHub Repo | `https://github.com/intent-solutions-io/intent-vision` | Source |
| GitHub Actions | `https://github.com/intent-solutions-io/intent-vision/actions` | CI/CD |

### Beads (Work Tracking)

```bash
# Session start
bd sync                           # Pull latest
bd list --status in_progress      # What was I doing?
bd ready                          # Available work

# During work
bd update <id> --status in_progress   # Claim task
bd close <id> --reason "Evidence"      # Complete task

# Session end
bd sync                           # Push changes
git push                          # Push code
```

### First-Week Checklist

- [ ] Clone repo and verify `npm ci` succeeds
- [ ] Copy `.env.example` to `.env` and configure
- [ ] Run `npm test` - verify 381 tests pass
- [ ] Run `npm run dev` - verify server starts
- [ ] Review CLAUDE.md and AGENTS.md
- [ ] Review runbook: 051-AT-RNBK-intentvision-deploy-rollback.md
- [ ] Review production checklist: 052-AT-RNBK-production-readiness-checklist.md
- [ ] Get GCP IAM access (request from owner)
- [ ] Access staging Cloud Run console
- [ ] Review 000-docs/003-AT-ARCH-cloud-implementation-plan.md
- [ ] Familiarize with Beads workflow (`bd --help`)

---

## 9. Recommendations Roadmap

### Week 1 - Stabilization

**Goals**:
- Execute load test against staging (`npm run load:test:staging`)
- Validate all SLOs pass at baseline load (100 orgs, 10 metrics/org)
- Document any performance issues discovered
- Set up Cloud Monitoring basic dashboard

**Success Criteria**:
- [ ] Load test baseline profile completes without errors
- [ ] P50 latency < 500ms for forecasts
- [ ] Error rate < 0.1%
- [ ] Dashboard shows request metrics

### Month 1 - Foundation

**Goals**:
- Deploy to production environment
- Implement Terraform IaC for reproducibility
- Configure Firestore backup policy
- Establish on-call rotation
- Add frontend test coverage (packages/web)
- Wire real Stripe integration (replace stub)

**Success Criteria**:
- [ ] Production URL active with customer traffic
- [ ] `terraform plan` shows no drift
- [ ] Daily Firestore exports running
- [ ] PagerDuty/Opsgenie configured
- [ ] Web package has >50% test coverage
- [ ] First invoice generated via Stripe

### Quarter 1 - Strategic

**Goals**:
- Implement auto-scaling tuning based on load patterns
- Add Vertex AI as third forecast backend
- Build customer-facing status page
- Achieve SOC 2 Type I readiness
- Expand test coverage to >80% across all packages

**Success Criteria**:
- [ ] Autoscaling responds correctly to traffic spikes
- [ ] Vertex AI backend passing integration tests
- [ ] Status page URL published
- [ ] Security audit completed
- [ ] Test coverage badge shows >80%

---

## Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| ARV Gate | Automated Review & Validation - CI checks for docs/code quality |
| Beads | Work tracking system for Claude Code sessions |
| AgentFS | Agent state persistence (snapshots) |
| Canonical Metric | Normalized time-series data point with provenance |
| Metrics Spine | Core data model for time-series storage |
| TimeGPT | Nixtla's foundation model for time-series forecasting |
| Turso | Edge SQLite database service (libSQL) |

### B. Reference Links

- [Beads Documentation](https://github.com/steveyegge/beads)
- [AgentFS SDK](https://github.com/tursodatabase/agentfs)
- [Turso Documentation](https://turso.tech/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Nixtla TimeGPT](https://docs.nixtla.io/)

### C. Troubleshooting Playbooks

#### Tests Failing with "SQLITE_ERROR: no such table"

**Root Cause**: In-memory database not shared across connections.

**Solution**:
```typescript
// db/config.ts uses shared memory cache
{ url: 'file:memdb?mode=memory&cache=shared' }
```

#### Docker Build Fails with Memory Error

**Solution**: Increase Docker memory limit or use `--max-old-space-size`:
```bash
docker build --build-arg NODE_OPTIONS="--max-old-space-size=4096" -t intentvision .
```

#### Cloud Run 503 on Startup

**Possible Causes**:
1. Firestore connectivity issue
2. Missing environment variables
3. Health check timeout

**Debug**:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=intentvision-api" --limit=50
```

#### API Returns 401 on Valid API Key

**Check**:
1. Key exists in Firestore `api_keys` collection
2. Key not expired (`expires_at` field)
3. Key enabled (`enabled: true`)
4. Correct tenant scope

### D. Open Questions

1. **Disaster Recovery**: What is the RTO/RPO target for production?
2. **Multi-region**: Is us-central1 the only region, or will we expand?
3. **Data Retention**: How long should historical forecasts be kept?
4. **PII Handling**: Are there any PII fields in metrics that need encryption?
5. **Rate Limiting**: Should rate limits be configurable per-tenant?

---

*Generated by Claude Code Operator Analysis*
*IntentVision v0.13.0 | 2026-01-31*
