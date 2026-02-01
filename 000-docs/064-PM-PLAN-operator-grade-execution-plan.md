# IntentVision Operator-Grade Execution Plan

**Document ID:** 064-PM-PLAN-operator-grade-execution-plan
**Type:** PM-PLAN (Project Management Plan)
**Date/Time (CST):** 2026-01-31 00:15 CST
**Status:** DRAFT — PLAN MODE (Do Not Execute)
**Repository:** intent-solutions-io/intent-vision
**Current Branch:** phase-11-usage-metering
**Baseline Commit:** b63b38c

---

## 0. Executive Summary

This plan converts the Operator-Grade System Analysis (063-AA-AUDT) into 8 executable Beads epics with strict PR/commit/AAR discipline. It establishes the foundation for production readiness: README overhaul, Terraform IaC, production cutover, observability, DR/backups, load testing, resilience patterns, and web tests.

**Hard Dependencies Identified:**
- GCP Project: `intentvision` (from ci.yml)
- Region: `us-central1`
- WIF already configured in workflows
- Staging deploys on `main`, prod on tags `v*.*.*`

---

## 1. Beads Audit Summary

### 1.1 Existing Epics (3)

| Bead ID | Title | Status | Action |
|---------|-------|--------|--------|
| `intentvision-mpr` | Phase F: ADK Productization | open | KEEP — ADK work continues in parallel |
| `intentvision-9xh` | Phase D: Agent Engine Deployment | open | KEEP — Deployment work continues |
| `intentvision-uxb` | Phase 8: Notification Preferences | open | KEEP — Feature work continues |

### 1.2 Existing Tasks to Incorporate

| Bead ID | Title | Status | Action | Maps To |
|---------|-------|--------|--------|---------|
| `intentvision-xyq.3` | F.3 Set up Turso Cloud database | open | MERGE → Epic 3 | prod-cutover |
| `intentvision-xyq.4` | F.4 Configure secrets in Secret Manager | open | MERGE → Epic 3 | prod-cutover |
| `intentvision-xyq.5` | F.5 Deploy to Cloud Run | open | MERGE → Epic 3 | prod-cutover |
| `intentvision-c0s` | Phase 13: Observability | open | MERGE → Epic 4 | observability |
| `intentvision-91n.6` | G.6 Create infra/ deployment configs | open | MERGE → Epic 2 | terraform |

### 1.3 Tasks to Close (Already Done or Superseded)

| Bead ID | Title | Reason to Close |
|---------|-------|-----------------|
| None identified | — | Audit shows no completed tasks without closure |

---

## 2. Epic Tree (8 Epics)

### Priority Legend
- **P0**: Must complete before any production customer
- **P1**: Must complete within 2 weeks of prod launch
- **P2**: Nice to have, schedule after P0/P1

---

## EPIC 1 (P0): README + Repo Open-Source Ready

**Epic ID:** `intentvision-readme`
**Goal:** Transform README from placeholder to crisp operator/product documentation reflecting current reality.

### Child Tasks

| Child ID | Title | Owner | Blocked By |
|----------|-------|-------|------------|
| `.1` | (docs) Restructure README sections | Eng | — |
| `.2` | (docs) Add "Current Status" section | Eng | .1 |
| `.3` | (docs) Verify developer quickstart | Eng | .1 |
| `.4` | (docs) Add ops quickstart section | DevOps | .1, .3 |
| `.5` | (docs) Add badges and verify links | Eng | .2, .3, .4 |

### Child Task Details

#### intentvision-readme.1: Restructure README sections

**Acceptance Criteria:**
- [ ] README has sections: What it is, Who it's for, Architecture, Quickstart, Environments, Security, Ops, Roadmap
- [ ] ASCII architecture diagram present
- [ ] All claims verified against current codebase
- [ ] No dead links

**Evidence Required:**
- `git diff README.md` showing structural changes
- README verification checklist in PR description

**Branch:** `feature/readme-1-restructure`
**PR Title:** `[intentvision-readme.1] Restructure README with operator-first sections`
**Commit Example:** `docs(readme): restructure sections for operator clarity`

---

#### intentvision-readme.2: Add "Current Status" section

**Acceptance Criteria:**
- [ ] Explicit staging/prod status (staging: live, prod: pending)
- [ ] Terraform status noted (placeholder → real)
- [ ] Version badge reflects actual version
- [ ] Last updated date accurate

**Evidence Required:**
- Screenshot or markdown of status section
- Verification that staging URL works

**Branch:** `feature/readme-2-status`
**PR Title:** `[intentvision-readme.2] Add current status section with explicit environment state`
**Commit Example:** `docs(readme): add current status section`

---

#### intentvision-readme.3: Verify developer quickstart

**Acceptance Criteria:**
- [ ] `npm ci` works from clean clone
- [ ] `npm test` passes (381 tests)
- [ ] `npm run dev` starts server
- [ ] `.env.example` is complete and documented
- [ ] All commands verified on fresh environment

**Evidence Required:**
- Terminal output of each command
- Fresh clone test (or CI job evidence)

**Branch:** `feature/readme-3-devstart`
**PR Title:** `[intentvision-readme.3] Verify and update developer quickstart`
**Commit Example:** `docs(readme): verify developer quickstart steps`

---

#### intentvision-readme.4: Add ops quickstart section

**Acceptance Criteria:**
- [ ] Deploy triggers documented (staging: push to main, prod: tag)
- [ ] Rollback procedure summarized with link to runbook
- [ ] Health check URLs documented
- [ ] Secret management overview present

**Evidence Required:**
- Ops section content
- Link verification for runbooks

**Branch:** `feature/readme-4-ops`
**PR Title:** `[intentvision-readme.4] Add ops quickstart for DevOps onboarding`
**Commit Example:** `docs(readme): add ops quickstart section`

---

#### intentvision-readme.5: Add badges and verify links

**Acceptance Criteria:**
- [ ] CI status badge present and working
- [ ] License badge if applicable
- [ ] Version badge (npm or git tag)
- [ ] All URLs tested (staging, docs, runbooks)

