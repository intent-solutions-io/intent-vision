# IntentVision Cloud MVP Deployment Plan

> Task ID: intentvision-11dp

---

## Executive Summary

This document outlines the deployment strategy for IntentVision MVP to Google Cloud Platform. The deployment uses Cloud Run for serverless container hosting, Turso for edge-distributed SQLite, and follows GCP naming conventions (no numbers in resource names).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Google Cloud Platform                      │
│                                                                   │
│  ┌─────────────┐     ┌─────────────────┐     ┌───────────────┐  │
│  │  Cloud Run  │────▶│  Cloud Tasks    │────▶│  Pub/Sub      │  │
│  │  (API/UI)   │     │  (Scheduler)    │     │  (Events)     │  │
│  └─────────────┘     └─────────────────┘     └───────────────┘  │
│         │                    │                       │           │
│         ▼                    ▼                       ▼           │
│  ┌─────────────┐     ┌─────────────────┐     ┌───────────────┐  │
│  │   Secret    │     │   GCS Bucket    │     │  Cloud        │  │
│  │   Manager   │     │  (Fixtures/Exp) │     │  Logging      │  │
│  └─────────────┘     └─────────────────┘     └───────────────┘  │
│                                                                   │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Turso (External)    │
                    │   Edge SQLite DB      │
                    └───────────────────────┘
```

---

## 1. GCP Resource Naming

Following GCP naming conventions (no numbers):

| Resource | Name | Description |
|----------|------|-------------|
| Project | `intentvision-prod` | Production project |
| Cloud Run Service | `intentvision-api` | Main API service |
| Cloud Run Service | `intentvision-worker` | Background workers |
| GCS Bucket | `intentvision-fixtures` | Fixture/export storage |
| GCS Bucket | `intentvision-exports` | Data exports |
| Secret Manager | `intentvision-turso-url` | Turso connection URL |
| Secret Manager | `intentvision-turso-token` | Turso auth token |
| Pub/Sub Topic | `intentvision-metrics` | Metric ingestion |
| Pub/Sub Topic | `intentvision-alerts` | Alert notifications |
| Cloud Tasks Queue | `intentvision-forecast` | Forecast jobs |
| Cloud Tasks Queue | `intentvision-anomaly` | Anomaly detection jobs |

---

## 2. Cloud Run Configuration

### 2.1 Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
RUN npm ci --workspace=@intentvision/pipeline --workspace=@intentvision/operator
RUN npm run build --workspaces

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/*/dist ./packages/
COPY --from=builder /app/packages/*/package.json ./packages/
COPY package.json ./

# Cloud Run expects PORT env var
ENV PORT=8080
EXPOSE 8080

CMD ["node", "packages/cloud-functions/dist/index.js"]
```

### 2.2 Service Configuration (service.yaml)

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: intentvision-api
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "true"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      serviceAccountName: intentvision-sa@intentvision-prod.iam.gserviceaccount.com
      containers:
        - image: gcr.io/intentvision-prod/intentvision-api:latest
          ports:
            - containerPort: 8080
          resources:
            limits:
              cpu: "2"
              memory: "1Gi"
          env:
            - name: NODE_ENV
              value: production
            - name: TURSO_URL
              valueFrom:
                secretKeyRef:
                  name: intentvision-turso-url
                  key: latest
            - name: TURSO_TOKEN
              valueFrom:
                secretKeyRef:
                  name: intentvision-turso-token
                  key: latest
```

### 2.3 Cloud Build (cloudbuild.yaml)

```yaml
steps:
  # Build the container
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/intentvision-api:$COMMIT_SHA', '.']

  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/intentvision-api:$COMMIT_SHA']

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'intentvision-api'
      - '--image=gcr.io/$PROJECT_ID/intentvision-api:$COMMIT_SHA'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'

images:
  - 'gcr.io/$PROJECT_ID/intentvision-api:$COMMIT_SHA'

options:
  logging: CLOUD_LOGGING_ONLY
