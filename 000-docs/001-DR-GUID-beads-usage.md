# Beads Usage Specification for IntentVision

**Purpose:** Define how the Beads issue/work tracker is used in the IntentVision repository.
**Version:** 1.0.0
**Last Updated:** 2025-12-15

---

## Overview

IntentVision uses [Beads](https://github.com/steveyegge/beads) as its work graph and memory system for tracking all development work. Beads provides a git-backed, dependency-aware issue tracker optimized for AI agent workflows.

**Core Principle:** "No orphan work" — every task must be tracked in Beads with proper dependencies.

---

## Installation

```bash
# Recommended: npm global install
npm install -g @beads/bd

# Alternative: Homebrew (macOS)
brew tap steveyegge/beads && brew install bd

# Verify installation
bd --version
```

---

## Repository Setup

Initialize Beads in the repository root:

```bash
cd /home/jeremy/000-projects/intentvision
bd init --quiet  # Non-interactive for agent workflows
```

This creates:
- `.beads/issues.jsonl` — Source of truth (committed to git)
- `.beads/deletions.jsonl` — Deletion manifest (committed)
- `.beads/config.yaml` — Repository configuration (committed)
- `.beads/beads.db` — SQLite cache (gitignored)

---

## Naming Conventions

### Issue ID Format

Beads uses hash-based IDs that scale with database size:
- 0–500 issues: 4 characters (e.g., `bd-a1b2`)
- 500–1,500 issues: 5 characters (e.g., `bd-f14c3`)
- 1,500+ issues: 6 characters (e.g., `bd-3e7a5b`)

### Title Conventions

| Type | Title Format | Example |
|------|--------------|---------|
| Epic | `[Phase N] Short Description` | `[Phase 1] Canonical metrics spine` |
| Task | `verb + object` | `Implement metric registry schema` |
| Bug | `Fix: description` | `Fix: forecast API timeout handling` |

### Tag Standards

Reserved tags (enforced via CI):
- `phase-0`, `phase-1`, ... `phase-5` — Phase association
- `ci`, `infra`, `docs` — Category tags
- `blocked`, `needs-review` — Status tags

---

## Dependency Rules

### Required Dependencies

1. **Phase gates:** All Phase N+1 work blocks on Phase N completion
2. **Feature chains:** Implementation tasks block on design tasks
3. **Test coverage:** Feature tasks should block on test tasks

### Dependency Types

```bash
# Blocks (hard dependency)
bd dep add bd-xxxx bd-yyyy --type blocks

# Discovered-from (traceability)
bd dep add bd-xxxx bd-yyyy --type discovered-from

# Parent-child (hierarchical breakdown)
bd create "Subtask" --parent bd-xxxx

# Related (soft link)
bd dep add bd-xxxx bd-yyyy --type related
```

---

## Status Workflow

### Standard Statuses

| Status | Meaning |
|--------|---------|
| `open` | Created, not started |
| `in_progress` | Actively being worked on |
| `blocked` | Waiting on dependency |
| `review` | Complete, pending verification |
| `closed` | Done |

### Transitions

```bash
# Start work
bd update bd-xxxx --status in_progress

# Mark blocked
bd update bd-xxxx --status blocked --reason "Waiting on bd-yyyy"

# Complete work
bd close bd-xxxx --reason "Implemented in commit abc123"
```

---

## Agent Integration Protocol

### Session Start

```bash
# Get ready tasks (no blockers)
bd ready --json

# Onboard (for new agents)
bd onboard
```

### During Work

```bash
# Create discovered issues
bd create "Found: missing validation" -t bug -p 2 --tag phase-1

# Link to parent issue
bd dep add bd-new bd-parent --type discovered-from

# Update progress
bd update bd-xxxx --status in_progress
```

### Session End

```bash
# Close completed work
bd close bd-xxxx --reason "Implementation complete"

# Sync to git
bd sync
```

---

## Phase Graph Structure

IntentVision uses phases as epic-level containers:

```
Phase 0 (bd-p0xx)
├── Task: Import 6767 standards
├── Task: ARV CI gate
├── Task: Cloud implementation plan
└── Task: Beads bootstrap

Phase 1 (bd-p1xx) [blocks on Phase 0]
├── Task: Metrics spine design
├── Task: Metric registry schema
└── Task: Validation rules

... (continues through Phase 5)
```

---

## CI Integration

The ARV gate validates Beads hygiene:

1. **No orphan issues:** Every non-epic issue must have a parent or phase tag
2. **Closed issues have reasons:** All closed issues must have completion reasons
3. **Dependencies are valid:** No circular dependencies
4. **Phase tags match:** Issue phase tags align with blocking epic

---

## Sync Strategy

### Automatic Sync

- After CRUD operations: 5-second debounce exports to JSONL
- After `git pull`: Auto-import from newer JSONL
- Git hooks: Pre-commit/post-merge for zero-lag sync

### Manual Sync

```bash
# Force sync
bd sync

# Validate database health
bd doctor
```

---

## Conflict Resolution

Beads uses JSONL format with custom merge driver. In case of conflicts:

1. Run `bd sync` to attempt auto-resolution
2. If conflicts persist, manually review `.beads/issues.jsonl`
3. Use `bd doctor` to validate resolved state

---

## Backup Policy

- `.beads/issues.jsonl` is committed to git (automatic backup via version control)
- SQLite cache is regenerated from JSONL on clone
- Weekly snapshots recommended for large projects (>1000 issues)

---

## References

- [Beads Repository](https://github.com/steveyegge/beads)
- [Beads CLI Documentation](https://github.com/steveyegge/beads#cli-commands)
- IntentVision `docs/vendor-policy.md` for version pinning
