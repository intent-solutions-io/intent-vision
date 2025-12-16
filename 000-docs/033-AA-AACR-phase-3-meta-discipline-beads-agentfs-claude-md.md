# Phase 3 AAR - Beads + AgentFS Discipline Layer + CLAUDE.md Upgrade

> Installing "rails" for repeatable, enforceable development discipline

---

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | `3 - Beads + AgentFS Discipline Layer` |
| **Repo/App** | `intentvision` |
| **Owner** | Engineering |
| **Date/Time (CST)** | 2025-12-15 23:45 CST |
| **Status** | `FINAL` |
| **Related Issues/PRs** | Epic: `intentvision-q37` |
| **Commit(s)** | Pending |

---

## Beads / Task IDs Touched

| Task ID | Status | Title |
|---------|--------|-------|
| `intentvision-q37` | `completed` | Phase 3: Beads + AgentFS Discipline Layer Epic |
| `intentvision-q37.1` | `completed` | 3.1 Upgrade CLAUDE.md with Prime Directives |
| `intentvision-q37.2` | `completed` | 3.2 Create Beads helper scripts and documentation |
| `intentvision-q37.3` | `completed` | 3.3 Create AgentFS helper documentation |
| `intentvision-q37.4` | `completed` | 3.4 Create/update 6767 standards docs |
| `intentvision-q37.5` | `completed` | 3.5 Add AAR validation check script |
| `intentvision-q37.6` | `completed` | 3.6 Create Phase 3 AAR document |

**Beads Status:** `Active`

---

## Executive Summary

- Installed comprehensive development discipline layer for IntentVision
- Upgraded CLAUDE.md with Prime Directives and Every Session Checklist
- Created detailed Beads helper documentation based on actual tool capabilities
- Created AgentFS helper documentation with SDK usage patterns
- Referenced existing 6767 standards (6767-f, 6767-g) for Beads/AgentFS integration
- Added AAR validation script to enforce Beads references

---

## What Changed

### New Files Created

| File | Purpose |
|------|---------|
| `scripts/beads/README.md` | Comprehensive Beads usage guide for IntentVision |
| `scripts/agentfs/README.md` | AgentFS state management guide |
| `scripts/ci/check-aar-beads.sh` | CI script to validate AAR Beads references |

### Files Modified

| File | Changes |
|------|---------|
| `CLAUDE.md` | Major upgrade: Prime Directives, Session Checklist, Usage Rules |

---

## CLAUDE.md Upgrade Details

### New Sections Added

1. **PRIME DIRECTIVES FOR THIS REPO**
   - 6 non-negotiable rules for all IntentVision work
   - Repo context, public/private separation, Beads discipline
   - AgentFS state, Doc-Filing v4, storage separation

2. **EVERY SESSION CHECKLIST**
   - Before Starting Work (identify Beads tasks)
   - While Doing Work (scope, internal tool isolation)
   - After Completing Work (post-response hook)
   - Commit message format, AAR requirements

3. **BEADS + AGENTFS USAGE RULES**
   - Task ID format (`intentvision-XXX`, `intentvision-XXX.N`)
   - Common commands reference
   - AgentFS expected usage patterns
   - Separation guarantee

4. **DOC-FILING V4 REQUIREMENTS**
   - Flat filing structure
   - Naming convention (NNN-CC-ABCD)
   - AAR required sections
   - 6767 standards reference

5. **Quick Reference: Phase Workflow**
   - 5-step workflow for any phase
   - Visual guide for the process

---

## Helper Documentation Details

### Beads Helper (`scripts/beads/README.md`)

Based on actual Beads tool from https://github.com/steveyegge/beads:

- Hash-based IDs (`intentvision-q37`, `intentvision-q37.1`)
- Full CLI command reference
- Phase workflow patterns
- Commit message and AAR integration
- Priority levels and issue types
- Label conventions for IntentVision
- Storage structure (`.beads/issues.jsonl`)
- Git integration details

### AgentFS Helper (`scripts/agentfs/README.md`)

Based on actual AgentFS tool from https://github.com/tursodatabase/agentfs:

- SDK initialization and usage
- Key-value operations
- File operations
- Tool call tracking
- Session snapshots
- Integration patterns for IntentVision
- Separation guarantee from public API

---

## 6767 Standards Referenced

Existing standards already cover Beads/AgentFS comprehensively:

| Standard | Purpose | Status |
|----------|---------|--------|
| `6767-f` | Work Tracking (Beads + Task IDs) | No changes needed |
| `6767-g` | Beads + AgentFS Complementary Systems | No changes needed |

These standards define:
- Task ID as canonical work unit
- Task IDs in AARs, commits, PRs
- Beads + AgentFS as complementary systems
- Integration patterns between all four pillars
- Compliance checklist

---

## How This Affects Future Work

### Future Claude Code Sessions

1. **Read CLAUDE.md first** - Prime Directives and checklist are at the top
2. **Create Beads tasks** - `bd create "description" -t task`
3. **Follow Session Checklist** - Before/during/after hooks
4. **Produce AARs** - Must have "Beads / Task IDs Touched" section
5. **Reference in commits** - `[Task: intentvision-XXX]`

### Future Phase Prompts Should Include

