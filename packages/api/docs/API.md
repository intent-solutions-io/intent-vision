# IntentVision Public API v1

> Phase 4: Production SaaS Control Plane + Public API v1
> Beads Task: intentvision-p88

## Overview

IntentVision provides a RESTful API for time series forecasting and alerting. This document covers the public API endpoints available in v0.4.0.

## Base URL

```
https://api.intentvision.io/v1
```

For local development:
```
http://localhost:8080/v1
```

## Authentication

All API requests require an API key. Include it in one of these headers:

```bash
# Option 1: X-API-Key header (recommended)
curl -H "X-API-Key: iv_abc123..." https://api.intentvision.io/v1/forecast

# Option 2: Authorization Bearer token
curl -H "Authorization: Bearer iv_abc123..." https://api.intentvision.io/v1/forecast
```

### API Key Format

API keys follow the format: `iv_{org_prefix}_{random_string}`

Example: `iv_dev001_k8s7d6f5a4s3d2f1`

### Scopes

API keys are assigned scopes that control access:

| Scope | Description | Endpoints |
|-------|-------------|-----------|
| `ingest:write` | Write time series data | `POST /v1/ingest/timeseries` |
| `metrics:read` | Read metrics and forecasts | `GET /v1/forecast`, `POST /v1/forecast/run` |
| `alerts:read` | Read alert rules and events | `GET /v1/alerts/*` |
| `alerts:write` | Manage alert rules | `POST/PATCH/DELETE /v1/alerts/*` |
| `admin` | Full access | All endpoints |

Legacy scopes (`ingest`, `forecast`, `read`) are still supported for backward compatibility.

---

## Response Format

All responses follow this structure:

```json
{
  "success": true,
  "requestId": "req-abc123",
  "timestamp": "2025-12-15T00:00:00.000Z",
  "data": { ... },
  "durationMs": 45
}
```

Error responses:

```json
{
  "success": false,
  "requestId": "req-abc123",
  "timestamp": "2025-12-15T00:00:00.000Z",
  "error": "Error message here"
}
```

---

## Endpoints

### Health Check

#### `GET /health`

