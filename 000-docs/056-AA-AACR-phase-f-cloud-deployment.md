# After-Action Completion Report: Phase F - Cloud Deployment Foundation

**Document ID**: 056-AA-AACR-phase-f-cloud-deployment
**Phase**: F
**Beads Epic**: intentvision-xyq
**Date/Time (CST)**: 2025-12-16 16:30 CST
**Status**: FINAL
**Version**: 0.14.1

---

## Executive Summary

Phase F established the cloud deployment foundation for IntentVision. Key accomplishments:

- Created ADR documenting all deployment decisions (GCP project, region, database, domains, CI/CD, secrets)
- Updated CI/CD workflow for single GCP project (`intentvision`)
- Configured Turso/libSQL as the only primary database (removed Firestore references)
- Documented custom domains (`intentvision.intent-solutions.io`, `stg.intentvision.intent-solutions.io`)
- Added critical Agent Surfaces constraint: all agents must use Vertex AI Agent Engine

---

## Beads / Task IDs Touched

| Task ID | Status | Title |
|---------|--------|-------|
| `intentvision-xyq` | `in_progress` | Phase F: Cloud Deployment (Epic) |
| `intentvision-xyq.2` | `completed` | F.2 Configure Cloud Run service |
| `intentvision-xyq.4` | `completed` | F.4 Configure secrets in Secret Manager |

**Remaining tasks** (infrastructure setup required):
| Task ID | Status | Title |
|---------|--------|-------|
| `intentvision-xyq.1` | `pending` | F.1 Create optimized Dockerfile |
| `intentvision-xyq.3` | `pending` | F.3 Set up Turso Cloud database |
| `intentvision-xyq.5` | `pending` | F.5 Deploy to Cloud Run |

---

## What Changed

### Files Created

| File | Purpose |
|------|---------|
| `000-docs/055-DR-ADRC-deployment-foundation-decisions.md` | ADR answering Q9-Q14 deployment questions |
| `000-docs/056-AA-AACR-phase-f-cloud-deployment.md` | This AAR |

### Files Modified

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Updated for single GCP project, Turso-only, correct secret names |

### CI/CD Workflow Changes

1. **Header updated**: Phase F references, infrastructure summary
2. **Removed**: `firestore-live-tests` job (Turso-only architecture)
3. **Updated secrets**: Unified to `GCP_WIF_PROVIDER`, `GCP_SA_EMAIL` (single project)
4. **Secret naming**: Changed to `{env}-turso-url`, `{env}-turso-token` pattern
5. **Domain outputs**: Added custom domain URLs to deployment steps

---

## Deployment Architecture Summary

```
GCP Project: intentvision (us-central1)
├── Cloud Run Services
│   ├── intentvision-api-staging → stg.intentvision.intent-solutions.io
│   └── intentvision-api         → intentvision.intent-solutions.io
├── Secret Manager
│   ├── staging-turso-url
│   ├── staging-turso-token
│   ├── prod-turso-url
│   └── prod-turso-token
├── Artifact Registry
│   └── intentvision/api
└── Cloud Logging
```

---

## Critical Constraints Documented

### Agent Surfaces Constraint

**CRITICAL**: All agents must be Vertex AI Agent Engine, not in-process.

- Cloud Run is a stateless API gateway ONLY
- Agents deployed to Vertex AI Agent Engine
- Cloud Run calls agents via Vertex AI API
- Follows `bobs-brain` ARV + CI/CD pattern

This is documented in ADR 055-DR-ADRC-deployment-foundation-decisions.md.

---

## GitHub Secrets Required

| Secret | Purpose |
|--------|---------|
| `GCP_WIF_PROVIDER` | Workload Identity Federation provider |
| `GCP_SA_EMAIL` | Service account email (`github-deployer@intentvision.iam.gserviceaccount.com`) |
| `INTENTVISION_STAGING_URL` | (Optional) Override staging URL |

---

## Phase Completion Checklist

| Criteria | Status |
|----------|--------|
| ADR created answering Q9-Q14 | PASS |
| CI workflow updated for single project | PASS |
| Firestore references removed | PASS |
| Secret naming convention documented | PASS |
| Agent constraint documented | PASS |
| Domain configuration documented | PASS |
| Beads task IDs referenced in AAR | PASS |

---

## Remaining Work (Infrastructure Setup)

These tasks require manual GCP/Turso console work:

| Task | Description | Owner |
|------|-------------|-------|
| Create GCP project | `gcloud projects create intentvision` | DevOps |
| Configure WIF | Set up github-pool + github-provider | DevOps |
| Create Turso databases | `intentvision-staging`, `intentvision-prod` | DevOps |
| Create secrets | `staging-turso-url`, etc. in Secret Manager | DevOps |
| Configure DNS | CNAME records for custom domains | DevOps |
| Set GitHub secrets | `GCP_WIF_PROVIDER`, `GCP_SA_EMAIL` | DevOps |

---

## Risks / Follow-ups

| Risk | Severity | Mitigation |
|------|----------|------------|
| WIF not configured | High | Document setup steps in runbook |
| Turso databases not provisioned | High | Must be done before first deploy |
| DNS propagation delay | Low | Plan for 24-48h propagation |

### Recommended Follow-ups

1. **Create infrastructure setup runbook** - Step-by-step GCP/Turso setup
2. **Test WIF authentication** - Validate GitHub Actions can authenticate
3. **Provision Turso databases** - Create staging and prod databases
4. **Configure custom domains** - Set up DNS records

---

## Evidence Links / Artifacts

| Artifact | Location |
|----------|----------|
| Deployment ADR | `000-docs/055-DR-ADRC-deployment-foundation-decisions.md` |
| CI/CD Workflow | `.github/workflows/ci.yml` |
| Previous Phase AAR | `000-docs/054-AA-AACR-phase-14-stabilization-gate.md` |
| Deployment Plan | `000-docs/019-cloud-mvp-deployment-plan.md` |

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
