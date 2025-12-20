# ADR: Production Deployment and Observability Architecture

**Document ID**: 049-DR-ADRC-production-deployment-observability
**Phase**: 13
**Date**: 2025-12-16
**Status**: Accepted
**Deciders**: Engineering Team

---

## Context

IntentVision requires production deployment infrastructure with proper environment isolation, continuous deployment pipelines, and observability for monitoring system health. This ADR documents the architectural decisions for:

1. **Environment Configuration**: Development, staging, and production isolation
2. **Cloud Run Deployment**: API service deployment on Google Cloud
3. **Firebase Hosting**: Static dashboard deployment
4. **CI/CD Pipeline**: Automated testing and deployment via GitHub Actions
5. **Observability Strategy**: Logging, metrics, and alerting

## Decision

### 1. Environment Architecture

**Decision**: Three-tier environment model with strict isolation.

**Rationale**:
- Clear separation prevents production incidents from testing
- Environment-specific configurations (Firestore, API keys)
- Staging provides production-like validation before release

**Architecture**:
```
              INTENTVISION ENVIRONMENT ARCHITECTURE

+-------------------------------------------------------------------------+
|                           DEVELOPMENT                                     |
|                                                                           |
|  +-----------------+  +------------------+  +----------------------+      |
|  | Local Machine   |  | Firestore        |  | Local SQLite         |      |
|  | npm run dev     |  | (dev project)    |  | (AgentFS/Beads)      |      |
|  | Port 3000       |  | envs/dev/...     |  |                      |      |
|  +-----------------+  +------------------+  +----------------------+      |
|                                                                           |
+-------------------------------------------------------------------------+

+-------------------------------------------------------------------------+
|                            STAGING                                        |
|                                                                           |
|  +-----------------+  +------------------+  +----------------------+      |
|  | Cloud Run       |  | Firestore        |  | Cloud Logging        |      |
|  | iv-api-staging  |  | (staging proj)   |  | staging logs         |      |
|  | *.run.app       |  | envs/staging/... |  |                      |      |
|  +-----------------+  +------------------+  +----------------------+      |
|         |                                                                 |
|         v                                                                 |
|  +-----------------+                                                      |
|  | Firebase Host   |                                                      |
|  | iv-staging      |                                                      |
|  | staging.url     |                                                      |
|  +-----------------+                                                      |
+-------------------------------------------------------------------------+

+-------------------------------------------------------------------------+
|                           PRODUCTION                                      |
|                                                                           |
|  +-----------------+  +------------------+  +----------------------+      |
|  | Cloud Run       |  | Firestore        |  | Cloud Logging        |      |
|  | iv-api-prod     |  | (prod project)   |  | + Error Reporting    |      |
|  | api.intentv.io  |  | envs/prod/...    |  | + Cloud Monitoring   |      |
|  +-----------------+  +------------------+  +----------------------+      |
|         |                                                                 |
|         v                                                                 |
|  +-----------------+  +------------------+                                |
|  | Firebase Host   |  | Uptime Checks    |                                |
|  | intentvision    |  | PagerDuty        |                                |
|  | app.intentv.io  |  | Integration      |                                |
|  +-----------------+  +------------------+                                |
+-------------------------------------------------------------------------+


ENVIRONMENT VARIABLES BY TIER:

+---------------------+------------------------+-------------------------+
| Variable            | Staging                | Production              |
+---------------------+------------------------+-------------------------+
| NODE_ENV            | staging                | production              |
| GCP_PROJECT_ID      | iv-staging-xxx         | iv-prod-xxx             |
| FIRESTORE_PREFIX    | envs/staging           | envs/prod               |
| API_URL             | https://iv-api-staging | https://api.intentv.io  |
| LOG_LEVEL           | debug                  | info                    |
| RESEND_API_KEY      | re_test_xxx            | re_live_xxx             |
| STRIPE_SECRET_KEY   | sk_test_xxx            | sk_live_xxx             |
+---------------------+------------------------+-------------------------+
```

### 2. Cloud Run Deployment

**Decision**: Deploy API as Cloud Run service with autoscaling.

**Rationale**:
- Serverless scaling reduces operational overhead
- Pay-per-use model aligns with early-stage economics
- Built-in load balancing and SSL termination
- Easy rollback via revision management

**Configuration**:
```yaml
# Cloud Run Service Configuration
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: iv-api-prod
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"        # Always warm
        autoscaling.knative.dev/maxScale: "10"       # Cost protection
        run.googleapis.com/cpu-throttling: "false"   # Consistent perf
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
      - image: gcr.io/iv-prod-xxx/iv-api:latest
        ports:
        - containerPort: 8080
        resources:
          limits:
            cpu: "1"
            memory: "512Mi"
        env:
        - name: NODE_ENV
          value: production
        - name: GCP_PROJECT_ID
          valueFrom:
            secretKeyRef:
              name: iv-api-secrets
              key: gcp_project_id
```