Check API health status. No authentication required.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.4.0",
  "uptime": 3600,
  "checks": {
    "firestore": true
  }
}
```

---

### Time Series Ingestion

#### `POST /v1/ingest/timeseries`

Ingest time series data for a metric.

**Required Scope:** `ingest:write` or `admin`

**Request Body:**
```json
{
  "metricName": "mrr",
  "points": [
    {
      "timestamp": "2025-12-15T00:00:00.000Z",
      "value": 10000,
      "metadata": { "source": "stripe" }
    },
    {
      "timestamp": "2025-12-16T00:00:00.000Z",
      "value": 10500
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "req-abc123",
  "timestamp": "2025-12-15T00:00:00.000Z",
  "data": {
    "metricId": "metric-xyz789",
    "metricName": "mrr",
    "pointsIngested": 2,
    "duplicatesSkipped": 0
  }
}
```

---

### Forecasting

#### `POST /v1/forecast/run`

Generate a forecast for a metric.

**Required Scope:** `metrics:read` or `admin`

**Request Body:**
```json
{
  "metricName": "mrr",
  "horizonDays": 7,
  "backend": "statistical"
}
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `metricName` | string | Yes | - | Name of the metric to forecast |
| `horizonDays` | number | No | 7 | Number of days to forecast |
| `backend` | string | No | "statistical" | Forecast backend ("statistical" or "nixtla") |

**Response:**
```json
{
  "success": true,
  "requestId": "req-abc123",
  "timestamp": "2025-12-15T00:00:00.000Z",
  "data": {
    "forecastId": "fc-xyz789",
    "metricName": "mrr",
    "horizonDays": 7,
    "backend": "statistical",
    "pointsGenerated": 7,
    "status": "completed"
  }
}
```

#### `GET /v1/forecast`

Retrieve forecasts for a metric.

**Required Scope:** `metrics:read` or `admin`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `metricName` | string | Yes | - | Name of the metric |
| `limit` | number | No | 10 | Maximum forecasts to return |
| `latestOnly` | boolean | No | false | Return only the latest forecast |

**Example:**
```bash
curl "http://localhost:8080/v1/forecast?metricName=mrr&latestOnly=true" \
  -H "X-API-Key: iv_abc123..."
```

**Response:**
```json
{
  "success": true,
  "requestId": "req-abc123",
  "timestamp": "2025-12-15T00:00:00.000Z",
  "data": {
    "forecasts": [
      {
        "id": "fc-xyz789",
        "metricName": "mrr",
        "horizonDays": 7,
        "backend": "statistical",
        "status": "completed",
        "predictions": [
          {
            "timestamp": "2025-12-16T00:00:00.000Z",
            "predictedValue": 10750,
            "confidenceLower": 10200,
            "confidenceUpper": 11300,
            "confidenceLevel": 0.95
          }
        ],
        "createdAt": "2025-12-15T00:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

### Alert Rules

#### `POST /v1/alerts/rules`

Create a new alert rule.

**Required Scope:** `alerts:write` or `admin`

**Request Body (Phase 4 - Condition-based with Channels):**
```json
{
  "name": "MRR Drop Alert",
  "metricName": "mrr",
  "type": "threshold",
  "condition": {
    "operator": "lt",
    "value": 9000
  },
  "horizonDays": 7,
  "channels": [
    {
      "type": "email",
      "to": ["alerts@company.com", "ceo@company.com"],
      "isPrimary": true,
      "enabled": true
    }
  ],
  "description": "Alert when MRR forecast drops below $9,000",
  "enabled": true
}
```

**Request Body (Legacy - Direction-based with Single Email):**
```json
{
  "metricName": "mrr",
  "direction": "below",
  "threshold": 9000,
  "horizonDays": 7,
  "email": "alerts@company.com",
  "enabled": true
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No | Human-readable alert name |
| `metricName` | string | Yes | Metric to monitor |
| `type` | string | No | "threshold" or "anomaly" (default: "threshold") |
| `condition.operator` | string | Yes* | "gt", "lt", "gte", "lte" |
| `condition.value` | number | Yes* | Threshold value |
| `direction` | string | Yes** | "above" or "below" (legacy) |
| `threshold` | number | Yes** | Threshold value (legacy) |
| `horizonDays` | number | No | Forecast horizon (default: 7) |
| `channels` | array | Yes* | Notification channels |
| `email` | string | Yes** | Single email (legacy) |
| `enabled` | boolean | No | Whether rule is active (default: true) |

*Required for Phase 4 format
**Required for legacy format

**Channel Types:**

| Type | Status | Configuration |
|------|--------|---------------|
| `email` | Implemented | `{ type: "email", to: ["email@..."], enabled: true }` |
| `slack` | Future | `{ type: "slack", slackChannel: "#alerts" }` |
| `webhook` | Future | `{ type: "webhook", webhookUrl: "https://..." }` |
| `sms` | Future | `{ type: "sms", to: ["+1..."] }` |

**Response:**
```json
{
  "success": true,
  "requestId": "req-abc123",
  "timestamp": "2025-12-15T00:00:00.000Z",
  "data": {
    "alert": {
      "id": "rule-xyz789",
      "name": "MRR Drop Alert",
      "metricName": "mrr",
      "type": "threshold",
      "condition": { "operator": "lt", "value": 9000 },
      "horizonDays": 7,
      "channels": [...],
      "enabled": true,
      "createdAt": "2025-12-15T00:00:00.000Z"
    }
  }
}
```

#### `GET /v1/alerts/rules`

List all alert rules.

**Required Scope:** `alerts:read` or `admin`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `metricName` | string | - | Filter by metric |
| `enabledOnly` | boolean | false | Only return enabled rules |

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [...],
    "total": 5
  }
}
```

#### `GET /v1/alerts/rules/:id`

Get a specific alert rule.

**Required Scope:** `alerts:read` or `admin`

#### `PATCH /v1/alerts/rules/:id`

Update an alert rule. All fields are optional.

**Required Scope:** `alerts:write` or `admin`

**Request Body:**
```json
{
  "enabled": false,
  "channels": [
    {
      "type": "email",
      "to": ["new-email@company.com"],
      "enabled": true
    }
  ]
}
```

#### `DELETE /v1/alerts/rules/:id`

Delete an alert rule.

**Required Scope:** `alerts:write` or `admin`

---

### Alert Evaluation

#### `POST /v1/alerts/evaluate`

Evaluate all enabled alert rules against the latest forecasts and send notifications.

**Required Scope:** `alerts:write` or `admin`

**Request Body:**
```json
{
  "metricName": "mrr"  // Optional: filter to specific metric
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rulesEvaluated": 5,
    "rulesTriggered": 1,
    "results": [
      {
        "ruleId": "rule-xyz789",
        "metricName": "mrr",
        "triggered": true,
        "triggerValue": 8500,
        "threshold": 9000,
        "condition": { "operator": "lt", "value": 9000 },
        "channelResults": [
          {
            "type": "email",
            "sent": true
          }
        ],
        "emailSent": true
      }
    ]
  }
}
```

---

## Error Codes

| HTTP Status | Error | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Invalid request body or parameters |
| 401 | Unauthorized | Missing or invalid API key |
| 403 | Forbidden | Insufficient scope permissions |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error |

---

## Rate Limiting

API keys can have rate limits configured per minute. Default is unlimited.

When rate limited, you'll receive:
```json
{
  "success": false,
  "error": "Rate limit exceeded. Try again in 60 seconds."
}
```

---

## Examples

### Complete Workflow

```bash
# 1. Ingest data
curl -X POST http://localhost:8080/v1/ingest/timeseries \
  -H "Content-Type: application/json" \
  -H "X-API-Key: iv_abc123..." \
  -d '{
    "metricName": "mrr",
    "points": [
      {"timestamp": "2025-12-01", "value": 10000},
      {"timestamp": "2025-12-02", "value": 10100},
      {"timestamp": "2025-12-03", "value": 10200}
    ]
  }'

