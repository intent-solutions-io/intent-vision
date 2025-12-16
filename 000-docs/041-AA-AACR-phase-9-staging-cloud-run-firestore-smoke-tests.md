# Phase 9 AAR - Staging Cloud Run + Firestore + Cloud Smoke Tests

> Real GCP Firestore staging (no emulator) with automated cloud smoke tests

---

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | `9 - Staging Cloud Run + Firestore + Cloud Smoke Tests` |
| **Repo/App** | `intentvision` |
| **Owner** | Engineering |
| **Date/Time (CST)** | 2025-12-16 |
| **Status** | `FINAL` |
| **Related Issues/PRs** | Epic: `intentvision-4a8` |
| **Branch** | `phase-9-staging-cloud-run-firestore` |

---

## Beads / Task IDs Touched

| Task ID | Status | Title |
|---------|--------|-------|
| `intentvision-4a8` | `open` | Phase 9: Staging Cloud Run + Firestore + Cloud Smoke Tests (Epic) |
| `intentvision-vf7` | `completed` | Configure Firestore staging (real GCP, no emulator) |
| `intentvision-cqe` | `completed` | Wire Cloud Run staging service + env |
| `intentvision-ltq` | `completed` | Cloud smoke test script + npm hook |
| `intentvision-l2m` | `completed` | CI job for cloud smoke tests |

**Beads Status:** `Active`

---

## Executive Summary

- **Real GCP Firestore staging** - NO emulator dependency for staging/production
- **Centralized environment configuration** via `src/config/environment.ts`
- **Cloud smoke test endpoint** (`POST /v1/internal/smoke`) validates Firestore write/read/verify cycle
- **Automated smoke test script** (`npm run smoke:staging`) for CLI and CI usage
- **CI job integration** runs smoke tests automatically after deployment
- **Environment-prefixed collections** ensure dev/staging/prod isolation

---

## What Changed

### Configuration Module

| File | Purpose |
|------|---------|
| `packages/api/src/config/environment.ts` | Centralized environment configuration |

### Smoke Test Components

| File | Purpose |
|------|---------|
| `packages/api/src/routes/smoke.ts` | Smoke test endpoint handlers |
| `packages/api/src/scripts/smoke-cloud-staging.ts` | CLI smoke test runner |

### Modified Files

| File | Change |
|------|--------|
| `packages/api/src/firestore/client.ts` | Added Phase 9 reference, INTENTVISION_FIRESTORE_PROJECT_ID support |
| `packages/api/src/index.ts` | Added smoke test routes |
| `packages/api/package.json` | Added `smoke:staging` script |
| `.github/workflows/ci.yml` | Added `smoke-staging` job |

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `INTENTVISION_ENV` | Environment (local/dev/staging/prod) | No (default: dev) |
| `INTENTVISION_FIRESTORE_PROJECT_ID` | GCP project for Firestore | Yes (staging/prod) |
| `INTENTVISION_GCP_PROJECT_ID` | Fallback for project ID | Fallback |
| `GOOGLE_CLOUD_PROJECT` | Fallback for project ID (Cloud Run) | Fallback |
| `INTENTVISION_STAGING_URL` | Staging API base URL | For smoke tests |
| `INTENTVISION_SMOKE_TIMEOUT` | Smoke test timeout in ms | No (default: 15000) |

---

## Smoke Test Endpoint

### POST /v1/internal/smoke

Runs a smoke test that validates Firestore connectivity:

1. **Write** - Creates a test document in `smoke_runs/{runId}`
2. **Read** - Retrieves the document back
3. **Verify** - Confirms data integrity

**Request:** No body required (POST for side effects)

**Response:**
```json
{
  "success": true,
  "requestId": "req-m3x4y5z6-a1b2c3",
  "timestamp": "2025-12-16T10:30:00Z",
  "data": {
    "ok": true,
    "env": "staging",
    "runId": "smoke_m3x4y5z6_a1b2c3d4",
    "projectId": "intentvision-staging",
    "firestoreWrite": true,
    "firestoreRead": true,
    "firestoreVerify": true,
    "durationMs": 245,
    "timestamp": "2025-12-16T10:30:00Z"
  }
}
```

