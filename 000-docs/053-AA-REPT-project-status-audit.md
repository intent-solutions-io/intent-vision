# IntentVision Status Report

**Document ID**: 053-AA-REPT-project-status-audit
**Type**: AA-REPT (Audit Report)
**Date**: 2025-12-16
**Status**: Final

---

## 1. Project Snapshot

**Repo Name**: `intentvision`
**Primary Purpose**: Universal Prediction Engine for time-series forecasting and anomaly detection with multi-tenant SaaS architecture.

**Tech Stack**:
- **Language/Runtime**: TypeScript, Node.js 20+
- **Database**:
  - Firestore (customer data - primary)
  - Turso/libSQL (internal tooling only)
- **Deployment Target**: GCP Cloud Run + Firebase Hosting
- **CI/CD**: GitHub Actions
- **Forecasting**: Statistical (Holt-Winters), Nixtla TimeGPT (optional)

**Elevator Pitch**: IntentVision is a SaaS platform that ingests time-series metrics, normalizes them into a canonical format, generates forecasts and detects anomalies using pluggable backends, and triggers alerts across multiple channels (email, Slack, webhooks). It's designed for multi-tenant operation with usage metering and plan-based limits.

---

## 2. Feature & Phase Status

### Phase Timeline (Reconstructed from 000-docs/)

| Phase | Title | Status | Evidence |
|-------|-------|--------|----------|
| 1 | Standardization | Done | 006-AA-AACR |
| 2 | CI Scaffold + ARV | Done | 007-AA-AACR |
| 3 | Contracts | Done | 008-AA-AACR |
| 4 | Vertical Slice (Pipeline) | Done | 012-AA-AACR |
| 5 | Cloud Ready | Done | 013-AA-AACR |
| 6 | Agent Workflow | Done | 014-AA-AACR |
| 7 | Real Ingestion + Firestore | Done | 015-AA-AACR |
| 8 | Forecast/Anomaly Eval | Done | 016-AA-AACR |
| 9 | Alerting Rules | Done | 017-AA-AACR |
| 10 | Operator Auth | Done | 018-AA-AACR |
| 11 | Deployment Plan | Done | 020-AA-AACR |
| A | Stack Alignment | Done | 022-AA-AACR |
| B | Nixtla TimeGPT | Done | 023-AA-AACR |
| 9 (Cloud) | Staging Cloud Run + Firestore | Done | 041-AA-AACR |
| 10 | Sellable Alpha Shell | Done | 043-AA-AACR |
| 11 | Usage Metering | Done | 045-AA-AACR |
| 12 | Billing Plumbing | Done | 048-AA-AACR |
| 13 | Production Deployment | Done | 050-AA-AACR |
| C | User Authentication | In Progress | Beads: intentvision-cvo |
| D | External Connections | Open | Beads: intentvision-wgk |
| E | Integration Testing | Open | Beads: intentvision-7yf |
| F | Cloud Deployment | Open | Beads: intentvision-xyq |

**Observed Drift**:
- The VERSION file shows `0.11.0` but Phase 13 AAR references `0.13.0` - version mismatch
- CHANGELOG shows 0.11.0 as the current version (usage metering), so Phase 12/13 work may not be reflected in VERSION

---

## 3. Build, Tests, and CI Status

### Test Commands
```bash
npm test                   # All tests (contracts + pipeline + operator)
npm run test:contracts     # Contract tests (23 tests)
npm run test:pipeline      # Pipeline tests (vitest)
npm run test:operator      # Operator tests (vitest)
npm run test:e2e           # E2E pipeline tests
npm run typecheck          # TypeScript checking
```

### Current Test Status

| Suite | Status | Details |
|-------|--------|---------|
| Contracts | PASS | 23/23 tests passing |
| Pipeline | FAIL | 9 suites fail - SQLite table setup error |
| Operator | Unknown | Depends on pipeline setup |

**Root Cause of Pipeline Failures**: The vitest-setup.ts attempts to create tables in an in-memory SQLite database but fails with `SQLITE_ERROR: no such table: main.metrics`. This is a test environment setup issue, not a code problem.

### CI Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| CI/CD Pipeline | `.github/workflows/ci.yml` | Test, Build, Deploy (staging/prod) |
| ARV Gate | `.github/workflows/arv-gate.yaml` | Documentation & standards checks |

**CI Pipeline Jobs**:
1. `test` - Unit tests (no external deps)
2. `firestore-live-tests` - Live Firestore tests (opt-in via secret)
3. `build` - Docker image build + smoke test
4. `deploy-staging` - Cloud Run staging (main branch)
5. `deploy-prod` - Cloud Run production (tags only)
6. `smoke-staging` - Cloud smoke tests after staging deploy
7. `notify` - Status notifications

**Assessment**: CI is production-grade and well-structured. The pipeline is **1-2 steps from production-ready** once GCP secrets are configured.

---

## 4. AgentFS Status

### Presence Check