# 2. Generate forecast
curl -X POST http://localhost:8080/v1/forecast/run \
  -H "Content-Type: application/json" \
  -H "X-API-Key: iv_abc123..." \
  -d '{"metricName": "mrr", "horizonDays": 7}'

# 3. Create alert with user-configurable channels
curl -X POST http://localhost:8080/v1/alerts/rules \
  -H "Content-Type: application/json" \
  -H "X-API-Key: iv_abc123..." \
  -d '{
    "name": "MRR Alert",
    "metricName": "mrr",
    "condition": {"operator": "lt", "value": 9500},
    "channels": [
      {"type": "email", "to": ["team@company.com"], "enabled": true}
    ]
  }'

# 4. Evaluate alerts
curl -X POST http://localhost:8080/v1/alerts/evaluate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: iv_abc123..." \
  -d '{}'
```

---

## Changelog

### v0.4.0 (Phase 4)
- Added user-configurable notification channels
- Added condition-based alerts (operator: gt, lt, gte, lte)
- Added new scopes: `ingest:write`, `metrics:read`, `alerts:read`, `alerts:write`
- Added per-channel delivery results in alert events
- Added Organization plan and slug fields
- Maintained backward compatibility with legacy scopes and single-email alerts

### v0.3.0 (Phase 2)
- Added alert rules and evaluation
- Added Resend email notifications
- Added alert events tracking

### v0.2.0 (Phase 1)
- Initial release with time series ingestion
- Statistical forecasting backend
- API key authentication

---

*IntentVision - Predictive Analytics for SaaS*
*Contact: jeremy@intentsolutions.io*
