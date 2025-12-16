# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT: Read `.claude/hooks.md` for quick CLI reference and post-response checklist.**

---

## PRIME DIRECTIVES FOR THIS REPO

**These rules are NON-NEGOTIABLE and apply to ALL work in `intentvision`:**

| # | Directive |
|---|-----------|
| 1 | **Repo Context**: Work ONLY in the `intentvision` repository |
| 2 | **Public/Private Separation**: NEVER expose Beads, AgentFS, or Turso in public API surfaces, customer docs, or marketing |
| 3 | **Beads Discipline**: ALWAYS attach work to Beads task IDs; every commit and AAR must reference tasks |
| 4 | **AgentFS State**: Use AgentFS for agent state, reasoning traces, and decision logging |
| 5 | **Doc-Filing v4**: Follow flat `000-docs/` structure; produce AARs per phase with Beads Task IDs |
| 6 | **Storage Separation**: Firestore = customer data; Turso/libSQL = internal tools ONLY |

**If any of these are violated, STOP and fix immediately before continuing.**

---

## EVERY SESSION CHECKLIST

**Execute this checklist mentally for ANY substantial work in this repo.**

### Before Starting Work

- [ ] Confirm repo context: `intentvision`
- [ ] Identify existing Beads Task ID(s) for this work, or create new one(s):
  ```bash
  bd ready                    # Show available tasks
  bd list -l phase-X          # List tasks for current phase
  bd create "description" -t task -p 2  # Create new task
  ```
- [ ] Note the Task ID(s) in your reasoning context
- [ ] Review which phase this work belongs to

### While Doing Work

- [ ] Keep changes scoped to the current phase objectives
- [ ] Keep internal tooling (Beads, AgentFS, Turso) out of:
  - Public API endpoints and responses
  - Customer-facing documentation
  - Marketing copy or product descriptions
  - Package exports that customers might import
- [ ] Use Firestore for all customer data operations
- [ ] Ensure statistical forecast backend works without Nixtla API key

### After Completing Work (Post-Response Hook)

- [ ] Verify changes align with relevant 6767 standards
- [ ] Ensure AAR exists for this phase in `000-docs/`:
  - Uses Doc-Filing v4 naming: `NNN-AA-AACR-phase-X-description.md`
  - Contains Beads Task ID references in metadata
  - Includes Phase Completion Checklist
- [ ] Suggest commit message with Beads Task ID(s):
  ```
  feat: description of change

  [Task: intentvision-xxx]

  🤖 Generated with Claude Code
  ```
- [ ] If behavior/structure changed significantly, suggest AgentFS snapshot:
  ```bash
  # Document decision in AgentFS (if agent tooling active)
  # Snapshot important state transitions
  ```
- [ ] Close completed Beads tasks:
  ```bash
  bd close intentvision-xxx
  ```

**This checklist is for internal discipline. It does not need to be printed in every response.**

---

## BEADS + AGENTFS USAGE RULES

### Beads Work Tracking

**Purpose:** Track all work, ensure traceability, enforce discipline.

**Task ID Format:**
- Pattern: `intentvision-XXX` (alphanumeric, assigned by Beads)
- Epic subtasks: `intentvision-XXX.N` (parent task with numbered children)

**Storage:**
- Database: `.beads/beads.db` (SQLite, git-ignored except manifest)
- Issues stored as JSONL internally

**Required Usage:**

| Context | Beads Requirement |
|---------|-------------------|
| Starting new phase | Create epic: `bd create "Phase X: Title" -t epic -p 1 -l phase-X` |
| Each subtask | Create task: `bd create "description" -t task --parent intentvision-XXX` |
| Commit messages | Include `[Task: intentvision-XXX]` |
| AAR documents | List all Task IDs in "Beads / Task IDs Touched" section |
| Completing work | Close tasks: `bd close intentvision-XXX` |