**Evidence Required:**
- Badge rendering screenshot
- Link verification report

**Branch:** `feature/readme-5-badges`
**PR Title:** `[intentvision-readme.5] Add badges and verify all links`
**Commit Example:** `docs(readme): add CI/license/version badges`

---

## EPIC 2 (P0): Terraform IaC — Reproducible Infrastructure

**Epic ID:** `intentvision-terraform`
**Goal:** `infrastructure/terraform/` produces real, reproducible staging/prod infra.

**Incorporates Existing:** `intentvision-91n.6`

### Child Tasks

| Child ID | Title | Owner | Blocked By |
|----------|-------|-------|------------|
| `.1` | (infra) Terraform skeleton + remote state | DevOps | — |
| `.2` | (infra) Enable APIs + Artifact Registry + SA | DevOps | .1 |
| `.3` | (infra) Cloud Run staging module | DevOps | .2 |
| `.4` | (infra) Cloud Run prod module (disabled) | DevOps | .3 |
| `.5` | (infra) Secret Manager resources | DevOps | .2 |
| `.6` | (ci) Terraform plan drift detection | DevOps | .3 |

### Child Task Details

#### intentvision-terraform.1: Terraform skeleton + remote state

**Acceptance Criteria:**
- [ ] `infrastructure/terraform/` has proper structure (main.tf, variables.tf, outputs.tf, versions.tf)
- [ ] Remote state backend configured (GCS bucket)
- [ ] State bucket created with versioning enabled
- [ ] README in terraform/ explaining structure
- [ ] `.terraform-version` or tfenv config present

**Evidence Required:**
```bash
terraform init   # Must succeed
terraform validate  # Must pass
ls infrastructure/terraform/  # Show structure
```

**Branch:** `feature/terraform-1-skeleton`
**PR Title:** `[intentvision-terraform.1] Terraform skeleton with GCS remote state`
**Commit Example:** `infra(terraform): add skeleton with GCS remote state backend`

---

#### intentvision-terraform.2: Enable APIs + Artifact Registry + SA

**Acceptance Criteria:**
- [ ] APIs enabled: run.googleapis.com, artifactregistry.googleapis.com, secretmanager.googleapis.com, cloudbuild.googleapis.com
- [ ] Artifact Registry repo: `us-central1-docker.pkg.dev/intentvision/intentvision`
- [ ] Service account for Cloud Run with least privilege
- [ ] WIF service account for GitHub Actions (if not already created)

**Evidence Required:**
```bash
terraform plan  # Show resources to be created
gcloud services list --enabled  # After apply
gcloud iam service-accounts list  # Show SAs
```

**Branch:** `feature/terraform-2-apis-sa`
**PR Title:** `[intentvision-terraform.2] Enable GCP APIs, Artifact Registry, and service accounts`
**Commit Example:** `infra(terraform): enable APIs and create service accounts`

---

#### intentvision-terraform.3: Cloud Run staging module

**Acceptance Criteria:**
- [ ] Cloud Run service `intentvision-api-staging` defined
- [ ] Uses image from Artifact Registry
- [ ] Environment variables: `INTENTVISION_ENV=staging`, `NODE_ENV=production`
- [ ] Secrets referenced from Secret Manager
- [ ] IAM binding for public access (unauthenticated)
- [ ] Resource limits: 512Mi memory, 1 CPU, max 10 instances

**Evidence Required:**
```bash
terraform plan -target=module.staging  # Show plan
gcloud run services describe intentvision-api-staging --region=us-central1  # After apply
```

**Branch:** `feature/terraform-3-staging`
**PR Title:** `[intentvision-terraform.3] Cloud Run staging service via Terraform`
**Commit Example:** `infra(terraform): add Cloud Run staging service module`

---

#### intentvision-terraform.4: Cloud Run prod module (disabled)

**Acceptance Criteria:**
- [ ] Cloud Run service `intentvision-api` defined
- [ ] Module has `enabled = false` by default (via variable)
- [ ] Production config: 1Gi memory, 2 CPU, min 1 instance, max 100
- [ ] Uses same service account as staging
- [ ] Ready to enable via variable flip

**Evidence Required:**
```bash
terraform plan  # Should show "0 to add" when disabled
# Document: how to enable for prod
```

**Branch:** `feature/terraform-4-prod`
**PR Title:** `[intentvision-terraform.4] Cloud Run prod module (disabled by default)`
**Commit Example:** `infra(terraform): add disabled Cloud Run prod module`

---

#### intentvision-terraform.5: Secret Manager resources

**Acceptance Criteria:**
- [ ] Secrets defined: `staging-turso-url`, `staging-turso-token`, `prod-turso-url`, `prod-turso-token`
- [ ] IAM bindings: Cloud Run SA can access secrets
- [ ] Secret values NOT in Terraform (placeholder or manual)
- [ ] Documentation for secret rotation

**Evidence Required:**
```bash
terraform plan -target=google_secret_manager_secret  # Show secrets
gcloud secrets list  # After apply
```

**Branch:** `feature/terraform-5-secrets`
**PR Title:** `[intentvision-terraform.5] Secret Manager resources for staging/prod`
**Commit Example:** `infra(terraform): add Secret Manager resources with IAM`

---

#### intentvision-terraform.6: CI drift detection

**Acceptance Criteria:**
- [ ] GitHub Actions workflow: `terraform-plan.yml`
- [ ] Runs on push to main and PRs touching `infrastructure/terraform/**`
- [ ] Read-only: `terraform plan` only, no apply
- [ ] Plan output posted to PR as comment (optional but preferred)
- [ ] Failure if drift detected

**Evidence Required:**
- Workflow YAML diff
- Sample PR with plan comment

**Branch:** `feature/terraform-6-ci`
**PR Title:** `[intentvision-terraform.6] CI job for Terraform drift detection`
**Commit Example:** `ci(terraform): add plan-only drift detection workflow`

---

## EPIC 3 (P0): Production Deploy Cutover

**Epic ID:** `intentvision-prod-cutover`
**Goal:** Enable production deploy via tag, with smoke tests and validated rollback.

