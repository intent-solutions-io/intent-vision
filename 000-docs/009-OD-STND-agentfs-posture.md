# AgentFS Posture Document

> **Standard:** IntentVision agent audit and artifact management policy

---

## Overview

IntentVision uses AgentFS (from Turso) as the canonical audit/snapshot system for all agent operations. Every agent run, tool call, and state change is captured in a SQLite database for full auditability and reproducibility.

---

## What We Log

| Category | Logged | Rationale |
|----------|--------|-----------|
| Tool calls (all) | Yes | Complete audit trail of agent actions |
| File operations | Yes | Track all file reads/writes/deletes |
| State changes | Yes | Key-value store mutations |
| LLM prompts/responses | Yes | Full conversation history for replay |
| Execution timestamps | Yes | Timeline reconstruction |
| Error states | Yes | Debugging and incident response |
| Task ID references | Yes | Link to Beads work graph |

---

## What We Do NOT Log

| Category | Logged | Rationale |
|----------|--------|-----------|
| Secrets/credentials | No | Security - never persist sensitive data |
| API keys | No | Security |
| User PII (unless required) | No | Privacy compliance |
| Raw binary files | No | Size - store references only |
| Transient cache data | No | Not valuable for audit |

---

## Artifact Storage

### Location

```
.agentfs/                    # AgentFS database directory
  intentvision.db            # Main agent filesystem database
  snapshots/                 # Point-in-time snapshots
    <timestamp>-<task-id>.db # Snapshot per significant operation
```

### Snapshot Policy

1. **Automatic snapshots:** After each phase completion
2. **Manual snapshots:** Before risky operations
3. **Retention:** Keep last 30 days of snapshots
4. **Naming:** `YYYYMMDD-HHMMSS-<task-id>.db`

---

## Integration with AARs

Every AAR includes:

1. **AgentFS Status:** Active/Not initialized
2. **Snapshot IDs:** List of relevant snapshots from the phase
3. **Query examples:** How to inspect the agent activity

Example AAR section:
```markdown
### AgentFS Snapshots

| Snapshot ID | Timestamp | Description |
|-------------|-----------|-------------|
| 20251215-140000-bd-h1g | 2025-12-15T14:00:00Z | Phase 3 completion |

**AgentFS Status:** Active
```

---

## CLI Commands

```bash
# Initialize AgentFS for this project
node -e "const {AgentFS} = require('agentfs-sdk'); AgentFS.init('.agentfs/intentvision.db')"

# Query tool calls
sqlite3 .agentfs/intentvision.db "SELECT * FROM tool_calls ORDER BY timestamp DESC LIMIT 10"

# Create snapshot
cp .agentfs/intentvision.db .agentfs/snapshots/$(date +%Y%m%d-%H%M%S)-snapshot.db

# List recent activity
sqlite3 .agentfs/intentvision.db "SELECT timestamp, tool_name, status FROM tool_calls"
```

---

## Security Considerations

1. **Database encryption:** Consider SQLite encryption for production
2. **Access control:** Restrict .agentfs/ to authorized users
3. **Backup:** Include in disaster recovery plan
4. **Rotation:** Rotate/archive old snapshots

---

## Compliance

- AgentFS audit trail supports SOC2 audit requirements
- Full provenance chain from task → action → artifact
- Queryable history for incident investigation

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
