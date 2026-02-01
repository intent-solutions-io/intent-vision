# IntentVision

[![CI/CD](https://github.com/intent-solutions-io/intent-vision/actions/workflows/ci.yml/badge.svg)](https://github.com/intent-solutions-io/intent-vision/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.13.0-blue.svg)](./VERSION)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green.svg)](https://nodejs.org/)

**Universal Prediction Engine** for SaaS metrics forecasting, anomaly detection, and intelligent alerting.

---

## What It Is

IntentVision connects your business data sources, normalizes metrics into a canonical format, runs AI-powered forecasting and anomaly detection, and delivers actionable insights via:

- **REST API** — Programmatic access to forecasts and alerts
- **Dashboard** — Visual monitoring for ops teams
- **Alerts** — Email, Slack, and webhook notifications
- **SDK** — TypeScript client for integration

**Core Pipeline:** `Ingest → Normalize → Store → Forecast → Anomaly → Alert`

## Who It's For

- **SaaS Companies** — Forecast MRR, churn, signups, engagement
- **Ops Teams** — Monitor thresholds, get alerts before customers notice
- **Data Teams** — Integrate via API, build custom dashboards

---

## Current Status

| Environment | Status | URL |
|-------------|--------|-----|
| **Staging** | Live | `stg.intentvision.intent-solutions.io` |
| **Production** | Pending | `api.intentvision.io` (not yet deployed) |

| Component | State |
|-----------|-------|
| API Server | Ready (packages/api) |
| Firestore | Configured (multi-tenant) |
| Terraform IaC | Placeholder (infrastructure/terraform/) |
| CI/CD | Automated (GitHub Actions) |

**Version:** 0.13.0 — See [CHANGELOG.md](./CHANGELOG.md)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│           [Dashboard]  [SDK]  [Direct API]                   │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD RUN (API)                           │
│  packages/api → /v1/events, /v1/forecasts, /v1/alerts       │
│                          │                                   │
│  packages/operator → Auth, Multi-tenancy, API Keys          │
│                          │                                   │
│  packages/pipeline → Ingest → Normalize → Forecast → Alert  │
│                          │                                   │
│                    [Forecast Backends]                       │
│              StatisticalBackend │ NixtlaTimeGPT             │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│   CLOUD FIRESTORE   │       │   TURSO (Internal)  │
│   (Customer Data)   │       │   .beads/, .agentfs │
└─────────────────────┘       └─────────────────────┘
```

### Packages

| Package | Purpose |
|---------|---------|
| `packages/api` | REST API server (Cloud Run) |
| `packages/contracts` | Shared TypeScript interfaces |
| `packages/pipeline` | Ingest/normalize/forecast/alert |
| `packages/operator` | Auth, multi-tenancy, API keys |
| `packages/web` | React dashboard |
| `packages/sdk` | TypeScript client SDK |

---

## Developer Quickstart

### Prerequisites

- Node.js 20+
- npm 10+
- Git

### Setup

```bash
# Clone
git clone git@github.com:intent-solutions-io/intent-vision.git
cd intent-vision

# Install
npm ci

# Configure
cp .env.example .env
# Edit .env with your values (INTENTVISION_DB_URL, etc.)

# Run tests (381 tests)
npm test

# Start dev server
npm run dev
# → http://localhost:3000

# Verify
curl http://localhost:3000/health
# → {"status":"healthy"}
```

### Common Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests (contracts + pipeline + operator) |
| `npm run build` | Build all packages |
| `npm run typecheck` | TypeScript checking |
| `npm run dev` | Start API dev server |
| `npm run pipeline` | Run pipeline with fixtures |
| `./scripts/ci/arv-check.sh` | Pre-push CI checks |

---

## Ops Quickstart

### Deployment Triggers

| Event | Action |
|-------|--------|
| Push to `main` | Deploy to **staging** |
| Tag `v*.*.*` | Deploy to **production** |

### Health Checks

```bash
# Staging
curl https://stg.intentvision.intent-solutions.io/health

# Production (when live)
curl https://api.intentvision.io/health
```

### Rollback

```bash
# List revisions
gcloud run revisions list --service=intentvision-api-staging --region=us-central1

# Rollback to previous
gcloud run services update-traffic intentvision-api-staging \
  --region=us-central1 \
  --to-revisions=REVISION_NAME=100
```

See [051-AT-RNBK-intentvision-deploy-rollback.md](000-docs/051-AT-RNBK-intentvision-deploy-rollback.md) for full runbook.

---

## Security

- **API Authentication:** API keys via `X-API-Key` header
- **Dashboard Auth:** Firebase Authentication
- **Secrets:** GCP Secret Manager (`{env}-{service}-{key}` naming)
- **Firestore:** Tenant-scoped security rules
- **No PII in logs**

---

## Work Tracking (Beads)

```bash
bd ready                    # Available tasks
bd update <id> --status in_progress  # Start task
bd close <id> --reason "Done"        # Complete task
bd sync                     # Sync state
```

Every commit references a task ID: `[Task: intentvision-xxx]`

---

## Documentation

All docs in `000-docs/` (flat structure). Key documents:

| Document | Purpose |
|----------|---------|
| [Cloud Implementation Plan](000-docs/003-AT-ARCH-cloud-implementation-plan.md) | Architecture decisions |
| [Deploy Runbook](000-docs/051-AT-RNBK-intentvision-deploy-rollback.md) | Deployment procedures |
| [Production Checklist](000-docs/052-AT-RNBK-production-readiness-checklist.md) | Go-live checklist |
| [DevOps Playbook](000-docs/063-AA-AUDT-appaudit-devops-playbook.md) | Operator onboarding |

---

## Contributing

1. Claim a Beads task: `bd update <id> --status in_progress`
2. Create feature branch: `feature/<bead-id>-short-description`
3. Make commits with task ID: `[Task: intentvision-xxx]`
4. Run checks: `./scripts/ci/arv-check.sh`
5. Open PR → CI runs automatically
6. After merge → Create AAR in `000-docs/`

---

## Roadmap

**Immediate (P0):**
- [ ] Production deployment enabled
- [ ] Terraform IaC implemented
- [ ] Monitoring dashboards live

**Near-term (P1):**
- [ ] DR/Backup automation
- [ ] Load testing validation
- [ ] Stripe billing integration

**Future (P2):**
- [ ] TimeGPT circuit breaker
- [ ] Web test coverage
- [ ] Agent integrations

---

*Intent Solutions IO — Universal Prediction Engine*
*Contact: jeremy@intentsolutions.io*