**Incorporates Existing:** `intentvision-xyq.3`, `intentvision-xyq.4`, `intentvision-xyq.5`

### Child Tasks

| Child ID | Title | Owner | Blocked By |
|----------|-------|-------|------------|
| `.1` | (ops) Prod secrets creation + naming | DevOps | Epic 2.5 |
| `.2` | (ci) Verify WIF auth for prod deploy | DevOps | Epic 2.2 |
| `.3` | (ci) Audit and harden deploy-prod job | DevOps | .1, .2 |
| `.4` | (ci) Add smoke-prod job | DevOps | .3 |
| `.5` | (ops) Rollback drill + documentation | DevOps | .4 |

### Child Task Details

#### intentvision-prod-cutover.1: Prod secrets creation + naming

**Acceptance Criteria:**
- [ ] Secrets created: `prod-turso-url`, `prod-turso-token`
- [ ] Naming convention documented: `{env}-{service}-{key}`
- [ ] Values populated (manual step noted)
- [ ] Rotation policy documented

**Evidence Required:**
```bash
gcloud secrets list --filter="name:prod-"
gcloud secrets versions list prod-turso-url  # At least 1 version
```

**Branch:** `feature/prod-1-secrets`
**PR Title:** `[intentvision-prod-cutover.1] Create prod secrets with naming convention`
**Commit Example:** `ops(secrets): create prod-turso-url and prod-turso-token`

---

#### intentvision-prod-cutover.2: Verify WIF auth for prod deploy

**Acceptance Criteria:**
- [ ] WIF provider exists and is valid
- [ ] Service account has roles/run.admin for prod service
- [ ] No JSON key files anywhere in workflows
- [ ] Documentation of WIF setup for future reference

**Evidence Required:**
```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global --workload-identity-pool=github-pool
gcloud iam service-accounts get-iam-policy <SA_EMAIL>
```

**Branch:** `feature/prod-2-wif`
**PR Title:** `[intentvision-prod-cutover.2] Verify and document WIF auth for prod`
**Commit Example:** `ci(auth): verify WIF configuration for prod deployments`

---

#### intentvision-prod-cutover.3: Audit and harden deploy-prod job

**Acceptance Criteria:**
- [ ] Only triggers on tags `v*.*.*`
- [ ] Requires test job success
- [ ] Uses WIF auth (no secrets with JSON keys)
- [ ] Environment protection rules considered (manual approval?)
- [ ] Timeout and retry settings appropriate

**Evidence Required:**
- Workflow YAML diff
- Test tag deployment to verify trigger

**Branch:** `feature/prod-3-harden`
**PR Title:** `[intentvision-prod-cutover.3] Harden deploy-prod workflow`
**Commit Example:** `ci(deploy): harden prod deployment with environment protection`

---

#### intentvision-prod-cutover.4: Add smoke-prod job

**Acceptance Criteria:**
- [ ] Smoke test job runs after deploy-prod
- [ ] Tests health endpoint on prod URL
- [ ] Tests at least one API endpoint (e.g., /v1/demo/backends)
- [ ] Fails deploy if smoke fails
- [ ] Notifications on failure (optional)

**Evidence Required:**
```bash
# Smoke test output from workflow run
curl -f https://api.intentvision.io/health
```

**Branch:** `feature/prod-4-smoke`
**PR Title:** `[intentvision-prod-cutover.4] Add smoke-prod job after deployment`
**Commit Example:** `ci(smoke): add production smoke test job`

---

#### intentvision-prod-cutover.5: Rollback drill + documentation

**Acceptance Criteria:**
- [ ] Rollback procedure executed on staging (dry run)
- [ ] Time to rollback documented (target: < 5 minutes)
- [ ] Runbook 051-AT-RNBK updated with prod specifics
- [ ] Traffic split strategy documented

**Evidence Required:**
```bash
gcloud run revisions list --service=intentvision-api-staging
gcloud run services update-traffic intentvision-api-staging \
  --to-revisions=<previous>=100
# Time from command to healthy: X minutes
```

**Branch:** `feature/prod-5-rollback`
**PR Title:** `[intentvision-prod-cutover.5] Execute rollback drill and update runbook`
**Commit Example:** `ops(runbook): update rollback procedure with prod instructions`

---

## EPIC 4 (P1): Observability + Paging Baseline

**Epic ID:** `intentvision-observability`
**Goal:** See failures before customers do.

**Incorporates Existing:** `intentvision-c0s`

### Child Tasks

| Child ID | Title | Owner | Blocked By |
|----------|-------|-------|------------|
| `.1` | (api) Verify logging standards | Eng | — |
| `.2` | (ops) Create Cloud Monitoring dashboard | DevOps | Epic 3.4 |
| `.3` | (ops) Configure alert policies | DevOps | .2 |
| `.4` | (ops) Integrate Error Reporting | DevOps | Epic 3.4 |

### Child Task Details

#### intentvision-observability.1: Verify logging standards

**Acceptance Criteria:**
- [ ] All logs are structured JSON
- [ ] Request ID (correlation ID) present in all logs
- [ ] Log levels used appropriately (INFO, WARN, ERROR)
- [ ] No PII in logs
- [ ] Sample logs documented

**Evidence Required:**
```bash
# Sample log line from staging:
gcloud logging read "resource.type=cloud_run_revision" --limit=5 --format=json
```

**Branch:** `feature/obs-1-logging`
**PR Title:** `[intentvision-observability.1] Verify structured logging standards`
**Commit Example:** `ops(logging): verify JSON structured logging with correlation IDs`

---

#### intentvision-observability.2: Create Cloud Monitoring dashboard

**Acceptance Criteria:**
- [ ] Dashboard exists: "IntentVision API"
- [ ] Widgets: Request count, Latency (p50/p95/p99), Error rate (5xx), CPU, Memory
- [ ] Dashboard JSON exported to repo for reproducibility
- [ ] Link added to README/runbook

**Evidence Required:**
- Dashboard URL
- Screenshot of dashboard
- JSON export in `infrastructure/monitoring/`

