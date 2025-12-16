# Changelog

All notable changes to IntentVision will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.13.0] - 2025-12-16

### Summary

Production Deployment Infrastructure - IntentVision now has complete CI/CD automation with Cloud Run services, Firebase Hosting, and comprehensive observability through GCP monitoring.

### Features

- **Environment Configuration**: Three-tier model (dev/staging/prod) with isolated Firestore prefixes
- **Cloud Run Deployment**: API service with autoscaling and revision management
- **Firebase Hosting**: Dashboard deployment with custom domain support
- **CI/CD Pipeline**: Automated GitHub Actions for test, build, deploy-staging, deploy-prod
- **Observability**: GCP Cloud Logging, Error Reporting, and Uptime Checks

### Infrastructure

| Environment | API Endpoint | Firestore Prefix |
|-------------|--------------|------------------|
| Development | localhost:3000 | envs/dev |
| Staging | iv-api-staging-xxx.run.app | envs/staging |
| Production | api.intentvision.io | envs/prod |

### CI/CD Jobs

- `test` - Unit tests (no external deps)
- `firestore-live-tests` - Live Firestore tests (opt-in via secret)
- `build` - Docker image build + smoke test
- `deploy-staging` - Cloud Run staging (main branch)
- `deploy-prod` - Cloud Run production (tags only)
- `smoke-staging` - Cloud smoke tests after staging deploy

### Documentation

- 049-DR-ADRC-production-deployment-observability.md (Architecture Decision Record)
- 050-AA-AACR-phase-13-production-deployment.md (Implementation AAR)
- 051-AT-RNBK-intentvision-deploy-rollback.md (Runbook)
- 052-AT-RNBK-production-readiness-checklist.md (Checklist)

---

## [0.12.0] - 2025-12-16

### Summary

Billing Plumbing release - Foundation for monetization with billing snapshots, Stripe abstraction layer (stubbed for testing), and CLI tools for billing operations.

### Features

- **Billing Snapshot Model**: Periodic usage aggregation for invoicing
- **Stripe Client Abstraction**: Interface layer with stub for development/testing
- **Plan Mapping**: Translation between IntentVision plans and Stripe products
- **CLI Tools**: Commands for snapshot generation and billing reports
- **Owner Billing UI**: Dashboard view for billing history and upcoming charges

### Billing Snapshot Schema

```typescript
interface BillingSnapshot {
  id: string;
  orgId: string;
  periodStart: Date;
  periodEnd: Date;
  status: 'pending' | 'finalized' | 'invoiced' | 'paid';
  usage: { forecasts, alerts, metrics, apiCalls };
  subtotal: number;
  planId: string;
  stripeInvoiceId?: string;
}
```

### Documentation

- 047-DR-ADRC-billing-plumbing-stripe-stub.md (Architecture Decision Record)
- 048-AA-AACR-phase-12-billing-plumbing.md (Implementation AAR)

---

## [0.11.0] - 2025-12-16

### Summary

Usage Metering + Plan Enforcement release - IntentVision now tracks all billable operations, enforces daily plan limits, and provides admin usage views for tenant monitoring.

### Features

- **Usage Event Tracking**: All billable operations (forecasts, alerts, ingestion) recorded
- **Plan Limit Enforcement**: 429 response when daily limits exceeded
- **Admin Usage API**: Comprehensive usage endpoints for monitoring
- **Warning System**: Admin overview shows warnings at 80% usage

### API Endpoints

- `GET /admin/orgs/:orgId/usage/today` - Today's usage summary
- `GET /admin/orgs/:orgId/usage/last-30d` - Last 30 days usage
- `GET /admin/orgs/:orgId/usage/overview` - Comprehensive overview with warnings

### Usage Event Types

| Event Type | Trigger | Quantity |
|------------|---------|----------|
| forecast_call | POST /v1/forecast/run | 1 |
| alert_fired | Alert notification sent | 1 |
| metric_ingested | POST /v1/ingest/timeseries | points.length |
| api_call | General API calls | 1 |

### Documentation

- 045-AA-AACR-phase-11-usage-metering.md (Implementation AAR)
- 046-DR-ADRC-usage-metering-plan-enforcement.md (Architecture Decision Record)

---

## [0.10.0] - 2025-12-16

### Summary

