# Phase 2 AAR - Email Alerts via Resend

> Alert rules and email notifications for forecast thresholds

---

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | `2 - Email Alerts via Resend` |
| **Repo/App** | `intentvision` |
| **Owner** | Engineering |
| **Date/Time (CST)** | 2025-12-15 23:30 CST |
| **Status** | `FINAL` |
| **Related Issues/PRs** | Epic: `intentvision-8aj` |
| **Commit(s)** | Pending |

---

## Beads / Task IDs Touched

| Task ID | Status | Title |
|---------|--------|-------|
| `intentvision-8aj` | `completed` | Phase 2 Email Alerts Epic |
| `intentvision-8aj.1` | `completed` | Extend Firestore schema for alertRules/alertEvents |
| `intentvision-8aj.2` | `completed` | Create Resend notification client wrapper |
| `intentvision-8aj.3` | `completed` | Implement alert rule management endpoints |
| `intentvision-8aj.4` | `completed` | Implement alert evaluation endpoint |
| `intentvision-8aj.5` | `completed` | Create Phase 2 AAR document |

**Beads Status:** `Active`

---

## Executive Summary

- Extended Firestore schema with `alertRules` and `alertEvents` collections
- Created Resend email client wrapper for sending alert notifications
- Implemented full CRUD API for alert rule management
- Implemented alert evaluation endpoint that checks forecasts against thresholds
- Beautiful HTML email templates for alert notifications
- Version bumped to 0.3.0

---

## What Changed

### New Files Created

| File | Purpose |
|------|---------|
| `packages/api/src/notifications/resend.ts` | Resend API client wrapper |
| `packages/api/src/routes/alerts.ts` | Alert rule and evaluation endpoints |

### Files Modified

| File | Changes |
|------|---------|
| `packages/api/src/firestore/schema.ts` | Added AlertRule, AlertEvent types |
| `packages/api/src/index.ts` | Added alert routes, bumped to v0.3.0 |

---

## Firestore Schema Extensions

### New Collections

```
organizations/{orgId}/alertRules/{ruleId}
organizations/{orgId}/alertEvents/{eventId}
```

### Example Documents

**Alert Rule**
```json
{
  "id": "rule_abc123",
  "orgId": "org-dev-001",
  "metricName": "mrr",
  "direction": "below",
  "threshold": 10000,
  "horizonDays": 7,
  "email": "alerts@company.com",
  "enabled": true,
  "description": "MRR dropping below $10k",
  "createdAt": "2025-12-15T23:30:00Z",
  "updatedAt": "2025-12-15T23:30:00Z"
}
```

**Alert Event**
```json
{
  "id": "event_def456",
  "orgId": "org-dev-001",
  "ruleId": "rule_abc123",
  "metricName": "mrr",
  "triggeredAt": "2025-12-15T23:35:00Z",
  "triggerValue": 9500.50,
  "threshold": 10000,
  "direction": "below",
  "email": "alerts@company.com",
  "deliveryStatus": "sent",
  "resendMessageId": "re_abc123def456"
}
```

---

## API Endpoints

### POST /v1/alerts/rules

Create a new alert rule.

**Request**
```bash
curl -X POST http://localhost:8080/v1/alerts/rules \
  -H "Content-Type: application/json" \
  -H "X-API-Key: iv_abc123..." \
  -d '{
    "metricName": "mrr",
    "direction": "below",
    "threshold": 10000,
    "horizonDays": 7,
    "email": "alerts@company.com",
    "enabled": true,
    "description": "Alert when MRR forecast drops below $10k"
  }'
```

**Response**
```json
{
  "success": true,
  "requestId": "req-abc123",
  "timestamp": "2025-12-15T23:30:00Z",
  "data": {
    "rule": {
      "id": "rule_abc123",
      "orgId": "org-dev-001",
      "metricName": "mrr",
      "direction": "below",
      "threshold": 10000,
      "horizonDays": 7,
      "email": "alerts@company.com",
      "enabled": true,
      "description": "Alert when MRR forecast drops below $10k",
      "createdAt": "2025-12-15T23:30:00Z",
      "updatedAt": "2025-12-15T23:30:00Z"
    }
  }
}
```

### GET /v1/alerts/rules

List all alert rules for the organization.

**Request**
```bash
curl "http://localhost:8080/v1/alerts/rules?enabledOnly=true" \
  -H "X-API-Key: iv_abc123..."
```

**Response**
```json
{
  "success": true,
  "requestId": "req-def456",
  "timestamp": "2025-12-15T23:30:00Z",
  "data": {
    "rules": [...],
    "total": 5
  }
}
```

### GET /v1/alerts/rules/:id

Get a specific alert rule.

### PATCH /v1/alerts/rules/:id

Update an alert rule.

**Request**
```bash
curl -X PATCH http://localhost:8080/v1/alerts/rules/rule_abc123 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: iv_abc123..." \
  -d '{
    "threshold": 9000,
    "enabled": false
  }'
```

### DELETE /v1/alerts/rules/:id

Delete an alert rule.

### POST /v1/alerts/evaluate

Evaluate all enabled alert rules against latest forecasts.

**Request**
```bash
curl -X POST http://localhost:8080/v1/alerts/evaluate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: iv_abc123..." \
  -d '{
    "metricName": "mrr"
  }'
```