**Common Commands:**
```bash
bd ready                          # Show available tasks
bd list                           # All tasks
bd list -l phase-3                # Filter by label
bd show intentvision-XXX          # Task details
bd create "title" -t task -p 2    # Create task (P1-P4 priority)
bd close intentvision-XXX         # Close task
bd sync                           # Sync with remote (if configured)
```

### AgentFS State Management

**Purpose:** Persist agent state, decision traces, and reasoning logs.

**Storage:**
- Database: `.agentfs/intentvision.db` (SQLite, git-ignored)
- Used for: Agent decisions, scenario traces, evaluation runs

**Expected Usage:**

| Use Case | AgentFS Role |
|----------|--------------|
| Agent decision logging | Store reasoning traces and choices |
| Multi-step workflows | Persist state between steps |
| Evaluation runs | Log model outputs and metrics |
| Snapshot checkpoints | Save state at significant transitions |

**Rules:**
- AgentFS is INTERNAL ONLY
- Never called by public HTTP endpoints
- Not required for production API startup
- Never stores customer PII
- Future "operator agent" work should use AgentFS for state

### Separation Guarantee

**These tools MUST NOT appear in:**
- `packages/api/` public exports
- `packages/pipeline/` public interfaces
- Customer-facing responses
- Product documentation
- Firestore collections
- Environment variable requirements for customers

**Allowed locations:**
- `.beads/` and `.agentfs/` directories
- `scripts/` for internal tooling
- `000-docs/` for documentation
- CI/CD scripts and checks
- `CLAUDE.md` instructions

---

## DOC-FILING V4 REQUIREMENTS

### Flat Filing Structure

All documentation lives in `000-docs/` with **NO SUBDIRECTORIES**.

**Naming Convention:** `NNN-CC-ABCD-description.md`

| Component | Meaning |
|-----------|---------|
| `NNN` | Sequential number (001-999, chronological) |
| `CC` | Category code (see table below) |
| `ABCD` | Type code (4 letters, see table below) |
| `description` | Kebab-case description |

**Category Codes (CC):**

| Code | Category |
|------|----------|
| `AA` | After-Action Reports / Audits |
| `AT` | Architecture & Technical |
| `BA` | Battle Plans / Strategic |
| `PP` | Product & Planning |
| `PM` | Project Management |

**Type Codes (ABCD):**

| Code | Type |
|------|------|
| `AACR` | After-Action Completion Report |
| `REPT` | Report |
| `TMPL` | Template |
| `STND` | Standard |
| `SPEC` | Specification |

### AAR Requirements

**Every phase MUST produce an AAR:**

Filename pattern: `NNN-AA-AACR-phase-X-description.md`

**Required Sections:**

1. **Metadata Header**
   - Phase number and title
   - Repo/App name
   - Owner
   - Date/Time with timezone (CST)
   - Status (DRAFT/FINAL)
   - Related Issues/PRs

2. **Beads / Task IDs Touched** (MANDATORY)
   ```markdown
   | Task ID | Status | Title |
   |---------|--------|-------|
   | `intentvision-XXX` | `completed` | Task title |
   ```

3. **Executive Summary**
   - 3-5 bullet points of what was accomplished

4. **What Changed**
   - New files created
   - Files modified
   - Schema/API changes

5. **Evidence Links / Artifacts**
   - File paths
   - Commit hashes (when available)
   - AgentFS snapshot IDs (if applicable)

6. **Phase Completion Checklist**
   - Exit criteria with PASS/FAIL status

7. **Footer**
   - Confidentiality notice
   - Contact information

### 6767 Standards

Files prefixed with `6767-` are **canonical standards** (cross-repo, immutable after approval):

| File | Purpose |
|------|---------|
| `6767-a-*` | Core standards |
| `6767-b-*` | Templates |
| `6767-c-*` | Process guides |

Standards should be referenced, not duplicated, in project-specific docs.

---

## Project Overview

IntentVision is a **Universal Prediction Engine** with this data flow:
```
Connect sources → Normalize metrics → Forecast/anomaly → Explain → Alert/API/dashboard/agent
```

## Commands

