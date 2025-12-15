# AgentFS Usage Specification for IntentVision

**Purpose:** Define how AgentFS is used for agent action auditing and reproducibility in IntentVision.
**Version:** 1.0.0
**Last Updated:** 2025-12-15

---

## Overview

IntentVision uses [AgentFS](https://github.com/tursodatabase/agentfs) as its audit ledger and reproducibility substrate. AgentFS records all agent actions, tool calls, and state changes, enabling snapshot/replay for compliance and debugging.

**Core Principle:** Every agent action is recorded; every session is reproducible.

---

## Installation

```bash
# Install CLI
npm install -g agentfs-cli

# Install SDK for TypeScript agents
npm install agentfs-sdk

# Verify installation
agentfs --version
```

---

## Repository Setup

### Initialize Agent Filesystems

Each agent type gets its own AgentFS instance:

```bash
# Create agent filesystems
agentfs init intentvision-ci        # CI/CD agent actions
agentfs init intentvision-forecast  # Forecast engine operations
agentfs init intentvision-ingest    # Data ingestion tracking
```

This creates `.agentfs/<agent-id>.db` SQLite databases.

### Directory Structure

```
.agentfs/
├── intentvision-ci.db       # CI agent audit trail
├── intentvision-forecast.db # Forecast operations
├── intentvision-ingest.db   # Ingest pipeline records
└── snapshots/               # Point-in-time snapshots
    ├── 2025-12-15-ci.db
    └── 2025-12-15-forecast.db
```

---

## What Gets Committed vs Gitignored

### Committed to Git

| File/Directory | Rationale |
|----------------|-----------|
| `.agentfs/config.yaml` | Agent configuration |
| `.agentfs/snapshots/` | Milestone snapshots for reproducibility |
| `docs/agentfs-usage.md` | This specification |

### Gitignored (Local Only)

| File/Directory | Rationale |
|----------------|-----------|
| `.agentfs/*.db` | Live databases (rebuilt from operations) |
| `.agentfs/*.db-wal` | SQLite WAL files |
| `.agentfs/*.db-shm` | SQLite shared memory |
| `.agentfs/tmp/` | Temporary working files |

### .gitignore Entries

```gitignore
# AgentFS live databases (local only)
.agentfs/*.db
.agentfs/*.db-wal
.agentfs/*.db-shm
.agentfs/tmp/

# Keep snapshots and config
!.agentfs/snapshots/
!.agentfs/config.yaml
```

---

## Recording Agent Actions

### Tool Call Recording

Every external tool invocation must be recorded:

```typescript
import { AgentFS } from 'agentfs-sdk';

const agent = await AgentFS.open({ id: 'intentvision-forecast' });

// Record a tool call
const startTime = Date.now();
const result = await externalForecastAPI(params);
const endTime = Date.now();

await agent.tools.record(
  'forecast_api_call',       // Tool name
  startTime,                 // Start timestamp
  endTime,                   // End timestamp
  { model: 'nixtla', horizon: 30 },  // Input parameters
  { predictions: result }    // Output data
);
```

### State Changes

Key-value state for agent context:

```typescript
// Set state
await agent.kv.set('current_phase', 'phase-1');
await agent.kv.set('last_successful_ingest', '2025-12-15T10:30:00Z');

// Get state
const phase = await agent.kv.get('current_phase');
```

### File Operations

Filesystem operations for agent working files:

```typescript
// Write agent artifacts
await agent.fs.writeFile('/working/forecast-output.json', jsonData);

// List agent files
const files = await agent.fs.readdir('/working');
```

---

## Snapshot Policy

### Snapshot Triggers

| Event | Action |
|-------|--------|
| Phase completion | Create phase snapshot |
| Successful CI run | Optional incremental snapshot |
| Before major operations | Pre-operation checkpoint |
| Weekly schedule | Automated weekly snapshot |

### Creating Snapshots

```bash
# Manual snapshot
cp .agentfs/intentvision-ci.db .agentfs/snapshots/$(date +%Y-%m-%d)-ci.db

# Scripted snapshot (in CI)
./scripts/ci/snapshot-agents.sh
```

### Snapshot Naming Convention

```
<YYYY-MM-DD>-<agent-id>[-<label>].db

Examples:
2025-12-15-ci.db                    # Daily CI snapshot
2025-12-15-forecast-phase1.db       # Phase milestone
2025-12-15-ingest-pre-migration.db  # Pre-operation checkpoint
```

---

## Per-Run Artifacts

### CI Run Artifacts

Each CI run produces:
- Tool call log (which checks ran, timing, results)
- State snapshot before/after
- Error traces if failed

```typescript
// Example CI run recording
await agent.tools.record('arv_check', start, end,
  { checks: ['doc-filing', 'aar-presence', 'lint'] },
  { passed: true, duration_ms: 1250 }
);
```

### Forecast Run Artifacts

Each forecast operation records:
- Input data hash
- Model parameters
- Output predictions
- Timing metrics

---

## Privacy Considerations

### Sensitive Data Handling

| Data Type | Policy |
|-----------|--------|
| API keys | NEVER recorded; use references |
| User data | Hash/anonymize before recording |
| Model outputs | Record structure, not full content if PII |
| Timing data | Always record for performance analysis |

### Data Retention

- Live databases: No retention limit (local only)
- Snapshots: 90-day retention for non-milestone
- Milestone snapshots: Permanent (tied to phases)

---

## Audit Queries

### SQLite Direct Queries

```sql
-- Find all tool calls in time range
SELECT * FROM tool_calls
WHERE start_time >= '2025-12-15T00:00:00Z'
ORDER BY start_time;

-- Get state history
SELECT * FROM kv_log WHERE key = 'current_phase';

-- Count operations by type
SELECT tool_name, COUNT(*)
FROM tool_calls
GROUP BY tool_name;
```

### CLI Queries

```bash
# List recent tool calls
agentfs tools list intentvision-ci --limit 50

# Show agent state
agentfs kv list intentvision-forecast

# Export audit trail
agentfs export intentvision-ci --format jsonl > audit-trail.jsonl
```

---

## Replay for Debugging

### Restore from Snapshot

```bash
# Restore to specific snapshot
cp .agentfs/snapshots/2025-12-15-ci.db .agentfs/intentvision-ci.db

# Run agent with restored state
# (Agent will continue from snapshot state)
```

### Replay Tool Calls

```typescript
// Replay recorded tool calls for debugging
const calls = await agent.tools.list({ limit: 100 });
for (const call of calls) {
  console.log(`${call.tool_name}: ${call.start_time} - ${call.end_time}`);
  console.log('  Input:', call.input);
  console.log('  Output:', call.output);
}
```

---

## CI Integration

The ARV gate validates AgentFS hygiene:

1. **Config exists:** `.agentfs/config.yaml` is present
2. **Snapshots directory:** `.agentfs/snapshots/` exists and is committed
3. **No live DBs committed:** Live databases are properly gitignored

---

## References

- [AgentFS Repository](https://github.com/tursodatabase/agentfs)
- [AgentFS SPEC.md](https://github.com/tursodatabase/agentfs/blob/main/SPEC.md)
- IntentVision `docs/vendor-policy.md` for version pinning