```

---

## 3. Infrastructure Requirements

### 3.1 GCP Services

| Service | Purpose | Tier |
|---------|---------|------|
| Cloud Run | API hosting | Pay-per-use |
| Cloud Tasks | Job scheduling | Free tier |
| Pub/Sub | Event messaging | Free tier (first 10GB) |
| GCS | Object storage | Standard |
| Secret Manager | Secrets | Free tier (first 10k) |
| Cloud Logging | Observability | Free tier (first 50GB) |

### 3.2 External Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Turso | Database | Edge deployment, us-east-1 |
| GitHub | Source control | Main branch protection |

### 3.3 IAM Roles

```bash
# Service account for Cloud Run
gcloud iam service-accounts create intentvision-sa \
  --display-name="IntentVision Service Account"

# Grant necessary roles
gcloud projects add-iam-policy-binding intentvision-prod \
  --member="serviceAccount:intentvision-sa@intentvision-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding intentvision-prod \
  --member="serviceAccount:intentvision-sa@intentvision-prod.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding intentvision-prod \
  --member="serviceAccount:intentvision-sa@intentvision-prod.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

gcloud projects add-iam-policy-binding intentvision-prod \
  --member="serviceAccount:intentvision-sa@intentvision-prod.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

---

## 4. Secrets Management

### 4.1 Required Secrets

| Secret Name | Source | Description |
|-------------|--------|-------------|
| `intentvision-turso-url` | Turso Console | Database URL |
| `intentvision-turso-token` | Turso Console | Auth token |
| `intentvision-api-key-salt` | Generate | Key hashing salt |

### 4.2 Creating Secrets

```bash
# Create Turso URL secret
echo -n "libsql://intentvision-[org].turso.io" | \
  gcloud secrets create intentvision-turso-url --data-file=-

# Create Turso token secret
echo -n "your-turso-token" | \
  gcloud secrets create intentvision-turso-token --data-file=-

# Generate and store API key salt
openssl rand -hex 32 | \
  gcloud secrets create intentvision-api-key-salt --data-file=-
```

---

## 5. Deployment Checklist

### 5.1 Pre-Deployment

- [ ] GCP project created and billing enabled
- [ ] Required APIs enabled:
  - [ ] Cloud Run API
  - [ ] Cloud Build API
  - [ ] Secret Manager API
  - [ ] Cloud Tasks API
  - [ ] Pub/Sub API
- [ ] Service account created with correct roles
- [ ] Secrets created in Secret Manager
- [ ] Turso database provisioned and schema deployed
- [ ] GCS buckets created

### 5.2 Deployment

- [ ] Build container image
- [ ] Push to Container Registry
- [ ] Deploy to Cloud Run
- [ ] Configure custom domain (optional)
- [ ] Set up Cloud Scheduler for periodic jobs

### 5.3 Post-Deployment Verification

- [ ] Health check endpoint returns 200
- [ ] API authentication works
- [ ] Database connection verified
- [ ] Metrics ingestion tested
- [ ] Forecast generation tested
- [ ] Anomaly detection tested
- [ ] Alert notification tested
- [ ] Logging appears in Cloud Logging

---

## 6. Deployment Commands

### 6.1 Initial Setup

```bash
# Set project
export PROJECT_ID=intentvision-prod
gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  cloudtasks.googleapis.com \
  pubsub.googleapis.com \
  storage.googleapis.com

# Create GCS buckets
gsutil mb -l us-central1 gs://intentvision-fixtures
gsutil mb -l us-central1 gs://intentvision-exports

# Create Pub/Sub topics
gcloud pubsub topics create intentvision-metrics
gcloud pubsub topics create intentvision-alerts

# Create Cloud Tasks queues
gcloud tasks queues create intentvision-forecast --location=us-central1
gcloud tasks queues create intentvision-anomaly --location=us-central1
```

### 6.2 Deploy

