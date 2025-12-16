# Metrics Dashboard and KPIs

> IntentVision - Time Series Forecasting and Anomaly Detection Platform

---

## Document Information

| Field | Value |
|-------|-------|
| **Project** | IntentVision |
| **Document Type** | Metrics Dashboard and KPIs |
| **Version** | 1.0 |
| **Last Updated** | 2025-12-15 |
| **Status** | Active |
| **Review Frequency** | Monthly |

---

## Overview

This document defines the key performance indicators (KPIs) and metrics for monitoring IntentVision's health, performance, and business success.

---

## KPI Categories

### 1. System Health Metrics
Infrastructure and service availability

### 2. Performance Metrics
Response times and throughput

### 3. Business Metrics
Usage, adoption, and revenue indicators

### 4. Quality Metrics
Forecast accuracy and error rates

### 5. Operational Metrics
Team efficiency and incident response

---

## 1. System Health Metrics

### 1.1 Service Availability

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **Uptime** | Service availability percentage | 99.9% | < 99.5% |
| **Health Check Success** | /health endpoint success rate | 100% | < 99% |
| **Error Rate (5xx)** | Server error responses | < 0.1% | > 1% |
| **Error Rate (4xx)** | Client error responses | < 5% | > 10% |

**Dashboard Widget: Service Status**
```
┌─────────────────────────────────────────────────┐
│ Service Health                      ● All Good │
├─────────────────────────────────────────────────┤
│ Pipeline Service    ●  Healthy     99.99%      │
│ Operator Service    ●  Healthy     99.98%      │
│ Database            ●  Healthy     100.0%      │
│ Nixtla API          ●  Healthy     99.95%      │
└─────────────────────────────────────────────────┘
```

### 1.2 Infrastructure Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **CPU Utilization** | Average CPU usage | < 60% | > 80% |
| **Memory Utilization** | Average memory usage | < 70% | > 85% |
| **Instance Count** | Running Cloud Run instances | 1-10 | > 15 |
| **Database Connections** | Active DB connections | < 50 | > 80 |
| **Database Size** | Total database storage | < 5GB | > 8GB |

**Dashboard Widget: Resource Utilization**
```
┌─────────────────────────────────────────────────┐
│ Resource Utilization (24h)                      │
├─────────────────────────────────────────────────┤
│ CPU:    ███████░░░░░░░░░░░░░  35%              │
│ Memory: █████████░░░░░░░░░░░  45%              │
│ DB:     ████░░░░░░░░░░░░░░░░  20%              │
│                                                 │
│ Active Instances: 3                             │
│ Peak Today: 7                                   │
└─────────────────────────────────────────────────┘
```

---

## 2. Performance Metrics

### 2.1 API Latency

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **p50 Latency** | Median response time | < 50ms | > 100ms |
| **p95 Latency** | 95th percentile response | < 200ms | > 500ms |
| **p99 Latency** | 99th percentile response | < 500ms | > 1s |
| **Forecast Latency** | Forecast generation time | < 3s | > 10s |
| **Anomaly Latency** | Anomaly detection time | < 500ms | > 2s |

**Dashboard Widget: Latency Distribution**
```
┌─────────────────────────────────────────────────┐
│ API Latency (Last Hour)                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  p50: 42ms ████████░░░░░░░░░░░░                │
│  p95: 156ms ██████████████░░░░░░                │
│  p99: 423ms ██████████████████░░                │
│                                                 │
│  Trend: ↓ 5% from yesterday                     │
└─────────────────────────────────────────────────┘
```

### 2.2 Throughput Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **Requests/Second** | API request rate | > 100 rps | < 10 rps |
| **Metrics Ingested/Min** | Metrics ingestion rate | > 10K/min | < 1K/min |
| **Forecasts/Hour** | Forecast generation rate | > 100/hour | < 10/hour |
| **Alerts/Hour** | Alert trigger rate | Varies | > 1000/hour |