**Response**
```json
{
  "success": true,
  "requestId": "req-ghi789",
  "timestamp": "2025-12-15T23:35:00Z",
  "data": {
    "rulesEvaluated": 3,
    "rulesTriggered": 1,
    "results": [
      {
        "ruleId": "rule_abc123",
        "metricName": "mrr",
        "triggered": true,
        "triggerValue": 9500.50,
        "threshold": 10000,
        "direction": "below",
        "emailSent": true
      },
      {
        "ruleId": "rule_def456",
        "metricName": "mrr",
        "triggered": false,
        "threshold": 5000,
        "direction": "below",
        "emailSent": false
      }
    ]
  }
}
```

---

## Resend Integration

### Configuration

| Environment Variable | Purpose | Default |
|---------------------|---------|---------|
| `RESEND_API_KEY` | API key for Resend service | Required |
| `RESEND_FROM_EMAIL` | Sender email address | `alerts@intentvision.io` |

### Email Template

Beautiful HTML emails with:
- Gradient header with IntentVision branding
- Clear alert condition display
- Color-coded trigger values (red for above, amber for below)
- Plain text fallback for all email clients

---

## Scopes

| Endpoint | Required Scope |
|----------|----------------|
| POST /v1/alerts/rules | `admin` |
| GET /v1/alerts/rules | `read` |
| GET /v1/alerts/rules/:id | `read` |
| PATCH /v1/alerts/rules/:id | `admin` |
| DELETE /v1/alerts/rules/:id | `admin` |
| POST /v1/alerts/evaluate | `admin` |

---

## How to Verify

```bash
# Step 1: Ensure Firestore emulator is running
firebase emulators:start --only firestore

# Step 2: Start API server (in another terminal)
export FIRESTORE_EMULATOR_HOST=localhost:8081
export RESEND_API_KEY=re_test_xxx  # Optional for testing
npm run dev:api

# Step 3: Run seed script (generates API key)
npm run seed:dev

# Step 4: Create an alert rule
curl -X POST http://localhost:8080/v1/alerts/rules \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -d '{
    "metricName": "mrr",
    "direction": "below",
    "threshold": 10000,
    "email": "test@example.com"
  }'

# Step 5: Run a forecast
curl -X POST http://localhost:8080/v1/forecast/run \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -d '{"metricName": "mrr", "horizonDays": 7}'

# Step 6: Evaluate alerts
curl -X POST http://localhost:8080/v1/alerts/evaluate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -d '{}'
```

---

## Risks / Gotchas

- **Resend API key required for emails**: Without `RESEND_API_KEY`, alerts will be recorded but not delivered
- **Admin scope required**: Most alert operations require `admin` scope
- **No deduplication**: Evaluating the same rules multiple times may send multiple emails
- **No rate limiting**: Production needs rate limiting on alert emails

---

## Rollback Plan

1. Revert alert route additions in `packages/api/src/index.ts`
2. Remove `packages/api/src/routes/alerts.ts`
3. Remove `packages/api/src/notifications/resend.ts`
4. Remove alert types from `packages/api/src/firestore/schema.ts`
5. Revert version to 0.2.0

---

## Open Questions

- [ ] Email deduplication strategy (time window? per rule?)
- [ ] Should alert evaluation be scheduled (cron) or on-demand only?
- [ ] Webhook support in addition to email?
- [ ] Alert history retention policy?

---

## Next Actions

| Action | Owner | Due |
|--------|-------|-----|
| Add Firestore indexes for alert queries | Engineering | Phase 3 |
| Implement rate limiting on alert emails | Engineering | Phase 3 |
| Add alert deduplication logic | Engineering | Phase 3 |
| Dashboard UI for alert management | Engineering | Future |

---

## Evidence Links / Artifacts

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `packages/api/src/notifications/resend.ts` | `created` | Email client |
| `packages/api/src/routes/alerts.ts` | `created` | Alert endpoints |
| `packages/api/src/firestore/schema.ts` | `modified` | Alert types |
| `packages/api/src/index.ts` | `modified` | Route wiring, v0.3.0 |

### Commits

| Hash | Message |
|------|---------|
| `pending` | `feat: Phase 2 Email Alerts via Resend [Epic: intentvision-8aj]` |

### AgentFS Snapshots

| Snapshot ID | Timestamp | Description |
|-------------|-----------|-------------|
| N/A | - | No snapshots this phase |

**AgentFS Status:** `Active` (not used this phase)

---

## Phase Completion Checklist

- [x] Firestore schema extended for alertRules and alertEvents
- [x] Resend notification client wrapper created
- [x] POST /v1/alerts/rules endpoint exists
- [x] GET /v1/alerts/rules endpoint exists
- [x] GET /v1/alerts/rules/:id endpoint exists
- [x] PATCH /v1/alerts/rules/:id endpoint exists
- [x] DELETE /v1/alerts/rules/:id endpoint exists
- [x] POST /v1/alerts/evaluate endpoint exists
- [x] Alert evaluation sends emails via Resend
- [x] Phase 2 AAR created with Doc-Filing v4
- [x] Beads Task IDs referenced
- [x] No internal tooling in public API

---

## Exit Criteria Summary

| Criterion | Status |
|-----------|--------|
| AlertRule and AlertEvent types in schema | PASS |
| Resend client wrapper | PASS |
| CRUD endpoints for alert rules | PASS |
| Alert evaluation endpoint | PASS |
| Email delivery via Resend | PASS |
| Phase 2 AAR with Beads Task IDs | PASS |
| No internal tools in public API | PASS |

**Phase 2 Complete. Ready for Phase 3 (Advanced Features).**

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