```bash
# Build & Test
npm run build              # Build all packages (TypeScript)
npm test                   # Run all tests (contracts + pipeline + operator)
npm run test:e2e           # End-to-end pipeline tests
npm run typecheck          # TypeScript type checking

# Run Specific Package Tests
npm run test:contracts     # @intentvision/contracts tests
npm run test:pipeline      # @intentvision/pipeline tests (vitest)
npm run test:operator      # @intentvision/operator tests (vitest)

# Development
npm run dev                # Start API server (watch mode)
npm run pipeline           # Run pipeline CLI with fixtures
npm run pipeline:synthetic # Run pipeline with synthetic data

# Database
npm run db:migrate         # Run migrations (Turso/LibSQL - internal only)
npm run db:status          # Check migration status

# ARV Gate (run before push)
./scripts/ci/arv-check.sh  # All CI checks

# Beads Work Tracking
bd ready                   # Show available tasks
bd list                    # All tasks
bd create "task" -t task   # Create task
bd close intentvision-xxx  # Close task
bd sync                    # Sync with remote
```

## Architecture

### Monorepo Structure (npm workspaces)
```
packages/
├── contracts/   # Canonical TypeScript interfaces for all data types
├── pipeline/    # Data processing: ingest → normalize → store → forecast → anomaly → alert
├── operator/    # Auth, multi-tenancy, operator interface
├── api/         # Production API server (Cloud Run) - Firestore-backed
├── web/         # Customer dashboard (React + Vite) - Phase 5
├── agent/       # Agent tooling (uses AgentFS internally)
└── functions/   # Cloud Functions

Internal (git-ignored, not for customers):
├── .beads/      # Work tracking database
├── .agentfs/    # Agent state database
└── db/          # Local dev database (Turso/SQLite)
```

### Package Dependencies
- `@intentvision/contracts` - No internal deps (pure types/interfaces)
- `@intentvision/pipeline` - Uses contracts
- `@intentvision/operator` - Uses contracts + pipeline
- `@intentvision/api` - Uses pipeline, operator, Firestore

### Pipeline Components (`packages/pipeline/src/`)
| Directory | Purpose |
|-----------|---------|
| `ingest/` | Fixture loader, webhook handler, raw data intake |
| `normalize/` | Transform raw → canonical metrics |
| `store/` | Metric storage (LibSQL/Turso for internal, Firestore for product) |
| `forecast/` | Prediction backends (statistical default, Nixtla optional) |
| `anomaly/` | Detection (stub, ensemble) |
| `alert/` | Alert emission and routing |
| `connections/` | External data source connections |
| `observability/` | Logging and metrics |

### Core Data Types (from `@intentvision/contracts`)
- `CanonicalMetric` - Normalized time-series data point
- `TimeSeries` - Collection of metrics with metadata
- `ForecastRequest/Response` - Prediction pipeline interface
- `Anomaly` - Detected anomaly with severity and context
- `AlertTrigger` - Alert with routing information

---

## Storage & Backends

### Product Data (Firestore - Primary)

All customer-facing product data uses **Firestore** as the primary database:

| Data Type | Storage | Collection Path |
|-----------|---------|-----------------|
| Organizations | Firestore | `organizations/{orgId}` |
| Users | Firestore | `users/{userId}` (Phase 5) |
| API Keys | Firestore | `organizations/{orgId}/apiKeys/{keyId}` |
| Metrics | Firestore | `organizations/{orgId}/metrics/{metricId}` |
| Time Series | Firestore | `organizations/{orgId}/timeseries/{seriesId}` |
| Forecasts | Firestore | `organizations/{orgId}/forecasts/{forecastId}` |
| Alert Rules | Firestore | `organizations/{orgId}/alertRules/{ruleId}` |
| Alert Events | Firestore | `organizations/{orgId}/alertEvents/{eventId}` |
| Usage | Firestore | `organizations/{orgId}/usage/{date}` |

**Firestore is the canonical source of truth for all customer data.**

### API Endpoint Categories (Phase 5)

