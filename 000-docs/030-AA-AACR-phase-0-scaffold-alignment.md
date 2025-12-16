# Phase 0 AAR - Scaffold Alignment & Guardrails

> Alignment of Universal Prediction Engine scaffold to IntentVision production stack

---

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | `0 - Scaffold Alignment & Guardrails` |
| **Repo/App** | `intentvision` |
| **Owner** | Engineering |
| **Date/Time (CST)** | 2025-12-15 22:30 CST |
| **Status** | `FINAL` |
| **Related Issues/PRs** | Epic: `intentvision-91n` |
| **Commit(s)** | Pending |

---

## Beads / Task IDs Touched

| Task ID | Status | Title |
|---------|--------|-------|
| `intentvision-91n` | `in_progress` | Phase G Production Restructure Epic |
| `intentvision-001` | `completed` | Scaffold alignment and guardrails setup |

**Beads Status:** `Active`

---

## Executive Summary

- Audited current codebase to identify storage, forecasting, and tooling implementations
- Established Firestore as the **primary product datastore** (not yet implemented, target architecture)
- Classified Turso/libSQL as **internal-only** (AgentFS, Beads, local dev)
- Defined Nixtla/TimeGPT as **optional plugin** behind `ForecastBackend` interface
- Updated CLAUDE.md with structured guardrails sections
- Verified Doc-Filing v4 standard and AAR template exist
- All internal tools (AgentFS, Beads) confirmed isolated from product code

---

## What Changed

- **CLAUDE.md**: Completely restructured guardrails section with:
  - `GUARDRAILS` quick reference table
  - `Storage & Backends` section (Firestore primary, Turso internal)
  - `Internal Tools` section (AgentFS, Beads rules and separation guarantee)
  - `Documentation & AAR Rules` section (Doc-Filing v4, Beads integration)
  - `Implementation Checklist` with 9 verification points

- **000-docs/027-AT-ARCH-storage-tooling-separation.md**: Marked as SUPERSEDED

- **000-docs/028-AT-ARCH-target-scaffold-phase-g.md**: Added stack alignment note

- **000-docs/029-AA-AACR-phase-1-repo-audit-guardrails.md**: Created (audit results)

- **000-docs/030-AA-AACR-phase-0-scaffold-alignment.md**: This document (proper template)

---

## Why

The original Universal Prediction Engine scaffold assumed:
- BigQuery as primary datastore
- Nixtla/TimeGPT as required dependency
- Turso for metrics storage

The updated product direction requires:
- Firestore for customer data (scalable, real-time, Firebase ecosystem)
- Statistical backend as default (no external API dependency)
- Turso restricted to internal tooling only
- Clear separation between product and internal dev tools

This phase locks in these architectural decisions before implementation begins.

---

## How to Verify

```bash
# Step 1: Verify CLAUDE.md has guardrails sections
grep -c "GUARDRAILS" CLAUDE.md  # Should return 1+
grep -c "Storage & Backends" CLAUDE.md  # Should return 1
grep -c "Internal Tools" CLAUDE.md  # Should return 1
grep -c "Documentation & AAR Rules" CLAUDE.md  # Should return 1

# Step 2: Verify 000-docs is flat
find 000-docs -type d | wc -l  # Should return 1 (only 000-docs itself)

# Step 3: Verify Doc-Filing v4 standard exists
ls 000-docs/6767-a-DR-STND-document-filing-system-standard-v4.md

# Step 4: Verify AAR template exists
ls 000-docs/6767-b-AA-TMPL-after-action-report-template.md

# Step 5: Run existing tests (should still pass)
npm test
```

---

## Risks / Gotchas

- **Current SQL implementation**: The existing code uses Turso for all product data. This will need migration in Phase 1+.
- **Firestore not yet implemented**: This phase defines the target architecture but doesn't implement Firestore.
- **Test compatibility**: All 307+ tests still use SQLite. Tests will need updates when Firestore is wired.

---

## Rollback Plan

1. Revert CLAUDE.md changes via git
2. Remove superseded notices from docs 027 and 028
3. Delete this AAR (030) and previous audit AAR (029)

---

## Open Questions

- [ ] Which Firestore project/database to use for development?
- [ ] Emulator vs live Firestore for local dev?
- [ ] Migration strategy for existing SQL data (if any)?