**Service Architecture**:
```
                    CLOUD RUN SERVICE TOPOLOGY

                       +------------------+
                       |   Cloud Load     |
                       |   Balancer       |
                       |   (HTTPS/SSL)    |
                       +--------+---------+
                                |
              +-----------------+-----------------+
              |                 |                 |
              v                 v                 v
      +-------+-------+ +-------+-------+ +-------+-------+
      | Cloud Run     | | Cloud Run     | | Cloud Run     |
      | Instance 1    | | Instance 2    | | Instance N    |
      | (Revision A)  | | (Revision A)  | | (Revision A)  |
      +-------+-------+ +-------+-------+ +-------+-------+
              |                 |                 |
              +-----------------+-----------------+
                                |
              +-----------------+-----------------+
              |                                   |
              v                                   v
      +-------+-------+                   +-------+-------+
      |   Firestore   |                   | Secret Manager|
      |   (Production)|                   | (API Keys)    |
      +---------------+                   +---------------+


REVISION MANAGEMENT:

  +--------------------------------------------------+
  |  Revision History                                 |
  +--------------------------------------------------+
  | iv-api-prod-00003 (current)  100% traffic        |
  | iv-api-prod-00002            0% (rollback ready) |
  | iv-api-prod-00001            0% (archived)       |
  +--------------------------------------------------+

TRAFFIC SPLITTING (for canary deploys):
  Revision 00003: 90%
  Revision 00004: 10% (canary)
```

### 3. Firebase Hosting

**Decision**: Deploy dashboard to Firebase Hosting with custom domain.

**Rationale**:
- Global CDN for fast static asset delivery
- Integrated with Firebase Auth for authentication
- Simple deployment via firebase-tools
- Free SSL certificates

**Configuration**:
```json
// firebase.json
{
  "hosting": {
    "site": "intentvision-prod",
    "public": "packages/dashboard/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|woff2)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

**Sites**:
```
Firebase Hosting Sites:
+----------------------+---------------------------+-------------------+
| Site ID              | Custom Domain             | Purpose           |
+----------------------+---------------------------+-------------------+
| intentvision-staging | staging.intentvision.io   | Staging dashboard |
| intentvision-prod    | app.intentvision.io       | Production app    |
+----------------------+---------------------------+-------------------+
```

### 4. CI/CD Pipeline

**Decision**: GitHub Actions for automated testing, building, and deployment.

**Rationale**:
- Integrated with GitHub repository
- Parallelizable job execution
- Environment-specific deployment gates
- Secrets management integration

**Pipeline Architecture**:
```
                    CI/CD PIPELINE FLOW

+------------------------------------------------------------------+
|                        TRIGGER                                     |
|   Push to main | Pull Request | Manual dispatch                   |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                     TEST STAGE                                     |
|                                                                    |
|  +----------------+  +----------------+  +----------------+        |
|  | Lint           |  | Type Check     |  | Unit Tests     |        |
|  | eslint         |  | tsc --noEmit   |  | vitest run     |        |
|  +----------------+  +----------------+  +----------------+        |
|                                                                    |
|  +----------------+  +----------------+                            |
|  | Contract Tests |  | Integration    |                            |
|  | schemas valid  |  | Tests          |                            |
|  +----------------+  +----------------+                            |
+------------------------------------------------------------------+
                              |
                              v (on push to main)
+------------------------------------------------------------------+
|                    BUILD STAGE                                     |
|                                                                    |
|  +------------------+        +------------------+                  |
|  | Build API Docker |        | Build Dashboard  |                  |
|  | gcr.io/xxx/iv-api|        | npm run build    |                  |
|  +------------------+        +------------------+                  |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                   DEPLOY STAGING                                   |
|                                                                    |
|  +------------------+        +------------------+                  |
|  | Deploy Cloud Run |        | Deploy Firebase  |                  |
|  | iv-api-staging   |        | Hosting staging  |                  |
|  +------------------+        +------------------+                  |
|                                                                    |
|  +------------------+                                              |
|  | Run Smoke Tests  |                                              |
|  | against staging  |                                              |
|  +------------------+                                              |
+------------------------------------------------------------------+
                              |
                              v (manual approval)
+------------------------------------------------------------------+
|                  DEPLOY PRODUCTION                                 |
|                                                                    |
|  +------------------+        +------------------+                  |
|  | Deploy Cloud Run |        | Deploy Firebase  |                  |
|  | iv-api-prod      |        | Hosting prod     |                  |
|  +------------------+        +------------------+                  |
|                                                                    |
|  +------------------+        +------------------+                  |
|  | Run Smoke Tests  |        | Update Uptime    |                  |
|  | against prod     |        | Checks           |                  |
|  +------------------+        +------------------+                  |
+------------------------------------------------------------------+


WORKFLOW FILE: .github/workflows/deploy.yaml
```

### 5. Observability Strategy

**Decision**: Cloud-native observability with structured logging, metrics, and alerting.

**Rationale**:
- GCP-integrated tools reduce operational complexity
- Structured logs enable powerful querying
- Uptime monitoring catches availability issues
- Error reporting aggregates and alerts on exceptions

**Architecture**:
```
                 OBSERVABILITY ARCHITECTURE