**Branch:** `feature/obs-2-dashboard`
**PR Title:** `[intentvision-observability.2] Create Cloud Monitoring dashboard`
**Commit Example:** `ops(monitoring): add Cloud Monitoring dashboard with SLI widgets`

---

#### intentvision-observability.3: Configure alert policies

**Acceptance Criteria:**
- [ ] Alert: 5xx error rate > 1% for 5 minutes
- [ ] Alert: p95 latency > 3000ms for 5 minutes
- [ ] Alert: No requests for 10 minutes (availability)
- [ ] Notification channel configured (email minimum)
- [ ] Alert policies in Terraform or gcloud scripts

**Evidence Required:**
```bash
gcloud monitoring policies list
# Or Terraform plan showing alert resources
```

**Branch:** `feature/obs-3-alerts`
**PR Title:** `[intentvision-observability.3] Configure alert policies for SLOs`
**Commit Example:** `ops(alerting): add error rate and latency alert policies`

---

#### intentvision-observability.4: Integrate Error Reporting

**Acceptance Criteria:**
- [ ] Error Reporting enabled for Cloud Run
- [ ] Errors grouped and deduplicated
- [ ] Error notifications configured
- [ ] Sample error visible in Error Reporting console

**Evidence Required:**
- Error Reporting console screenshot
- Sample error group

**Branch:** `feature/obs-4-errors`
**PR Title:** `[intentvision-observability.4] Integrate Error Reporting`
**Commit Example:** `ops(errors): enable Error Reporting integration`

---

## EPIC 5 (P1): DR/Backups Policy

**Epic ID:** `intentvision-dr`
**Goal:** Daily Firestore exports + restore runbook; Turso backup posture documented.

### Child Tasks

| Child ID | Title | Owner | Blocked By |
|----------|-------|-------|------------|
| `.1` | (ops) Define RTO/RPO and document | DevOps | — |
| `.2` | (ops) Firestore scheduled exports | DevOps | .1 |
| `.3` | (ops) Firestore restore procedure test | DevOps | .2 |
| `.4` | (ops) Turso backup/restore documentation | DevOps | .1 |

### Child Task Details

#### intentvision-dr.1: Define RTO/RPO and document

**Acceptance Criteria:**
- [ ] RTO defined: 4 hours (proposed)
- [ ] RPO defined: 24 hours (proposed)
- [ ] Documented in 000-docs/ as DR policy
- [ ] Stakeholder approval noted

**Evidence Required:**
- DR policy document created
- RTO/RPO table in README or runbook

**Branch:** `feature/dr-1-policy`
**PR Title:** `[intentvision-dr.1] Define RTO/RPO policy`
**Commit Example:** `docs(dr): define RTO 4h RPO 24h policy`

---

#### intentvision-dr.2: Firestore scheduled exports

**Acceptance Criteria:**
- [ ] Cloud Scheduler job for daily exports
- [ ] Exports to GCS bucket with lifecycle rules
- [ ] Retention: 30 days (proposed)
- [ ] Export verified running

**Evidence Required:**
```bash
gcloud scheduler jobs list
gcloud firestore exports list
gsutil ls gs://intentvision-backups/
```

**Branch:** `feature/dr-2-exports`
**PR Title:** `[intentvision-dr.2] Configure Firestore scheduled exports`
**Commit Example:** `ops(backup): add daily Firestore exports to GCS`

---

#### intentvision-dr.3: Firestore restore procedure test

**Acceptance Criteria:**
- [ ] Restore procedure documented
- [ ] Restore tested on staging (or separate project)
- [ ] Time to restore documented
- [ ] Runbook updated with restore steps

**Evidence Required:**
```bash
gcloud firestore import gs://intentvision-backups/<export-path>
# Time from command to data available
```

**Branch:** `feature/dr-3-restore`
**PR Title:** `[intentvision-dr.3] Test and document Firestore restore`
**Commit Example:** `ops(backup): test Firestore restore procedure`

---

#### intentvision-dr.4: Turso backup/restore documentation

**Acceptance Criteria:**
- [ ] Turso backup capabilities documented
- [ ] Point-in-time recovery documented (if available)
- [ ] Manual backup procedure documented
- [ ] Restore procedure documented

**Evidence Required:**
- Turso backup documentation in 000-docs/ or runbook
- Evidence of backup capability from Turso dashboard

**Branch:** `feature/dr-4-turso`
**PR Title:** `[intentvision-dr.4] Document Turso backup/restore`
**Commit Example:** `docs(turso): document backup and restore procedures`

---

## EPIC 6 (P1): Load Testing Against Staging

**Epic ID:** `intentvision-loadtest`
**Goal:** Run baseline and growth profiles, capture bottlenecks, recommend tuning.

### Child Tasks

| Child ID | Title | Owner | Blocked By |
|----------|-------|-------|------------|
| `.1` | (test) Execute Baseline profile | Eng | Epic 3.4 |
| `.2` | (test) Execute Growth profile | Eng | .1 |
| `.3` | (ops) Firestore index audit | DevOps | .2 |
| `.4` | (ops) Cloud Run tuning | DevOps | .2 |

### Child Task Details

#### intentvision-loadtest.1: Execute Baseline profile

**Acceptance Criteria:**
- [ ] Baseline profile (100 orgs, 10 metrics/org) executed
- [ ] All SLOs passing (p50 < 500ms, error < 0.1%)
- [ ] Results captured and documented
- [ ] Timestamp and commit noted

**Evidence Required:**
```bash
npm run load:test:baseline --workspace=@intentvision/api
# Capture: latency histograms, error rates, duration
```

**Branch:** `feature/load-1-baseline`
**PR Title:** `[intentvision-loadtest.1] Execute baseline load test`
**Commit Example:** `test(load): execute baseline profile and capture results`

---

#### intentvision-loadtest.2: Execute Growth profile

**Acceptance Criteria:**
- [ ] Growth profile (300 orgs, 25 metrics/org) executed
- [ ] Performance degradation characterized
- [ ] Bottlenecks identified (CPU, memory, DB, external)
- [ ] Results captured and documented

