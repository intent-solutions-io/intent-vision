# AgentFS State Management for IntentVision

> The filesystem for agents - persistent, auditable storage for AI workflows

## Overview

AgentFS provides specialized storage for AI agent workflows. It offers filesystem operations, key-value storage, and tool call tracking - all stored in a single SQLite database for auditability and reproducibility.

**Key Features:**
- **Filesystem** - POSIX-like file operations within the agent context
- **Key-Value Store** - Persistent state and configuration
- **Tool Tracking** - Audit trail of all function calls with timestamps
- **Snapshots** - Point-in-time state capture for reproducibility

**Storage:** `.agentfs/intentvision.db` (SQLite, git-ignored)

**This is INTERNAL ONLY - never expose to customers.**

## Storage Location

```
.agentfs/
├── intentvision.db           # Main SQLite database
└── snapshots/                # Point-in-time snapshots
    └── YYYY-MM-DD-phase-X-description.json
```

## When to Use AgentFS

| Use Case | AgentFS Role |
|----------|--------------|
| Agent decision logging | Store reasoning traces via KV |
| Multi-step workflows | Persist state between steps |
| Tool call auditing | Track all operations with timestamps |
| Session snapshots | Capture state at significant transitions |
| Phase transitions | Record phase status changes |
| Evaluation runs | Log model outputs and metrics |

## SDK Usage

### Initialize AgentFS

```typescript
import { AgentFS } from 'agentfs-sdk';

// Open or create agent filesystem
const agent = await AgentFS.open({ id: 'intentvision' });
```

### Key-Value Operations

```typescript
// Store values
await agent.kv.set('project:name', 'IntentVision');
await agent.kv.set('phase:current', {
  number: 3,
  name: 'Discipline Layer',
  status: 'in_progress'
});

// Retrieve values
const project = await agent.kv.get('project:name');
const phase = await agent.kv.get('phase:current');

// Delete values
await agent.kv.delete('temp:workspace');

// List keys
const keys = await agent.kv.list('phase:*');
```

### File Operations

```typescript
// Write file
await agent.fs.write('/decisions/phase-3.md', content);

// Read file
const data = await agent.fs.read('/decisions/phase-3.md');

// List directory
const files = await agent.fs.ls('/decisions');

// Check existence
const exists = await agent.fs.exists('/config/settings.json');
```

### Tool Call Tracking

```typescript
const startTime = Date.now() / 1000;

// Perform operation...
const result = await someOperation();

// Record the tool call
await agent.tools.record(
  'forecast_generation',        // Tool name
  startTime,                    // Start timestamp (Unix)
  Date.now() / 1000,           // End timestamp (Unix)
  { metricName: 'mrr', horizonDays: 7 },  // Input
  { predictions: result.predictions }      // Output
);
```

### Session Snapshots

```typescript
// Create snapshot
const snapshot = {
  snapshot_id: `${new Date().toISOString().split('T')[0]}-phase-3-discipline`,
  created_at: new Date().toISOString(),
  project: 'intentvision',
  phase: 3,
  status: {
    claude_md: 'updated',
    beads_helpers: 'created',
    agentfs_helpers: 'created'
  },
  beads_tasks: {
    epic: 'intentvision-q37',
    completed: ['intentvision-q37.1', 'intentvision-q37.2']
  }
};

// Store in KV
await agent.kv.set('session:current', snapshot);
await agent.kv.set(`snapshot:${snapshot.snapshot_id}`, snapshot);
```

## CLI Usage

```bash
# Initialize new agent filesystem
agentfs init intentvision

# List files
agentfs fs ls

# Read file
agentfs fs cat /decisions/phase-3.md

# Mount filesystem (FUSE)
agentfs mount .agentfs/intentvision.db /mnt/agent
```

## Initialization Script

IntentVision includes an initialization script at `scripts/agentfs-init.ts`:

```bash
# Run initialization
npx tsx scripts/agentfs-init.ts
```

This script:
1. Creates the AgentFS database
2. Stores project context in KV store
3. Records initialization in tool audit trail
4. Creates initial session snapshot

## Key Patterns for IntentVision

### Phase Tracking

```typescript
// Store phase status
await agent.kv.set('phase:1', { status: 'completed', name: 'Firestore MVP' });
await agent.kv.set('phase:2', { status: 'completed', name: 'Email Alerts' });
await agent.kv.set('phase:3', { status: 'in_progress', name: 'Discipline Layer' });

// Get current phase
const currentPhase = await agent.kv.get('phase:current');
```

### Decision Logging

```typescript
// Log important decisions
await agent.kv.set('decision:auth-strategy', {
  timestamp: new Date().toISOString(),
  choice: 'API key with SHA-256 hash',
  reasoning: 'Simple, secure, no external dependencies',
  alternatives: ['JWT', 'OAuth2', 'Session tokens']
});
```

### Beads Integration

```typescript
// Track Beads task context
await agent.kv.set('beads:current', {
  epic: 'intentvision-q37',
  task: 'intentvision-q37.2',
  phase: 3
});
```

## Rules for IntentVision

1. **Internal only** - Never call from public API endpoints
2. **Not required for startup** - API server must work without AgentFS
3. **No customer PII** - Never store customer data
4. **Audit significant operations** - Use tool tracking for important actions
5. **Snapshot at transitions** - Capture state when phases complete
6. **Reference in AARs** - Note AgentFS snapshot IDs in documentation

## Separation Guarantee

AgentFS MUST NOT appear in:
- `packages/api/` public exports
- Public HTTP endpoint handlers
- Customer-facing responses
- Environment variable requirements for customers

AgentFS IS allowed in:
- `scripts/` for internal tooling
- `packages/agent/` for agent workflows
- CI/CD scripts
- Development tools
- `000-docs/` documentation

## Comparison: AgentFS vs Firestore

| Aspect | AgentFS | Firestore |
|--------|---------|-----------|
| Purpose | Agent state, audit trails | Customer product data |
| Visibility | Internal only | Customer-facing |
| Storage | Local SQLite | Cloud-hosted |
| Required | No (optional) | Yes (production) |
| Data | Decisions, traces, sessions | Orgs, metrics, forecasts |

## Troubleshooting

### "agentfs: command not found"

```bash
# Install via npm
npm install -g agentfs-sdk

# Or use npx
npx agentfs init intentvision
```

### Database locked

```bash
# Check for other processes
lsof .agentfs/intentvision.db

# If stuck, safe to delete and reinit (internal tool)
rm .agentfs/intentvision.db
npx tsx scripts/agentfs-init.ts
```

### SDK not found

```bash
# Install in project
npm install agentfs-sdk
```

---

*Reference: https://github.com/tursodatabase/agentfs*
*This is for internal use only. Do not share with customers.*
