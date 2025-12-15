# IntentVision Cloud Implementation Plan

**Purpose:** Design document for GCP/Firebase deployment with GitHub-based CI/CD, aligned with "bobs-brain" posture.
**Version:** 1.0.0
**Last Updated:** 2025-12-15
**Status:** DRAFT (Phase 0 — No resources deployed)

---

## Executive Summary

IntentVision is a Universal Prediction Engine that connects data sources, normalizes metrics, runs forecasts/anomaly detection, and delivers insights via alerts, APIs, dashboards, and agents.

This document defines the cloud architecture and deployment strategy, emphasizing:
- **Reproducible infrastructure** via Terraform
- **Tight CI/CD gates** (ARV-style checks)
- **Minimal manual steps** (GitOps-first)
- **Observable, auditable operations**

---

## 1. Environment Strategy

### 1.1 Environment Definitions

| Environment | Purpose | GCP Project Suffix | Branch |
|-------------|---------|-------------------|--------|
| `dev` | Development, feature testing | `-dev` | `main`, feature branches |
| `staging` | Pre-production validation | `-staging` | `main` (promoted) |
| `prod` | Production workloads | `-prod` | Release tags |

### 1.2 Project Naming Convention

```
intentvision-<env>
```

Examples:
- `intentvision-dev`
- `intentvision-staging`
- `intentvision-prod`

### 1.3 Isolation Strategy

| Isolation Layer | Implementation |
|-----------------|----------------|
| Network | Separate VPCs per environment |
| IAM | No cross-environment service accounts |
| Data | Separate Firestore/BigQuery datasets |
| Secrets | Environment-scoped Secret Manager secrets |
| Domains | `dev.intentvision.io`, `staging.intentvision.io`, `intentvision.io` |

---

## 2. GCP Services Architecture

### 2.1 Core Compute: Cloud Run

**Purpose:** Serverless container hosting for all API services.

```
Cloud Run Services:
├── intentvision-api          # Main API gateway
├── intentvision-forecast     # Forecast engine (pluggable backend)
├── intentvision-ingest       # Data ingestion workers
├── intentvision-alerting     # Alert processing and routing
└── intentvision-agent        # Agent interaction service
```

**Configuration:**
- Min instances: 0 (dev), 1 (staging/prod)
- Max instances: 10 (dev), 100 (prod)
- CPU: 1-4 vCPU based on service
- Memory: 512MB-4GB based on service
- Concurrency: 80-250 based on service
- Timeout: 60s API, 300s workers

### 2.2 Data Layer: BigQuery

**Purpose:** Analytics data warehouse for metrics storage and querying.

```
BigQuery Datasets:
├── intentvision_metrics      # Raw and normalized metrics
├── intentvision_forecasts    # Forecast results and history
├── intentvision_audit        # Audit trails and compliance
└── intentvision_analytics    # Aggregated analytics
```

**Data Partitioning:**
- Time-based partitioning on `ingested_at` or `metric_timestamp`
- Clustering on `source_id`, `metric_type`
- Retention: 7 years (configurable per table)

### 2.3 Messaging: Pub/Sub

**Purpose:** Async event-driven communication between services.

```
Pub/Sub Topics:
├── metric-ingested          # New metrics ready for processing
├── forecast-requested       # Forecast job requests
├── forecast-completed       # Forecast results ready
├── anomaly-detected         # Anomaly detection events
├── alert-triggered          # Alerts to be routed
└── agent-task               # Agent task queue
```

**Subscriptions:**
- Push to Cloud Run for real-time processing
- Pull for batch workers
- Dead letter topics for failed messages

### 2.4 Secrets: Secret Manager

**Purpose:** Secure storage for API keys, credentials, and config.

```
Secrets:
├── forecast-api-key-<provider>  # Nixtla, Vertex AI, etc.
├── webhook-signing-key          # Alert webhook HMAC
├── database-credentials         # If using external DBs
├── oauth-client-secrets         # OAuth provider secrets
└── agent-api-keys               # External agent integrations
```

**Access Pattern:**
- Services access via Workload Identity
- No secrets in environment variables
- Automatic rotation policy: 90 days

### 2.5 Scheduling: Cloud Scheduler

