## Task Tracking (Beads / bd)
- Use `bd` for ALL tasks/issues (no markdown TODO lists).
- Start of session: `bd ready`
- Create work: `bd create "Title" -p 1 --description "Context + acceptance criteria"`
- Update status: `bd update <id> --status in_progress`
- Finish: `bd close <id> --reason "Done"`
- End of session: `bd sync` (flush/import/export + git sync)
- Manual testing safety:
  - Prefer `BEADS_DIR` to isolate a workspace if needed. (`BEADS_DB` exists but is deprecated.)


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IntentVision is a **Universal Prediction Engine**: Connect sources → Normalize metrics → Forecast/anomaly → Explain → Alert/API/dashboard/agent.

## Commands

```bash
# Build & Test
npm run build              # Build all packages
npm test                   # Run all tests
npm run typecheck          # TypeScript checking

# Run single test file
npx vitest run packages/pipeline/tests/path/to/file.test.ts

# Development
npm run dev                # API server (watch mode)
npm run pipeline           # Run pipeline with fixtures
npm run pipeline:synthetic # Run with synthetic data

# Pre-push gate
./scripts/ci/arv-check.sh
```

## Architecture

npm workspaces monorepo:

| Package | Purpose |
|---------|---------|
| `contracts` | Canonical TypeScript interfaces (no deps) |
| `pipeline` | ingest → normalize → store → forecast → anomaly → alert |
| `operator` | Auth, multi-tenancy |
| `api` | Production API server (Cloud Run, Firestore) |
| `sdk` | Customer-facing TypeScript SDK |
| `web` | Customer dashboard (React + Vite) |
| `agent` | Agent tooling (internal) |

**Pipeline flow:** `packages/pipeline/src/` contains `ingest/`, `normalize/`, `store/`, `forecast/`, `anomaly/`, `alert/`, `observability/`

## Critical Rules

### Storage Separation
- **Firestore** = ALL customer data (`organizations/{orgId}/...`)
- **Turso/libSQL** = Internal tools ONLY (`.beads/`, `.agentfs/`, `db/`)

### Internal Tools (NEVER expose to customers)
- **Beads** - Work tracking (`.beads/`)
- **AgentFS** - Agent state (`.agentfs/`)

These must NOT appear in: public API responses, customer docs, package exports, Firestore collections.

### Forecasting
- `StatisticalBackend` = DEFAULT (no external deps)
- `NixtlaTimeGPTBackend` = Optional (requires `NIXTLA_API_KEY`)
- System must work without Nixtla API key

## Work Tracking (Beads)

```bash
bd ready                   # Available tasks
bd list                    # All tasks
bd create "task" -t task   # Create task
bd close intentvision-xxx  # Close task
```

Commits must include `[Task: intentvision-xxx]`.

## Documentation

All docs in `000-docs/` (flat, no subdirectories). Files prefixed `6767-` are canonical standards.

Phase completion requires an AAR: `NNN-AA-AACR-phase-X-description.md`
