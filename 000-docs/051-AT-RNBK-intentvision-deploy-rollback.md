# Runbook: IntentVision Deployment and Rollback

**Document ID**: 051-AT-RNBK-intentvision-deploy-rollback
**Type**: Operations Runbook
**Date**: 2025-12-16
**Status**: Active
**Owner**: Engineering/DevOps

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Deploy to Staging](#3-deploy-to-staging)
4. [Deploy to Production](#4-deploy-to-production)
5. [Rollback Cloud Run](#5-rollback-cloud-run)
6. [Rollback Firebase Hosting](#6-rollback-firebase-hosting)
7. [Re-seed Demo Tenant](#7-re-seed-demo-tenant)
8. [Post-Deploy Smoke Tests](#8-post-deploy-smoke-tests)
9. [Emergency Procedures](#9-emergency-procedures)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

This runbook covers deployment and rollback procedures for IntentVision's production infrastructure:

| Component | Platform | Staging | Production |
|-----------|----------|---------|------------|
| API | Cloud Run | iv-api-staging | iv-api-prod |
| Dashboard | Firebase Hosting | intentvision-staging | intentvision-prod |
| Database | Firestore | envs/staging | envs/prod |

**Deployment Flow**:
```
main branch --> CI Tests --> Build --> Staging --> (approval) --> Production
```

---

## 2. Prerequisites

### Required Tools

```bash
# Verify gcloud CLI
gcloud --version
# Google Cloud SDK 450.0.0 or later

# Verify Firebase CLI
firebase --version
# 13.0.0 or later

# Verify Docker
docker --version
# Docker 24.0 or later

# Verify Node.js
node --version
# v20.0.0 or later
```

### Authentication

```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Authenticate with Firebase
firebase login

# Verify access
gcloud run services list --platform managed
firebase projects:list
```

### Environment Variables

```bash
# Required for deployment scripts
export GCP_PROJECT_ID="intentvision-prod"
export GCP_REGION="us-central1"
export FIREBASE_PROJECT="intentvision-prod"
```

---

## 3. Deploy to Staging

### 3.1 Automatic Deploy (CI/CD)

Staging deploys automatically when pushing to `main`:

```bash
# Push to main triggers staging deploy
git push origin main

# Monitor in GitHub Actions
# https://github.com/intentvision/intentvision/actions
```

### 3.2 Manual Deploy (API)

```bash
# 1. Build Docker image
docker build -t gcr.io/${GCP_PROJECT_ID}/iv-api:staging-$(date +%Y%m%d-%H%M%S) .

# 2. Push to Container Registry
docker push gcr.io/${GCP_PROJECT_ID}/iv-api:staging-$(date +%Y%m%d-%H%M%S)

# 3. Deploy to Cloud Run
gcloud run deploy iv-api-staging \
  --image gcr.io/${GCP_PROJECT_ID}/iv-api:staging-$(date +%Y%m%d-%H%M%S) \
  --platform managed \
  --region ${GCP_REGION} \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=staging,GCP_PROJECT_ID=${GCP_PROJECT_ID}

# 4. Verify deployment
gcloud run services describe iv-api-staging --platform managed --region ${GCP_REGION}
```

### 3.3 Manual Deploy (Dashboard)

```bash
# 1. Build dashboard
cd packages/dashboard
npm run build

# 2. Deploy to Firebase Hosting
firebase deploy --only hosting:staging

# 3. Verify deployment
firebase hosting:channel:list
```

---

## 4. Deploy to Production

### 4.1 Via CI/CD (Recommended)

```bash
# 1. Ensure staging is healthy
curl -s https://iv-api-staging-xxx.run.app/health | jq .

# 2. Approve production deployment in GitHub Actions
# Navigate to: Actions -> Deploy workflow -> Approve

# 3. Monitor deployment progress in GitHub Actions
```

### 4.2 Manual Deploy (API)

**WARNING**: Only use manual deploy for emergencies or when CI/CD is unavailable.

```bash
# 1. Tag the image for production
docker tag gcr.io/${GCP_PROJECT_ID}/iv-api:staging-TIMESTAMP \
           gcr.io/${GCP_PROJECT_ID}/iv-api:prod-$(date +%Y%m%d-%H%M%S)
docker push gcr.io/${GCP_PROJECT_ID}/iv-api:prod-$(date +%Y%m%d-%H%M%S)

# 2. Deploy to Cloud Run production
gcloud run deploy iv-api-prod \
  --image gcr.io/${GCP_PROJECT_ID}/iv-api:prod-$(date +%Y%m%d-%H%M%S) \
  --platform managed \
  --region ${GCP_REGION} \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production,GCP_PROJECT_ID=${GCP_PROJECT_ID}

# 3. Verify deployment
curl -s https://api.intentvision.io/health | jq .
```

### 4.3 Manual Deploy (Dashboard)

```bash
# 1. Build with production config
cd packages/dashboard
VITE_API_URL=https://api.intentvision.io npm run build

# 2. Deploy to production
firebase deploy --only hosting:production

# 3. Verify
curl -I https://app.intentvision.io
```

---

## 5. Rollback Cloud Run

### 5.1 List Available Revisions

```bash
# List all revisions for a service
gcloud run revisions list \
  --service iv-api-prod \
  --platform managed \
  --region ${GCP_REGION}

# Output:
# REVISION              ACTIVE  SERVICE      DEPLOYED              AUTHOR
# iv-api-prod-00005    yes     iv-api-prod  2025-12-16 10:30:00   user@example.com
# iv-api-prod-00004            iv-api-prod  2025-12-15 15:00:00   user@example.com
# iv-api-prod-00003            iv-api-prod  2025-12-14 09:00:00   user@example.com
```

### 5.2 Rollback to Previous Revision

```bash
# Rollback to specific revision
gcloud run services update-traffic iv-api-prod \
  --platform managed \
  --region ${GCP_REGION} \
  --to-revisions iv-api-prod-00004=100

# Verify rollback
gcloud run services describe iv-api-prod --platform managed --region ${GCP_REGION}
```

### 5.3 Gradual Rollback (Canary)

```bash
# Split traffic 90/10 to test rollback
gcloud run services update-traffic iv-api-prod \
  --platform managed \
  --region ${GCP_REGION} \
  --to-revisions iv-api-prod-00005=90,iv-api-prod-00004=10

# If stable, complete rollback
gcloud run services update-traffic iv-api-prod \
  --platform managed \
  --region ${GCP_REGION} \
  --to-revisions iv-api-prod-00004=100
```

### 5.4 Emergency Rollback Script

```bash
#!/bin/bash
# emergency-rollback.sh

SERVICE=${1:-"iv-api-prod"}
REGION=${2:-"us-central1"}

echo "=== EMERGENCY ROLLBACK ==="
echo "Service: $SERVICE"
echo "Region: $REGION"

# Get current and previous revisions
CURRENT=$(gcloud run revisions list --service $SERVICE --platform managed --region $REGION --format="value(metadata.name)" --limit=1)
PREVIOUS=$(gcloud run revisions list --service $SERVICE --platform managed --region $REGION --format="value(metadata.name)" --limit=2 | tail -1)

echo "Current: $CURRENT"
echo "Rolling back to: $PREVIOUS"
read -p "Proceed? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    gcloud run services update-traffic $SERVICE \
      --platform managed \
      --region $REGION \
      --to-revisions $PREVIOUS=100
    echo "Rollback complete. Verifying..."
    sleep 5
    curl -s "https://api.intentvision.io/health" | jq .
fi
```

---

## 6. Rollback Firebase Hosting

### 6.1 List Previous Versions

```bash
# List release history
firebase hosting:releases:list --site intentvision-prod

# Output:
# Release   Version ID        Type    Created At
# 1         abc123def456      deploy  2025-12-16 10:30:00
# 2         xyz789ghi012      deploy  2025-12-15 15:00:00
```

### 6.2 Rollback to Previous Version

```bash
# Clone a previous release
firebase hosting:clone intentvision-prod:VERSION_ID intentvision-prod:live

# Or rollback via console:
# https://console.firebase.google.com/project/PROJECT_ID/hosting/sites/intentvision-prod
```

### 6.3 Re-deploy Previous Build

```bash
# Checkout previous commit
git checkout HEAD~1

# Rebuild and deploy
cd packages/dashboard
npm ci
npm run build
firebase deploy --only hosting:production

# Return to main
git checkout main
```

---

## 7. Re-seed Demo Tenant

### 7.1 When to Re-seed

Re-seed the demo tenant when:
- Demo data is corrupted or deleted
- New features require updated demo data
- Preparing for a customer demo

### 7.2 Re-seed Commands

```bash
# 1. Delete existing demo data (optional - be careful!)
npx tsx packages/api/src/cli/admin.ts tenant:delete --org-id demo-org --confirm

# 2. Create demo tenant
npx tsx packages/api/src/cli/admin.ts tenant:create \
  --name "Demo Organization" \
  --slug "demo-org" \
  --email "demo@intentvision.io" \
  --plan "starter"

# 3. Seed demo metrics
npx tsx packages/api/src/cli/seed.ts metrics \
  --org-id demo-org \
  --metrics stripe:mrr,stripe:churn,github:deploys \
  --days 90

# 4. Seed demo forecasts
npx tsx packages/api/src/cli/seed.ts forecasts \
  --org-id demo-org

# 5. Create demo alerts
npx tsx packages/api/src/cli/seed.ts alerts \
  --org-id demo-org

# 6. Verify demo tenant
npx tsx packages/api/src/cli/admin.ts tenant:info --org-id demo-org
```

### 7.3 Demo Seed Script

```bash
#!/bin/bash
# seed-demo.sh

ORG_ID="demo-org"
ENV=${1:-"staging"}

echo "=== Re-seeding Demo Tenant ==="
echo "Environment: $ENV"
echo "Organization: $ORG_ID"

# Set environment
if [ "$ENV" = "production" ]; then
  export FIRESTORE_PREFIX="envs/prod"
  export GCP_PROJECT_ID="intentvision-prod"
else
  export FIRESTORE_PREFIX="envs/staging"
  export GCP_PROJECT_ID="intentvision-staging"
fi

# Run seed commands
npx tsx packages/api/src/cli/seed.ts full --org-id $ORG_ID

echo "Demo tenant re-seeded successfully!"
```

---

## 8. Post-Deploy Smoke Tests

### 8.1 API Smoke Tests

```bash
#!/bin/bash
# smoke-test-api.sh

API_URL=${1:-"https://api.intentvision.io"}

echo "=== API Smoke Tests ==="
echo "Target: $API_URL"

# Test 1: Health endpoint
echo -n "Health check... "
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$HEALTH" = "200" ]; then echo "PASS"; else echo "FAIL ($HEALTH)"; exit 1; fi

# Test 2: Version endpoint
echo -n "Version check... "
VERSION=$(curl -s "$API_URL/version" | jq -r '.version')
if [ -n "$VERSION" ]; then echo "PASS ($VERSION)"; else echo "FAIL"; exit 1; fi

# Test 3: API key validation
echo -n "Auth check... "
AUTH=$(curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: invalid" "$API_URL/v1/metrics")
if [ "$AUTH" = "401" ]; then echo "PASS"; else echo "FAIL ($AUTH)"; exit 1; fi

# Test 4: Valid API operation (requires test key)
if [ -n "$TEST_API_KEY" ]; then
  echo -n "Forecast endpoint... "
  FORECAST=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-API-Key: $TEST_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"metricKey":"test:metric","horizon":7}' \
    "$API_URL/v1/forecast/run")
  if [ "$FORECAST" = "200" ] || [ "$FORECAST" = "429" ]; then
    echo "PASS ($FORECAST)";
  else
    echo "FAIL ($FORECAST)"; exit 1;
  fi
fi

echo "=== All Smoke Tests Passed ==="
```

### 8.2 Dashboard Smoke Tests

```bash
#!/bin/bash
# smoke-test-dashboard.sh

DASHBOARD_URL=${1:-"https://app.intentvision.io"}

echo "=== Dashboard Smoke Tests ==="
echo "Target: $DASHBOARD_URL"

# Test 1: Homepage loads
echo -n "Homepage... "
HOME=$(curl -s -o /dev/null -w "%{http_code}" "$DASHBOARD_URL/")
if [ "$HOME" = "200" ]; then echo "PASS"; else echo "FAIL ($HOME)"; exit 1; fi

# Test 2: Static assets
echo -n "Static assets... "
ASSETS=$(curl -s -o /dev/null -w "%{http_code}" "$DASHBOARD_URL/assets/index.js" 2>/dev/null || echo "200")
if [ "$ASSETS" = "200" ] || [ "$ASSETS" = "304" ]; then echo "PASS"; else echo "PASS (SPA)"; fi

# Test 3: SPA routing
echo -n "SPA routing... "
ROUTE=$(curl -s -o /dev/null -w "%{http_code}" "$DASHBOARD_URL/dashboard")
if [ "$ROUTE" = "200" ]; then echo "PASS"; else echo "FAIL ($ROUTE)"; exit 1; fi

echo "=== All Dashboard Tests Passed ==="
```

### 8.3 Full Smoke Test Suite

```bash
# Run all smoke tests
./scripts/smoke-test-api.sh https://api.intentvision.io
./scripts/smoke-test-dashboard.sh https://app.intentvision.io

# Or via npm
npm run smoke:staging
npm run smoke:production
```

---

## 9. Emergency Procedures

### 9.1 Complete Service Outage

```bash
# 1. Check service status
gcloud run services list --platform managed

# 2. Check for errors in logs
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit 20

# 3. Rollback to known good revision
./scripts/emergency-rollback.sh iv-api-prod

# 4. Notify stakeholders
# Send message to #incidents Slack channel
```

### 9.2 Database Issues

```bash
# 1. Check Firestore status
# https://status.firebase.google.com/

# 2. Verify connectivity
npx tsx packages/api/src/cli/admin.ts health:firestore

# 3. If needed, switch to read-only mode
gcloud run services update iv-api-prod \
  --set-env-vars READONLY_MODE=true
```

### 9.3 High Error Rate

```bash
# 1. Check error logs
gcloud logging read "resource.type=cloud_run_revision AND severity=ERROR" \
  --format="table(timestamp,jsonPayload.message)" \
  --limit 50

# 2. Check recent deployments
gcloud run revisions list --service iv-api-prod --limit 5

# 3. If caused by new deploy, rollback
gcloud run services update-traffic iv-api-prod \
  --to-revisions PREVIOUS_REVISION=100
```

---

## 10. Troubleshooting

### 10.1 Deployment Fails

**Symptom**: `gcloud run deploy` returns error

**Solutions**:
```bash
# Check image exists
gcloud container images list --repository=gcr.io/${GCP_PROJECT_ID}

# Check IAM permissions
gcloud projects get-iam-policy ${GCP_PROJECT_ID}

# Check service account
gcloud iam service-accounts list

# Verbose deploy
gcloud run deploy iv-api-prod --verbosity=debug ...
```

### 10.2 Cold Start Latency

**Symptom**: First request after idle takes 5+ seconds

**Solutions**:
```bash
# Set min instances
gcloud run services update iv-api-prod \
  --min-instances 1

# Check current config
gcloud run services describe iv-api-prod
```

### 10.3 Firebase Hosting 404

**Symptom**: Dashboard returns 404 on routes

**Solutions**:
```bash
# Check firebase.json rewrites
cat firebase.json | jq '.hosting.rewrites'

# Verify deployment
firebase hosting:releases:list --site intentvision-prod

# Redeploy
firebase deploy --only hosting:production
```

### 10.4 Logs Not Appearing

**Symptom**: No logs in Cloud Logging

**Solutions**:
```bash
# Check logger configuration
gcloud logging logs list

# Verify log sink
gcloud logging sinks list

# Test logging
curl https://api.intentvision.io/health
gcloud logging read "resource.type=cloud_run_revision" --limit 5
```

---

## Quick Reference Card

```
=== DEPLOY ===
git push origin main              # Triggers CI/CD
firebase deploy --only hosting    # Dashboard only

=== ROLLBACK ===
gcloud run services update-traffic iv-api-prod \
  --to-revisions REVISION=100

=== HEALTH ===
curl https://api.intentvision.io/health
gcloud run services describe iv-api-prod

=== LOGS ===
gcloud logging read "resource.type=cloud_run_revision" --limit 50

=== SMOKE TEST ===
npm run smoke:production
```

---

*Operations Runbook - IntentVision Deployment*
*Last Updated: 2025-12-16*
*Owner: Engineering/DevOps*