**Purpose:** Cron-based job scheduling for periodic tasks.

```
Scheduled Jobs:
├── metric-collection-hourly    # Pull metrics from sources
├── forecast-refresh-daily      # Re-run forecasts
├── anomaly-scan-hourly         # Anomaly detection pass
├── data-retention-weekly       # Cleanup old data
└── health-check-5min           # Service health monitoring
```

**Implementation:**
- Scheduler invokes Pub/Sub or HTTP endpoints
- Idempotent handlers (safe to retry)
- Logging via Cloud Logging

### 2.6 AI/ML: Vertex AI (Optional)

**Purpose:** Alternative forecast backend, ML model hosting.

```
Vertex AI Components:
├── Model Registry              # Forecast model versions
├── Endpoints                   # Online prediction serving
├── Pipelines                   # Training/retraining workflows
└── Feature Store (optional)    # Feature management
```

**Design Note:** Forecast backend is pluggable. Vertex AI is ONE option alongside:
- Nixtla (TimeGPT, StatsForecast)
- Classical models (Prophet, ARIMA)
- Custom models

### 2.7 Observability Stack

#### Cloud Logging
- Structured JSON logs from all services
- Log-based metrics for alerting
- 30-day retention (default), 365-day for audit

#### Cloud Monitoring
- Custom dashboards per service
- Uptime checks for external endpoints
- Alert policies for SLO violations

#### Cloud Trace
- Distributed tracing across services
- Trace correlation IDs in all requests
- Sampling: 100% dev, 10% staging, 1% prod

---

## 3. Firebase Services

### 3.1 Firebase Hosting

**Purpose:** Static asset hosting, CDN, custom domains.

```
Hosting Sites:
├── intentvision-app          # Main dashboard SPA
├── intentvision-docs         # Documentation site
└── intentvision-status       # Status page
```

**Configuration:**
- CDN enabled globally
- Automatic SSL certificates
- Custom domain: `app.intentvision.io`

### 3.2 Firebase Authentication

**Purpose:** User identity and access management.

```
Auth Providers:
├── Email/Password            # Default provider
├── Google                    # OAuth provider
├── GitHub                    # OAuth provider (optional)
└── SAML/OIDC                 # Enterprise SSO (future)
```

**Token Strategy:**
- Firebase ID tokens for frontend
- Service account tokens for service-to-service
- Custom claims for role-based access

### 3.3 Firestore

**Purpose:** Real-time data for user-facing features.

```
Collections:
├── users/                    # User profiles and preferences
├── organizations/            # Multi-tenant org data
├── dashboards/               # Saved dashboard configs
├── alerts/                   # User alert configurations
└── sessions/                 # Active user sessions
```

**Usage Boundaries:**
- User-facing real-time data: Firestore
- Analytics and metrics: BigQuery
- Never store raw metrics in Firestore

---

## 4. Authentication & Authorization Model

### 4.1 Multi-Tenancy Structure

```
Tenant Model:
├── Organization (top-level tenant)
│   ├── Projects (data isolation unit)
│   │   ├── Data Sources
│   │   ├── Metrics
│   │   ├── Forecasts
│   │   └── Alerts
│   └── Members (users in org)
│       └── Roles (admin, editor, viewer)
```

### 4.2 Auth Enforcement Points

| Layer | Enforcement | Method |
|-------|-------------|--------|
| CDN/Hosting | Public (static assets) | None |
| API Gateway | All API requests | Firebase ID token verification |
| Service-to-Service | Internal calls | Service account + IAM |
| BigQuery | Data access | Row-level security, IAM |
| Firestore | Document access | Security rules |

### 4.3 Role Definitions

| Role | Permissions |
|------|-------------|
| `org:admin` | Full org management, billing, members |
| `org:editor` | Create/edit projects, sources, alerts |
| `org:viewer` | Read-only access to all data |
| `project:admin` | Full project management |
| `project:editor` | Edit project data sources, alerts |
| `project:viewer` | View project metrics and forecasts |

### 4.4 API Gateway Pattern

```
Request Flow:
1. Client sends request with Firebase ID token
2. Cloud Run service validates token via Firebase Admin SDK
3. Extract user ID and custom claims (roles)
4. Lookup organization membership
5. Authorize based on resource + role
6. Process request or return 403
```

