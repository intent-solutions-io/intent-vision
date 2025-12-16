# ADR: Notification Preferences and Alert Routing

> Firestore as source of truth for multi-channel notification preferences

---

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ADR-040 |
| **Status** | `ACCEPTED` |
| **Date** | 2025-12-15 |
| **Decision Maker** | Engineering |
| **Related** | Phase 8, `intentvision-uxb` |

---

## Context

IntentVision needs to notify tenants when alerts are triggered. Different tenants have different notification requirements:

- Some prefer email only
- Some need Slack integration
- Some require PagerDuty for on-call routing
- Some want webhooks for custom integrations

Additionally, notification preferences may vary by:
- Alert severity (info, warning, critical)
- Metric type (e.g., only notify for Stripe metrics)
- User (per-user vs org-wide preferences)

We needed to decide:
1. Where to store notification preferences
2. How to route alerts to the correct channels
3. Which email provider to use
4. How to handle multiple notification channels

---

## Decision

### 1. Firestore for Notification Preferences

**Store all notification preferences in Cloud Firestore**, using environment-prefixed collections for isolation.

**Rationale:**
- Firestore is already used for SaaS state (metrics, forecasts)
- Real-time listeners enable future live preference updates
- Environment prefixing provides dev/stage/prod isolation
- No additional infrastructure required

**Collections:**
```
envs/{env}/orgs/{orgId}/notificationChannels/{channelId}
envs/{env}/orgs/{orgId}/notificationPreferences/{preferenceId}
```

### 2. Resend as Primary Email Provider

**Use Resend for transactional email alerts** via their REST API.

**Rationale:**
- Simple REST API (no SMTP complexity)
- Good deliverability reputation
- Reasonable free tier for development
- Easy domain verification
- Swappable if needed (abstracted behind client module)

**Configuration:**
- `INTENTVISION_RESEND_API_KEY`: API key
- `INTENTVISION_ALERT_FROM_EMAIL`: From address (default: jeremy@intentsolutions.io)

### 3. Multi-Channel Model

**Support four notification channel types:**

| Channel | Implementation | Status |
|---------|---------------|--------|
| `email` | Resend API | Production |
| `slack_webhook` | HTTP POST | Stub |
| `http_webhook` | HTTP POST | Stub |
| `pagerduty` | Events API v2 | Stub |

**Rationale:**
- These cover 95%+ of enterprise notification needs
- All can be implemented via HTTP (no special protocols)
- Stubs allow safe testing without side effects

### 4. Preference Matching Logic

**Match alerts to preferences by:**
1. Organization ID (required match)
2. Severity level (exact match or critical→warning escalation)
3. Metric key pattern (optional, supports wildcards like `stripe:*`)
4. Enabled flag (must be true)

**Rationale:**
- Flexible matching without complex query language
- Wildcards handle common use cases (all Stripe metrics)
- Severity escalation ensures critical alerts notify warning subscribers

### 5. Internal vs External Responsibilities

**AgentFS and Beads remain internal-only tools.**

Customer notification flow:
```
Alert → Firestore Preferences → Channel Dispatch
```

No dependency on:
- AgentFS (Turso) - internal DevOps only
- Beads CLI - internal task tracking only

---

## Consequences

### Positive

- **Unified data store**: All SaaS state in Firestore
- **Flexibility**: Tenants can configure preferences without code changes
- **Scalability**: Firestore handles per-org preferences at scale
- **Extensibility**: Easy to add new channel types
- **Testability**: Stub channels enable safe testing

### Negative

- **Firestore dependency**: Notification routing depends on Firestore availability
- **Query limitations**: Complex preference matching done in application code
- **Stub limitations**: Non-email channels don't actually deliver until implemented

### Neutral

- **Email provider lock-in**: Resend-specific, but abstracted for easy swap
- **Configuration complexity**: More env vars to manage

---

## Alternatives Considered

### 1. Store preferences in Turso (SQLite)

**Rejected because:**
- Turso is for internal AgentFS operations
- Would create dependency between customer flow and internal tooling
- Firestore already established for SaaS state

### 2. Use SendGrid instead of Resend

**Rejected because:**
- More complex API
- Heavier SDK
- Resend is simpler and sufficient for current needs

### 3. Single notification channel per org

**Rejected because:**
- Doesn't meet enterprise requirements
- Many orgs need multiple channels (email + Slack)
- Per-severity routing is common requirement

### 4. Store preferences in-memory only

**Rejected because:**
- Lost on restart
- Doesn't support multiple API instances
- No persistence or audit trail

---

## Implementation Notes

### Adding a New Channel Type

1. Add type to `NotificationChannelType` union
2. Add channel-specific fields to `NotificationChannelConfig`
3. Implement sender function in `alert-dispatcher.ts`
4. Add case to dispatch switch statement

### Testing Alerts

```bash
npm run alert:test -- --org-id my-org --email user@example.com
```

### Environment Variables

```bash
# Required for Firestore
export INTENTVISION_GCP_PROJECT_ID=your-project
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json

# Required for email
export INTENTVISION_RESEND_API_KEY=re_xxxxxxxxx
export INTENTVISION_ALERT_FROM_EMAIL=jeremy@intentsolutions.io
```

---

## References

- [Resend API Documentation](https://resend.com/docs)
- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)
- Phase 8 AAR: `000-docs/039-AA-AACR-phase-8-notification-preferences-multi-channel-alerts.md`

---

*intent solutions io - confidential IP*
*Contact: jeremy@intentsolutions.io*
