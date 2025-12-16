# ADR: Sellable Alpha - Plan and Tenant Architecture

**Document ID**: 044-DR-ADRC-sellable-alpha-plan-tenant-architecture
**Date**: 2025-12-16
**Status**: Accepted
**Deciders**: Engineering Team
**Phase**: 10 - Sellable Alpha Shell

---

## Context

IntentVision is transitioning from an internal MVP to a sellable alpha product. This requires:

1. **Multi-tenancy**: Organizations isolated with their own data and limits
2. **Monetization**: Tiered plans with feature gating and usage limits
3. **Self-service**: Customers can onboard without manual intervention
4. **User experience**: Dashboard for managing integrations and settings

## Decision

### 1. Plan Model Architecture

**Decision**: Static plan definitions in code with database-backed usage tracking.

**Rationale**:
- Plans change infrequently; code changes require review and testing
- Usage tracking in Firestore enables real-time limit enforcement
- Avoids complex pricing engine during alpha phase

**Structure**:
```typescript
interface Plan {
  id: PlanId;
  name: string;
  limits: {
    maxMetrics: number;
    maxAlerts: number;
    maxForecastsPerDay: number;
    retentionDays: number;
  };
  features: {
    timegptEnabled: boolean;
    slackEnabled: boolean;
    webhookEnabled: boolean;
    anomalyDetection: boolean;
    apiRateLimitPerMinute: number;
  };
  priceMonthly: number;
  available: boolean;
}
```

### 2. Tenant Onboarding Flow

**Decision**: Single POST /v1/tenants endpoint creates org + user + API key atomically.

**Rationale**:
- Minimizes friction for new customers
- Single transaction prevents partial state
- Returns API key only once (security best practice)

**Flow**:
```
POST /v1/tenants
{
  "name": "Acme Corp",
  "slug": "acme-corp",
  "email": "admin@acme.com"
}

Response:
{
  "organization": { "id": "org-xxx", "slug": "acme-corp", ... },
  "user": { "id": "user-xxx", "email": "admin@acme.com", ... },
  "apiKey": { "key": "iv_xxx...", "keyPrefix": "iv_xxx_" }
}
```

### 3. User Notification Preferences Storage

**Decision**: Store preferences as subcollection under user documents.

**Path**: `users/{userId}/preferences/notifications`

**Rationale**:
- User-scoped data belongs under user document
- Subcollection allows multiple preference types later
- Simple query pattern for preference lookup

**Alternative Considered**: Top-level preferences collection with userId field
- Rejected: Requires compound queries, less natural hierarchy

### 4. Dual Authentication Paths

**Decision**: Maintain separate auth for API keys vs Firebase Auth.

| Use Case | Auth Method | Context |
|----------|-------------|---------|
| API operations | X-API-Key header | AuthContext with scopes |
| Dashboard UI | Firebase ID token | FirebaseAuthContext with uid |

**Rationale**:
- API keys for server-to-server, long-lived operations
- Firebase Auth for user sessions, OAuth flows
- Different security models for different use cases

### 5. Plan Limit Enforcement

**Decision**: Pre-action checks before resource creation.

```typescript
// Before creating a metric
const check = await canCreateMetric(orgId);
if (!check.allowed) {
  throw new Error(check.reason);
}
```

**Rationale**:
- Fail fast with clear error messages
- Prevents partial resource creation
- Enables upgrade prompts in UI

**Alternative Considered**: Post-hoc enforcement with rollback
- Rejected: More complex, worse UX

### 6. Legacy Plan Migration

**Decision**: Map existing `OrganizationPlan` to new `PlanId` system.

```typescript
const planIdMap = {
  beta: 'free',
  starter: 'starter',
  growth: 'growth',
  enterprise: 'enterprise',
};
```

**Rationale**:
- Backward compatible with existing data
- Gradual migration without breaking changes
- Eventually deprecate legacy plan field

## Consequences

### Positive
- Clear monetization path with tiered limits
- Self-service onboarding reduces friction
- Flexible notification preferences per user
- Clean separation of auth concerns

### Negative
- Two auth systems to maintain
- Plan changes require code deployment
- Usage tracking adds Firestore read/writes

### Risks
- Usage counters could drift under high load
- Plan limit changes need careful migration
- Firebase Auth requires proper project setup

## Compliance

- **Data Isolation**: Each org's data in separate subcollections
- **API Key Security**: Hashed storage, single-reveal pattern
- **Email Validation**: Basic format check on input

## Related Documents

- 043-AA-AACR-phase-10-sellable-alpha-shell.md (Implementation AAR)
- 034-AA-AACR-phase-4-saas-control-plane-api-v1.md (API Key architecture)
- 039-AA-AACR-phase-8-notification-preferences-multi-channel-alerts.md (Notification system)

---

*Architecture Decision Record - Phase 10 Sellable Alpha Shell*