**Dashboard Widget: Throughput**
```
┌─────────────────────────────────────────────────┐
│ Throughput (Real-time)                          │
├─────────────────────────────────────────────────┤
│                                                 │
│ API Requests:      ▅▆▇█▇▆▅▄▅▆▇█▇▆▅   156 rps  │
│ Metrics Ingested:  ▂▃▄▅▆▇█▇▆▅▄▃▂▃▄   23K/min  │
│ Forecasts:         ▂▂▃▃▄▄▅▅▆▆▇▇██    42/hour  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 3. Business Metrics

### 3.1 Usage Metrics

| Metric | Description | Target | Notes |
|--------|-------------|--------|-------|
| **Active Organizations** | Orgs with activity in last 7 days | Growth | Monthly review |
| **Total Metrics Stored** | Cumulative metric count | Growth | Per org limits |
| **Forecasts Generated** | Total forecasts | Growth | Nixtla API cost |
| **Alerts Triggered** | Total alert triggers | Varies | Customer value |
| **API Keys Active** | Active API keys | Growth | Adoption indicator |

**Dashboard Widget: Usage Overview**
```
┌─────────────────────────────────────────────────┐
│ Usage (This Month)                              │
├─────────────────────────────────────────────────┤
│                                                 │
│ Active Organizations:     42    (+5 from last)  │
│ Metrics Stored:          156M   (+12% MoM)      │
│ Forecasts Generated:     8,432  (+23% MoM)      │
│ Alerts Triggered:        2,156  (-8% MoM)       │
│                                                 │
│ Nixtla API Calls:        8,432  ($84.32 cost)   │
└─────────────────────────────────────────────────┘
```

### 3.2 Adoption Metrics

| Metric | Description | Target | Notes |
|--------|-------------|--------|-------|
| **New Sign-ups** | New organization registrations | 10/week | Growth |
| **Activation Rate** | Sign-ups that ingest first metric | > 60% | Onboarding |
| **Feature Adoption** | % using forecasting | > 50% | Product stickiness |
| **Retention (30-day)** | Orgs active after 30 days | > 70% | Success metric |
| **Churn Rate** | Orgs inactive for 30 days | < 5% | Watch closely |

**Dashboard Widget: Adoption Funnel**
```
┌─────────────────────────────────────────────────┐
│ Adoption Funnel (Last 30 Days)                  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Sign-ups:           ████████████████████  100   │
│ First Metric:       ████████████░░░░░░░░   65   │
│ First Forecast:     █████████░░░░░░░░░░░   45   │
│ First Alert:        ██████░░░░░░░░░░░░░░   32   │
│ Active (Day 30):    █████░░░░░░░░░░░░░░░   28   │
│                                                 │
│ Activation: 65%  |  Retention: 43%              │
└─────────────────────────────────────────────────┘
```

### 3.3 Revenue Metrics (Future)

| Metric | Description | Target | Notes |
|--------|-------------|--------|-------|
| **MRR** | Monthly recurring revenue | Growth | Post-pricing |
| **ARPU** | Average revenue per user | > $50 | Pricing optimization |
| **CAC** | Customer acquisition cost | < $200 | Marketing efficiency |
| **LTV** | Customer lifetime value | > $600 | LTV:CAC > 3:1 |

---

## 4. Quality Metrics

### 4.1 Forecast Accuracy

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **MAE** | Mean Absolute Error | < 10% of mean | > 20% |
| **RMSE** | Root Mean Square Error | < 15% of mean | > 25% |
| **MAPE** | Mean Absolute Percentage Error | < 10% | > 20% |
| **Coverage (95%)** | % actuals within 95% interval | > 90% | < 85% |

**Dashboard Widget: Forecast Accuracy**
```
┌─────────────────────────────────────────────────┐
│ Forecast Accuracy (Last 7 Days)                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ MAE:     5.2%  █████░░░░░  Target: < 10%       │
│ RMSE:    7.8%  ███████░░░  Target: < 15%       │
│ MAPE:    6.1%  ██████░░░░  Target: < 10%       │
│ Coverage: 92%  █████████░  Target: > 90%       │
│                                                 │
│ Best performing: system.cpu.usage (3.2% MAE)    │
│ Needs attention: app.request.count (18% MAPE)   │
└─────────────────────────────────────────────────┘
```

### 4.2 Data Quality

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **Ingestion Success Rate** | Successful metric ingestion | > 99% | < 95% |
| **Validation Failure Rate** | Invalid metrics rejected | < 5% | > 10% |
| **Dead Letter Volume** | Failed records in DLQ | < 100/day | > 1000/day |
| **Duplicate Rate** | Duplicate metrics detected | < 1% | > 5% |

---

## 5. Operational Metrics

### 5.1 Incident Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **MTTR** | Mean Time to Resolution | < 1 hour | > 4 hours |
| **MTBF** | Mean Time Between Failures | > 30 days | < 7 days |
| **Incidents (P1)** | Critical incidents per month | 0 | > 0 |
| **Incidents (P2)** | High severity incidents | < 2/month | > 5/month |
| **SLA Breach** | SLA violations | 0 | > 0 |

**Dashboard Widget: Incident Summary**
```
┌─────────────────────────────────────────────────┐
│ Incident Summary (Last 30 Days)                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ P1 Incidents:  0      ●  No critical issues     │
│ P2 Incidents:  1      ●  Resolved               │
│ P3 Incidents:  4      ●  Resolved               │
│                                                 │
│ MTTR: 23 minutes (target: < 60 min)             │
│ MTBF: 45 days (target: > 30 days)               │
│                                                 │
│ SLA Status: ● 99.95% (target: 99.9%)            │
└─────────────────────────────────────────────────┘
```

### 5.2 Test Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **Test Count** | Total automated tests | 147 (current) | Growth |
| **Test Pass Rate** | % of tests passing | 100% | < 100% |
| **Code Coverage** | % code covered by tests | > 80% | < 70% |
| **Test Duration** | CI test execution time | < 2 min | > 5 min |

---

## Dashboard Layouts

### Executive Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ IntentVision Executive Dashboard                       ● All Services Up │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │ Active Orgs   │  │ Metrics/Day   │  │ Forecasts     │  │ Uptime    │ │
│  │     42        │  │    1.2M       │  │    8,432      │  │  99.99%   │ │
│  │   +5 WoW      │  │   +12% MoM    │  │   +23% MoM    │  │           │ │
│  └───────────────┘  └───────────────┘  └───────────────┘  └───────────┘ │
│                                                                         │
│  Usage Trend (30 Days)               │  Forecast Accuracy               │
│  ▂▃▄▅▆▇█▇▆▅▄▅▆▇█▇▆▅▄▅▆▇█▇▆▅▄▅▆▇█   │  MAE:  5.2%  ████░░░░░░          │
│                                       │  RMSE: 7.8%  ██████░░░░          │
│                                       │  MAPE: 6.1%  █████░░░░░          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Operations Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ IntentVision Operations Dashboard                      Last Update: Now │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Service Health          │  API Latency (p95)      │  Error Rate        │
│  ● Pipeline: Healthy     │  ▃▃▄▄▅▅▆▆▇▇██████▇▆▅   │  0.05%             │
│  ● Operator: Healthy     │  Current: 156ms         │  Target: < 0.1%    │
│  ● Database: Healthy     │  24h Avg:  143ms        │  ● Good            │
│                          │                          │                    │
│  Throughput              │  Resource Usage          │  Alerts Today      │
│  API:     156 rps        │  CPU:    35%  ████░░░░  │  Triggered:  42    │
│  Metrics: 23K/min        │  Memory: 45%  █████░░░  │  Resolved:   38    │
│  Forecasts: 42/hour      │  DB:     20%  ██░░░░░░  │  Active:      4    │
│                                                                         │
│  Recent Incidents                                                       │
│  ● [P3] 2h ago - Nixtla API timeout (resolved, MTTR: 15min)            │
│  ● [P3] 1d ago - High ingestion latency (resolved, MTTR: 22min)        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Engineering Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ IntentVision Engineering Dashboard                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Test Status             │  Build Status           │  Coverage          │
│  147 tests passing       │  ● main: passing        │  Pipeline: 85%     │
│  0 failing               │  ● Last: 3 hours ago    │  Operator: 90%     │
│  Duration: 1m 23s        │  ● Duration: 2m 15s     │  Contracts: 95%    │
│                                                                         │
│  Deployment Status       │  Database               │  Dependencies      │
│  Pipeline: v0.5.0        │  Tables: 14             │  0 vulnerabilities │
│  Operator: v0.5.0        │  Migrations: 2          │  23 packages       │
│  Last Deploy: 2 days ago │  Size: 1.2 GB           │  Last audit: Today │
│                                                                         │
│  Performance Regression                                                 │
│  ● No regressions detected in last 7 days                              │
│  ● Baseline: p95 = 145ms, Current: p95 = 156ms (+7%)                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Alerting Rules

### Critical Alerts (P1) - Page Immediately

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Uptime drops below | 99.5% | Page on-call |
| Error rate exceeds | 5% for 5 min | Page on-call |
| Database unreachable | 1 min | Page on-call |
| All instances unhealthy | Any | Page on-call |

### High Priority Alerts (P2) - Page During Business Hours

| Condition | Threshold | Action |
|-----------|-----------|--------|
| p99 latency exceeds | 2s for 10 min | Page during hours |
| CPU utilization exceeds | 85% for 15 min | Page during hours |
| Dead letter queue exceeds | 1000 items | Page during hours |
| Nixtla API failures | 10% for 10 min | Page during hours |

### Medium Priority Alerts (P3) - Slack Notification

| Condition | Threshold | Action |
|-----------|-----------|--------|
| p95 latency exceeds | 500ms for 30 min | Slack #alerts |
| Memory utilization exceeds | 80% for 30 min | Slack #alerts |
| Forecast accuracy (MAPE) exceeds | 20% for 1 hour | Slack #alerts |
| Test failure in CI | Any | Slack #engineering |

---

## Review Cadence

| Review Type | Frequency | Participants | Focus |
|-------------|-----------|--------------|-------|
| Daily standup | Daily | Engineering | Issues, blockers |
| Weekly metrics | Weekly | Eng + Product | Trends, anomalies |
| Monthly review | Monthly | Leadership | KPIs, strategy |
| Quarterly planning | Quarterly | All | Targets, roadmap |

---

## Appendix: Metric Collection

### Instrumentation

```typescript
// Example: Recording API latency
const startTime = Date.now();
try {
  const result = await handler(request);
  metrics.recordLatency('api.latency', Date.now() - startTime, {
    endpoint: request.path,
    status: 'success',
  });
  return result;
} catch (error) {
  metrics.recordLatency('api.latency', Date.now() - startTime, {
    endpoint: request.path,
    status: 'error',
  });
  throw error;
}
```

### Data Sources

| Metric Type | Source | Collection Method |
|-------------|--------|-------------------|
| Infrastructure | Cloud Monitoring | Automatic |
| API Latency | Application | Custom instrumentation |
| Business Metrics | Database | Scheduled queries |
| Forecast Accuracy | Evaluation framework | Post-prediction |

---

*Intent Solutions IO - Confidential*