**Evidence Required:**
```bash
npm run load:test:growth --workspace=@intentvision/api
# Capture: same metrics as baseline + comparison
```

**Branch:** `feature/load-2-growth`
**PR Title:** `[intentvision-loadtest.2] Execute growth load test`
**Commit Example:** `test(load): execute growth profile and identify bottlenecks`

---

#### intentvision-loadtest.3: Firestore index audit

**Acceptance Criteria:**
- [ ] Slow queries identified from load test logs
- [ ] Index recommendations generated
- [ ] Indexes created or plan documented
- [ ] Before/after query performance compared

**Evidence Required:**
```bash
firebase firestore:indexes
# Slow query logs from load test
```

**Branch:** `feature/load-3-indexes`
**PR Title:** `[intentvision-loadtest.3] Firestore index audit and optimization`
**Commit Example:** `ops(firestore): add indexes based on load test analysis`

---

#### intentvision-loadtest.4: Cloud Run tuning

**Acceptance Criteria:**
- [ ] Concurrency setting optimized based on load test
- [ ] Memory/CPU right-sized
- [ ] Min instances set appropriately for prod
- [ ] Tuning documented with rationale

**Evidence Required:**
- Before/after Cloud Run config diff
- Performance comparison

**Branch:** `feature/load-4-tuning`
**PR Title:** `[intentvision-loadtest.4] Cloud Run tuning based on load test`
**Commit Example:** `ops(cloudrun): tune concurrency and resources`

---

## EPIC 7 (P2): TimeGPT Quota Resilience

**Epic ID:** `intentvision-resilience`
**Goal:** Graceful degradation to statistical backend when TimeGPT is unavailable.

### Child Tasks

| Child ID | Title | Owner | Blocked By |
|----------|-------|-------|------------|
| `.1` | (api) Implement circuit breaker | Eng | — |
| `.2` | (api) Surface clear error modes | Eng | .1 |
| `.3` | (api) Metering for TimeGPT calls | Eng | .1 |

### Child Task Details

#### intentvision-resilience.1: Implement circuit breaker

**Acceptance Criteria:**
- [ ] Circuit breaker wraps TimeGPT calls
- [ ] Opens after N consecutive failures or timeout threshold
- [ ] Falls back to StatisticalBackend when open
- [ ] Resets after cooldown period
- [ ] Configurable thresholds

**Evidence Required:**
- Unit tests for circuit breaker behavior
- Integration test: mock TimeGPT failure → fallback

**Branch:** `feature/resilience-1-breaker`
**PR Title:** `[intentvision-resilience.1] Circuit breaker for TimeGPT with fallback`
**Commit Example:** `feat(forecast): add circuit breaker for TimeGPT with statistical fallback`

---

#### intentvision-resilience.2: Surface clear error modes

**Acceptance Criteria:**
- [ ] API response indicates which backend was used
- [ ] Degraded mode logged at WARN level
- [ ] User-facing message explains forecast source
- [ ] Metrics track fallback frequency

**Evidence Required:**
- API response sample showing backend field
- Logs showing fallback events

**Branch:** `feature/resilience-2-errors`
**PR Title:** `[intentvision-resilience.2] Surface forecast backend in responses`
**Commit Example:** `feat(api): add backend source to forecast responses`

---

#### intentvision-resilience.3: Metering for TimeGPT calls

**Acceptance Criteria:**
- [ ] TimeGPT calls counted separately from statistical
- [ ] Usage visible in admin endpoint
- [ ] Rate limiting respects TimeGPT quota
- [ ] Alerts if approaching quota

**Evidence Required:**
```bash
curl /admin/orgs/:orgId/usage/overview
# Shows: timegpt_calls, statistical_calls
```

**Branch:** `feature/resilience-3-metering`
**PR Title:** `[intentvision-resilience.3] Meter TimeGPT calls separately`
**Commit Example:** `feat(usage): track TimeGPT vs statistical backend calls`

---

## EPIC 8 (P2): Web Tests Baseline

**Epic ID:** `intentvision-webtests`
**Goal:** Prevent UI regressions with minimal smoke tests.

### Child Tasks

| Child ID | Title | Owner | Blocked By |
|----------|-------|-------|------------|
| `.1` | (test) Add test framework to packages/web | Eng | — |
| `.2` | (test) Add smoke tests (render, routes) | Eng | .1 |
| `.3` | (ci) Add web tests to CI | Eng | .2 |

### Child Task Details

#### intentvision-webtests.1: Add test framework

**Acceptance Criteria:**
- [ ] Vitest configured for packages/web
- [ ] React Testing Library installed
- [ ] At least one passing test (sanity check)
- [ ] Package.json has test script

**Evidence Required:**
```bash
npm test --workspace=@intentvision/web
# 1 test passing
```

**Branch:** `feature/web-1-framework`
**PR Title:** `[intentvision-webtests.1] Add Vitest test framework to web package`
**Commit Example:** `test(web): add Vitest and React Testing Library`

---

#### intentvision-webtests.2: Add smoke tests

**Acceptance Criteria:**
- [ ] App renders without error
- [ ] Main routes exist (/dashboard, /alerts, /settings)
- [ ] At least 5 tests
- [ ] Coverage report generated

**Evidence Required:**
```bash
npm test --workspace=@intentvision/web -- --coverage
# 5+ tests, coverage report
```

**Branch:** `feature/web-2-smoke`
**PR Title:** `[intentvision-webtests.2] Add smoke tests for render and routes`
**Commit Example:** `test(web): add smoke tests for dashboard routes`

---

#### intentvision-webtests.3: Add web tests to CI

**Acceptance Criteria:**
- [ ] CI workflow runs web tests
- [ ] Fails build if tests fail
- [ ] Coverage uploaded (optional)

**Evidence Required:**
- Workflow YAML diff
- CI run showing web test step

**Branch:** `feature/web-3-ci`
**PR Title:** `[intentvision-webtests.3] Add web tests to CI pipeline`
**Commit Example:** `ci(test): add web package tests to CI`

---

## 3. Beads Creation Commands

### 3.1 Epic Creation

