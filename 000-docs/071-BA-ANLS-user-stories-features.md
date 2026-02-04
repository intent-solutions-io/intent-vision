# User Stories

> IntentVision - Time Series Forecasting and Anomaly Detection Platform

---

## Document Information

| Field | Value |
|-------|-------|
| **Project** | IntentVision |
| **Document Type** | User Stories |
| **Version** | 1.0 |
| **Last Updated** | 2025-12-15 |
| **Status** | Active |

---

## Story Format

Each user story follows the standard format:
> **As a** [persona], **I want** [capability], **so that** [benefit].

Stories include:
- **Epic**: Parent feature grouping
- **Priority**: P0 (Critical) / P1 (High) / P2 (Medium) / P3 (Low)
- **Phase**: Implementation phase (1-11, A, B, C-F)
- **Status**: Implemented / In Progress / Planned

---

## Epic 1: Data Ingestion

### US-1.1: Webhook Metric Ingestion
| Field | Value |
|-------|-------|
| **Epic** | Data Ingestion |
| **Priority** | P0 |
| **Phase** | 7 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** to send metrics via webhook,
**so that** I can integrate IntentVision with any data source.

**Acceptance Criteria:**
- [ ] POST endpoint accepts JSON metric payloads
- [ ] Supports batch ingestion (up to 1000 metrics per request)
- [ ] Returns accepted/rejected counts with error details
- [ ] Validates metric format at ingestion boundary
- [ ] Supports idempotency keys for retry safety

**Technical Notes:**
- Implementation: `packages/pipeline/src/ingest/webhook/handler.ts`
- Endpoint: `POST /api/v1/ingest`

---

### US-1.2: Idempotent Ingestion
| Field | Value |
|-------|-------|
| **Epic** | Data Ingestion |
| **Priority** | P1 |
| **Phase** | 7 |
| **Status** | Implemented |

**As a** Platform Engineer,
**I want** idempotent metric ingestion,
**so that** retry logic doesn't create duplicate data.

**Acceptance Criteria:**
- [ ] Idempotency key prevents duplicate processing
- [ ] Cached response returned for duplicate keys
- [ ] TTL configurable for idempotency cache
- [ ] Graceful handling of expired keys

**Technical Notes:**
- Implementation: `packages/pipeline/src/ingest/webhook/idempotency.ts`

---

### US-1.3: Dead Letter Queue
| Field | Value |
|-------|-------|
| **Epic** | Data Ingestion |
| **Priority** | P1 |
| **Phase** | 7 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** failed metrics captured in a dead letter queue,
**so that** I can investigate and reprocess failures.

**Acceptance Criteria:**
- [ ] Failed metrics stored with error context
- [ ] Query API to list dead letter entries
- [ ] Reprocess capability for recovered metrics
- [ ] Automatic cleanup after configurable retention

**Technical Notes:**
- Implementation: `packages/pipeline/src/ingest/webhook/dead-letter.ts`

---

### US-1.4: Multi-Source Ingestion
| Field | Value |
|-------|-------|
| **Epic** | Data Ingestion |
| **Priority** | P2 |
| **Phase** | D |
| **Status** | Planned |

**As a** Platform Engineer,
**I want** to configure multiple ingestion sources per organization,
**so that** teams can consolidate metrics from different systems.

**Acceptance Criteria:**
- [ ] Register multiple source adapters per org
- [ ] Source-specific default dimensions
- [ ] Metric key mapping per source
- [ ] Enable/disable sources without deletion

---

## Epic 2: Time Series Forecasting

### US-2.1: Generate Forecast
| Field | Value |
|-------|-------|
| **Epic** | Forecasting |
| **Priority** | P0 |
| **Phase** | 4, B |
| **Status** | Implemented |

**As a** SRE,
**I want** to generate forecasts for any metric,
**so that** I can predict future values and plan capacity.

**Acceptance Criteria:**
- [ ] Request forecast for specific metric + dimensions
- [ ] Configurable horizon (1-720 periods)
- [ ] Multiple frequency options (1m, 5m, 1h, 1d)
- [ ] Point predictions returned as time series
- [ ] Prediction intervals at 80% and 95% confidence