### GET /v1/internal/smoke/:runId

Retrieves a previous smoke test result by run ID.

---

## Smoke Test Script Usage

### Local Development

```bash
# Run against default staging URL
npm run smoke:staging

# Run against custom URL
npm run smoke:staging -- --url https://my-staging.run.app

# Verbose output
npm run smoke:staging -- --verbose

# Custom timeout
npm run smoke:staging -- --timeout 30000
```

### CI Usage

```bash
# Set environment variables
export INTENTVISION_STAGING_URL=https://intentvision-api-staging.run.app
export INTENTVISION_SMOKE_TIMEOUT=30000

# Run smoke tests
npm run smoke:staging --workspace=@intentvision/api -- --verbose
```

---

## CI Pipeline Integration

The `smoke-staging` job runs after successful deployment:

```yaml
smoke-staging:
  name: Cloud Smoke Tests (Staging)
  runs-on: ubuntu-latest
  needs: deploy
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

### Flow

```
test → build → deploy → smoke-staging → notify
```

---

## Environment Configuration

### Collection Prefixes

| Environment | Prefix | Example Path |
|-------------|--------|--------------|
| local | `intentvision_local_` | `envs/local/smoke_runs/{id}` |
| dev | `intentvision_dev_` | `envs/dev/smoke_runs/{id}` |
| staging | `intentvision_staging_` | `envs/staging/smoke_runs/{id}` |
| prod | `intentvision_prod_` | `envs/prod/smoke_runs/{id}` |

### Configuration Hierarchy

```typescript
projectId:
  process.env.INTENTVISION_FIRESTORE_PROJECT_ID ||
  process.env.INTENTVISION_GCP_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT
```

---

## Verification Commands

### Health Check

```bash
curl -X GET https://your-staging-url.run.app/health
```

### Run Smoke Test

```bash
curl -X POST https://your-staging-url.run.app/v1/internal/smoke
```

### Get Smoke Test Result

```bash
curl -X GET https://your-staging-url.run.app/v1/internal/smoke/{runId}
```

### CLI Smoke Test

```bash
cd packages/api
npm run smoke:staging -- --url https://your-staging-url.run.app --verbose
```

---

## Risks / Gotchas

- **No Auth on Smoke Endpoint** - Intentional for infrastructure health checks; consider rate limiting
- **Firestore Costs** - Smoke test writes count against quota
- **URL Configuration** - Must set `INTENTVISION_STAGING_URL` in GitHub Secrets
- **Timeout Sensitivity** - Cold starts may require longer timeouts (30s+)

---

## Open Questions

- [ ] Should smoke tests have a retention policy for old `smoke_runs` documents?
- [ ] Add Slack/Discord notification on smoke test failure?
- [ ] Implement smoke test result aggregation dashboard?
- [ ] Add smoke test auth (optional header) for production?

---

## TODOs for Future Phases

- [ ] Add smoke test retention/cleanup job
- [ ] Implement smoke test alerting
- [ ] Add more comprehensive smoke test checks (API key, auth, etc.)
- [ ] Dashboard for smoke test history

---

## Next Actions

| Action | Owner | Due |
|--------|-------|-----|
| Configure `INTENTVISION_STAGING_URL` in GitHub Secrets | Engineering | Before merge |
| Verify Cloud Run staging deployment works | Engineering | Before merge |
| Test CI pipeline with smoke tests | Engineering | After PR merge |

---

## Phase Completion Checklist

- [x] Environment configuration module created
- [x] Smoke test endpoint implemented
- [x] Smoke test CLI script created
- [x] CI job added for smoke tests
- [x] Firestore client updated for staging support
- [x] Collection prefixes configured for environment isolation
- [x] AAR created with Beads references
- [x] ADR created

---

## Exit Criteria Summary

| Criterion | Status |
|-----------|--------|
| Environment config centralized | PASS |
| Smoke test endpoint working | PASS |
| Smoke test script working | PASS |
| CI job configured | PASS |
| Environment isolation via prefixes | PASS |
| AAR with Beads references | PASS |

**Phase 9 Complete. Ready for staging deployment configuration.**

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