```bash
# Epic 1: README
bd create "intentvision/readme: README operator-ready restructure" \
  --type epic -p 1 -l "docs,p0" \
  -d "Transform README into operator-first documentation. AC: sections restructured, status section, quickstart verified, badges added."

# Epic 2: Terraform
bd create "intentvision/terraform: Reproducible IaC infrastructure" \
  --type epic -p 1 -l "infra,terraform,p0" \
  -d "Create Terraform IaC for staging/prod Cloud Run, Secret Manager, Artifact Registry. AC: terraform plan succeeds, drift detection in CI."

# Epic 3: Prod Cutover
bd create "intentvision/prod-cutover: Enable production deployment" \
  --type epic -p 1 -l "ops,deployment,p0" \
  -d "Enable tag-based prod deploy with smoke tests and validated rollback. AC: tag deploys to prod, smoke passes, rollback < 5min."

# Epic 4: Observability
bd create "intentvision/observability: Monitoring and alerting baseline" \
  --type epic -p 2 -l "ops,monitoring,p1" \
  -d "Create dashboards, alerts, error reporting. AC: dashboard exists, 3 alert policies, error reporting integrated."

# Epic 5: DR
bd create "intentvision/dr: Disaster recovery and backups" \
  --type epic -p 2 -l "ops,backup,p1" \
  -d "RTO/RPO defined, Firestore exports, Turso backup documented. AC: daily exports, restore tested, policy documented."

# Epic 6: Load Testing
bd create "intentvision/loadtest: Load testing and tuning" \
  --type epic -p 2 -l "test,performance,p1" \
  -d "Execute load profiles, identify bottlenecks, tune Cloud Run. AC: baseline/growth executed, indexes optimized, tuning applied."

# Epic 7: Resilience
bd create "intentvision/resilience: TimeGPT circuit breaker" \
  --type epic -p 3 -l "api,resilience,p2" \
  -d "Graceful fallback to statistical backend. AC: circuit breaker, error modes, metering."

# Epic 8: Web Tests
bd create "intentvision/webtests: Web package test coverage" \
  --type epic -p 3 -l "test,web,p2" \
  -d "Add test framework and smoke tests. AC: Vitest, 5+ tests, CI integration."
```

### 3.2 Child Task Creation (Example for Epic 1)

```bash
# After creating epic, get its ID (e.g., intentvision-abc)
# Then create children:

bd create "(docs) Restructure README sections" \
  --type task -p 1 --parent intentvision-abc \
  -d "AC: 8 sections present (What/Who/Arch/Start/Env/Sec/Ops/Road), ASCII diagram, no dead links. Evidence: git diff README.md"

bd create "(docs) Add Current Status section" \
  --type task -p 1 --parent intentvision-abc \
  -d "AC: staging/prod status explicit, version badge, last updated. Evidence: README section screenshot."

# ... continue for all children
```

### 3.3 Link Existing Tasks

```bash
# Link existing tasks to new epics
bd update intentvision-91n.6 --parent intentvision-terraform  # Link to Terraform epic
bd update intentvision-c0s --parent intentvision-observability  # Link to Observability epic
bd update intentvision-xyq.3 --parent intentvision-prod-cutover  # Link Turso task
bd update intentvision-xyq.4 --parent intentvision-prod-cutover  # Link secrets task
bd update intentvision-xyq.5 --parent intentvision-prod-cutover  # Link deploy task
```

---

## 4. Dependency Map

```
EPIC 1: README (P0)
└── No blockers, start immediately

EPIC 2: Terraform (P0)
├── .1 Skeleton → No blockers
├── .2 APIs/SA → Blocks on .1
├── .3 Staging → Blocks on .2
├── .4 Prod → Blocks on .3
├── .5 Secrets → Blocks on .2
└── .6 CI drift → Blocks on .3

EPIC 3: Prod Cutover (P0)
├── .1 Secrets → Blocks on Epic 2.5
├── .2 WIF → Blocks on Epic 2.2
├── .3 Harden deploy → Blocks on .1, .2
├── .4 Smoke prod → Blocks on .3
└── .5 Rollback drill → Blocks on .4

EPIC 4: Observability (P1)
├── .1 Logging → No blockers
├── .2 Dashboard → Blocks on Epic 3.4
├── .3 Alerts → Blocks on .2
└── .4 Errors → Blocks on Epic 3.4

EPIC 5: DR (P1)
├── .1 Policy → No blockers
├── .2 Exports → Blocks on .1
├── .3 Restore → Blocks on .2
└── .4 Turso → Blocks on .1

EPIC 6: Load Testing (P1)
├── .1 Baseline → Blocks on Epic 3.4
├── .2 Growth → Blocks on .1
├── .3 Indexes → Blocks on .2
└── .4 Tuning → Blocks on .2

EPIC 7: Resilience (P2)
├── .1 Breaker → No blockers
├── .2 Errors → Blocks on .1
└── .3 Metering → Blocks on .1

EPIC 8: Web Tests (P2)
├── .1 Framework → No blockers
├── .2 Smoke → Blocks on .1
└── .3 CI → Blocks on .2
```

---

## 5. Branch/Commit/PR Standards

### 5.1 Naming Conventions

| Element | Pattern | Example |
|---------|---------|---------|
| Epic Title | `intentvision/<area>: <outcome>` | `intentvision/terraform: Reproducible IaC` |
| Child Title | `(<area>) <verb> <object>` | `(infra) Add Cloud Run staging module` |
| Branch | `feature/<bead-id>-<kebab>` | `feature/intentvision-abc.3-staging-module` |
| PR Title | `[<bead-id>] <concise outcome>` | `[intentvision-abc.3] Cloud Run staging via Terraform` |
| Commit | Conventional commits | `infra(terraform): add Cloud Run staging service` |

### 5.2 Commit Prefixes

| Prefix | Use For |
|--------|---------|
| `docs(readme):` | README changes |
| `docs(runbook):` | Runbook updates |
| `infra(terraform):` | Terraform changes |
| `ci(deploy):` | Deployment workflow changes |
| `ci(test):` | Test workflow changes |
| `ops(monitoring):` | Observability changes |
| `ops(backup):` | Backup/DR changes |
| `feat(api):` | API features |
| `feat(forecast):` | Forecasting features |
| `test(web):` | Web package tests |
| `test(load):` | Load testing |