**Technical Notes:**
- Implementation: `packages/pipeline/src/forecast/forecast-service.ts`
- Backends: Nixtla TimeGPT, Statistical, Stub

---

### US-2.2: Forecast Backend Selection
| Field | Value |
|-------|-------|
| **Epic** | Forecasting |
| **Priority** | P1 |
| **Phase** | B |
| **Status** | Implemented |

**As a** SRE,
**I want** to select different forecast backends,
**so that** I can compare model performance for different use cases.

**Acceptance Criteria:**
- [ ] Query available backends and capabilities
- [ ] Specify preferred backend in forecast request
- [ ] Fallback to default if preferred unavailable
- [ ] Backend type included in forecast response

**Technical Notes:**
- Registry: `packages/pipeline/src/backends/registry.ts`
- Available: `nixtla-timegpt`, `statistical`, `stub`

---

### US-2.3: Forecast Evaluation Metrics
| Field | Value |
|-------|-------|
| **Epic** | Forecasting |
| **Priority** | P0 |
| **Phase** | 8 |
| **Status** | Implemented |

**As a** SRE,
**I want** to evaluate forecast accuracy,
**so that** I can trust predictions and validate model performance.

**Acceptance Criteria:**
- [ ] Calculate MAE (Mean Absolute Error)
- [ ] Calculate RMSE (Root Mean Square Error)
- [ ] Calculate MAPE (Mean Absolute Percentage Error)
- [ ] Compare predictions against actuals
- [ ] Historical accuracy trends

**Technical Notes:**
- Implementation: `packages/pipeline/src/eval/evaluation-framework.ts`

---

### US-2.4: Scheduled Forecasts
| Field | Value |
|-------|-------|
| **Epic** | Forecasting |
| **Priority** | P2 |
| **Phase** | E |
| **Status** | Planned |

**As a** Platform Engineer,
**I want** to schedule recurring forecasts,
**so that** predictions are always fresh without manual triggering.

**Acceptance Criteria:**
- [ ] Create scheduled forecast jobs
- [ ] Configurable schedule (hourly, daily)
- [ ] Job status tracking (pending, running, completed, failed)
- [ ] Automatic retry on failure

---

## Epic 3: Anomaly Detection

### US-3.1: Detect Anomalies
| Field | Value |
|-------|-------|
| **Epic** | Anomaly Detection |
| **Priority** | P0 |
| **Phase** | 4, B |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** automatic anomaly detection on my metrics,
**so that** unusual patterns are identified without manual threshold tuning.

**Acceptance Criteria:**
- [ ] Detect point anomalies in time series
- [ ] Configurable sensitivity (0-1 scale)
- [ ] Severity classification (low, medium, high, critical)
- [ ] Anomaly score indicates confidence
- [ ] Context window around anomaly

**Technical Notes:**
- Implementation: `packages/pipeline/src/anomaly/anomaly-stub.ts`
- Nixtla: `packages/pipeline/src/forecast/nixtla-timegpt.ts` (detectAnomalies)

---

### US-3.2: Anomaly Context
| Field | Value |
|-------|-------|
| **Epic** | Anomaly Detection |
| **Priority** | P1 |
| **Phase** | 4 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** context around detected anomalies,
**so that** I can understand the anomaly in relation to normal behavior.

**Acceptance Criteria:**
- [ ] Data points before anomaly included
- [ ] Data points after anomaly included
- [ ] Statistical context (mean, std_dev, min, max)
- [ ] Configurable context window size

---

### US-3.3: Ensemble Detection
| Field | Value |
|-------|-------|
| **Epic** | Anomaly Detection |
| **Priority** | P2 |
| **Phase** | 8 |
| **Status** | Implemented |

**As a** SRE,
**I want** ensemble anomaly detection,
**so that** I get higher confidence results from multiple methods.

**Acceptance Criteria:**
- [ ] Combine multiple detection methods
- [ ] Configurable method weights
- [ ] Consensus scoring across methods
- [ ] Method breakdown in results

**Technical Notes:**
- Implementation: `packages/pipeline/src/anomaly/ensemble-detector.ts`

---

## Epic 4: Alerting

### US-4.1: Threshold-Based Alerts
| Field | Value |
|-------|-------|
| **Epic** | Alerting |
| **Priority** | P0 |
| **Phase** | 4, 9 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** to create threshold-based alert rules,
**so that** I'm notified when metrics exceed boundaries.

