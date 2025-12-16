# Architectural Decision Record: Usage Metering + Plan Enforcement

**Document ID**: 046-DR-ADRC-usage-metering-plan-enforcement
**Phase**: 11
**Date**: 2025-12-16
**Status**: Accepted

---

## Context

IntentVision needs to track usage for:
1. Plan limit enforcement (free tier limits)
2. Admin visibility into tenant usage
3. Future billing integration

## Decision

Implement event-sourced usage metering with real-time limit enforcement.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Request                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Pre-Check: checkUsageLimit()                  │
│         (for expensive ops like forecast/run)               │
│                                                             │
│    ┌──────────────┐                ┌──────────────┐        │
│    │   Allowed    │                │   Blocked    │        │
│    │  Continue    │                │   429 Error  │        │
│    └──────────────┘                └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Execute Operation                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Post-Success: recordUsageEvent()               │
│                  (never throws)                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Model

```typescript
// Stored in: organizations/{orgId}/usageEvents/{eventId}
interface UsageEvent {
  id: string;
  orgId: string;
  planId: string;
  userId?: string;
  eventType: 'forecast_call' | 'alert_fired' | 'metric_ingested' | 'api_call';
  quantity: number;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}
```

### Plan Limits (from plan.ts)

| Plan | Forecasts/Day | Alerts | Metrics | API Rate/min |
|------|--------------|--------|---------|--------------|
| Free | 10 | 5 | 3 | 60 |
| Starter | 100 | 50 | 25 | 300 |
| Growth | 500 | 200 | 100 | 1000 |
| Enterprise | 5000 | 1000 | 1000 | 10000 |

### Enforcement Strategy

1. **Pre-check (blocking)**: Used for expensive operations (forecasts)
   - Query today's usage count
   - Compare against plan limit
   - Return 429 with helpful message if exceeded

2. **Post-record (non-blocking)**: All operations
   - Record event after successful operation
   - Never throw - log errors silently
   - Main operation succeeds even if metering fails

### API Endpoints

| Endpoint | Method | Scope | Description |
|----------|--------|-------|-------------|
| `/admin/orgs/:orgId/usage/today` | GET | admin | Today's usage |
| `/admin/orgs/:orgId/usage/last-30d` | GET | admin | 30-day usage |
| `/admin/orgs/:orgId/usage/overview` | GET | admin | Full overview |

## Alternatives Considered

### 1. Redis for Usage Counters
- **Pros**: Faster, atomic increments
- **Cons**: Additional infrastructure, less audit trail
- **Decision**: Use Firestore for simplicity, optimize later if needed

### 2. Hard Block All Operations
- **Pros**: Guaranteed enforcement
- **Cons**: Poor UX, potential data loss
- **Decision**: Soft block with 429, allow reads to continue

### 3. Pre-aggregated Daily Counters
- **Pros**: Faster queries
- **Cons**: Complex update logic, eventual consistency
- **Decision**: Real-time queries from events, add aggregation later

## Consequences

### Positive
- Complete audit trail of all billable operations
- Real-time limit enforcement prevents abuse
- Admin visibility into tenant behavior
- Foundation for usage-based billing

### Negative
- Query overhead on each forecast request
- Storage growth from individual events
- No sub-day limits (only daily currently)

### Mitigations
- Firestore queries are efficient with proper indexes
- Can add TTL or aggregation job later
- Rate limiting exists separately at API level

## Firestore Indexes Required

```json
{
  "collectionGroup": "usageEvents",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "occurredAt", "order": "ASCENDING" }
  ]
}
```

## Future Work

1. **Billing Integration**: Connect to Stripe for usage-based billing
2. **Pre-aggregation**: Nightly job to compute daily summaries
3. **Usage Alerts**: Notify customers approaching limits
4. **Rate Limiting**: Integrate with existing rate limiter

---

**Decision Made By**: IntentVision Engineering
**Date**: 2025-12-16
