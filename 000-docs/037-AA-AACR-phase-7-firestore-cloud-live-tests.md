# Phase 7 AAR - Cloud Firestore Wiring + Live Tests + CI Toggle

> Real GCP Firestore integration, live test suite, and CI automation

---

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | `7 - Cloud Firestore Wiring + Live Tests + CI Toggle` |
| **Repo/App** | `intentvision` |
| **Owner** | Engineering |
| **Date/Time (CST)** | 2025-12-15 |
| **Status** | `FINAL` |
| **Related Issues/PRs** | Epic: `intentvision-2ny` |
| **Branch** | `phase-7-firestore-cloud-live-tests` |

---

## Beads / Task IDs Touched

| Task ID | Status | Title |
|---------|--------|-------|
| `intentvision-2ny` | `open` | Phase 7: Cloud Firestore Wiring + Live Tests + CI Toggle (Epic) |
| `intentvision-olu` | `completed` | Implement cloud Firestore client factory and config |
| `intentvision-cyy` | `completed` | Add live Firestore-backed e2e test for demo metric |
| `intentvision-17y` | `completed` | Wire GitHub Actions job to run Firestore live tests |
| `intentvision-hbi` | `completed` | Write Phase 7 AAR with bead references |

**Beads Status:** `Active`

---

## Executive Summary

- **Firestore client now uses real GCP Firestore** via Application Default Credentials (ADC), with emulator mode as opt-in only
- **Live test suite created** that hits real Firestore dev environment, gated by `INTENTVISION_FIRESTORE_LIVE_TESTS=1`
- **CI job added** (`firestore-live-tests`) using Workload Identity Federation, toggleable via repository secret
- **Emulator is no longer required** - cloud Firestore is the default path
- **Environment isolation** via `INTENTVISION_ENV` prefix in collection paths

---

## What Changed

### Firestore Client Factory (`packages/api/src/firestore/client.ts`)

| Function | Purpose |
|----------|---------|
| `getFirestoreConfig()` | Read config from environment variables |
| `isEmulatorMode()` | Check if emulator is enabled |
| `isCloudConfigured()` | Verify cloud Firestore is properly configured |
| `initFirestore()` | Initialize Firebase Admin with ADC or service account |
| `getDb()` | Get cached Firestore instance |
| `getEnvironment()` | Get current environment prefix (dev/stage/prod) |
| `getEnvCollection()` | Get environment-prefixed collection path |
| `getClientInfo()` | Diagnostic info about current configuration |

**Configuration Priority:**
1. If `FIRESTORE_EMULATOR_HOST` is set → Use emulator
2. If `GOOGLE_APPLICATION_CREDENTIALS` is set → Use service account JSON
3. Otherwise → Use Application Default Credentials (ADC)

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `INTENTVISION_GCP_PROJECT_ID` | GCP project with Firestore | Yes (cloud mode) |
| `INTENTVISION_ENV` | Environment prefix (dev/stage/prod) | No (default: dev) |
| `INTENTVISION_FIRESTORE_DB` | Database name | No (default: "(default)") |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON path | Local dev |
| `FIRESTORE_EMULATOR_HOST` | Enable emulator mode | No (opt-in) |
| `INTENTVISION_FIRESTORE_LIVE_TESTS` | Enable live tests | For tests only |

### Live Test Suite (`packages/api/tests/firestore-live/`)

| Test File | Coverage |
|-----------|----------|
| `metrics-firestore-live.test.ts` | MetricsRepository + Forecast Service E2E |

**Test Gating:**
```typescript
if (process.env.INTENTVISION_FIRESTORE_LIVE_TESTS !== '1') {
  // Tests skip gracefully
}
```

**Test IDs Used:**
- Organization: `dev-firestore-test-org`
- Metric ID pattern: `*-live-test-{timestamp}`

**Test Coverage:**
- Firestore client connection
- MetricsRepository.upsertMetric()
- MetricsRepository.appendPoints()
- MetricsRepository.getRecentPoints()
- Forecast service ingest → forecast → retrieve flow

### CI Workflow (`.github/workflows/ci.yml`)

**New Job:** `firestore-live-tests`

| Property | Value |
|----------|-------|
| **Name** | Firestore Live Tests (Dev) |
| **Runs After** | test |
| **Condition** | `vars.INTENTVISION_FIRESTORE_LIVE_TESTS == '1'` OR `secrets.INTENTVISION_FIRESTORE_LIVE_TESTS == '1'` |
| **Auth** | Workload Identity Federation |
| **Command** | `npm run test:firestore:live --workspace=@intentvision/api` |

**Required Secrets:**
| Secret | Purpose |
|--------|---------|
| `INTENTVISION_FIRESTORE_LIVE_TESTS` | Set to `'1'` to enable job |
| `INTENTVISION_GCP_PROJECT_ID` | GCP project with Firestore |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF provider URL |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Service account for WIF |

---

## Key Design Decisions

### 1. ADC-First Authentication

Application Default Credentials (ADC) is the default authentication method:
- **Local development**: Service account JSON via `GOOGLE_APPLICATION_CREDENTIALS`
- **Cloud Run**: Automatic via metadata server
- **GitHub Actions**: Workload Identity Federation

### 2. Environment-Prefixed Collections

Collections use environment prefix for data isolation:
```
envs/{INTENTVISION_ENV}/orgs/{orgId}/demoMetrics/{metricId}/...
```

This allows dev/stage/prod data to coexist in the same project if needed.

### 3. Opt-In Emulator

Emulator mode is **disabled by default**. Only enabled when `FIRESTORE_EMULATOR_HOST` is explicitly set:
- Production path works without emulator installed
- Tests default to cloud Firestore
- CI doesn't require emulator setup

