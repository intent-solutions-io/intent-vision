# Claude Code Hooks & CLI Quick Reference

> **MENTAL POST-RESPONSE HOOK** - Review this after every substantial response in this repo.

---

## BEADS CLI QUICK REFERENCE

```bash
# VIEW TASKS
bd ready                              # What's ready to work on
bd list                               # All tasks
bd list -l phase-4                    # Filter by label
bd show intentvision-XXX              # Task details
bd stats                              # Overview

# CREATE TASKS
bd create "Phase X: Title" -t epic -p 1 -l "phase-X"          # Create epic
bd create "subtask" -t task -p 2 --parent intentvision-XXX    # Create subtask

# MANAGE TASKS
bd update intentvision-XXX --status in_progress               # Update status
bd close intentvision-XXX --reason "Completed"                # Close task
bd close intentvision-XXX.1 intentvision-XXX.2                # Close multiple

# DEPENDENCIES
bd dep add intentvision-YYY intentvision-XXX --type blocks    # Add blocker
bd dep tree intentvision-XXX                                  # View tree
```

---

## EVERY SESSION CHECKLIST

### Before Starting Work
- [ ] `bd ready` - See what's available
- [ ] Create/identify Beads Task ID for this work
- [ ] Note Task ID in reasoning

### While Working
- [ ] Internal tools (Beads, AgentFS, Turso) stay INTERNAL
- [ ] Customer data goes to Firestore
- [ ] Statistical backend works without Nixtla

### After Completing Work (POST-RESPONSE HOOK)
- [ ] AAR exists in `000-docs/` with Beads Task IDs
- [ ] Commit message format:
  ```
  feat: description

  [Task: intentvision-XXX]

  🤖 Generated with Claude Code
  ```
- [ ] Close completed tasks: `bd close intentvision-XXX`

---

## COMMIT MESSAGE TEMPLATE

```bash
git commit -m "$(cat <<'EOF'
feat: description of change

Details if needed.

[Task: intentvision-XXX]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## AAR TEMPLATE REMINDER

File: `000-docs/NNN-AA-AACR-phase-X-description.md`

Required sections:
1. Metadata (Phase, Repo, Date, Status)
2. **Beads / Task IDs Touched** (MANDATORY)
3. Executive Summary
4. What Changed
5. Evidence Links / Artifacts
6. Phase Completion Checklist

---

## STORAGE RULES

| Data Type | Storage | Location |
|-----------|---------|----------|
| Customer data | Firestore | `organizations/{orgId}/...` |
| Internal tools | Turso/SQLite | `.beads/`, `.agentfs/`, `db/` |
| Agent state | AgentFS | `.agentfs/intentvision.db` |
| Work tracking | Beads | `.beads/issues.jsonl` |

---

## PRIME DIRECTIVES (NON-NEGOTIABLE)

1. **Repo Context**: Work ONLY in `intentvision`
2. **Public/Private**: NEVER expose Beads/AgentFS/Turso to customers
3. **Beads Discipline**: ALWAYS attach work to Task IDs
4. **AgentFS State**: Use for agent traces/decisions
5. **Doc-Filing v4**: Flat `000-docs/`, AARs per phase
6. **Storage Separation**: Firestore = customer; Turso = internal

---

*This file is automatically checked by Claude Code at session start.*
*Reference: CLAUDE.md, scripts/beads/README.md, scripts/agentfs/README.md*