| Check | Result |
|-------|--------|
| `.agentfs/` directory exists | Yes |
| Database file exists | `.agentfs/intentvision.db` (4KB + 300KB WAL) |
| Snapshots directory | `.agentfs/snapshots/` with 2 snapshots |
| SDK dependency | `agentfs-sdk: ^0.2.3` in root package.json |

### Code Integration

| Location | Integration Level |
|----------|-------------------|
| `packages/agent/src/logging/decision-logger.ts` | **STUBBED** - Not real AgentFS calls |
| `scripts/agentfs-init.ts` | Uses real `AgentFS.open()` from SDK |
| `packages/agent/package.json` | Has `agentfs-sdk: ^0.1.0` dependency |

### Classification: **Wired but unclear usage**

**Details**:
- The agent package has AgentFS structure but the `decision-logger.ts` uses a **stub implementation** that just logs to console
- The `scripts/agentfs-init.ts` properly uses the real AgentFS SDK to initialize the database
- Snapshots exist and contain valid phase tracking data
- The agent code calls `logDecision()` etc., but those are stubs, not real writes

### Commands to Verify AgentFS Health
```bash
ls -la .agentfs/
cat .agentfs/snapshots/*.json
```

### Gaps and Risks
1. **Decision logging is stubbed** - Agent decisions are NOT being persisted to AgentFS database
2. **No smoke tests** for AgentFS integration
3. **No clear env flags** for enabling/disabling AgentFS
4. **SDK version mismatch**: Root has `^0.2.3`, agent has `^0.1.0`

**Suggestion**: Replace stub in `decision-logger.ts` with real AgentFS SDK calls. Add a small integration test to validate writes persist.

---

## 5. Beads (bd) Status

### Presence Check

| Check | Result |
|-------|--------|
| `.beads/` directory exists | Yes |
| `beads.db` | Present (401KB + WAL) |
| `issues.jsonl` | Present (56KB) |
| `config.yaml` | Present |
| `daemon.log` | Active (127KB) |

### Beads Usage Patterns

**Active Usage Observed**:
- 50+ tasks tracked across multiple phases
- Epic/subtask hierarchy used (e.g., `intentvision-xyq.1`, `intentvision-xyq.2`)
- Labels used (`phase-X`, `api`, `saas`, etc.)
- Tasks properly closed with reasons

**Current Work (from `bd ready`)**:
1. `intentvision-wgk` - Phase D: External Connections
2. `intentvision-xyq` - Phase F: Cloud Deployment
3. `intentvision-p88` - Phase 4: Production SaaS Control Plane
4. `intentvision-uxb` - Phase 8: Notification Preferences
5. `intentvision-4a8` - Phase 9: Staging Cloud Run + Firestore

**Commands to Inspect**:
```bash
bd ready                  # 10 tasks with no blockers
bd list                   # All tasks
bd stats                  # Overview statistics
bd show intentvision-XXX  # Task details
```

### Classification: **Actively used for work tracking**

Beads is being used as intended:
- All commits reference task IDs
- AARs include "Beads / Task IDs Touched" sections
- Phases are tracked as epics with subtasks
- Clear audit trail in `issues.jsonl`

---

## 6. Architecture & Data Flow Overview

### Runtime Components

```
+-------------+    +-------------+    +-------------+
|   Web UI    |    |   SDK       |    |  Webhooks   |
|  (React)    |    |(TypeScript) |    |             |
+------+------+    +------+------+    +------+------+
       |                  |                  |
       +------------------+------------------+
                          |
                          v
              +-----------------------+
              |   API Server          |
              |   (packages/api)      |
              |   - Express/Hono      |
              |   - Firebase Auth     |
              |   - API Key Auth      |
              +-----------+-----------+
                          |
       +------------------+------------------+
       |                  |                  |
       v                  v                  v
+------------+   +----------------+   +------------+
|  Pipeline  |   |   Operator     |   |  Agent     |
| (forecast, |   | (auth, tenant, |   | (ReAct,    |
| anomaly,   |   |  plans)        |   |  tools)    |
| alert)     |   |                |   |            |
+------+-----+   +--------+-------+   +------+-----+
       |                  |                  |
       +------------------+------------------+
                          |
          +---------------+---------------+
          |                               |
          v                               v
   +-------------+                 +-------------+
   |  Firestore  |                 | Turso/libSQL|
   | (customer   |                 | (internal   |
   |  data)      |                 |  tooling)   |
   +-------------+                 +-------------+
```

### Data Flow

```
Ingest -> Normalize -> Store -> Forecast -> Anomaly -> Alert
   |          |          |         |           |         |
Webhook   Transform   Firestore  Stat/      Detect    Email/
/API      to Canon.   + Metrics  Nixtla     Outliers  Slack/
          Metrics                                     Webhook
```

### Database Wiring