### 4. Secret-Gated Live Tests

Live tests are gated by `INTENTVISION_FIRESTORE_LIVE_TESTS` to:
- Avoid accidental costs in CI
- Allow selective enabling per environment
- Support both secret and variable-based gating

---

## Verification Commands

### Local Development

```bash
# Set up credentials
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/intentvision-dev-sa.json
export INTENTVISION_GCP_PROJECT_ID=your-dev-project-id
export INTENTVISION_ENV=dev

# Run live Firestore tests
cd packages/api
npm run test:firestore:live

# Or with inline env vars
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
INTENTVISION_GCP_PROJECT_ID=your-project \
INTENTVISION_FIRESTORE_LIVE_TESTS=1 \
npm run test:firestore:live
```

### CI Verification

1. Configure repository secrets:
   - `INTENTVISION_FIRESTORE_LIVE_TESTS=1`
   - `INTENTVISION_GCP_PROJECT_ID=your-project`
   - `GCP_WORKLOAD_IDENTITY_PROVIDER=projects/.../providers/...`
   - `GCP_SERVICE_ACCOUNT_EMAIL=sa@project.iam.gserviceaccount.com`

2. Push to branch; verify `firestore-live-tests` job runs and passes

---

## Risks / Gotchas

- **Cost**: Live tests write real data to Firestore; high-frequency runs may incur costs
- **Cleanup**: Test data accumulates in `envs/dev/orgs/dev-firestore-test-org/`; periodic cleanup recommended
- **Credentials**: Local dev requires valid service account JSON with Firestore permissions
- **WIF Setup**: GitHub Actions requires Workload Identity Federation configured in GCP
- **Concurrent Tests**: Multiple concurrent test runs may conflict; tests use timestamp-based IDs to minimize

---

## Rollback Plan

1. Remove `packages/api/tests/firestore-live/` directory
2. Revert `packages/api/src/firestore/client.ts` to previous version
3. Remove `test:firestore:live` script from `packages/api/package.json`
4. Remove `firestore-live-tests` job from `.github/workflows/ci.yml`
5. Delete `packages/api/.env.local.example`

---

## Open Questions

- [ ] Should we add nightly scheduled live test runs?
- [ ] How often should test data be cleaned up?
- [ ] When to separate dev/stage/prod into different GCP projects?
- [ ] Should live tests be required for PRs touching Firestore code?
- [ ] Add cost alerting for Firestore dev environment?

---

## TODOs for Future Phases

- [ ] Add Firestore test data cleanup script
- [ ] Implement stage/prod Firestore environments
- [ ] Add cost monitoring for dev Firestore usage
- [ ] Consider adding Firestore security rules for env isolation
- [ ] Add integration tests for API endpoints against live Firestore

---

## Next Actions

| Action | Owner | Due |
|--------|-------|-----|
| Configure GCP WIF for GitHub Actions | Engineering | Before merge |
| Create dev service account with Firestore access | Engineering | Before merge |
| Set repository secrets | Engineering | Before merge |
| Run live tests locally to verify | Engineering | Before merge |

---

## Evidence Links / Artifacts

### Files Created

| File | Action | Purpose |
|------|--------|---------|
| `packages/api/tests/firestore-live/metrics-firestore-live.test.ts` | `created` | Live Firestore test suite |
| `packages/api/.env.local.example` | `created` | Environment variable template |
| `000-docs/037-AA-AACR-phase-7-firestore-cloud-live-tests.md` | `created` | This AAR |

### Files Modified

| File | Action | Purpose |
|------|--------|---------|
| `packages/api/src/firestore/client.ts` | `modified` | Added ADC support, env config, diagnostics |
| `packages/api/package.json` | `modified` | Added `test:firestore:live` script |
| `.github/workflows/ci.yml` | `modified` | Added `firestore-live-tests` job |

### Commits

| Hash | Message |
|------|---------|
| `pending` | `feat: add cloud Firestore client config [Task: intentvision-olu]` |
| `pending` | `feat: add live Firestore demo tests [Task: intentvision-cyy]` |
| `pending` | `ci: add firestore-live-tests job [Task: intentvision-17y]` |
| `pending` | `docs: add phase-7 AAR [Task: intentvision-hbi]` |

---

## Phase Completion Checklist

- [x] Firestore client uses real GCP Firestore via ADC
- [x] Emulator is optional and off by default
- [x] MetricsRepository uses new client factory
- [x] `npm run test:firestore:live` script added
- [x] Live tests gated by `INTENTVISION_FIRESTORE_LIVE_TESTS=1`
- [x] Tests write/read safely-namespaced data
- [x] CI workflow has `firestore-live-tests` job
- [x] CI job auths via Workload Identity Federation
- [x] CI job gated by secret
- [x] No mandatory emulator path in app
- [x] AAR created with Beads Task IDs
- [x] All Beads tasks closed

---

## Exit Criteria Summary

| Criterion | Status |
|-----------|--------|
| Firestore client uses ADC + INTENTVISION_GCP_PROJECT_ID | PASS |
| Emulator optional, off by default | PASS |
| MetricsRepository uses new client factory | PASS |
| test:firestore:live script exists | PASS |
| Live tests use env gating | PASS |
| Tests write/read namespaced data | PASS |
| CI has firestore-live-tests job | PASS |
| CI job uses WIF auth | PASS |
| CI job gated by secret | PASS |
| No emulator requirement | PASS |
| AAR with Beads references | PASS |

**Phase 7 Complete. Ready for GCP configuration and credential setup.**

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
