# Database Posture Document

> **Standard:** IntentVision database strategy and migration approach

---

## Overview

IntentVision uses **libSQL/Turso** as the primary database layer:

- **Local development:** SQLite via libSQL client (`file:db/intentvision.db`)
- **Production:** Turso edge database (libsql:// URL)
- **Migration tool:** Custom TypeScript runner (`db/migrate.ts`)

---

## Technology Choice Rationale

| Factor | libSQL/Turso | Postgres |
|--------|--------------|----------|
| Local dev simplicity | Excellent (no server) | Requires container/server |
| Edge deployment | Native (Turso) | Requires managed service |
| SQLite compatibility | 100% | N/A |
| Cost at scale | Low (edge) | Higher (managed) |
| Sync capabilities | Built-in (embedded replicas) | External tooling |

**Decision:** libSQL/Turso for initial development, with option to add Postgres for specific workloads later.

---

## Database Schema

All schema is defined in `db/migrations/` with sequential numbering:

```
db/
  migrations/
    001_initial_schema.sql    # Core tables
    002_*.sql                  # Future migrations
  config.ts                    # Connection and migration logic
  migrate.ts                   # CLI tool
  intentvision.db              # Local SQLite file (gitignored)
```

### Core Tables

| Table | Purpose |
|-------|---------|
| `_migrations` | Migration tracking |
| `organizations` | Multi-tenant org data |
| `metrics` | Canonical metrics spine |
| `time_series` | Aggregated time series |
| `forecasts` | Forecast results |
| `anomalies` | Detected anomalies |
| `alerts` | Alert instances |
| `alert_rules` | Alert configuration |
| `ingestion_sources` | Data source configs |

---

## Connection Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `INTENTVISION_DB_URL` | `file:db/intentvision.db` | Database URL |
| `INTENTVISION_DB_AUTH_TOKEN` | (none) | Turso auth token |

### Local Development

```bash
# No configuration needed - uses local SQLite
npx tsx db/migrate.ts run
```

### Turso Production

```bash
# Set environment variables
export INTENTVISION_DB_URL="libsql://intentvision-<org>.turso.io"
export INTENTVISION_DB_AUTH_TOKEN="<token>"

# Or via turso CLI
turso db create intentvision
turso db tokens create intentvision
```

---

## Migration Commands

```bash
# Check migration status
npx tsx db/migrate.ts status

# Run pending migrations
npx tsx db/migrate.ts run

# Test database connection
npx tsx db/migrate.ts test
```

---

## Migration Best Practices

1. **Sequential naming:** `NNN_description.sql`
2. **Idempotent:** Use `IF NOT EXISTS` clauses
3. **Atomic:** Each migration is a single transaction
4. **Reversible:** Document rollback steps in comments
5. **Tested:** Verify on fresh database before commit

---

## Turso CLI Commands (when authenticated)

```bash
# Login
turso auth login

# Create database (no numbers in name per GCP rules)
turso db create intentvision

# Connect shell
turso db shell intentvision

# Get connection URL
turso db show intentvision --url

# Create auth token
turso db tokens create intentvision
```

---

## Backup and Recovery

### Local Development
```bash
# Manual backup
cp db/intentvision.db db/intentvision.backup.db

# Restore
cp db/intentvision.backup.db db/intentvision.db
```

### Turso Production
```bash
# Turso handles replication automatically
# Manual backup via dump
turso db shell intentvision ".dump" > backup.sql
```

---

## Security Considerations

1. **Never commit .db files** - Contains development data
2. **Use tokens for Turso** - Never embed in code
3. **Rotate tokens** - Follow standard rotation policy
4. **Encrypt at rest** - Turso provides encryption by default

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
