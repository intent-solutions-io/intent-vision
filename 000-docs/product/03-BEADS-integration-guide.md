# 🔗 Beads Integration Guide

**IntentVision - Work Tracking with Beads**

**Metadata**
- Last Updated: 2025-12-15
- Beads Version: 0.20.1+
- Repository: https://github.com/steveyegge/beads

---

## 🎯 1. What is Beads?

Beads is a **git-backed issue tracker** designed for AI coding agents. It provides:
- **Persistent memory** across conversation sessions
- **Dependency tracking** between tasks
- **Hash-based IDs** for collision-resistant concurrent work
- **Distributed sync** via git (no server needed)

### 1.1 Why Beads for IntentVision?
- Tracks all phases and tasks in queryable database
- Parent-child relationships for epic → subtask decomposition
- Audit trail of all work in git history
- Agents can orient themselves with `bd ready` on startup

---

## 📁 2. File Structure

```
.beads/
├── issues.jsonl          # Source of truth (git tracked)
├── deletions.jsonl       # Deletion manifest
├── beads.db              # SQLite cache (gitignored)
├── beads.db-shm          # SQLite shared memory
├── beads.db-wal          # SQLite write-ahead log
├── config.yaml           # Repository configuration
├── metadata.json         # Database metadata
├── daemon.log            # Background daemon logs
├── daemon.pid            # Daemon process ID
├── daemon.lock           # Daemon lock file
├── bd.sock               # Daemon socket
└── README.md             # Beads documentation
```

---

## 🔧 3. Common Commands

### 3.1 Initialization
```bash
# Initialize Beads in a repo
bd init

# Quiet mode (for agents)
bd init --quiet
```

### 3.2 Creating Issues
```bash
# Create a simple task
bd create "Implement forecast backend" -t task -p 2

# Create with labels
bd create "Phase B: Nixtla Integration" -t epic --label phase-b

# Create as child of epic
bd create "Implement NixtlaTimeGPTBackend" -t task --parent intentvision-jet
```

### 3.3 Listing & Querying
```bash
# List all open issues
bd list

# List ready work (no open blockers)
bd ready

# JSON output for agents
bd list --json

# Filter by label
bd list --label phase-b
```

### 3.4 Updating Issues
```bash
# Close an issue
bd close intentvision-jet.1 --reason "Implemented nixtla-timegpt.ts"

# Update status
bd update intentvision-jet.2 --status in_progress

# Add notes
bd update intentvision-jet.2 --notes "Created forecast-service.ts"
```

### 3.5 Dependencies
```bash
# Add parent-child relationship
bd dep add intentvision-jet.1 intentvision-jet --type parent-child

# Add blocking dependency
bd dep add task-b task-a --type blocks
```

---

## 📊 4. Issue ID Format

### 4.1 Hash-Based IDs
Beads uses collision-resistant hash IDs:
```
intentvision-jet     # Epic (4-6 chars)
intentvision-jet.1   # Subtask 1
intentvision-jet.2   # Subtask 2
intentvision-5ba     # Another task
```

### 4.2 ID Scaling
| Issue Count | ID Length | Example |
|-------------|-----------|---------|
| 0-500 | 3 chars | `bd-a1b` |
| 500-1,500 | 4 chars | `bd-a1b2` |
| 1,500+ | 5 chars | `bd-a1b2c` |

---

## 📋 5. IntentVision Task Registry