Sellable Alpha Shell release - IntentVision becomes a sellable product with self-service tenant onboarding, plan-based feature gating, and a complete dashboard UI shell.

### Features

- **Tenant Self-Service Onboarding**: POST /v1/tenants creates org + user + API key atomically
- **Plan Model**: Free/Starter/Growth/Enterprise plans with limits (metrics, alerts, forecasts)
- **Per-User Notification Preferences**: Individual control over email/Slack/webhook channels
- **Dashboard UI**: Complete React app with /dashboard, /alerts, /settings/notifications
- **Firebase Authentication**: Separate auth path for dashboard users (distinct from API keys)
- **Usage Tracking**: Real-time enforcement of plan limits

### API Endpoints

- `POST /v1/tenants` - Create new tenant (public self-service)
- `GET /v1/tenants/:slug` - Get tenant info
- `GET /v1/dashboard` - Dashboard overview with org info and usage stats
- `GET /v1/dashboard/alerts` - Paginated alert history
- `GET /v1/me/preferences/notifications` - Get notification preferences
- `PUT /v1/me/preferences/notifications` - Update notification preferences
- `POST /v1/me/preferences/notifications/test` - Send test notification

### Plan Limits

| Plan | Metrics | Alerts | Forecasts/Day | Price |
|------|---------|--------|---------------|-------|
| Free | 3 | 5 | 10 | $0 |
| Starter | 10 | 20 | 100 | $49 |
| Growth | 50 | 100 | 500 | $199 |
| Enterprise | Unlimited | Unlimited | Unlimited | Custom |

### Documentation

- 043-AA-AACR-phase-10-sellable-alpha-shell.md (Implementation AAR)
- 044-DR-ADRC-sellable-alpha-plan-tenant-architecture.md (Architecture Decision Record)

---

## [0.1.0] - 2025-12-15

### Summary

Initial release of IntentVision - AI-powered SaaS metrics forecasting platform with multi-tenant architecture, Firestore backend, and Nixtla TimeGPT integration.

### Architecture

- Monorepo structure with 5 packages: api, contracts, operator, pipeline, web
- Cloud Firestore for data persistence with environment isolation
- Cloud Run deployment ready with Docker support
- GitHub Actions CI/CD pipeline with test, build, deploy stages

### Features

- **Phase 0-2**: Foundation, contracts schema, CI scaffolding with ARV gate
- **Phase 3-7**: Core pipeline implementation (ingestion, normalization, forecasting)
- **Phase 8**: Forecast and anomaly evaluation framework
- **Phase 9**: Alerting rules engine with threshold-based triggers
- **Phase 10**: Authentication, tenancy, and operator dashboard
- **Phase A**: Stack alignment with SaaS database tables
- **Phase B**: Nixtla TimeGPT integration for ML forecasting
- **Phase E2E**: Single-metric forecast demo with API and UI
- **Phase F**: Cloud deployment infrastructure (Cloud Run, Artifact Registry)
- **Phase 7**: Cloud Firestore wiring with live tests and CI toggle

### Infrastructure

- Firestore client factory with Application Default Credentials (ADC)
- Environment-prefixed collection paths (`envs/{env}/orgs/{orgId}/...`)
- Live Firestore test suite gated by `INTENTVISION_FIRESTORE_LIVE_TESTS=1`
- CI job for Firestore live tests with Workload Identity Federation auth
- Demo API routes (`/v1/demo/*`) and ForecastDemoPage UI

### API Endpoints

- `POST /v1/demo/ingest` - Ingest metric time series data
- `POST /v1/demo/forecast` - Run forecast with stub or stat backend
- `GET /v1/demo/metric` - Retrieve metric data with latest forecast
- `GET /v1/demo/backends` - List available forecast backends

### Packages

| Package | Version | Description |
|---------|---------|-------------|
| @intentvision/api | 0.1.0 | Production API server |
| @intentvision/contracts | 0.1.0 | Shared TypeScript contracts |
| @intentvision/operator | 0.1.0 | Operator dashboard and auth |
| @intentvision/pipeline | 0.1.0 | Data pipeline and forecasting |
| @intentvision/web | 0.1.0 | React web application |

### Metrics

- TypeScript Files: 506
- Documentation: 44 files in 000-docs/
- Test Suites: Unit, Integration, Live Firestore

### Contributors

- Jeremy Longshore (@jeremy) - Lead Developer

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
