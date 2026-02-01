# ADR: IntentVision Deployment Foundation Decisions

**Document ID**: 055-DR-ADRC-deployment-foundation-decisions
**Phase**: F (Cloud Deployment)
**Date**: 2025-12-16
**Status**: Accepted
**Deciders**: Engineering Team
**Beads Epic**: intentvision-xyq

---

## Context

This ADR documents foundational deployment decisions for IntentVision, answering critical infrastructure questions (Q9-Q14 from status audit) to unblock Phase F deployment.

## Decisions Summary

| Question | Decision |
|----------|----------|
| Q9: GCP Project | Single project: `intentvision` |
| Q10: Region | `us-central1` |
| Q11: Primary Database | Turso/libSQL only |
| Q12: Domains | `intentvision.intent-solutions.io` (prod), `stg.intentvision.intent-solutions.io` (staging) |
| Q13: CI/CD | GitHub Actions with Workload Identity Federation |
| Q14: Secrets | GCP Secret Manager |

---

## Q9: GCP Project Structure

**Decision**: Single GCP project named `intentvision`

**Rationale**:
- Simplifies IAM and billing management
- Environment isolation via Cloud Run service naming (not separate projects)
- Reduces operational overhead for MVP/alpha phase
- Turso handles database isolation externally

**Structure**:
```
GCP Project: intentvision (us-central1)
├── Cloud Run Services
│   ├── intentvision-api-staging
│   └── intentvision-api (production)
├── Secret Manager
│   ├── staging-turso-url
│   ├── staging-turso-token
│   ├── prod-turso-url
│   └── prod-turso-token
├── Artifact Registry
│   └── intentvision/api (Docker images)
└── Cloud Logging (all environments)
```

---

## Q10: Region Selection

**Decision**: `us-central1`

**Rationale**:
- Lowest latency to Turso primary region
- Central US provides balanced latency across US customers
- Good Cloud Run capacity and pricing
- Supports all required GCP services

---

## Q11: Primary Database

**Decision**: Turso/libSQL is the ONLY primary database

**Clarifications**:
- **No Firestore**: Not used for production data
- **No BigQuery**: Not required for MVP
- **Turso Databases**:
  - `intentvision-staging` - Staging environment
  - `intentvision-prod` - Production environment

**Internal Tools Exception**:
- AgentFS and Beads use local SQLite (`.agentfs/`, `.beads/`)
- These are git-ignored and NOT deployed to cloud

**Data Model**:
```
Turso (intentvision-prod)
├── organizations
├── users
├── api_keys
├── metrics
├── forecasts
├── alert_rules
├── alert_events
└── usage_records
```

---

## Q12: Domain Configuration

**Decision**: Custom domains under `intent-solutions.io`

| Environment | Domain | Cloud Run Service |
|-------------|--------|-------------------|
| Production | `intentvision.intent-solutions.io` | `intentvision-api` |
| Staging | `stg.intentvision.intent-solutions.io` | `intentvision-api-staging` |

**DNS Configuration** (Cloud DNS or external):
```
intentvision.intent-solutions.io     CNAME ghs.googlehosted.com
stg.intentvision.intent-solutions.io CNAME ghs.googlehosted.com
```

**SSL**: Managed by Cloud Run (automatic provisioning)

---

## Q13: CI/CD Pipeline

**Decision**: GitHub Actions with Workload Identity Federation (WIF)

**Workflow**:
```
Push to main branch
    ↓
Test Job (npm test, typecheck)
    ↓
Build Job (Docker image)
    ↓
Deploy Staging (intentvision-api-staging)
    ↓
Smoke Tests (staging)
    ↓
[Tag v*.*.* only] → Deploy Production
```

**WIF Configuration**:
```
Project: intentvision
Pool: github-pool
Provider: github-provider
Service Account: github-deployer@intentvision.iam.gserviceaccount.com
```

