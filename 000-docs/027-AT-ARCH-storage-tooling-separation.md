# Storage & Tooling Separation - IntentVision

> Architectural Decision Record for data storage and internal tooling boundaries

---

> **SUPERSEDED**: This document described a SQL-primary architecture. As of 2025-12-15, the architecture has pivoted to **Firestore-primary** for customer data. See `CLAUDE.md` (Data & Tooling Guardrails) and `029-AA-AACR-phase-1-repo-audit-guardrails.md` for current architecture. The internal tooling separation rules (AgentFS, Beads) remain valid.

---

## Metadata

| Field | Value |
|-------|-------|
| **Document** | `027-AT-ARCH-storage-tooling-separation` |
| **Category** | Architecture (AT-ARCH) |
| **Status** | SUPERSEDED |
| **Date** | 2025-12-15 |
| **Owner** | Engineering |

---

## Executive Summary

This document establishes the canonical storage architecture for IntentVision and explicitly separates internal development tools from customer-facing infrastructure. These decisions are **non-negotiable constraints** for all future development.

---

## 1. Product Data Storage Stack

### Decision: SQLite/libSQL/Turso

All customer-facing product data uses **SQLite-compatible storage** via libSQL (Turso):

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCT DATA (SQL)                           │
├─────────────────────────────────────────────────────────────────┤
│  Database: Turso (libSQL) / SQLite                              │
│  Config: INTENTVISION_DB_URL, INTENTVISION_DB_AUTH_TOKEN        │
│  Schema: db/migrations/*.sql                                    │
│  Client: @libsql/client (db/config.ts)                          │
├─────────────────────────────────────────────────────────────────┤
│  Tables (14 total):                                             │
│  ├── organizations      - Tenant root                           │
│  ├── users              - SaaS user accounts                    │
│  ├── user_org_memberships - User-org relationship               │
│  ├── metrics            - Canonical metric spine                │
│  ├── time_series        - Aggregated series                     │
│  ├── forecasts          - Prediction results                    │
│  ├── anomalies          - Detection results                     │
│  ├── alerts             - Fired alerts                          │
│  ├── alert_rules        - Alert configuration                   │
│  ├── ingestion_sources  - Data source config                    │
│  ├── connections        - External integrations                 │
│  ├── api_keys           - API authentication                    │
│  ├── forecast_jobs      - Scheduled forecasts                   │
│  └── notification_channels - Alert destinations                 │
└─────────────────────────────────────────────────────────────────┘
```

### Rationale

| Criterion | SQLite/libSQL/Turso | Firestore | BigQuery |
|-----------|---------------------|-----------|----------|
| Edge-ready | Yes | No | No |
| SQL compatibility | Yes | No | Yes |
| Vendor lock-in | Low (SQLite standard) | High | High |
| Local development | Easy (file) | Emulator | Complex |
| Multi-tenant support | Yes (org_id) | Yes | Yes |
| Cost at scale | Low | Medium | High |
| Time-series queries | Good | Poor | Excellent |

**Chosen**: SQLite/libSQL/Turso for balance of portability, cost, and developer experience.

---

## 2. Firestore Role (If Used)

### Decision: Control-Plane Only

Firestore is **optional** and restricted to control-plane functions:

```
┌─────────────────────────────────────────────────────────────────┐
│                 CONTROL PLANE (Firestore - Optional)            │
├─────────────────────────────────────────────────────────────────┤
│  ALLOWED:                                                       │
│  ├── Auth session metadata                                      │
│  ├── User UI preferences                                        │
│  ├── Saved dashboard layouts                                    │
│  ├── Feature flags (per-user)                                   │
│  └── Non-critical UX state                                      │
├─────────────────────────────────────────────────────────────────┤
│  NOT ALLOWED:                                                   │
│  ├── Time-series metrics                                        │
│  ├── Forecasts                                                  │
│  ├── Anomalies                                                  │
│  ├── Alerts / Alert rules                                       │
│  ├── Organizations (source of truth)                            │
│  ├── API keys                                                   │
│  └── Any data that affects prediction engine behavior           │
└─────────────────────────────────────────────────────────────────┘
```

### Firestore Integration Rules

If Firestore is introduced:

1. **Create documentation** in `000-docs/` explaining what Firestore stores
2. **Frontend calls backend API**, not Firestore directly for product data
3. **Firestore data is rebuildable** - loss of Firestore should not break predictions
4. **No duplication** - data exists in one place (SQL or Firestore, not both)

---

## 3. Internal Development Tools

### Decision: Complete Separation from Production

Internal tools operate in isolated namespaces with no runtime coupling to production code.

```
┌─────────────────────────────────────────────────────────────────┐
│                 INTERNAL TOOLS (Dev-Only)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AgentFS (.agentfs/)                                            │
│  ├── Purpose: Agent decision logging, experimentation           │
│  ├── Database: intentvision.db (separate from product DB)       │
│  ├── Snapshots: .agentfs/snapshots/                             │
│  └── Usage: packages/agent/ only (not pipeline/operator/api)    │
│                                                                 │
│  Beads (.beads/)                                                │
│  ├── Purpose: Work tracking, task management                    │
│  ├── Data: issues.jsonl                                         │
│  ├── CLI: bd ready, bd list, bd close                           │
│  └── Usage: Commits, CI, documentation only                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Separation Rules

| Rule | Enforcement |
|------|-------------|
| No production imports from `.agentfs/` | Code review, grep checks |
| No production imports from `.beads/` | Code review, grep checks |
| AgentFS not required for API startup | Startup validation |
| Beads not required for API startup | Startup validation |
| Customer data never in AgentFS | Schema separation |
| Internal tools have own databases | Separate DB files |

### Verification Script

```bash
# Check for violations
grep -r "from.*\.agentfs" packages/api packages/pipeline packages/operator
grep -r "from.*\.beads" packages/api packages/pipeline packages/operator

# Should return empty (no matches)
```

---

## 4. Multi-Tenant Architecture

### Decision: Org-Scoped Row Isolation

```sql
-- Every product table includes org_id
CREATE TABLE metrics (
    id INTEGER PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(org_id),
    -- ... other columns
);

-- All queries are org-scoped
SELECT * FROM metrics WHERE org_id = ? AND ...;
```

### Tenant Isolation Guarantees

1. **Query Filtering**: All store functions require `org_id` parameter
2. **API Authentication**: API keys are org-scoped
3. **Middleware Enforcement**: Tenant context set before request processing
4. **Foreign Keys**: `org_id` references `organizations(org_id)`

### Future: Physical Isolation (Optional)

For enterprise customers requiring physical isolation:

```typescript
// Per-tenant DB URL configuration
const dbUrl = process.env[`INTENTVISION_DB_URL_${orgId}`]
           || process.env.INTENTVISION_DB_URL;
```

---

## 5. Configuration via Environment

### Required Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `INTENTVISION_DB_URL` | Primary database connection | `libsql://db.turso.io` |
| `INTENTVISION_DB_AUTH_TOKEN` | Turso authentication | `eyJ...` |

### Optional Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NIXTLA_API_KEY` | Nixtla TimeGPT API | None (statistical fallback) |
| `PORT` | API server port | `8080` |
| `NODE_ENV` | Environment mode | `development` |
| `TEST_DB_URL` | Test database override | `:memory:` |

### Hard Rules

- **No hardcoded database URLs** in source code
- **No credentials in version control**
- **All DB config via environment**

---

## 6. Migration Notes

### Current State (Compliant)

As of 2025-12-15, IntentVision is **fully compliant** with these guardrails:

- All product data in SQLite/libSQL (`db/` schema)
- No Firestore dependencies
- AgentFS isolated in `.agentfs/` and `packages/agent/`
- Beads isolated in `.beads/`
- No cross-contamination between internal tools and production packages

### If Violations Are Found

1. **Document** the violation in an AAR
2. **Create** a scoped refactor task in Beads
3. **Fix** with minimal changes
4. **Test** all 307+ tests pass
5. **Update** this document if architecture changes

---

## 7. Architecture Diagram

```
                              ┌──────────────────────────────────┐
                              │         EXTERNAL CLIENTS         │
                              │   (Web App, Mobile, Integrations)│
                              └──────────────┬───────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                      │
│                        packages/api/src/index.ts                           │
│  Endpoints: /health, /pipeline, /forecast, /ingest, /anomalies             │
└────────────────────────────────────────────────────────────────────────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│  OPERATOR LAYER     │      │   PIPELINE LAYER    │      │   CONTRACTS LAYER   │
│ packages/operator/  │      │  packages/pipeline/ │      │  packages/contracts/│
│ - Auth (API keys)   │      │ - Ingest            │      │ - Type definitions  │
│ - Multi-tenancy     │      │ - Normalize         │      │ - Interfaces        │
│ - RBAC              │      │ - Store             │      │                     │
│                     │      │ - Forecast          │      │                     │
│                     │      │ - Anomaly           │      │                     │
│                     │      │ - Alert             │      │                     │
└─────────────────────┘      └─────────────────────┘      └─────────────────────┘
              │                              │
              └──────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        PRODUCT DATABASE                                     │
│                     SQLite / libSQL / Turso                                │
│                        db/config.ts                                        │
│  Tables: organizations, metrics, forecasts, anomalies, alerts, api_keys... │
│  Config: INTENTVISION_DB_URL, INTENTVISION_DB_AUTH_TOKEN                   │
└────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════ SEPARATION BOUNDARY ═══════════════════════════


┌────────────────────────────────────────────────────────────────────────────┐
│                      INTERNAL DEV TOOLS (Isolated)                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────┐      ┌─────────────────────────┐              │
│  │    AgentFS (.agentfs/)  │      │    Beads (.beads/)      │              │
│  │    - Decision logging   │      │    - Work tracking      │              │
│  │    - Experimentation    │      │    - Task management    │              │
│  │    - packages/agent/    │      │    - Commit references  │              │
│  │    - Own SQLite DB      │      │    - issues.jsonl       │              │
│  └─────────────────────────┘      └─────────────────────────┘              │
│                                                                            │
│  NOT CONNECTED TO: packages/api, packages/pipeline, packages/operator      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘


┌────────────────────────────────────────────────────────────────────────────┐
│                      OPTIONAL: FIRESTORE (Control-Plane)                    │
│                                                                            │
│  IF USED (currently not):                                                  │
│  - Auth sessions                                                           │
│  - UI preferences                                                          │
│  - Dashboard layouts                                                       │
│                                                                            │
│  NEVER USED FOR: metrics, forecasts, anomalies, alerts, organizations      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. References

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Data & Tooling Guardrails section |
| `db/migrations/001_initial_schema.sql` | Core schema |
| `db/migrations/002_saas_tables.sql` | SaaS schema |
| `db/config.ts` | Database client factory |
| `000-docs/024-AA-SUMM-project-status-comprehensive.md` | Project overview |
| `000-docs/026-AA-AUDT-appaudit-devops-playbook.md` | Operations guide |

---

*Document: 027-AT-ARCH-storage-tooling-separation.md*
*Category: Architecture*
*Last Updated: 2025-12-15*