---

## 5. Terraform Infrastructure Strategy

### 5.1 Module Layout

```
infrastructure/terraform/
├── modules/
│   ├── project/              # GCP project setup
│   ├── networking/           # VPC, subnets, firewall
│   ├── cloud-run/            # Cloud Run service template
│   ├── bigquery/             # Dataset and table definitions
│   ├── pubsub/               # Topics and subscriptions
│   ├── secret-manager/       # Secret definitions
│   ├── scheduler/            # Cloud Scheduler jobs
│   ├── monitoring/           # Dashboards and alerts
│   ├── firebase/             # Firebase project config
│   └── iam/                  # Service accounts and bindings
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   └── prod/
├── backend.tf                # State backend config
└── versions.tf               # Provider versions
```

### 5.2 State Management

| Aspect | Strategy |
|--------|----------|
| Backend | GCS bucket per environment |
| Locking | GCS object locking enabled |
| Encryption | Customer-managed keys (CMEK) |
| Access | CI service account only |
| Backup | Versioned bucket + cross-region |

**State Bucket Naming:**
```
intentvision-terraform-state-<env>
```

### 5.3 Drift Control

- **Detection:** Weekly `terraform plan` scheduled job
- **Alerting:** Slack/email on drift detection
- **Remediation:** Manual review required
- **Prevention:** No console changes policy

### 5.4 Module Versioning

```hcl
module "api_service" {
  source  = "./modules/cloud-run"
  version = "1.0.0"  # Internal module versioning

  # ...
}
```

---

## 6. GitHub Actions CI/CD

### 6.1 Workload Identity Federation

**Purpose:** No long-lived service account keys; GitHub authenticates directly to GCP.

```yaml
# Setup (once per environment)
gcloud iam workload-identity-pools create github-pool \
  --location="global"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --workload-identity-pool="github-pool" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository"

# Service account binding
gcloud iam service-accounts add-iam-policy-binding \
  intentvision-ci@intentvision-prod.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/intent-solutions-io/intentvision"
```

### 6.2 Workflow Structure

```
.github/workflows/
├── arv-gate.yaml            # All PRs: lint, test, security
├── terraform-plan.yaml      # PRs touching infra: plan only
├── terraform-apply.yaml     # Merge to main: apply to dev
├── deploy-staging.yaml      # Manual promotion to staging
├── deploy-prod.yaml         # Tag release: deploy to prod
├── scheduled-drift.yaml     # Weekly drift detection
└── dependency-audit.yaml    # Weekly security audit
```

### 6.3 Branch Protections

| Branch | Rules |
|--------|-------|
| `main` | Require PR, 1 approval, ARV gate pass, no force push |
| `release/*` | Require PR, 2 approvals, all checks pass |
| Feature branches | No protection (delete after merge) |

### 6.4 Required Checks

All PRs must pass:
1. `arv-gate` — Doc-filing, linting, tests, security
2. `terraform-plan` — If infra changes, plan must succeed
3. `beads-hygiene` — No orphan issues, valid dependencies

### 6.5 Release Strategy

```
Versioning: Semantic Versioning (MAJOR.MINOR.PATCH)

Release Flow:
1. Feature branches → main (via PR)
2. main auto-deploys to dev
3. Manual promotion: dev → staging (via workflow dispatch)
4. Staging validation: 48-hour soak
5. Tag release: staging → prod (via tag push)
6. Changelog auto-generated from conventional commits
```

**Tag Format:**
```
v1.0.0
v1.0.1-rc.1  # Release candidate
```

---

## 7. Observability Requirements

### 7.1 Structured Logging Standard

All services must emit JSON logs:

```json
{
  "severity": "INFO",
  "timestamp": "2025-12-15T10:30:00.000Z",
  "trace_id": "abc123def456",
  "span_id": "789xyz",
  "service": "intentvision-api",
  "message": "Forecast request processed",
  "labels": {
    "org_id": "org-123",
    "project_id": "proj-456",
    "user_id": "user-789"
  },
  "http_request": {
    "method": "POST",
    "url": "/api/v1/forecast",
    "status": 200,
    "latency_ms": 1250
  }
}
```

