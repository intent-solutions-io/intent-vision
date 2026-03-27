# 📋 Product Requirements Document (PRD)

**IntentVision - Time Series Forecasting & Anomaly Detection Platform**

**Metadata**
- Last Updated: 2025-12-15
- Maintainer: Intent Solutions IO
- Status: Phase B Complete (13 phases delivered)

---

## 🚀 1. Product Vision & Problem Statement

### 1.1 One-Liner
**Product Vision:** A pluggable time series forecasting and anomaly detection platform that enables DevOps teams to predict system behavior and detect anomalies before they impact users, reducing MTTR by 80%.

### 1.2 Problem Definition
- **Who hurts today:** DevOps engineers, SREs, and platform teams managing complex systems
- **Current pain points:**
  - Reactive incident response (alerts after impact)
  - No predictive capabilities for capacity planning
  - Siloed monitoring tools with no forecasting
  - Manual threshold tuning for anomaly detection
- **Why now:**
  - AI/ML forecasting costs dropped 90% (Nixtla TimeGPT)
  - Observability market maturing ($50B+ by 2027)
  - Teams demand proactive operations
- **Cost of inaction:**
  - Average outage costs $300K+
  - 60% of incidents are preventable with forecasting

---

## 🎯 2. Objectives & Key Results (OKRs)

### 2.1 Primary Objective
**Objective:** Deliver a production-ready forecasting platform with multi-backend support

### 2.2 Key Results
| KR | Metric | Current | Target | Timeline |
|----|--------|---------|--------|----------|
| KR1 | Forecast backends | 3 | 3 | ✅ Done |
| KR2 | Test coverage | 147 | 147 | ✅ Done |
| KR3 | API endpoints | 5 | 10 | Phase C |
| KR4 | Database tables | 14 | 14 | ✅ Done |

---

## 👥 3. Users & Market Segments

### 3.1 Primary Personas
> **Primary User:** DevOps Engineer / SRE
- **Demographics:** 3-10 years experience, manages 50+ services
- **Goals:** Reduce on-call burden, prevent outages, automate capacity planning
- **Pain Points:** Alert fatigue, manual threshold tuning, no visibility into future
- **Success Metrics:** MTTR reduction, prevented incidents

> **Secondary User:** Platform/Data Engineer
- **Demographics:** Building internal tooling, data pipelines
- **Goals:** Integrate forecasting into existing workflows
- **Relationship to Primary:** Builds tools for DevOps teams

---

## 🎯 4. Product Scope & Prioritization

### 4.1 MVP Features (Delivered)

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Project standardization | ✅ |
| 2 | CI/CD scaffold | ✅ |
| 3 | TypeScript contracts | ✅ |
| 4 | Vertical slice (Ingest→Alert) | ✅ |
| 5 | Cloud-ready packaging | ✅ |
| 6 | Agent workflow baseline | ✅ |
| 7 | Real ingestion + validation | ✅ |
| 8 | Forecast/anomaly evaluation | ✅ |
| 9 | Alerting rules engine | ✅ |
| 10 | Operator auth + dashboard | ✅ |
| 11 | Deployment plan | ✅ |
| A | Stack alignment (Turso) | ✅ |
| B | Nixtla TimeGPT integration | ✅ |

### 4.2 V1.0 Features (Planned)
- User registration/login
- Data source connections (webhook, API, Airbyte)
- Scheduled forecasting jobs
- Alert notification channels

### 4.3 Out of Scope (V1)
- ❌ Multi-region deployment
- ❌ Real-time streaming ingestion
- ❌ Custom ML model training
- ❌ Mobile app

---

## ⚙️ 5. Functional Requirements

### 5.1 Core Pipeline
```
Ingest → Normalize → Store → Forecast → Anomaly → Alert
```

| Component | File | Purpose |
|-----------|------|---------|
| Ingest | `fixture-loader.ts`, `webhook/` | Data ingestion |
| Normalize | `normalizer.ts` | Metric normalization |
| Store | `metric-store.ts` | Turso persistence |
| Forecast | `nixtla-timegpt.ts`, `forecast-service.ts` | Prediction generation |
| Anomaly | `ensemble-detector.ts` | Anomaly detection |
| Alert | `alert-emitter.ts` | Alert emission |

### 5.2 Forecast Backends
| Backend | Type | Use Case |
|---------|------|----------|
| Nixtla TimeGPT | `nixtla-timegpt` | Production ML forecasting |
| Statistical | `custom` | Offline/fallback (Holt-Winters) |
| Stub | `custom` | Development/testing |

### 5.3 Database Tables
**Core (8 tables):** organizations, metrics, time_series, forecasts, anomalies, alerts, alert_rules, ingestion_sources

**SaaS (6 tables):** users, user_org_memberships, connections, api_keys, forecast_jobs, notification_channels

---

## 🚀 6. Non-Functional Requirements

### 6.1 Performance
- **Response Time:** API < 200ms p95
- **Throughput:** 1000 metrics/second ingestion
- **Availability:** 99.9% uptime target
- **Scalability:** 100K organizations

### 6.2 Security
- **Authentication:** API keys with SHA-256 hashing
- **Authorization:** Role-based (owner/admin/member/viewer)
- **Encryption:** TLS in transit, AES at rest
- **Compliance:** GDPR-ready data handling

---

## 📊 7. Success Metrics

### 7.1 Technical Metrics
| Metric | Current | Target |
|--------|---------|--------|
| Tests passing | 147 | 147 ✅ |
| TypeScript files | 413 | - |
| Code coverage | - | 80% |
| Build time | <30s | <30s |

### 7.2 Business Metrics (Post-Launch)
- Monthly Active Users
- Forecasts generated/day
- Alert accuracy rate
- Customer NPS

---

## 📅 8. Release Strategy

### 8.1 Current Status
- **Phase:** B (Nixtla Integration) ✅
- **Commit:** `e6dd5af`
- **Tests:** 147 passing

### 8.2 Next Releases
| Phase | Focus | Status |
|-------|-------|--------|
| C | User auth endpoints | Planned |
| D | Connections pipeline | Planned |
| E | Full integration | Planned |
| F | Production deploy | Planned |

---

## 👥 9. Team

| Role | Name | Responsibilities |
|------|------|------------------|
| Owner | jeremy@intentsolutions.io | Product, architecture |
| AI Pair | Claude Code | Implementation, testing |

---

## 📚 10. Documentation Index

| Doc | Location |
|-----|----------|
| Phase AARs | `000-docs/006-023-AA-*.md` |
| Comprehensive Status | `000-docs/024-AA-SUMM-*.md` |
| Architecture | `000-docs/product/02-ARCH-*.md` |
| Beads Guide | `000-docs/product/03-BEADS-*.md` |

---

**✅ PRD Status:** Complete for delivered phases (1-11, A, B)