**Acceptance Criteria:**
- [ ] Operators: gt, gte, lt, lte, eq, neq
- [ ] Configurable threshold value
- [ ] Optional duration requirement
- [ ] Dimension filtering

**Technical Notes:**
- Implementation: `packages/pipeline/src/alert/rules-engine.ts`

---

### US-4.2: Anomaly-Based Alerts
| Field | Value |
|-------|-------|
| **Epic** | Alerting |
| **Priority** | P0 |
| **Phase** | 9 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** alerts triggered by anomaly detection,
**so that** I'm notified of unusual patterns without manual thresholds.

**Acceptance Criteria:**
- [ ] Minimum severity filter
- [ ] Anomaly context in alert payload
- [ ] Detection method included
- [ ] Link to anomaly details

---

### US-4.3: Forecast-Based Alerts
| Field | Value |
|-------|-------|
| **Epic** | Alerting |
| **Priority** | P0 |
| **Phase** | 9 |
| **Status** | Implemented |

**As a** SRE,
**I want** alerts based on forecast predictions,
**so that** I can act before predicted issues occur.

**Acceptance Criteria:**
- [ ] Forecast horizon in hours
- [ ] Threshold for predicted value
- [ ] Confidence interval in alert
- [ ] Predicted breach timestamp

---

### US-4.4: Rate of Change Alerts
| Field | Value |
|-------|-------|
| **Epic** | Alerting |
| **Priority** | P1 |
| **Phase** | 9 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** alerts on metric rate of change,
**so that** I detect sudden spikes or drops.

**Acceptance Criteria:**
- [ ] Maximum rate threshold
- [ ] Rate unit (per_minute, per_hour)
- [ ] Window for calculation
- [ ] Current rate in alert

---

### US-4.5: Missing Data Alerts
| Field | Value |
|-------|-------|
| **Epic** | Alerting |
| **Priority** | P1 |
| **Phase** | 9 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** alerts when expected data is missing,
**so that** I know when data collection fails.

**Acceptance Criteria:**
- [ ] Expected interval in milliseconds
- [ ] Last seen timestamp
- [ ] Missing duration in alert
- [ ] Automatic resolution on data arrival

---

### US-4.6: Alert Deduplication
| Field | Value |
|-------|-------|
| **Epic** | Alerting |
| **Priority** | P1 |
| **Phase** | 9 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** alert deduplication,
**so that** I don't receive duplicate notifications for the same issue.

**Acceptance Criteria:**
- [ ] Deduplication window configurable
- [ ] Deduplication key generation
- [ ] Notification count tracking
- [ ] Window reset on resolution

**Technical Notes:**
- Implementation: `packages/pipeline/src/alert/deduplication.ts`

---

### US-4.7: Notification Channels
| Field | Value |
|-------|-------|
| **Epic** | Alerting |
| **Priority** | P1 |
| **Phase** | 9 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** multiple notification channels,
**so that** I receive alerts through preferred methods.

**Acceptance Criteria:**
- [ ] Email notifications
- [ ] Slack webhooks
- [ ] Generic webhooks
- [ ] PagerDuty integration
- [ ] Channel-specific configuration

**Technical Notes:**
- Implementation: `packages/pipeline/src/alert/notification-channels.ts`

---

### US-4.8: Alert Lifecycle Management
| Field | Value |
|-------|-------|
| **Epic** | Alerting |
| **Priority** | P1 |
| **Phase** | 9 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** to track alert lifecycle,
**so that** I can acknowledge and resolve alerts.

**Acceptance Criteria:**
- [ ] States: firing, pending, acknowledged, resolved, suppressed
- [ ] Timestamp tracking for each transition
- [ ] Acknowledged by user tracking
- [ ] Auto-resolve on condition clear

**Technical Notes:**
- Implementation: `packages/pipeline/src/alert/lifecycle.ts`

---

## Epic 5: Authentication & Authorization

### US-5.1: API Key Authentication
| Field | Value |
|-------|-------|
| **Epic** | Auth |
| **Priority** | P0 |
| **Phase** | 10, A |
| **Status** | Implemented |

