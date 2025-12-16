# Release Plan and Roadmap

> IntentVision - Time Series Forecasting and Anomaly Detection Platform

---

## Document Information

| Field | Value |
|-------|-------|
| **Project** | IntentVision |
| **Document Type** | Release Plan and Roadmap |
| **Version** | 1.0 |
| **Last Updated** | 2025-12-15 |
| **Status** | Active |
| **Current Phase** | B Complete, C-F Planned |

---

## Executive Summary

IntentVision has completed 13 phases of development (1-11, A, B), delivering a fully functional time series forecasting and anomaly detection platform with:
- 147 passing tests
- 3 forecast backends (Nixtla TimeGPT, Statistical, Stub)
- Multi-tenant SaaS architecture
- Complete alerting rules engine

This release plan outlines phases C through F to achieve production readiness.

---

## Completed Phases (1-11, A, B)

| Phase | Title | Status | Commit | Key Deliverables |
|-------|-------|--------|--------|------------------|
| 1 | Standardization | Complete | `69670b1` | 6767 doc standard, project structure |
| 2 | CI Scaffold | Complete | `531e610` | ARV gate, GitHub Actions |
| 3 | Contracts | Complete | `e41a9ef` | TypeScript interfaces, fixtures |
| 4 | Vertical Slice | Complete | `e41a9ef` | Ingest -> Store -> Forecast -> Alert |
| 5 | Cloud Ready | Complete | `e41a9ef` | Cloud Functions shape |
| 6 | Agent Workflow | Complete | `e41a9ef` | AgentFS integration |
| 7 | Real Ingestion | Complete | `e41a9ef` | Webhook handler, validation |
| 8 | Forecast Eval | Complete | `ccc47ab` | MAE, RMSE, MAPE metrics |
| 9 | Alerting Rules | Complete | `b1e7295` | Rules engine, notification |
| 10 | Operator Auth | Complete | `61011b1` | API keys, tenancy, dashboard |
| 11 | Deployment Plan | Complete | `b4532a7` | Cloud MVP architecture |
| A | Stack Alignment | Complete | `c2ad3bb` | Turso, SHA-256, SaaS tables |
| B | Nixtla Integration | Complete | `e6dd5af` | TimeGPT backend, mock mode |

---

## Planned Phases (C-F)

### Phase C: User Authentication

| Attribute | Value |
|-----------|-------|
| **Duration** | 2 weeks |
| **Dependencies** | Phase B complete |
| **Priority** | P0 - Critical |
| **Target Start** | Week 1 |

#### Objectives
Enable user registration, authentication, and session management for the SaaS platform.

#### Deliverables

| Deliverable | Description | Effort |
|-------------|-------------|--------|
| Registration API | Email/password registration | 2 days |
| Login API | Session creation with JWT | 2 days |
| Email Verification | Send verification email | 2 days |
| Password Reset | Forgot password flow | 2 days |
| OAuth Integration | Google, GitHub providers | 3 days |
| Session Management | JWT validation, refresh | 2 days |
| User-Org Membership | Many-to-many relationships | 1 day |

#### Technical Design

**User Model:**
```typescript
interface User {
  userId: string;
  email: string;
  name: string;
  passwordHash?: string;
  authProvider: 'internal' | 'firebase' | 'google';
  externalId?: string;
  emailVerified: boolean;
}
```

**Authentication Flow:**
```
Registration -> Email Verification -> Login -> JWT Token -> API Access
```

#### Success Criteria
- [ ] User can register with email/password
- [ ] Email verification sent and validated
- [ ] Login returns valid JWT
- [ ] JWT validated on protected endpoints
- [ ] OAuth login working for Google
- [ ] User can belong to multiple organizations

#### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Email deliverability | High | Use SendGrid/Mailgun |
| OAuth complexity | Medium | Start with Google only |
| Session hijacking | High | Secure JWT implementation |

---

### Phase D: Connections Pipeline

| Attribute | Value |
|-----------|-------|
| **Duration** | 2 weeks |
| **Dependencies** | Phase C complete |
| **Priority** | P1 - High |
| **Target Start** | Week 3 |

#### Objectives
Wire data source connections to the ingestion pipeline, enabling self-service data integration.

#### Deliverables

| Deliverable | Description | Effort |
|-------------|-------------|--------|
| Connection CRUD | Create, read, update, delete | 2 days |
| Webhook Connection | Webhook URL generation | 1 day |
| API Connection | Pull-based data fetching | 3 days |
| Connection Status | Active, error, disabled states | 2 days |
| Metrics Routing | Route metrics to correct org | 2 days |
| Connection Testing | Validate connection config | 2 days |
| Sync Scheduling | Scheduled data pulls | 2 days |

#### Technical Design