+------------------------------------------------------------------+
|                    APPLICATION LAYER                               |
|                                                                    |
|  +------------------+  +------------------+  +------------------+  |
|  | Structured       |  | Request Tracing  |  | Error Capture    |  |
|  | Logging          |  | (correlation ID) |  | (try/catch)      |  |
|  +------------------+  +------------------+  +------------------+  |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                      GCP SERVICES                                  |
|                                                                    |
|  +------------------+  +------------------+  +------------------+  |
|  | Cloud Logging    |  | Cloud Trace      |  | Error Reporting  |  |
|  | Log Explorer     |  | Request spans    |  | Exception groups |  |
|  +------------------+  +------------------+  +------------------+  |
|                              |                                     |
|                              v                                     |
|  +------------------+  +------------------+  +------------------+  |
|  | Log-based        |  | Uptime Checks    |  | Alerting         |  |
|  | Metrics          |  | /health endpoint |  | Policies         |  |
|  +------------------+  +------------------+  +------------------+  |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                   NOTIFICATION CHANNELS                            |
|                                                                    |
|  +------------------+  +------------------+  +------------------+  |
|  | Email            |  | Slack            |  | PagerDuty        |  |
|  | (non-urgent)     |  | (#alerts)        |  | (on-call)        |  |
|  +------------------+  +------------------+  +------------------+  |
+------------------------------------------------------------------+


STRUCTURED LOG FORMAT:
{
  "severity": "INFO",
  "message": "Forecast completed",
  "timestamp": "2025-12-16T10:30:00Z",
  "labels": {
    "service": "iv-api",
    "environment": "production"
  },
  "httpRequest": {
    "requestMethod": "POST",
    "requestUrl": "/v1/forecast/run",
    "status": 200,
    "latency": "1.234s"
  },
  "jsonPayload": {
    "correlationId": "req_abc123",
    "orgId": "org_xyz",
    "metricKey": "stripe:mrr",
    "forecastHorizon": 30
  }
}


ALERTING POLICIES:
+-------------------------+----------------+------------------+-----------+
| Alert Name              | Condition      | Threshold        | Channel   |
+-------------------------+----------------+------------------+-----------+
| API High Error Rate     | 5xx responses  | > 1% for 5min    | Slack     |
| API High Latency        | p95 latency    | > 5s for 5min    | Slack     |
| API Down                | Uptime check   | fails 2 consec   | PagerDuty |
| Firestore Errors        | Error logs     | > 10 per min     | Slack     |
| Forecast Failures       | forecast_error | > 5 per hour     | Email     |
+-------------------------+----------------+------------------+-----------+


DASHBOARDS:
+------------------------------------------------------------------+
| IntentVision Production Dashboard                                  |
+------------------------------------------------------------------+
| Request Rate        | Error Rate          | Latency (p50/p95/p99)|
| [=====     ] 250/m  | [=        ] 0.2%    | 120ms / 450ms / 1.2s |
+------------------------------------------------------------------+
| Active Organizations | Forecasts Today    | Alerts Fired         |
| 42                  | 1,234              | 89                   |
+------------------------------------------------------------------+
| Resource Utilization                                              |
| CPU: [========  ] 45%  | Memory: [======   ] 35%                 |
+------------------------------------------------------------------+
```

## Consequences

### Positive
- Clear environment separation prevents cross-contamination
- Automated deployments reduce manual error and speed up releases
- Comprehensive observability enables rapid incident response
- Revision-based Cloud Run enables instant rollbacks
- CDN-backed dashboard provides global low-latency access

### Negative
- Multiple GCP projects increase management overhead
- CI/CD pipeline adds build time before deployments
- Observability tools have associated costs at scale

### Risks
- Cold start latency on Cloud Run (mitigated by min instances)
- Firebase Hosting cache invalidation delays
- Log volume costs at high traffic

## Environment Variables Reference

### API Service (Cloud Run)

| Variable | Staging | Production |
|----------|---------|------------|
| `NODE_ENV` | staging | production |
| `GCP_PROJECT_ID` | iv-staging-xxx | iv-prod-xxx |
| `FIRESTORE_PREFIX` | envs/staging | envs/prod |
| `LOG_LEVEL` | debug | info |
| `RESEND_API_KEY` | (Secret Manager) | (Secret Manager) |
| `STRIPE_SECRET_KEY` | (Secret Manager) | (Secret Manager) |

### Dashboard (Firebase Hosting)

| Variable | Staging | Production |
|----------|---------|------------|
| `VITE_API_URL` | https://iv-api-staging-xxx.run.app | https://api.intentvision.io |
| `VITE_FIREBASE_PROJECT` | iv-staging-xxx | iv-prod-xxx |

## Related Documents

- 048-AA-AACR-phase-12-billing-plumbing.md (Previous phase)
- 051-AT-RNBK-intentvision-deploy-rollback.md (Deployment runbook)
- 019-cloud-mvp-deployment-plan.md (Original deployment plan)

---

*Architecture Decision Record - Phase 13 Production Deployment*
