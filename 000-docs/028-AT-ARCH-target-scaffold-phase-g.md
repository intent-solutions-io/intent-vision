# Target Scaffold - Phase G Production Restructure

> Canonical reference for IntentVision production-ready SaaS architecture

---

> **STACK ALIGNMENT NOTE**: This scaffold defines the physical directory structure. For data storage stack decisions, see `030-AA-AACR-phase-0-scaffold-alignment.md`. Key points:
> - **Firestore** = Primary product database (not SQL)
> - **Turso/SQLite** = Internal tools only (AgentFS, Beads)
> - **Statistical backend** = Default forecasting (Nixtla optional)

---

## Metadata

| Field | Value |
|-------|-------|
| **Document** | `028-AT-ARCH-target-scaffold-phase-g` |
| **Epic** | `intentvision-91n` |
| **Status** | PLANNED |
| **Date** | 2025-12-15 |

---

## Target Directory Structure

```
intentvision/
├── 000-docs/                          # Flat doc-filing (AARs, PRDs, audits)
│   ├── 6767-*.md                      # Canonical standards
│   └── NNN-*.md                       # Project documents
│
├── CLAUDE.md                          # AI assistant guardrails
├── README.md                          # Project overview
├── package.json                       # Root workspace config
├── tsconfig.json
├── .gitignore
│
├── .github/
│   └── workflows/
│       ├── ci.yml                     # Test + build + ARV gates
│       ├── deploy-api.yml             # Cloud Run deploy
│       └── deploy-web.yml             # Firebase Hosting deploy
│
├── scripts/
│   ├── ci/                            # CI/CD scripts
│   │   ├── arv-check.sh
│   │   ├── check-docs-flat.sh
│   │   ├── check-security.sh
│   │   └── check-tests.sh
│   ├── dev/                           # Development helpers
│   │   ├── run-local-api.sh
│   │   └── seed-local-db.sh
│   └── ops/                           # Operations scripts
│       ├── export-logs.sh
│       └── backup-db.sh
│
├── db/                                # Database layer (UNCHANGED)
│   ├── config.ts                      # DB client factory
│   ├── migrate.ts                     # Migration runner
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── 002_saas_tables.sql
│   └── seeds/
│       └── demo-data.sql
│
├── apps/                              # DEPLOYABLE APPLICATIONS
│   │
│   ├── api/                           # Cloud Run API Server
│   │   ├── src/
│   │   │   ├── index.ts               # Express/Fastify entrypoint
│   │   │   ├── routes/
│   │   │   │   ├── health.ts
│   │   │   │   ├── ingest.ts
│   │   │   │   ├── forecast.ts
│   │   │   │   ├── anomalies.ts
│   │   │   │   ├── alerts.ts
│   │   │   │   └── tenants.ts
│   │   │   ├── middleware/
│   │   │   │   ├── api-key-auth.ts
│   │   │   │   ├── tenant-context.ts
│   │   │   │   └── error-handler.ts
│   │   │   ├── services/
│   │   │   │   ├── tenant-service.ts
│   │   │   │   └── metrics-service.ts
│   │   │   └── env.ts
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                           # Firebase Hosting Dashboard
│       ├── src/
│       │   ├── components/
│       │   │   ├── dashboard/
│       │   │   │   ├── CommandCenter.tsx
│       │   │   │   ├── PredictionCard.tsx
│       │   │   │   ├── RiskRadar.tsx
│       │   │   │   └── TrendChart.tsx
│       │   │   ├── alerts/
│       │   │   │   ├── AlertConfig.tsx
│       │   │   │   └── AlertHistory.tsx
│       │   │   ├── connections/
│       │   │   │   └── ConnectionList.tsx
│       │   │   └── common/
│       │   │       ├── Navbar.tsx
│       │   │       └── Sidebar.tsx
│       │   ├── hooks/
│       │   │   ├── useAuth.ts
│       │   │   ├── usePredictions.ts
│       │   │   ├── useAnomalies.ts
│       │   │   └── useAlerts.ts
│       │   ├── lib/
│       │   │   ├── api.ts             # Calls apps/api
│       │   │   └── firebase.ts        # Optional: Auth + UI state
│       │   ├── pages/
│       │   │   ├── index.tsx
│       │   │   ├── dashboard.tsx
│       │   │   ├── alerts.tsx
│       │   │   ├── connections.tsx
│       │   │   ├── settings.tsx
│       │   │   └── login.tsx
│       │   └── App.tsx
│       ├── public/
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── firebase.json
│       └── package.json
│
├── packages/                          # SHARED LIBRARIES
│   │
│   ├── contracts/                     # Types/interfaces (UNCHANGED)
│   │   ├── src/
│   │   │   ├── metrics-spine.ts
│   │   │   ├── forecast.ts
│   │   │   ├── anomaly.ts
│   │   │   ├── alert.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── pipeline/                      # Core engine (UNCHANGED)
│   │   ├── src/
│   │   │   ├── ingest/
│   │   │   ├── normalize/
│   │   │   ├── store/
│   │   │   ├── forecast/
│   │   │   ├── anomaly/
│   │   │   ├── alert/
│   │   │   ├── connections/
│   │   │   └── observability/
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── operator/                      # Multi-tenant layer (UNCHANGED)
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── tenant/
│   │   │   └── api/
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── agent/                         # AI agent tools (UNCHANGED)
│   │   ├── src/
│   │   │   ├── tools/
│   │   │   ├── router/
│   │   │   └── logging/
│   │   └── package.json
│   │
│   └── sdk-js/                        # NEW: Public JavaScript SDK
│       ├── src/
│       │   ├── client.ts              # IntentVisionClient class
│       │   ├── types.ts               # Re-exports from contracts
│       │   └── index.ts
│       ├── README.md                  # Usage examples
│       └── package.json
│
├── infra/                             # NEW: Deployment configs
│   ├── cloud-run/
│   │   └── service-api.yaml
│   ├── firebase/
│   │   ├── firebase.json
│   │   └── firestore.rules
│   └── env/
│       ├── .env.example
│       └── secrets.md
│
├── .agentfs/                          # INTERNAL DEV ONLY
│   ├── intentvision.db
│   └── snapshots/
│
└── .beads/                            # INTERNAL DEV ONLY
    └── issues.jsonl
```

