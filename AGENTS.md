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
