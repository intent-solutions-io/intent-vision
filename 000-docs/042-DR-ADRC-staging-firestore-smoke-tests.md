# ADR: Staging Firestore and Cloud Smoke Tests

> Real GCP Firestore for staging with automated smoke test validation

---

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ADR-042 |
| **Status** | `ACCEPTED` |
| **Date** | 2025-12-16 |
| **Decision Maker** | Engineering |
| **Related** | Phase 9, `intentvision-4a8` |

---

## Context

IntentVision needs a staging environment that accurately represents production behavior. Key requirements:

1. **No Emulator Dependency** - Staging must use real GCP Firestore, not the emulator
2. **Environment Isolation** - Dev, staging, and prod data must be isolated
3. **Deployment Validation** - Automated verification that deployments are healthy
4. **CI Integration** - Tests must run automatically after deployment

We needed to decide:
1. How to configure Firestore for different environments
2. How to isolate data between environments
3. How to validate deployments automatically
4. What level of authentication smoke tests require

---

## Decision

### 1. Real GCP Firestore for Staging

**Use real GCP Firestore for staging environment**, not the emulator.

**Rationale:**
- Emulator has behavior differences from production
- Staging should mirror production as closely as possible
- Real Firestore validates ADC/WIF authentication flows
- Catches permission and quota issues before production

**Configuration:**
```bash
# Staging
INTENTVISION_ENV=staging
INTENTVISION_FIRESTORE_PROJECT_ID=intentvision-staging
```

### 2. Environment-Prefixed Collections

**Isolate environments using collection path prefixes.**

**Pattern:** `envs/{env}/{collection}`

**Examples:**
- Dev: `envs/dev/orgs/{orgId}/metrics`
- Staging: `envs/staging/orgs/{orgId}/metrics`
- Prod: `envs/prod/orgs/{orgId}/metrics`

**Rationale:**
- Single Firestore instance can serve multiple environments
- Security rules can be applied per-environment
- Easy to query/export environment-specific data
- No cross-environment data leakage risk

### 3. Unauthenticated Smoke Test Endpoint

**`POST /v1/internal/smoke` does not require API key authentication.**

**Rationale:**
- Infrastructure health checks need to run without application credentials
- Load balancers and orchestrators need simple health verification
- Smoke tests validate infrastructure, not business logic
- Rate limiting can prevent abuse without auth complexity

**Security Mitigations:**
- Endpoint only performs safe operations (write test data, read back)
- No access to customer data or business operations
- Can add IP allowlisting at Cloud Run level if needed
- Test data in isolated `smoke_runs` collection

### 4. Write-Read-Verify Test Pattern

**Smoke tests perform a three-step validation:**

1. **Write** - Create a test document with known data
2. **Read** - Retrieve the document immediately
3. **Verify** - Compare retrieved data matches written data

**Rationale:**
- Validates both write and read paths
- Catches eventual consistency issues
- Confirms Firestore SDK is properly configured
- Simple enough to be fast (< 500ms typically)

### 5. CI Job After Deploy

**Run smoke tests as a CI job that depends on successful deployment.**

**Pipeline:**
```
test → build → deploy → smoke-staging → notify
```

**Rationale:**
- Catches deployment failures before notification
- Automated verification reduces manual checking
- Failure blocks further pipeline progress
- Results recorded in CI logs

---

## Consequences

### Positive

- **Production-like staging** - Real Firestore behavior in staging
- **Environment isolation** - No data leakage between environments
- **Automated validation** - Every deploy is verified automatically
- **Fast feedback** - Smoke tests complete in seconds
- **Simple operation** - No emulator setup or maintenance

### Negative

- **Firestore costs** - Smoke tests consume Firestore operations
- **Network dependency** - Smoke tests require network access to GCP
- **Cold start latency** - First smoke test after deploy may be slow

### Neutral

- **No auth on smoke endpoint** - Acceptable trade-off for infrastructure checks
- **Test data accumulation** - Needs periodic cleanup (future enhancement)

---

## Alternatives Considered

### 1. Use Firestore Emulator for Staging

**Rejected because:**
- Emulator behavior differs from production
- Doesn't validate real GCP authentication
- Misses permission and quota issues
- Adds emulator maintenance burden

### 2. Separate Firestore Instances per Environment

**Rejected because:**
- Higher operational complexity
- More IAM configuration required
- Collection prefixes achieve same isolation
- Single instance is simpler to manage

### 3. Authenticated Smoke Endpoint

**Rejected because:**
- Infrastructure checks shouldn't require app credentials
- Adds complexity for basic health verification
- Load balancers can't easily authenticate
- Security risk is minimal for test-only operations

### 4. Smoke Tests in Deploy Job

**Rejected because:**
- Separating jobs provides clearer failure signals
- Independent job can be re-run without re-deploying
- Better visibility in CI dashboard
- Allows for parallel smoke tests in future

---

## Implementation Notes

### Adding a New Environment

1. Add to `IntentVisionEnv` type in `environment.ts`
2. Add collection prefix in `getFirestoreEnvConfig()`
3. Configure CI secrets for the new environment
4. Deploy and run smoke tests

### Extending Smoke Tests

To add new smoke test checks:

1. Add check logic in `routes/smoke.ts`
2. Add result fields to `SmokeTestResult` interface
3. Update smoke test script output formatting
4. Update documentation

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Smoke runs - allow unauthenticated writes for health checks
    match /envs/{env}/smoke_runs/{runId} {
      allow read, write: if true;
    }

    // Other collections require authentication
    match /envs/{env}/{collection}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## References

- [Cloud Run Health Checks](https://cloud.google.com/run/docs/configuring/healthchecks)
- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)
- Phase 9 AAR: `000-docs/041-AA-AACR-phase-9-staging-cloud-run-firestore-smoke-tests.md`

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