### 7.2 Trace Correlation

Every request gets a trace ID:

```
X-Cloud-Trace-Context: <trace-id>/<span-id>;o=<options>
```

**Propagation:**
- API Gateway generates trace ID
- All downstream services propagate
- Pub/Sub messages include trace context
- BigQuery jobs log trace IDs

### 7.3 SLO Definitions

| Service | SLI | SLO Target |
|---------|-----|------------|
| API Gateway | Availability | 99.9% |
| API Gateway | Latency (p99) | < 500ms |
| Forecast Service | Success Rate | 99.5% |
| Forecast Service | Latency (p99) | < 30s |
| Ingest Pipeline | Throughput | > 1000 msg/s |
| Alerting | Delivery Latency | < 60s |

### 7.4 Alerting Strategy

| Severity | Condition | Response |
|----------|-----------|----------|
| P1 | SLO burn rate > 10x | Page on-call immediately |
| P2 | SLO burn rate > 2x | Slack alert, respond in 1h |
| P3 | Error rate spike | Slack alert, respond in 4h |
| P4 | Warning threshold | Daily digest |

### 7.5 AgentFS Audit Integration

All agent operations recorded in AgentFS:

```
Audit Trail Requirements:
├── CI/CD agent actions    # Deployments, rollbacks
├── Forecast operations    # Model inputs/outputs
├── Alert routing          # Who was notified, when
└── Data access            # What data was queried
```

**Snapshot Schedule:**
- Phase completions: Mandatory snapshot
- Weekly: Automated backup
- Pre-major-operation: Checkpoint

---

## 8. Security Posture

### 8.1 Secrets Management

- All secrets in Secret Manager
- No secrets in code, env vars, or logs
- Automatic rotation: 90-day policy
- Access audit logging enabled

### 8.2 Network Security

- VPC with private subnets for services
- Cloud NAT for egress
- Cloud Armor for API protection
- Private Google Access for GCP services

### 8.3 Container Security

- Distroless base images where possible
- No root users in containers
- Binary authorization (future)
- Vulnerability scanning in CI

### 8.4 Compliance

- Audit logs retained 365 days
- Data residency: US (configurable)
- PII handling: Encrypted at rest and transit
- GDPR: Data deletion workflows (future)

---

## 9. Implementation Phases

### Phase 0 (Current)
- Repository foundation
- CI/CD scaffolding
- This design document
- No cloud resources

### Phase 1
- GCP project setup (dev only)
- Basic VPC and IAM
- Firebase project initialization
- First Cloud Run service (health check)

### Phase 2
- BigQuery datasets
- Pub/Sub topics
- Ingest pipeline skeleton

### Phase 3
- Forecast service with pluggable backend
- Vertex AI or Nixtla integration

### Phase 4
- Alerting service
- Notification routing

### Phase 5
- Dashboard frontend
- API gateway surface
- Full observability

---

## Appendix A: Cost Estimation

| Service | Dev (Monthly) | Staging | Prod |
|---------|---------------|---------|------|
| Cloud Run | $50 | $150 | $500+ |
| BigQuery | $25 | $50 | $200+ |
| Pub/Sub | $5 | $10 | $50+ |
| Firebase | Free tier | $25 | $100+ |
| Monitoring | Included | Included | Included |
| **Total** | ~$80 | ~$235 | ~$850+ |

*Estimates only; actual costs depend on usage.*

---

## Appendix B: Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Cloud Run over GKE | Simpler ops, cost-effective at scale | 2025-12-15 |
| Firestore over Cloud SQL | Real-time sync, serverless | 2025-12-15 |
| BigQuery for metrics | Scalable analytics, SQL interface | 2025-12-15 |
| Pluggable forecast backend | Avoid vendor lock-in | 2025-12-15 |
| Workload Identity | No long-lived keys, secure CI/CD | 2025-12-15 |

---

## References

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Terraform GCP Provider](https://registry.terraform.io/providers/hashicorp/google)
- [GitHub Actions OIDC with GCP](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-google-cloud-platform)
- [Firebase Documentation](https://firebase.google.com/docs)
- IntentVision `docs/beads-usage.md`
- IntentVision `docs/agentfs-usage.md`