**Required GitHub Secrets**:
| Secret | Purpose |
|--------|---------|
| `GCP_WIF_PROVIDER` | WIF provider resource name |
| `GCP_SA_EMAIL` | Service account email |
| `GCP_PROJECT_ID` | `intentvision` |

---

## Q14: Secrets Management

**Decision**: GCP Secret Manager with environment prefixes

**Secret Naming Convention**:
```
{env}-{service}-{key}

Examples:
- staging-turso-url
- staging-turso-token
- prod-turso-url
- prod-turso-token
- staging-resend-api-key
- prod-resend-api-key
```

**Access Pattern**:
- Cloud Run services mount secrets as environment variables
- WIF service account has `secretmanager.secretAccessor` role

---

## Agent Surfaces Constraint

**CRITICAL CONSTRAINT**: All agents must be Vertex AI Agent Engine

**Rule**: IntentVision does NOT run in-process LLM agents in Cloud Run. Cloud Run is a stateless API gateway only.

**Pattern**: Follow `bobs-brain` ARV + CI/CD architecture:
- Agents deployed to Vertex AI Agent Engine
- Cloud Run calls agents via Vertex AI API
- Agent state managed by Vertex AI (not in Cloud Run memory)

**Rationale**:
- Eliminates cold start issues for LLM calls
- Proper agent lifecycle management
- Scales agent infrastructure independently
- Follows Google Cloud best practices

**Affected Components**:
- `packages/agent/` - Agent definitions for Vertex AI deployment
- Cloud Run - Gateway only, no agent runtime

---

## Environment Variables

### Cloud Run - Staging

| Variable | Source |
|----------|--------|
| `NODE_ENV` | `staging` |
| `INTENTVISION_ENV` | `staging` |
| `INTENTVISION_DB_URL` | Secret: `staging-turso-url` |
| `INTENTVISION_DB_AUTH_TOKEN` | Secret: `staging-turso-token` |
| `RESEND_API_KEY` | Secret: `staging-resend-api-key` |

### Cloud Run - Production

| Variable | Source |
|----------|--------|
| `NODE_ENV` | `production` |
| `INTENTVISION_ENV` | `production` |
| `INTENTVISION_DB_URL` | Secret: `prod-turso-url` |
| `INTENTVISION_DB_AUTH_TOKEN` | Secret: `prod-turso-token` |
| `RESEND_API_KEY` | Secret: `prod-resend-api-key` |

---

## Beads Task References

| Task ID | Description | Status |
|---------|-------------|--------|
| `intentvision-xyq` | Phase F: Cloud Deployment (Epic) | In Progress |
| `intentvision-xyq.1` | F.1 Create optimized Dockerfile | Pending |
| `intentvision-xyq.2` | F.2 Configure Cloud Run service | Pending |
| `intentvision-xyq.3` | F.3 Set up Turso Cloud database | Pending |
| `intentvision-xyq.4` | F.4 Configure secrets in Secret Manager | Pending |
| `intentvision-xyq.5` | F.5 Deploy to Cloud Run | Pending |

---

## Consequences

### Positive
- Single project simplifies management
- Turso-only eliminates Firestore cost and complexity
- WIF eliminates service account key management
- Clear environment isolation via naming conventions

### Negative
- Single project means shared quotas
- Turso external dependency for database
- No Firestore real-time features available

### Risks
- Turso availability impacts all environments (mitigated by Turso SLA)
- WIF setup complexity (one-time configuration)

---

## Implementation Checklist

- [ ] GCP project `intentvision` created
- [ ] Cloud Run API enabled
- [ ] Artifact Registry repository created
- [ ] WIF pool and provider configured
- [ ] Service account created with correct roles
- [ ] Turso databases provisioned (staging + prod)
- [ ] Secrets created in Secret Manager
- [ ] DNS records configured
- [ ] GitHub secrets configured

---

*Architecture Decision Record - Phase F Deployment Foundation*
*intent solutions io - confidential IP*