---

## Separation of Concerns

### Apps (Deployable)

| App | Purpose | Deployment | Data Source |
|-----|---------|------------|-------------|
| `apps/api` | Public HTTP API | Cloud Run | SQL (Turso/SQLite) |
| `apps/web` | Customer dashboard | Firebase Hosting | Calls `apps/api` |

### Packages (Shared Libraries)

| Package | Purpose | Consumers |
|---------|---------|-----------|
| `contracts` | Type definitions | All packages + apps |
| `pipeline` | Prediction engine | `apps/api` |
| `operator` | Multi-tenant auth | `apps/api` |
| `agent` | AI agent tools | Optional |
| `sdk-js` | Customer SDK | External customers |

### Internal Tools (Dev Only)

| Tool | Purpose | Never Used By |
|------|---------|---------------|
| `.agentfs/` | Agent decision logging | `apps/*`, `packages/*` |
| `.beads/` | Work tracking | `apps/*`, `packages/*` |

---

## Data Flow

```
                    ┌──────────────────────────────────────┐
                    │           CUSTOMER APPS              │
                    │  (using packages/sdk-js or direct)   │
                    └──────────────────┬───────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           apps/api (Cloud Run)                          │
│                                                                         │
│  routes/         middleware/           services/                        │
│  ├── health      ├── api-key-auth      ├── tenant-service              │
│  ├── ingest      ├── tenant-context    └── metrics-service             │
│  ├── forecast    └── error-handler                                      │
│  ├── anomalies                                                          │
│  └── alerts                                                             │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  packages/pipeline  │  │  packages/operator  │  │  packages/contracts │
│  (Prediction Engine)│  │  (Auth/Tenancy)     │  │  (Types)            │
└──────────┬──────────┘  └─────────────────────┘  └─────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           db/ (SQL)                                     │
│                    SQLite / libSQL / Turso                              │
│    metrics, forecasts, anomalies, alerts, organizations, api_keys      │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                        apps/web (Firebase Hosting)                      │
│                                                                         │
│  Dashboard UI (React + Vite + Tailwind)                                │
│  Calls: apps/api for ALL product data                                  │
│  Optional: Firebase Auth + Firestore for UI state only                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Migration Path

### From Current Structure

```
CURRENT                          TARGET
───────                          ──────
packages/api/        ──────►     apps/api/
(new)                ──────►     apps/web/
(new)                ──────►     packages/sdk-js/
(new)                ──────►     infra/
scripts/ci/          ──────►     scripts/ci/    (organize)
(new)                ──────►     scripts/dev/
(new)                ──────►     scripts/ops/
packages/contracts/  ──────►     packages/contracts/ (unchanged)
packages/pipeline/   ──────►     packages/pipeline/  (unchanged)
packages/operator/   ──────►     packages/operator/  (unchanged)
packages/agent/      ──────►     packages/agent/     (unchanged)
packages/functions/  ──────►     (archive/remove)
db/                  ──────►     db/ (unchanged)
```

### Task Order

1. **G.1** Create `apps/` directory structure
2. **G.2** Migrate `packages/api` → `apps/api`
3. **G.3** Create `apps/web` dashboard scaffold
4. **G.4** Create `packages/sdk-js`
5. **G.5** Reorganize `scripts/`
6. **G.6** Create `infra/` configs
7. **G.7** Configure Firebase Hosting
8. **G.8** Update workspace + imports
9. **G.9** Update and verify tests
10. **G.10** Update CI/CD
11. **G.11** Update documentation
12. **G.12** Cleanup deprecated code

---

## Success Criteria

- [ ] All 307+ tests pass
- [ ] `apps/api` deploys to Cloud Run
- [ ] `apps/web` deploys to Firebase Hosting
- [ ] `packages/sdk-js` publishable to npm
- [ ] No imports from `.agentfs/` or `.beads/` in apps/packages
- [ ] SQL remains source of truth for all product data
- [ ] Documentation updated with new structure

---

*Document: 028-AT-ARCH-target-scaffold-phase-g.md*
*Epic: intentvision-91n*
*Last Updated: 2025-12-15*