---

## 6. PR Description Template

```markdown
## Summary

<1-2 sentences describing what this PR does>

## Beads

- **Epic:** `<epic-id>` — <epic title>
- **Task(s):** `<child-id>` — <child title>

## Changes

- <bullet list of changes>

## How to Verify

```bash
# Step 1: <description>
<command>

# Step 2: <description>
<command>
```

## Evidence

<screenshots, log snippets, URLs, or command outputs>

## Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| <risk> | <mitigation> |

## Rollback Plan

1. <step>
2. <step>

## AAR

After merge, create: `000-docs/<NNN>-AA-AACR-<short-description>.md`

---

## Checklist

- [ ] Tests pass locally
- [ ] CI is green
- [ ] ARV gate passes (if applicable)
- [ ] Bead status updated
```

---

## 7. AAR Template

**Location:** `000-docs/NNN-AA-AACR-<short-kebab>.md`

**Next available number:** 065

```markdown
# After Action Report: <Short Title>

**Document ID:** NNN-AA-AACR-<short-kebab>
**Phase/Epic:** <epic-id>
**Repo:** intent-solutions-io/intent-vision
**Date/Time (CST):** YYYY-MM-DD HH:MM CST
**Status:** FINAL
**PR:** #<number>
**Commit(s):** <hash>

---

## Beads / Task IDs

| Task ID | Status | Title |
|---------|--------|-------|
| `<id>` | `completed` | <title> |

---

## What Shipped

- <bullet list>

---

## Why

<rationale>

---

## Validation

```bash
# Commands run to verify
<command>
```

**Results:**
- Tests: PASS
- TypeCheck: PASS
- ARV Gate: PASS
- Terraform Plan: N/A or <status>

---

## Ops Notes

- <deployment notes, config changes>

---

## Risks Discovered + Follow-ups

| Risk | Follow-up |
|------|-----------|
| <risk> | <bead ID or action> |

---

## Rollback Notes

<how to revert if needed>

---

## Evidence Bundle

| Type | Link/Path |
|------|-----------|
| PR | #<number> |
| Commit | <hash> |
| Logs | <path or N/A> |
| Dashboard | <URL or N/A> |

---

*intent solutions io — confidential IP*
```

---

## 8. Order of Operations

### Phase 1: P0 Epics (Week 1-2)

```
Day 1-2:
├── Epic 1.1: Restructure README (start immediately)
├── Epic 2.1: Terraform skeleton (parallel)
└── Epic 2.2: APIs/SA (after 2.1)

Day 3-4:
├── Epic 1.2-1.3: README status + dev quickstart
├── Epic 2.3: Cloud Run staging
└── Epic 2.5: Secret Manager

Day 5-6:
├── Epic 1.4-1.5: README ops + badges
├── Epic 2.4: Cloud Run prod module
├── Epic 2.6: CI drift detection
└── Epic 3.1: Prod secrets

Day 7-8:
├── Epic 3.2-3.3: WIF verify + harden deploy
└── Epic 3.4: Smoke prod job

Day 9-10:
├── Epic 3.5: Rollback drill
└── P0 AARs finalized
```

### Phase 2: P1 Epics (Week 3-4)

```
Week 3:
├── Epic 4: Observability (all tasks)
├── Epic 5.1-5.2: DR policy + exports
└── Epic 6.1: Load test baseline

Week 4:
├── Epic 5.3-5.4: Restore test + Turso docs
├── Epic 6.2-6.4: Growth + indexes + tuning
└── P1 AARs finalized
```

### Phase 3: P2 Epics (Week 5+)

```
Week 5:
├── Epic 7: Resilience (all tasks)
└── Epic 8: Web tests (all tasks)
```

---

## 9. Definition of Done (Initiative)

### Required for "Production Ready" Declaration

- [ ] **Prod deploy enabled** — Tag-based deployment works, smoke passes
- [ ] **Terraform reproducible** — `terraform apply` creates identical infra
- [ ] **Monitoring exists** — Dashboard + 3 alert policies active
- [ ] **DR configured** — Daily Firestore exports, restore tested
- [ ] **Load test executed** — Baseline AAR with evidence
- [ ] **README reflects truth** — Current status, quickstarts verified
- [ ] **All P0 AARs complete** — Documented in 000-docs/

### Metrics

| Metric | Target | Verification |
|--------|--------|--------------|
| Prod health check | 200 OK | `curl /health` |
| Rollback time | < 5 min | Documented in AAR |
| Alert latency | < 5 min | Test alert received |
| Test coverage | 381+ tests | `npm test` |
| Docs count | 65+ | `ls 000-docs/*.md | wc -l` |

---

## 10. Example: Fully Specified Child Tasks

### Example 1: README Task (Epic 1.3)

**Bead ID:** `intentvision-readme.3`
**Title:** (docs) Verify developer quickstart
**Owner:** Engineering
**Priority:** P0

**Acceptance Criteria:**
- [ ] `npm ci` works from clean clone
- [ ] `npm test` passes (381 tests)
- [ ] `npm run dev` starts server at localhost:3000
- [ ] `.env.example` is complete with all required variables
- [ ] All commands verified on fresh environment (or CI)

**Evidence Required:**
```bash
git clone git@github.com:intent-solutions-io/intent-vision.git /tmp/iv-test
cd /tmp/iv-test
npm ci
npm test          # Expect: 381 tests passing
npm run dev &     # Expect: Server at localhost:3000
curl http://localhost:3000/health  # Expect: {"status":"healthy"}
```

**Branch:** `feature/intentvision-readme.3-dev-quickstart`

**PR Title:** `[intentvision-readme.3] Verify and update developer quickstart`

**Commit Examples:**
```
docs(readme): verify npm ci on fresh clone
docs(readme): update .env.example with missing vars
docs(readme): add verified quickstart steps
```

