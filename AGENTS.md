# AGENTS.md - IntentVision Agent Protocol

> Session management, Beads integration, and AgentFS coordination for AI agents

---

## 🎯 Agent Session Protocol

### Starting a Session

```bash
# 1. Orient on current state
bd ready                          # Show work with no blockers
bd list --json | jq '.[] | select(.status == "open")'

# 2. Check AgentFS state
cat .agentfs/snapshots/*.json | jq -s 'sort_by(.updated_at) | last'

# 3. Run quality gates
npm test                          # 147 tests must pass
npm run build                     # TypeScript must compile
```

### During a Session

```bash
# After any issue changes, sync immediately
bd create "New task" -t task -p 2
bd sync                           # Force immediate sync

# Update AgentFS snapshot for significant milestones
# Store in .agentfs/snapshots/YYYY-MM-DD-description.json
```

### Landing the Plane (MANDATORY)

When ending a session, execute ALL steps:

#### Step 1: File Remaining Work
```bash
bd create "Follow-up task" -t task -p 2 --json
bd create "Bug discovered" -t bug -p 1 --json
```

#### Step 2: Quality Gates
```bash
npm test                          # All 147+ tests pass
npm run build                     # TypeScript compiles
```

#### Step 3: Update Issues
```bash
bd close bd-XXX --reason "Completed in commit abc123"
bd update bd-YYY --status in_progress
bd sync
```

#### Step 4: Git Push (NON-NEGOTIABLE)
```bash
git add .
git commit -m "feat: description [task-id]"
git pull --rebase
bd sync
git push                          # MANDATORY - plane hasn't landed until this succeeds
git status                        # Must show "up to date with origin"
```

#### Step 5: Verify Clean State
```bash
git status                        # No untracked files
bd list --json | jq 'length'      # Know issue count
```

#### Step 6: Provide Next Session Prompt
```
"Continue work on bd-XXX: [title]. Completed: [what]. Next: [what to do]."
```

---

## 📦 Beads Integration

### Issue Types
- `epic` - Multi-task phases
- `task` - Single deliverable
- `bug` - Defects
- `feature` - New capabilities

### Priority Levels
- `1` - P0: Critical/blocking
- `2` - P1: High priority
- `3` - P2: Normal
- `4` - P3: Low/nice-to-have

### Labels
- `phase-X` - Phase number
- `test` - Testing related
- `docs` - Documentation
- `infra` - Infrastructure
- `security` - Security related

### Parent-Child Pattern
```bash
# Create epic
bd create "Phase C: User Auth" -t epic --label phase-c

# Create subtasks
bd create "C.1 User registration endpoint" -t task --parent intentvision-XXX
bd create "C.2 Login endpoint" -t task --parent intentvision-XXX
bd create "C.3 Session management" -t task --parent intentvision-XXX
```

---

## 🗂️ AgentFS Integration

### Snapshot Location
```
.agentfs/
└── snapshots/
    ├── 2025-12-15-phase-ab.json     # Phase completion snapshots
    └── 2025-12-15-session-end.json  # Session state snapshots
```

### Snapshot Schema
```json
{
  "snapshot_id": "YYYY-MM-DD-description",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "project": "intentvision",
  "phase": "current-phase",
  "status": {
    "phase_a": "completed",
    "phase_b": "completed"
  },
  "beads_tasks": {
    "current": "task-id",
    "completed": ["task-1", "task-2"]
  },
  "tests": {
    "total": 147,
    "passing": true
  },
  "commits": {
    "latest": "abc123"
  }
}
```

### Creating Snapshots
```typescript
// After significant milestones
const snapshot = {
  snapshot_id: `${new Date().toISOString().split('T')[0]}-${description}`,
  created_at: new Date().toISOString(),
  // ... full state
};
fs.writeFileSync(`.agentfs/snapshots/${snapshot.snapshot_id}.json`, JSON.stringify(snapshot, null, 2));
```

---

## 🚀 Deployment Protocol

### Pre-Deploy Checklist
- [ ] All tests passing (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No open P0/P1 issues (`bd list -p 1`)
- [ ] AgentFS snapshot created
- [ ] Environment variables documented

### Cloud Run Deployment
```bash
# Build container
docker build -t gcr.io/PROJECT/intentvision .

# Push to registry
docker push gcr.io/PROJECT/intentvision

# Deploy
gcloud run deploy intentvision \
  --image gcr.io/PROJECT/intentvision \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Turso Database
```bash
# Create database
turso db create intentvision-prod

# Get connection URL
turso db show intentvision-prod --url

# Run migrations
INTENTVISION_DB_URL=libsql://... npm run db:migrate
```

---

## 📋 Quality Gates

### Required for Merge
1. `npm test` - All tests pass
2. `npm run build` - No TypeScript errors
3. `bd list -p 1` - No P0 issues open
4. Code review (if applicable)

### Required for Deploy
1. All merge requirements
2. Integration tests pass
3. Security scan clean
4. Documentation updated

---

## 🔗 Resources

- **Beads:** https://github.com/steveyegge/beads
- **AgentFS:** https://github.com/tursodatabase/agentfs
- **Turso:** https://turso.tech
- **Cloud Run:** https://cloud.google.com/run

---

*Last updated: 2025-12-15*

<!-- BEGIN BEADS INTEGRATION -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- Use `bd dolt push`/`bd dolt pull` for remote sync
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->