| Data Type | Storage | Notes |
|-----------|---------|-------|
| Organizations, Users | Firestore | Multi-tenant |
| Metrics, Forecasts | Firestore | Per-org collections |
| Alert Rules, Events | Firestore | Notification prefs |
| Usage Tracking | Firestore | Metering/billing |
| Beads Tasks | Turso/SQLite | `.beads/beads.db` |
| AgentFS State | Turso/SQLite | `.agentfs/intentvision.db` |
| Test Database | Turso/SQLite | `db/intentvision.db` |

### Multi-Tenancy Pattern
- `organizations/{orgId}/...` collection hierarchy
- API key authentication with org binding
- Plan-based limits (Free/Starter/Growth/Enterprise)
- Usage metering per operation type

---

## 7. Gaps, Risks, and "Rough Edges"

| # | Gap | Impact | Effort | Recommendation |
|---|-----|--------|--------|----------------|
| 1 | **Pipeline tests failing** - SQLite table creation fails in vitest-setup | High | Low | Fix vitest-setup.ts migration execution |
| 2 | **AgentFS stubbed in agent package** - Decisions not persisted | Medium | Medium | Replace stub with real SDK calls |
| 3 | **VERSION mismatch** - 0.11.0 vs 0.13.0 in docs | Low | Low | Update VERSION file to 0.13.0 |
| 4 | **Production secrets not configured** - CI deploys need secrets | High | Medium | Set up GCP secrets in GitHub |
| 5 | **Load testing incomplete** - Checklist shows unchecked items | Medium | Medium | Run baseline load tests |
| 6 | **No health endpoint tests** - /health/* not in test suite | Medium | Low | Add health endpoint tests |
| 7 | **SDK version mismatch** - agentfs-sdk 0.2.3 vs 0.1.0 | Low | Low | Align versions |
| 8 | **Phase labeling drift** - Multiple "Phase X" naming conventions | Low | Low | Standardize phase naming |

---

## 8. Recommended Next 3-5 Steps

### Step 1: Fix Pipeline Test Setup
**Goal**: Get all tests passing to unblock CI.
**Scope**: Fix `packages/pipeline/tests/vitest-setup.ts` to properly execute migrations before tests. The issue is that in-memory SQLite doesn't have the schema created.
**Success**: `npm run test:pipeline` passes (should be ~220 tests).

### Step 2: Configure Production Secrets
**Goal**: Enable CI/CD to deploy to staging and production.
**Scope**: Set up GitHub Actions secrets for GCP authentication (WIF provider, service account emails, project IDs). Configure Artifact Registry and Secret Manager.
**Success**: Push to main triggers successful staging deployment; version tag triggers production deployment.

### Step 3: Wire Real AgentFS in Agent Package
**Goal**: Persist agent decisions for audit and replay.
**Scope**: Replace stub implementation in `decision-logger.ts` with real `AgentFS` SDK calls. Add integration test.
**Success**: Running the agent demo writes entries to `.agentfs/intentvision.db` that can be queried.

### Step 4: Run Baseline Load Tests
**Goal**: Establish performance baseline before launch.
**Scope**: Execute `npm run load:test:baseline` against staging. Document p50/p99 latencies and error rates. Compare against SLO targets.
**Success**: Load test report generated; latencies within SLO bounds.

### Step 5: Complete Phase F (Cloud Deployment)
**Goal**: Deploy working staging environment.
**Scope**: Complete remaining subtasks: F.3 (Turso Cloud), F.4 (Secrets in Secret Manager), F.5 (Deploy to Cloud Run).
**Success**: `https://iv-api-staging-xxx.run.app/health` returns healthy status.

---

## 9. Questions & Decisions Needed

### Product Direction

**Q1**: Who is the primary paying customer for IntentVision? (DevOps teams? Data engineers? Business analysts?)

**Q2**: What is the first paid use case you want to ship? (Forecast API only? Full alerting? Dashboard?)

**Q3**: What's the pricing model? The plan structure (Free/Starter/Growth/Enterprise) is defined, but what are the actual dollar amounts?

### AgentFS

**Q4**: How strictly should AgentFS be used? Should every agent operation be logged, or only significant decisions?

**Q5**: What's the retention policy for AgentFS data? Should old snapshots be auto-purged?

**Q6**: Is AgentFS meant for production use (operator debugging) or just development tooling?

### Beads Usage

**Q7**: Should every commit require a Beads task ID, or is it acceptable for small fixes to skip this?

**Q8**: Are the current phase labels (1-13 + A/B/C/D/E/F) the final naming, or should they be consolidated?

### Deployment & Environments

**Q9**: Which GCP project(s) are designated for staging and production?

**Q10**: What domains are planned? (e.g., `api.intentvision.io`, `app.intentvision.io`)

**Q11**: Is there a custom domain for the dashboard, or will it use Firebase Hosting's default URL?

**Q12**: Do you want Nixtla TimeGPT enabled in production, or should it remain statistical-only for launch?

### CI/CD

**Q13**: Should the CI run live Firestore tests on every PR, or only on main branch merges?

**Q14**: Do you want Slack/Discord notifications for deployment success/failure?

---

*Status report complete - ready for external review.*