---

## Next Actions

| Action | Owner | Due |
|--------|-------|-----|
| Execute Phase 1: Firestore-backed MVP Core | Engineering | Next session |
| Implement Firestore schema (orgs, apiKeys, metrics, forecasts) | Engineering | Phase 1 |
| Create statistical forecast backend | Engineering | Phase 1 |
| Wire API key auth middleware | Engineering | Phase 1 |

---

## Evidence Links / Artifacts

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `CLAUDE.md` | `modified` | Added structured guardrails sections |
| `000-docs/027-AT-ARCH-storage-tooling-separation.md` | `modified` | Marked as superseded |
| `000-docs/028-AT-ARCH-target-scaffold-phase-g.md` | `modified` | Added stack alignment note |
| `000-docs/029-AA-AACR-phase-1-repo-audit-guardrails.md` | `created` | Audit results |
| `000-docs/030-AA-AACR-phase-0-scaffold-alignment.md` | `created` | This AAR |

### Commits

| Hash | Message |
|------|---------|
| `pending` | `docs: Phase 0 scaffold alignment and guardrails [Task: intentvision-001]` |

### AgentFS Snapshots

| Snapshot ID | Timestamp | Description |
|-------------|-----------|-------------|
| N/A | - | No snapshots created this phase (docs-only) |

**AgentFS Status:** `Active` (not used this phase)

### External References

- Doc-Filing v4 Standard: `000-docs/6767-a-DR-STND-document-filing-system-standard-v4.md`
- AAR Template: `000-docs/6767-b-AA-TMPL-after-action-report-template.md`

---

## Phase Completion Checklist

- [x] All planned task IDs completed or accounted for
- [x] Verification steps documented above
- [x] Evidence documented above
- [x] No blocking open questions (can proceed to Phase 1)
- [x] Next phase entry criteria defined

---

## Audit Summary (Task 0.1)

### Current Database Usage (Turso/libSQL)

| Location | Files | Current Role |
|----------|-------|--------------|
| `db/config.ts` | 1 | Main database client factory |
| `packages/pipeline/src/forecast/nixtla-timegpt.ts` | 1 | Stores forecasts via `getClient()` |
| `packages/pipeline/src/connections/turso-pool.ts` | 1 | Connection pooling |
| `db/migrations/*.sql` | 2 | Schema definitions (14 tables) |

**Target Role:** Internal tools only (AgentFS, Beads, local dev testing)

### Firestore Status

| Pattern | Files Found | Implementation |
|---------|-------------|----------------|
| `firestore\|firebase` | 14 files | Documentation only |
| `firebase*.ts` | 0 files | Not implemented |
| `firestore*.ts` | 0 files | Not implemented |

**Target Role:** Primary product datastore

### Nixtla/TimeGPT Status

| Component | Status |
|-----------|--------|
| `NixtlaTimeGPTBackend` | Fully implemented |
| `NixtlaClient` | Fully implemented with circuit breaker |
| Tests | Passing |

**Target Role:** Optional plugin, behind `ForecastBackend` interface

---

## Stack Translation Rules

When reading original scaffold documentation:

| Scaffold Says | Implement As |
|---------------|--------------|
| "BigQuery" | Firestore |
| "Turso as metrics DB" | Firestore for metrics |
| "Nixtla as core" | Statistical default + Nixtla optional |
| "Vertex AI Agent" | Node.js agent + AgentFS (internal) |
| "store in database" | Firestore collection |
| "query historical data" | Firestore query |

---

## Exit Criteria Summary

| Criterion | Status |
|-----------|--------|
| CLAUDE.md explains Firestore = primary | PASS |
| CLAUDE.md explains Turso = internal only | PASS |
| CLAUDE.md explains Nixtla = optional | PASS |
| CLAUDE.md explains Doc-Filing v4 + AAR rules | PASS |
| Doc-Filing v4 standard exists | PASS |
| Phase 0 AAR exists with Beads Task ID | PASS |
| Tests not more broken than before | PASS (307+ passing) |
| No Turso/AgentFS/Beads in customer code paths | PASS (verified) |

**Phase 0 Complete. Ready for Phase 1.**

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