| Category | Endpoints | Auth Method |
|----------|-----------|-------------|
| Public API | `/v1/ingest/*`, `/v1/forecast/*`, `/v1/alerts/*` | API Key |
| Dashboard API | `/v1/me`, `/v1/me/apiKeys` | Firebase Auth |
| Internal Operator | `/v1/internal/organizations/*` | API Key (admin scope) |

**Internal operator endpoints are NOT for customer use.**

### Internal Tools Storage (Turso/libSQL)

Turso/libSQL is used **EXCLUSIVELY** for internal development tools:

| Tool | Storage | Purpose |
|------|---------|---------|
| AgentFS | `.agentfs/intentvision.db` | Agent decision logging, snapshots |
| Beads | `.beads/beads.db` | Task tracking, work management |
| Local Dev | `db/intentvision.db` | Development testing only |

**Turso is NOT for customer data in production.**

### Forecasting Backends

IntentVision uses a pluggable `ForecastBackend` interface:

| Backend | Status | Use Case |
|---------|--------|----------|
| `StatisticalBackend` | **DEFAULT** | No external API dependency, always available |
| `NixtlaTimeGPTBackend` | Optional plugin | Premium AI-powered forecasting |

**Implementation Rules:**
- Default backend is `StatisticalBackend` (local/statistical, no API calls)
- `NixtlaTimeGPTBackend` requires `NIXTLA_API_KEY` environment variable
- If `NIXTLA_API_KEY` is not set, system falls back to statistical backend
- Backend selection can be per-tenant (feature-gated) in future phases

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `PORT` | API server port (default: 8080) | No |
| `NODE_ENV` | production/development | No |
| `FIRESTORE_EMULATOR_HOST` | Firestore emulator (dev only) | Dev only |
| `GOOGLE_APPLICATION_CREDENTIALS` | GCP service account (production) | Production |
| `NIXTLA_API_KEY` | Nixtla TimeGPT API key | No (optional) |
| `RESEND_API_KEY` | Resend email API key | No (alerts optional) |
| `RESEND_FROM_EMAIL` | Alert sender email | No |

**Internal-only variables (not for customers):**

| Variable | Purpose |
|----------|---------|
| `INTENTVISION_DB_URL` | Turso/LibSQL for internal tools |
| `INTENTVISION_DB_AUTH_TOKEN` | Turso auth (internal) |

---

## Deployment

```bash
# Docker (Cloud Run)
docker build -t intentvision .
docker run -p 8080:8080 intentvision

# Cloud Run
gcloud run deploy intentvision \
  --image gcr.io/PROJECT/intentvision \
  --platform managed --region us-central1
```

---

## Implementation Checklist

For every change, verify:

- [ ] Customer data uses Firestore (not Turso)
- [ ] Production endpoints do NOT call AgentFS or Beads
- [ ] Nixtla/TimeGPT is optional (statistical fallback works)
- [ ] Internal tools isolated in `.agentfs/` and `.beads/`
- [ ] Beads Task ID(s) identified for this work
- [ ] AAR created/updated for completed phase
- [ ] Beads Task IDs referenced in AAR and commits
- [ ] `npm test` passes
- [ ] `./scripts/ci/arv-check.sh` passes (if present)
- [ ] Docs updated if storage/schema changed

If violations are detected, create a scoped refactor plan and fix immediately.

---

## Quick Reference: Phase Workflow

```
1. Start Phase
   └─> bd create "Phase X: Title" -t epic -p 1 -l phase-X

2. Create Subtasks
   └─> bd create "subtask" -t task --parent intentvision-XXX

3. Do Work
   └─> Follow Every Session Checklist
   └─> Keep internal tools out of public surfaces

4. Complete Phase
   └─> Create AAR: 000-docs/NNN-AA-AACR-phase-X-description.md
   └─> Close tasks: bd close intentvision-XXX
   └─> Commit with [Task: intentvision-XXX]

5. Verify
   └─> Run tests, ARV checks
   └─> Confirm AAR has Beads references
```
