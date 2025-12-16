# Beads Work Tracking for IntentVision

> Internal work tracking using Beads - "Give your coding agent a memory upgrade"

## Overview

Beads is a lightweight, git-backed issue tracking system designed for AI coding agents. It uses JSONL files synced through git, allowing multiple agents to share unified issue tracking without a central server.

**Key Features:**
- Distributed database using `.beads/issues.jsonl` (git-tracked)
- Local SQLite cache for fast queries
- Hash-based IDs prevent merge conflicts
- Dependency tracking between issues
- Built for AI agent workflows

**This is INTERNAL ONLY - never expose to customers.**

## Task ID Format

IntentVision uses project-prefixed hash IDs:

| Pattern | Example | Use Case |
|---------|---------|----------|
| `intentvision-XXXX` | `intentvision-q37` | Standard task/epic |
| `intentvision-XXXX.N` | `intentvision-q37.1` | Child of epic (auto-numbered) |
| `intentvision-XXXX.N.N` | `intentvision-q37.3.1` | Nested child (up to 3 levels) |

Hash portion is auto-generated (collision-resistant hexadecimal).

## Quick Reference

### View Issues
```bash
bd ready                          # Issues ready to work on (no blockers)
bd list                           # All issues
bd list --status open             # Filter by status
bd list --priority 1              # High priority only
bd list -l phase-3                # Filter by label
bd show intentvision-XXX          # Full issue details
bd stats                          # Overview statistics
bd blocked                        # Issues waiting on blockers
```

### Create Issues
```bash
# Create epic for a phase
bd create "Phase 3: Discipline Layer" -t epic -p 1 -l "phase-3,meta"

# Create subtask under epic
bd create "3.1 Upgrade CLAUDE.md" -t task -p 2 --parent intentvision-q37

# Create with description
bd create "Fix auth bug" -t bug -p 1 -d "Users getting 401 on valid tokens"

# Create from markdown file (bulk)
bd create -f tasks.md
```

### Manage Issues
```bash
bd update intentvision-XXX --status in_progress
bd update intentvision-XXX --priority 2
bd update intentvision-XXX --assignee claude

bd close intentvision-XXX --reason "Completed"
bd close intentvision-q37.1 intentvision-q37.2  # Multiple at once
```

### Dependencies
```bash
bd dep add intentvision-f14c intentvision-a1b2              # f14c depends on a1b2
bd dep add intentvision-3e7a intentvision-a1b2 --type blocks  # Hard blocker
bd dep remove intentvision-f14c intentvision-a1b2
bd dep tree intentvision-f14c                                # Visualize tree
bd dep cycles                                                 # Detect circular deps
```

### Labels
```bash
bd label add intentvision-XXX phase-3
bd label add intentvision-XXX api
bd label remove intentvision-XXX urgent
bd label list-all                    # All labels with counts
```

### Sync & Maintenance
```bash
bd sync                   # Manual force-sync with git
bd info                   # Database info
bd doctor                 # Health check
```

## Priority Levels

| Level | Name | When to Use |
|-------|------|-------------|
| P0 | Critical | Production down, security issue |
| P1 | High | Blocks other work, urgent fix |
| P2 | Medium | Standard work (default) |
| P3 | Low | Nice to have, backlog |
| P4 | Backlog | Future consideration |

## Issue Types

| Type | When to Use |
|------|-------------|
| `epic` | Phase-level work container |
| `task` | Specific piece of work |
| `bug` | Something broken |
| `feature` | New functionality |
| `chore` | Maintenance, cleanup |

## Phase Workflow

### 1. Start New Phase

```bash
# Create epic
bd create "Phase 3: Beads + AgentFS Discipline Layer" -t epic -p 1 -l "phase-3,meta"
# → Created: intentvision-q37

# Create subtasks
bd create "3.1 Upgrade CLAUDE.md" -t task -p 2 --parent intentvision-q37
bd create "3.2 Create Beads helpers" -t task -p 2 --parent intentvision-q37
bd create "3.3 Create AgentFS helpers" -t task -p 2 --parent intentvision-q37
```

### 2. Work on Tasks

```bash
# See what's ready
bd ready

# Update status as you work
bd update intentvision-q37.1 --status in_progress

# Close when done
bd close intentvision-q37.1 --reason "CLAUDE.md updated with prime directives"
```

### 3. Complete Phase

```bash
# Close remaining subtasks
bd close intentvision-q37.2 intentvision-q37.3

# Close the epic
bd close intentvision-q37 --reason "Phase 3 complete"
```

## Commit Messages

Always reference task IDs:

```
feat: add alert evaluation endpoint

Implements POST /v1/alerts/evaluate for checking forecasts
against configured alert rules.

[Task: intentvision-8aj.4]

🤖 Generated with Claude Code
```

## AAR Integration

Every AAR must have "Beads / Task IDs Touched" section:

```markdown
## Beads / Task IDs Touched

| Task ID | Status | Title |
|---------|--------|-------|
| `intentvision-q37` | `completed` | Phase 3: Discipline Layer Epic |
| `intentvision-q37.1` | `completed` | 3.1 Upgrade CLAUDE.md |
| `intentvision-q37.2` | `completed` | 3.2 Create Beads helpers |
```

## Labels for IntentVision

| Label | Purpose |
|-------|---------|
| `phase-X` | Phase number (phase-1, phase-2, etc.) |
| `meta` | Process/tooling/discipline work |
| `api` | API endpoint changes |
| `schema` | Database/Firestore schema |
| `alerts` | Alert system work |
| `forecast` | Forecasting work |
| `docs` | Documentation |
| `ci` | CI/CD changes |

## Storage & Git Integration

```
.beads/
├── issues.jsonl      # Issue database (committed to git)
├── deletions.jsonl   # Deletion manifest
├── config.yaml       # Configuration
└── cache.db          # SQLite cache (git-ignored)
```

**Auto-sync behavior:**
- Export to JSONL after changes (5-second debounce)
- Import from JSONL after `git pull`
- Merge driver handles concurrent edits

## Rules for IntentVision

1. **Every phase gets an epic** - `bd create "Phase X: Title" -t epic`
2. **Break epics into tasks** - Use `--parent` flag
3. **Track all substantial work** - Create issue before starting
4. **Reference in commits** - `[Task: intentvision-XXX]`
5. **Document in AARs** - List all task IDs touched
6. **Close when done** - `bd close` with reason
7. **Never expose to customers** - Internal tool only

## Troubleshooting

### "bd: command not found"
```bash
# Check installation
which bd

# Install if needed
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
```

### Task not in `bd ready`
```bash
bd show intentvision-XXX  # Check status and blockers
bd blocked                 # See what's blocked
```

### Sync conflicts
```bash
bd sync          # Force sync
bd doctor        # Health check
```

---

*Reference: https://github.com/steveyegge/beads*
*This is for internal use only. Do not share with customers.*