**As a** Platform Engineer,
**I want** API key authentication,
**so that** external systems can securely access IntentVision.

**Acceptance Criteria:**
- [ ] Generate new API keys
- [ ] SHA-256 secure key storage
- [ ] Key validation on every request
- [ ] Key expiration support
- [ ] Key revocation capability

**Technical Notes:**
- Implementation: `packages/operator/src/auth/api-key.ts`
- Key format: `iv_[base64url-24-bytes]`

---

### US-5.2: API Key Scopes
| Field | Value |
|-------|-------|
| **Epic** | Auth |
| **Priority** | P1 |
| **Phase** | 10 |
| **Status** | Implemented |

**As a** Platform Engineer,
**I want** scoped API keys,
**so that** I can grant least-privilege access.

**Acceptance Criteria:**
- [ ] Read scope for queries
- [ ] Write scope for ingestion
- [ ] Admin scope for configuration
- [ ] Wildcard scope for full access
- [ ] Scope validation on protected endpoints

---

### US-5.3: Request Rate Limiting
| Field | Value |
|-------|-------|
| **Epic** | Auth |
| **Priority** | P1 |
| **Phase** | 10 |
| **Status** | Implemented |

**As a** Platform Engineer,
**I want** per-key rate limiting,
**so that** no single consumer can overwhelm the system.

**Acceptance Criteria:**
- [ ] Configurable rate limit per key
- [ ] Default rate limit for new keys
- [ ] Rate limit headers in response
- [ ] Graceful rate limit exceeded response

---

### US-5.4: User Authentication
| Field | Value |
|-------|-------|
| **Epic** | Auth |
| **Priority** | P0 |
| **Phase** | C |
| **Status** | Planned |

**As a** DevOps Engineer,
**I want** user account authentication,
**so that** I can log in to the dashboard.

**Acceptance Criteria:**
- [ ] Email/password registration
- [ ] Email verification flow
- [ ] Password reset capability
- [ ] Session management
- [ ] OAuth integration (Google, GitHub)

---

## Epic 6: Multi-Tenancy

### US-6.1: Organization Isolation
| Field | Value |
|-------|-------|
| **Epic** | Multi-Tenancy |
| **Priority** | P0 |
| **Phase** | 10 |
| **Status** | Implemented |

**As a** Platform Engineer,
**I want** organization-level isolation,
**so that** each team's data is separate and secure.

**Acceptance Criteria:**
- [ ] All data scoped to org_id
- [ ] Cross-org access prevented
- [ ] Org filter applied to all queries
- [ ] API keys bound to specific org

**Technical Notes:**
- Implementation: `packages/operator/src/tenant/context.ts`

---

### US-6.2: Tenant Context Propagation
| Field | Value |
|-------|-------|
| **Epic** | Multi-Tenancy |
| **Priority** | P1 |
| **Phase** | 10 |
| **Status** | Implemented |

**As a** Platform Engineer,
**I want** tenant context throughout requests,
**so that** all operations are scoped correctly.

**Acceptance Criteria:**
- [ ] Request ID generated per request
- [ ] Org ID propagated to all layers
- [ ] Context cleanup on completion
- [ ] Context metadata support

---

### US-6.3: User-Organization Membership
| Field | Value |
|-------|-------|
| **Epic** | Multi-Tenancy |
| **Priority** | P1 |
| **Phase** | C |
| **Status** | Planned |

**As a** Platform Engineer,
**I want** users to belong to multiple organizations,
**so that** consultants and contractors can access multiple workspaces.

**Acceptance Criteria:**
- [ ] Many-to-many user-org relationship
- [ ] Role per membership (owner, admin, member, viewer)
- [ ] Default organization setting
- [ ] Invitation workflow

---

## Epic 7: Storage & Persistence

### US-7.1: Metric Storage
| Field | Value |
|-------|-------|
| **Epic** | Storage |
| **Priority** | P0 |
| **Phase** | 4 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** metrics stored durably,
**so that** historical data is available for analysis.

**Acceptance Criteria:**
- [ ] Batch insert support
- [ ] Duplicate detection
- [ ] Indexed by org + metric key
- [ ] Indexed by timestamp

**Technical Notes:**
- Implementation: `packages/pipeline/src/store/metric-store.ts`