### 5.1 Completed Tasks
| Task ID | Phase | Title | Status |
|---------|-------|-------|--------|
| `intentvision-05p` | Preflight | Verify Beads operational | ✅ |
| `intentvision-5je` | Preflight | Verify operating systems | ✅ |
| `intentvision-4bc` | 2 | Create local ARV check | ✅ |
| `intentvision-7za` | 3 | Define forecast backend contract | ✅ |
| `intentvision-94f` | 3 | Define anomaly detection contract | ✅ |
| `intentvision-8jq` | 3 | Create fixture dataset | ✅ |
| `intentvision-0k9` | 4 | Implement forecast stub | ✅ |
| `intentvision-1c6` | 4 | Implement store to SQL | ✅ |
| `intentvision-8vu` | 4 | Add observability baseline | ✅ |
| `intentvision-6g7` | 6 | Agent Workflow Baseline | ✅ |
| `intentvision-6g7.1` | 6 | Agent router skeleton | ✅ |
| `intentvision-6g7.2` | 6 | ReAct loop | ✅ |
| `intentvision-6g7.3` | 6 | Decision logging | ✅ |
| `intentvision-79x` | 7 | Real Ingestion Path | ✅ |
| `intentvision-79x.1` | 7 | Webhook ingestion | ✅ |
| `intentvision-79x.2` | 7 | Idempotency | ✅ |
| `intentvision-79x.3` | 7 | Schema validation | ✅ |
| `intentvision-79x.4` | 7 | Dead letter queue | ✅ |
| `intentvision-79x.5` | 7 | Integration tests | ✅ |
| `intentvision-5ba` | A | Stack Alignment | ✅ |
| `intentvision-jet` | B | Nixtla TimeGPT | ✅ |
| `intentvision-jet.1` | B | Nixtla backend implementation | ✅ |
| `intentvision-jet.2` | B | Forecast service orchestrator | ✅ |
| `intentvision-jet.3` | B | Nixtla tests | ✅ |
| `intentvision-jet.4` | B | Phase B AAR | ✅ |

### 5.2 JSONL Format
Each issue in `issues.jsonl`:
```json
{
  "id": "intentvision-jet",
  "title": "Phase B: Nixtla TimeGPT Forecasting",
  "description": "",
  "status": "closed",
  "priority": 2,
  "issue_type": "epic",
  "created_at": "2025-12-15T16:50:00-06:00",
  "updated_at": "2025-12-15T17:45:00-06:00",
  "closed_at": "2025-12-15T17:45:00-06:00",
  "labels": ["phase-b"],
  "notes": "Phase B complete - all subtasks done"
}
```

---

## 🔄 6. Workflow Integration

### 6.1 Agent Startup
```bash
# Orient on startup
bd ready

# Get full context
bd list --json | jq '.[] | select(.status == "open")'
```

### 6.2 During Work
```bash
# Mark task in progress
bd update intentvision-xxx --status in_progress

# Add progress notes
bd update intentvision-xxx --notes "Implementing feature X"
```

### 6.3 Task Completion
```bash
# Close with reason
bd close intentvision-xxx --reason "Implemented in commit abc123"
```

### 6.4 Commit Message Format
```
feat(pipeline): implement feature [intentvision-xxx]

Description of changes...

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## 📖 7. Best Practices

### 7.1 Task Naming
- **Epics:** Descriptive phase names
  - `Phase B: Nixtla TimeGPT Forecasting`
- **Subtasks:** Action-oriented
  - `Implement NixtlaTimeGPTBackend class`
  - `Add 42 Nixtla tests with mocks`

### 7.2 Labels
Common labels used:
- `phase-X` - Phase number
- `epic` - Parent task
- `test` - Testing tasks
- `docs` - Documentation
- `preflight` - Setup/verification

### 7.3 Dependencies
Use parent-child for:
- Epic → Subtask relationships
- Phase → Task breakdowns

Use blocks for:
- Sequential dependencies
- API contracts before implementation

### 7.4 Sync
```bash
# Manual sync (usually automatic)
bd sync

# Check database health
bd doctor
```

---

## 🔗 8. Integration with AgentFS

Beads complements AgentFS:

| System | Purpose | Storage |
|--------|---------|---------|
| **Beads** | Work tracking | `.beads/issues.jsonl` |
| **AgentFS** | State snapshots | `.agentfs/snapshots/*.json` |

Together they provide:
- Task tracking (Beads)
- Execution context (AgentFS)
- Full audit trail (Git)

---

## 📚 9. References

- **Beads GitHub:** https://github.com/steveyegge/beads
- **Beads Docs:** https://github.com/steveyegge/beads/blob/main/README.md
- **IntentVision Standards:** `000-docs/6767-f-DR-STND-work-tracking-beads-taskids.md`
- **AgentFS Standard:** `000-docs/6767-g-DR-STND-beads-agentfs-complementary-systems.md`

---

**✅ Beads Status:** Fully integrated and operational