**Connection Model:**
```typescript
interface Connection {
  connectionId: string;
  orgId: string;
  name: string;
  type: 'webhook' | 'api' | 'airbyte';
  status: 'pending' | 'active' | 'error' | 'disabled';
  config: Record<string, unknown>;
  lastSyncAt?: string;
  metricsCount: number;
}
```

**Webhook Flow:**
```
Connection Created -> Webhook URL Generated -> External System Posts -> Ingestion Pipeline -> Storage
```

#### Success Criteria
- [ ] User can create webhook connection
- [ ] Webhook URL unique per connection
- [ ] Metrics routed to correct organization
- [ ] Connection status updated on sync
- [ ] Error messages captured for debugging

#### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Webhook security | High | Signed payloads, HMAC |
| Rate limiting | Medium | Per-connection limits |
| Data loss | High | Dead letter queue |

---

### Phase E: Full Integration

| Attribute | Value |
|-----------|-------|
| **Duration** | 3 weeks |
| **Dependencies** | Phase D complete |
| **Priority** | P1 - High |
| **Target Start** | Week 5 |

#### Objectives
Achieve end-to-end SaaS flow from user registration through data analysis and alerting.

#### Deliverables

| Deliverable | Description | Effort |
|-------------|-------------|--------|
| Dashboard API | Organization metrics summary | 3 days |
| Forecast Jobs | Scheduled forecast execution | 3 days |
| Alert Rules API | CRUD for alert rules | 2 days |
| Notification Routing | Connect alerts to channels | 2 days |
| Usage Tracking | Metrics count, API calls | 2 days |
| Billing Preparation | Usage metering | 3 days |
| E2E Test Suite | Critical path validation | 5 days |

#### Technical Design

**End-to-End Flow:**
```
User -> Login -> Create Org -> Create Connection -> Ingest Metrics
     -> Configure Alert Rule -> Forecast Generated -> Anomaly Detected
     -> Alert Triggered -> Notification Sent
```

**Forecast Job:**
```typescript
interface ForecastJob {
  jobId: string;
  orgId: string;
  metricKey: string;
  backend: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  horizon: number;
  frequency: string;
}
```

#### Success Criteria
- [ ] User completes full journey from registration to alert
- [ ] Scheduled forecasts run automatically
- [ ] Alert notifications delivered to Slack
- [ ] Usage metrics accurate
- [ ] E2E tests pass in CI

#### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Workflow complexity | High | Staged rollout |
| Performance bottleneck | High | Load testing |
| Integration bugs | Medium | E2E test coverage |

---

### Phase F: Production Deployment

| Attribute | Value |
|-----------|-------|
| **Duration** | 2 weeks |
| **Dependencies** | Phase E complete |
| **Priority** | P0 - Critical |
| **Target Start** | Week 8 |

#### Objectives
Deploy IntentVision to production with monitoring, logging, and operational procedures.

#### Deliverables

| Deliverable | Description | Effort |
|-------------|-------------|--------|
| Cloud Run Deployment | Pipeline service | 2 days |
| API Gateway | Cloud Endpoints | 2 days |
| Turso Production | Production database | 1 day |
| Secret Management | Secret Manager integration | 1 day |
| Monitoring Setup | Cloud Monitoring dashboards | 2 days |
| Alerting Setup | SLO-based alerts | 1 day |
| Runbook Creation | Operational procedures | 2 days |
| Launch Checklist | Production readiness | 1 day |
| DNS & SSL | Custom domain setup | 1 day |

#### Technical Architecture

```
                     ┌─────────────────┐
                     │   Cloud DNS     │
                     │ intentvision.io │
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │  Load Balancer  │
                     │  Cloud Armor    │
                     └────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
     ┌────────▼───────┐  ┌────▼────┐  ┌───────▼──────┐
     │   Cloud Run    │  │  Cloud  │  │  Cloud Run   │
     │   Pipeline     │  │  Tasks  │  │   Operator   │
     └────────┬───────┘  └────┬────┘  └───────┬──────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
                     ┌────────▼────────┐
                     │  Turso Cloud    │
                     │  (Production)   │
                     └─────────────────┘
```

#### Success Criteria
- [ ] Services deployed and healthy
- [ ] Custom domain configured with SSL
- [ ] Monitoring dashboards operational
- [ ] Alerts firing for error conditions
- [ ] Runbooks documented for common issues
- [ ] First customer onboarded

#### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Deployment failure | Critical | Blue-green deployment |
| Data migration | High | Backup before migration |
| Performance issues | High | Load testing beforehand |

---

## Roadmap Timeline