```bash
# Build and deploy
gcloud builds submit --config cloudbuild.yaml

# Or manual deploy
docker build -t gcr.io/$PROJECT_ID/intentvision-api:latest .
docker push gcr.io/$PROJECT_ID/intentvision-api:latest
gcloud run deploy intentvision-api \
  --image gcr.io/$PROJECT_ID/intentvision-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated
```

### 6.3 Verify

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe intentvision-api \
  --region us-central1 --format 'value(status.url)')

# Health check
curl $SERVICE_URL/health

# Test with API key
curl -H "X-API-Key: iv_your_key" $SERVICE_URL/api/v1/org
```

---

## 7. Nixtla OSS Integration Plan

Per supplemental prompt requirements, Nixtla OSS (StatsForecast) will be integrated as the baseline forecasting backend.

### 7.1 Integration Approach: Python Microservice

**Chosen approach**: Python microservice running StatsForecast, called from Node.js.

**Rationale**:
- Nixtla libraries are Python-first
- Keeps Node.js codebase clean
- Enables independent scaling of forecast service
- Production-ready statistical methods

### 7.2 Service Architecture

```
┌────────────────────┐     HTTP/gRPC     ┌────────────────────┐
│   Node.js API      │─────────────────▶│  Python Forecast   │
│   (Cloud Run)      │                   │   Service          │
│                    │◀─────────────────│   (Cloud Run)      │
└────────────────────┘                   └────────────────────┘
                                                  │
                                                  ▼
                                         ┌────────────────────┐
                                         │   StatsForecast    │
                                         │   (Holt-Winters,   │
                                         │    ARIMA, ETS)     │
                                         └────────────────────┘
```

### 7.3 Python Service Dependencies

```
# requirements.txt
statsforecast>=1.7.0
utilsforecast>=0.0.30
fastapi>=0.110.0
uvicorn>=0.27.0
numpy>=1.24.0
pandas>=2.0.0
```

### 7.4 Lock File Management

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install and lock dependencies
pip install -r requirements.txt
pip freeze > requirements.lock.txt
```

### 7.5 Python Service Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt

COPY src/ ./src/
ENV PORT=8081
EXPOSE 8081

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8081"]
```

### 7.6 CI Validation

```yaml
# .github/workflows/forecast-service.yml
name: Forecast Service CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: pip install -r requirements.lock.txt
      - name: Run smoke test
        run: python -m pytest tests/test_forecast_smoke.py -v
```

---

## 8. Cost Estimation (MVP)

| Service | Estimated Monthly | Notes |
|---------|------------------|-------|
| Cloud Run | $10-50 | Based on traffic |
| Turso | $0-29 | Free tier or Starter |
| GCS | $1-5 | Based on storage |
| Cloud Tasks | $0 | Free tier |
| Pub/Sub | $0-10 | Based on volume |
| Secret Manager | $0 | Free tier |
| **Total** | **$15-100** | MVP range |

---

## 9. Monitoring and Alerting

### 9.1 Cloud Monitoring Alerts

```bash
# Create uptime check
gcloud monitoring uptime-check-configs create intentvision-health \
  --display-name="IntentVision Health Check" \
  --http-check-path="/health" \
  --monitored-resource-type="uptime-url"
```

### 9.2 Log-Based Alerts

- Error rate > 1% over 5 minutes
- Latency p99 > 5 seconds
- Memory usage > 80%

---

## 10. Rollback Plan

### 10.1 Automatic Rollback

Cloud Run supports traffic splitting and automatic rollback:

```bash
# Rollback to previous revision
gcloud run services update-traffic intentvision-api \
  --to-revisions=intentvision-api-00001-abc=100 \
  --region us-central1
```

### 10.2 Manual Rollback Steps

1. Identify last working revision
2. Update traffic to route 100% to working revision
3. Investigate and fix issue
4. Deploy fix
5. Gradually shift traffic to new revision

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-12-15 | 1.0 | Claude | Initial deployment plan |

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