```
You are Claude Code, operating ONLY inside the repo: `intentvision`.

PHASE X: [Title]

Before starting:
- Create Beads epic: bd create "Phase X: Title" -t epic -p 1 -l phase-X
- Create subtasks as needed

After completing:
- Create AAR: 000-docs/NNN-AA-AACR-phase-X-description.md
- List all Beads Task IDs in AAR
- Close tasks: bd close intentvision-XXX
```

---

## AAR Validation Check

Added `scripts/ci/check-aar-beads.sh` that:
- Scans all AAR files in `000-docs/`
- Checks for "Beads" or "Task ID" references
- Can be integrated into CI pipeline
- Warns if AAR lacks Beads references

---

## How to Verify

```bash
# Step 1: Verify CLAUDE.md has new sections
grep -q "PRIME DIRECTIVES" CLAUDE.md && echo "PASS: Prime Directives"
grep -q "EVERY SESSION CHECKLIST" CLAUDE.md && echo "PASS: Session Checklist"
grep -q "BEADS + AGENTFS USAGE RULES" CLAUDE.md && echo "PASS: Usage Rules"

# Step 2: Verify helper docs exist
ls scripts/beads/README.md && echo "PASS: Beads helper"
ls scripts/agentfs/README.md && echo "PASS: AgentFS helper"

# Step 3: Verify validation script exists
ls scripts/ci/check-aar-beads.sh && echo "PASS: Validation script"

# Step 4: Run validation script
./scripts/ci/check-aar-beads.sh
```

---

## Risks / Gotchas

- **Discipline requires human/agent compliance** - Rules only work if followed
- **Beads CLI must be installed** - `bd` command must be available
- **AgentFS SDK optional** - Not required for API server startup
- **Validation is advisory** - CI check warns but doesn't block (configurable)

---

## Rollback Plan

1. Revert CLAUDE.md to previous version
2. Remove `scripts/beads/README.md`
3. Remove `scripts/agentfs/README.md`
4. Remove `scripts/ci/check-aar-beads.sh`
5. Keep 6767 standards (they're cross-repo, unchanged)

---

## Open Questions

- [ ] Should CI block on missing Beads references, or just warn?
- [ ] Add pre-commit hook for Beads task ID in commits?
- [ ] AgentFS initialization script should run when?
- [ ] Should we add a `bd ready` check to session start?

---

## TODOs for Future Phases

- [ ] Add CI check that commits include `[Task: intentvision-XXX]`
- [ ] Add pre-push hook that validates AAR Beads references
- [ ] Consider AgentFS initialization as part of Phase 1+ project setup
- [ ] Add automated Beads task creation from phase prompts

---

## Next Actions

| Action | Owner | Due |
|--------|-------|-----|
| Phase 4: Minimal operator dashboard + API key onboarding | Engineering | Next phase |
| Add pre-commit hook for task ID validation | Engineering | Future |
| Implement AgentFS in operator agent flows | Engineering | Future |

---

## Evidence Links / Artifacts

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `CLAUDE.md` | `modified` | Prime Directives, Session Checklist, Usage Rules |
| `scripts/beads/README.md` | `created` | Beads helper documentation |
| `scripts/agentfs/README.md` | `created` | AgentFS helper documentation |
| `scripts/ci/check-aar-beads.sh` | `created` | AAR validation script |

### 6767 Standards Referenced

| Document | Purpose |
|----------|---------|
| `6767-f-DR-STND-work-tracking-beads-taskids.md` | Work tracking standard |
| `6767-g-DR-STND-beads-agentfs-complementary-systems.md` | Complementary systems |

### Commits

| Hash | Message |
|------|---------|
| `pending` | `feat: Phase 3 Beads + AgentFS discipline layer [Epic: intentvision-q37]` |

### AgentFS Snapshots

| Snapshot ID | Timestamp | Description |
|-------------|-----------|-------------|
| N/A | - | No snapshots this phase |

**AgentFS Status:** `Active` (not used this phase)

---

## Phase Completion Checklist

- [x] CLAUDE.md has Prime Directives section
- [x] CLAUDE.md has Every Session Checklist (post-response hook)
- [x] CLAUDE.md has Beads + AgentFS Usage Rules
- [x] CLAUDE.md has Doc-Filing v4 Requirements summary
- [x] Beads helper doc exists (`scripts/beads/README.md`)
- [x] AgentFS helper doc exists (`scripts/agentfs/README.md`)
- [x] 6767 standards referenced (6767-f, 6767-g)
- [x] AAR validation script exists (`scripts/ci/check-aar-beads.sh`)
- [x] Phase 3 AAR created with Beads Task IDs
- [x] No internal tools exposed in public API

---

## Exit Criteria Summary

| Criterion | Status |
|-----------|--------|
| CLAUDE.md Prime Directives | PASS |
| CLAUDE.md Session Checklist with post-response hook | PASS |
| CLAUDE.md Beads + AgentFS Usage Rules | PASS |
| CLAUDE.md Doc-Filing v4 Requirements | PASS |
| Beads helper documentation | PASS |
| AgentFS helper documentation | PASS |
| 6767 standards referenced or updated | PASS |
| AAR validation check script | PASS |
| Phase 3 AAR with Beads Task IDs | PASS |
| No internal tools in public API | PASS |

**Phase 3 Complete. Ready for Phase 4 (Minimal Operator Dashboard + API Key Onboarding).**

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