```
           Week 1-2      Week 3-4      Week 5-7      Week 8-9
           ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐
Phase C    │ AUTH │      │      │      │      │      │      │
           └──────┘      │      │      │      │      │      │
                         │      │      │      │      │      │
Phase D                  │CONN. │      │      │      │      │
                         └──────┘      │      │      │      │
                                       │      │      │      │
Phase E                                │ E2E  │      │      │
                                       │INTEGR│      │      │
                                       └──────┘      │      │
                                                     │      │
Phase F                                              │DEPLOY│
                                                     │ PROD │
                                                     └──────┘
```

---

## Release Criteria

### Phase C Release Criteria
- [ ] All unit tests passing (target: 170+ tests)
- [ ] Integration tests for auth flows
- [ ] Security review of authentication
- [ ] Documentation updated

### Phase D Release Criteria
- [ ] All unit tests passing (target: 190+ tests)
- [ ] Connection lifecycle tested
- [ ] Webhook security validated
- [ ] Documentation updated

### Phase E Release Criteria
- [ ] All unit tests passing (target: 220+ tests)
- [ ] E2E tests for critical paths
- [ ] Performance baseline established
- [ ] Load testing completed

### Phase F Release Criteria
- [ ] All tests passing
- [ ] Production environment deployed
- [ ] Monitoring and alerting active
- [ ] Runbooks documented
- [ ] Launch checklist complete

---

## Version Numbering

| Version | Phase | Description |
|---------|-------|-------------|
| 0.1.0 | 1-4 | Initial vertical slice |
| 0.2.0 | 5-7 | Cloud-ready ingestion |
| 0.3.0 | 8-9 | Evaluation and alerting |
| 0.4.0 | 10-11 | Operator and deployment plan |
| 0.5.0 | A-B | Stack alignment and Nixtla |
| 0.6.0 | C | User authentication |
| 0.7.0 | D | Connections pipeline |
| 0.8.0 | E | Full integration |
| **1.0.0** | **F** | **Production release** |

---

## Resource Requirements

### Development Team
| Role | Phase C | Phase D | Phase E | Phase F |
|------|---------|---------|---------|---------|
| Backend Engineer | 1 | 1 | 1 | 0.5 |
| DevOps Engineer | 0.25 | 0.25 | 0.5 | 1 |
| QA Engineer | 0.25 | 0.25 | 0.5 | 0.5 |

### Infrastructure Costs (Monthly)
| Service | Development | Production |
|---------|-------------|------------|
| Cloud Run | $50 | $200 |
| Turso | Free tier | $50 |
| Nixtla API | Free tier | $100 |
| Monitoring | Included | Included |
| **Total** | **$50** | **$350** |

---

## Dependencies and Prerequisites

### External Dependencies
| Dependency | Status | Owner |
|------------|--------|-------|
| Nixtla API key | Obtained | Engineering |
| Turso Cloud account | Created | Engineering |
| GCP Project | Created | DevOps |
| Domain name | Reserved | Business |
| SendGrid account | Needed | Engineering |

### Internal Dependencies
| Dependency | Phase | Status |
|------------|-------|--------|
| Database migrations | A | Complete |
| API key auth | 10 | Complete |
| Forecast backends | B | Complete |
| Alert rules engine | 9 | Complete |

---

## Rollback Plan

### Phase Rollback
Each phase can be rolled back independently:
1. Revert commit to previous phase
2. Run database migration rollback
3. Redeploy previous version
4. Verify system health

### Production Rollback
1. Blue-green deployment allows instant rollback
2. Database migrations designed for backward compatibility
3. Feature flags for gradual rollout
4. Automated health checks trigger rollback

---

## Communication Plan

### Stakeholder Updates
| Audience | Frequency | Channel |
|----------|-----------|---------|
| Engineering | Daily | Slack #intentvision-dev |
| Leadership | Weekly | Email summary |
| Customers | At release | Release notes |

### Release Notifications
- Pre-release announcement (1 week before)
- Release notes with changelog
- Post-release retrospective

---

## Appendix: Task ID Registry

| Task ID | Phase | Title |
|---------|-------|-------|
| intentvision-c01 | C | Registration API |
| intentvision-c02 | C | Login API |
| intentvision-c03 | C | Email Verification |
| intentvision-c04 | C | Password Reset |
| intentvision-c05 | C | OAuth Integration |
| intentvision-d01 | D | Connection CRUD |
| intentvision-d02 | D | Webhook Connection |
| intentvision-d03 | D | API Connection |
| intentvision-e01 | E | Dashboard API |
| intentvision-e02 | E | Forecast Jobs |
| intentvision-e03 | E | E2E Test Suite |
| intentvision-f01 | F | Cloud Run Deployment |
| intentvision-f02 | F | Monitoring Setup |
| intentvision-f03 | F | Launch Checklist |

---

*Intent Solutions IO - Confidential*
