# Phase 1 AAR - Repo Audit & Guardrails

> After Action Review for IntentVision Phase 1: Repository Audit and Architecture Guardrails

---

## Metadata

| Field | Value |
|-------|-------|
| **Document** | `029-AA-AACR-phase-1-repo-audit-guardrails` |
| **Phase** | 1 - Repo Audit & Guardrails |
| **Status** | COMPLETED |
| **Date** | 2025-12-15 |
| **Beads Task** | intentvision-91n |

---

## Executive Summary

Phase 1 established the architectural guardrails for IntentVision's evolution from a SQL-first to a Firestore-primary architecture. This phase audited the current codebase, documented the existing implementation state, and updated CLAUDE.md with new development constraints.

---

## 1. Audit Findings

### 1.1 Current Database Usage (Turso/libSQL)

**Status**: Heavily implemented - 53 files reference libSQL/Turso

| Component | File | Usage |
|-----------|------|-------|
| DB Client Factory | `db/config.ts` | Primary connection management |
| Forecast Storage | `packages/pipeline/src/forecast/nixtla-timegpt.ts` | Stores forecasts via `getClient()` |
| Connection Pool | `packages/pipeline/src/connections/turso-pool.ts` | Connection pooling |
| Migrations | `db/migrations/*.sql` | Schema definitions |

**Schema**: 14 tables defined in SQL migrations:
- organizations, users, user_org_memberships
- metrics, time_series, forecasts, anomalies
- alerts, alert_rules, ingestion_sources
- connections, api_keys, forecast_jobs, notification_channels

### 1.2 Firestore/Firebase Status

**Status**: NOT IMPLEMENTED - Only documentation mentions

| Search Pattern | Files Found | Actual Code |
|---------------|-------------|-------------|
| `firestore\|firebase` | 14 files | 0 implementation files |
| `firebase*.ts` | 0 files | None |
| `firestore*.ts` | 0 files | None |

All Firebase mentions are in planning documents and architecture docs, not implementation.

### 1.3 TimeGPT/Nixtla Implementation

**Status**: FULLY IMPLEMENTED - Production-ready

| Component | File | Status |
|-----------|------|--------|
| TimeGPT Backend | `packages/pipeline/src/forecast/nixtla-timegpt.ts` | Complete |
| HTTP Client | `packages/pipeline/src/connections/nixtla-client.ts` | Complete |
| Circuit Breaker | `packages/pipeline/src/connections/nixtla-client.ts` | Complete |
| Tests | `packages/pipeline/tests/forecast/nixtla-timegpt.test.ts` | Passing |

Features implemented:
- Forecast generation with prediction intervals
- Anomaly detection
- Mock mode for testing
- Exponential backoff retry (3 retries)
- Circuit breaker pattern (5 failures = open for 30s)
- Database storage of results

### 1.4 Internal Tools Status

| Tool | Location | Database | Status |
|------|----------|----------|--------|
| AgentFS | `.agentfs/` | `intentvision.db` | Active |
| Beads | `.beads/` | `beads.db` | Active |

Git-ignore configuration verified:
- Database files (*.db, *.db-wal, *.db-shm) are ignored
- Snapshots directory is preserved
- Config files are preserved

---

## 2. Architecture Pivot

### 2.1 Before (SQL-Primary)

```
Customer Data → SQLite/libSQL (Turso) → All 14 tables
Internal Tools → SQLite (local) → AgentFS, Beads
```

### 2.2 After (Firestore-Primary)

```
Customer Data → Firestore → orgs/{orgId}/... collections
Internal Tools → SQLite (local) → AgentFS, Beads (unchanged)
```

### 2.3 Migration Path

The current SQL implementation remains functional for:
1. Local development and testing
2. Internal tool state (AgentFS, Beads)
3. Backwards compatibility during migration

Firestore will be introduced for:
1. Production customer data
2. Real-time dashboard updates
3. Scalable multi-tenant architecture

---

## 3. Guardrails Established

### 3.1 CLAUDE.md Updates

Updated `CLAUDE.md` with new "Data & Tooling Guardrails" section:

| Section | Content |
|---------|---------|
| Product Data Storage | Firestore as primary, org-scoped collections |
| Internal Tools Storage | Turso/libSQL for AgentFS and Beads only |
| Forecasting Backend | Statistical default, Nixtla optional plugin |
| Customer Isolation | Firestore security rules, org-scoped queries |
| Internal Tools | Strict separation from customer-facing code |
| Doc-Filing v4 | AAR required per phase |
| Implementation Checklist | 7-point verification list |

### 3.2 Separation Guarantee

Verified no imports from production packages into internal tools:

```bash
grep -r "from.*\.agentfs" packages/api packages/pipeline packages/operator
# Returns: empty (no violations)

grep -r "from.*\.beads" packages/api packages/pipeline packages/operator
# Returns: empty (no violations)
```

---

## 4. Test Status

| Package | Tests | Status |
|---------|-------|--------|
| contracts | ~50 | Passing |
| pipeline | 220 | Passing |
| operator | 87 | Passing |
| **Total** | **307+** | **All Passing** |

---

## 5. Deliverables

| Deliverable | Status | Location |
|-------------|--------|----------|
| Codebase Audit | Complete | This document |
| CLAUDE.md Update | Complete | `/CLAUDE.md` |
| .beads folder | Verified | `/.beads/` |
| .agentfs folder | Verified | `/.agentfs/` |
| Phase 1 AAR | Complete | `000-docs/029-AA-AACR-phase-1-repo-audit-guardrails.md` |

---

## 6. Next Steps (Phase 2 Preview)

Phase 2 will focus on Firestore schema design and implementation:

1. Design Firestore collection hierarchy
2. Create Firestore security rules
3. Implement Firestore client wrapper
4. Create migration utilities for SQL → Firestore
5. Update pipeline to support Firestore backend

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SQL tests break during migration | High | Keep SQL backend for testing |
| Firestore latency | Medium | Use batch writes, caching |
| Data consistency during migration | High | Dual-write period with validation |
| TimeGPT dependency | Low | Statistical backend as fallback |

---

## 8. References

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Updated guardrails |
| `027-AT-ARCH-storage-tooling-separation.md` | Previous architecture (superseded) |
| `028-AT-ARCH-target-scaffold-phase-g.md` | Target scaffold structure |
| `db/config.ts` | Current DB configuration |
| `packages/pipeline/src/forecast/nixtla-timegpt.ts` | TimeGPT implementation |

---

*Document: 029-AA-AACR-phase-1-repo-audit-guardrails.md*
*Phase: 1 - Repo Audit & Guardrails*
*Last Updated: 2025-12-15*