---

### US-7.2: Time Series Queries
| Field | Value |
|-------|-------|
| **Epic** | Storage |
| **Priority** | P0 |
| **Phase** | 4 |
| **Status** | Implemented |

**As a** SRE,
**I want** to query metrics as time series,
**so that** I can analyze trends and patterns.

**Acceptance Criteria:**
- [ ] Filter by org, metric key, dimensions
- [ ] Time range filtering
- [ ] Pagination support
- [ ] Return as TimeSeries object

---

### US-7.3: Database Migrations
| Field | Value |
|-------|-------|
| **Epic** | Storage |
| **Priority** | P0 |
| **Phase** | A |
| **Status** | Implemented |

**As a** Platform Engineer,
**I want** database migrations,
**so that** schema changes are versioned and repeatable.

**Acceptance Criteria:**
- [ ] SQL-based migration files
- [ ] Migration tracking table
- [ ] Idempotent migration runner
- [ ] Migration status query

**Technical Notes:**
- Implementation: `db/config.ts` (runMigrations)
- Migrations: `db/migrations/*.sql`

---

## Epic 8: Observability

### US-8.1: Structured Logging
| Field | Value |
|-------|-------|
| **Epic** | Observability |
| **Priority** | P1 |
| **Phase** | 4 |
| **Status** | Implemented |

**As a** DevOps Engineer,
**I want** structured JSON logging,
**so that** logs are queryable in log aggregation systems.

**Acceptance Criteria:**
- [ ] JSON log format
- [ ] Correlation ID in all logs
- [ ] Component tags
- [ ] Log levels (debug, info, warn, error)

**Technical Notes:**
- Implementation: `packages/pipeline/src/observability/logger.ts`

---

## Story Summary by Phase

### Completed (Phases 1-11, A, B)

| Story | Title | Phase |
|-------|-------|-------|
| US-1.1 | Webhook Metric Ingestion | 7 |
| US-1.2 | Idempotent Ingestion | 7 |
| US-1.3 | Dead Letter Queue | 7 |
| US-2.1 | Generate Forecast | 4, B |
| US-2.2 | Forecast Backend Selection | B |
| US-2.3 | Forecast Evaluation Metrics | 8 |
| US-3.1 | Detect Anomalies | 4, B |
| US-3.2 | Anomaly Context | 4 |
| US-3.3 | Ensemble Detection | 8 |
| US-4.1 | Threshold-Based Alerts | 4, 9 |
| US-4.2 | Anomaly-Based Alerts | 9 |
| US-4.3 | Forecast-Based Alerts | 9 |
| US-4.4 | Rate of Change Alerts | 9 |
| US-4.5 | Missing Data Alerts | 9 |
| US-4.6 | Alert Deduplication | 9 |
| US-4.7 | Notification Channels | 9 |
| US-4.8 | Alert Lifecycle Management | 9 |
| US-5.1 | API Key Authentication | 10, A |
| US-5.2 | API Key Scopes | 10 |
| US-5.3 | Request Rate Limiting | 10 |
| US-6.1 | Organization Isolation | 10 |
| US-6.2 | Tenant Context Propagation | 10 |
| US-7.1 | Metric Storage | 4 |
| US-7.2 | Time Series Queries | 4 |
| US-7.3 | Database Migrations | A |
| US-8.1 | Structured Logging | 4 |

### Planned (Phases C-F)

| Story | Title | Phase |
|-------|-------|-------|
| US-1.4 | Multi-Source Ingestion | D |
| US-2.4 | Scheduled Forecasts | E |
| US-5.4 | User Authentication | C |
| US-6.3 | User-Organization Membership | C |

---

## Backlog Prioritization

### P0 - Critical (Must Have)
- US-5.4: User Authentication (Phase C)

### P1 - High (Should Have)
- US-1.4: Multi-Source Ingestion (Phase D)
- US-2.4: Scheduled Forecasts (Phase E)
- US-6.3: User-Organization Membership (Phase C)

### P2 - Medium (Nice to Have)
- Dashboard visualizations
- Historical trend analysis
- Cost monitoring integration

### P3 - Low (Future)
- Mobile notifications
- GraphQL API
- Custom model training

---

*Intent Solutions IO - Confidential*