**AAR After Merge:** `065-AA-AACR-readme-dev-quickstart.md`

---

### Example 2: Terraform Task (Epic 2.3)

**Bead ID:** `intentvision-terraform.3`
**Title:** (infra) Cloud Run staging module
**Owner:** DevOps
**Priority:** P0
**Blocked By:** `intentvision-terraform.2`

**Acceptance Criteria:**
- [ ] Cloud Run service `intentvision-api-staging` defined in Terraform
- [ ] Uses image from Artifact Registry (variable)
- [ ] Environment: `INTENTVISION_ENV=staging`, `NODE_ENV=production`
- [ ] Secrets referenced from Secret Manager
- [ ] Public access (unauthenticated)
- [ ] Resources: 512Mi memory, 1 CPU, max 10 instances
- [ ] `terraform plan` shows correct resource creation

**Evidence Required:**
```bash
cd infrastructure/terraform
terraform plan -target=module.cloud_run_staging

# Expected output:
# + google_cloud_run_service.staging
#   name = "intentvision-api-staging"
#   location = "us-central1"
#   ...

# After apply:
gcloud run services describe intentvision-api-staging \
  --region=us-central1 --format="yaml(status.url)"
```

**Branch:** `feature/intentvision-terraform.3-staging-cloudrun`

**PR Title:** `[intentvision-terraform.3] Cloud Run staging service via Terraform`

**Commit Examples:**
```
infra(terraform): add Cloud Run staging module
infra(terraform): configure staging env vars and secrets
infra(terraform): set staging resource limits
```

**Rollback Strategy:**
```bash
# If deployment fails:
terraform destroy -target=module.cloud_run_staging
# Restore previous CI/CD manual deployment
```

**AAR After Merge:** `066-AA-AACR-terraform-staging-cloudrun.md`

---

## 11. Example PR Descriptions

### Example PR: Documentation (Epic 1.3)

```markdown
## Summary

Verify and update developer quickstart in README to ensure new engineers can set up local dev environment successfully.

## Beads

- **Epic:** `intentvision-readme` — README operator-ready restructure
- **Task(s):** `intentvision-readme.3` — (docs) Verify developer quickstart

## Changes

- Updated quickstart commands with correct order
- Added missing `GCP_PROJECT_ID` to .env.example
- Added health check verification step
- Clarified Node.js version requirement (20+)

## How to Verify

```bash
# Fresh clone test
git clone git@github.com:intent-solutions-io/intent-vision.git /tmp/iv-verify
cd /tmp/iv-verify
cp .env.example .env
npm ci
npm test                    # Expect: 381 tests
npm run dev &
sleep 3
curl http://localhost:3000/health  # Expect: {"status":"healthy"}
```

## Evidence

Terminal output:
```
> intentvision@0.1.0 test
> ...
Test Files  9 passed (9)
Tests  381 passed (381)
```

## Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| .env changes break existing setups | Documented in CHANGELOG |

## Rollback Plan

1. Revert commit: `git revert <hash>`
2. Push to main

## AAR

After merge, create: `000-docs/065-AA-AACR-readme-dev-quickstart.md`

---

## Checklist

- [x] Tests pass locally
- [x] CI is green
- [x] ARV gate passes
- [x] Bead status updated to in_progress
```

---

### Example PR: Infrastructure (Epic 2.3)

```markdown
## Summary

Add Terraform module for Cloud Run staging service, enabling reproducible infrastructure for the staging environment.

## Beads

- **Epic:** `intentvision-terraform` — Reproducible IaC infrastructure
- **Task(s):** `intentvision-terraform.3` — (infra) Cloud Run staging module

## Changes

- Created `infrastructure/terraform/modules/cloud_run/` module
- Added `staging.tf` with Cloud Run service definition
- Configured Secret Manager references for Turso credentials
- Added outputs for service URL

## How to Verify

```bash
cd infrastructure/terraform
terraform init
terraform plan -target=module.cloud_run_staging

# Verify plan shows:
# + google_cloud_run_service.staging
# + google_cloud_run_service_iam_member.staging_public
```

## Evidence

Terraform plan output:
```
Plan: 2 to add, 0 to change, 0 to destroy.

Changes to Outputs:
  + staging_url = "https://intentvision-api-staging-xxx.run.app"
```

## Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| Terraform state conflict | Using GCS remote state with locking |
| Secret values not in TF | Using data sources for existing secrets |

## Rollback Plan

1. `terraform destroy -target=module.cloud_run_staging`
2. Revert workflow to use manual gcloud deploy
3. Restore previous CI/CD flow

## AAR

After merge, create: `000-docs/066-AA-AACR-terraform-staging-cloudrun.md`

---

## Checklist

- [x] Tests pass locally
- [x] CI is green (terraform validate)
- [x] Terraform plan reviewed
- [x] No secrets in code
- [x] Bead status updated to in_progress
```

---

## 12. Blockers / Required Inputs

| Blocker | Default/Assumption | Action Needed |
|---------|-------------------|---------------|
| GCP Project ID | `intentvision` (from ci.yml) | Confirm or update |
| GCP Region | `us-central1` | Confirm |
| WIF Pool/Provider | Exists (from ci.yml) | Verify in GCP console |
| Artifact Registry | `us-central1-docker.pkg.dev/intentvision/intentvision` | Confirm or create |
| Turso credentials | Exist in Secret Manager | Verify |
| Firestore project | `intentvision-dev/staging/prod` | Confirm Firebase projects |

---

## 13. Next Steps (After Plan Approval)

1. **Switch to main branch** (or create feature branch from main)
2. **Create epics in Beads** using commands in Section 3.1
3. **Create child tasks** using commands in Section 3.2
4. **Link existing tasks** using commands in Section 3.3
5. **Begin Epic 1.1** (README restructure) — no blockers
6. **Begin Epic 2.1** (Terraform skeleton) — parallel track
7. **Follow dependency map** for subsequent tasks
8. **Create AAR after each PR merge**

---

*Plan generated: 2026-01-31 00:15 CST*
*Awaiting approval to execute*

---

**END OF PLAN**
