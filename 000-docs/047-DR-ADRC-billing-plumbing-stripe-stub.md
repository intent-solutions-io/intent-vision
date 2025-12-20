# ADR: Billing Plumbing - Snapshot Model and Stripe Abstraction

**Document ID**: 047-DR-ADRC-billing-plumbing-stripe-stub
**Phase**: 12
**Date**: 2025-12-16
**Status**: Accepted
**Deciders**: Engineering Team

---

## Context

IntentVision has implemented usage metering (Phase 11) that tracks billable operations in real-time. The next step is preparing the billing infrastructure without coupling to a specific payment processor. This phase establishes:

1. **Billing Snapshots**: Periodic aggregation of usage events for billing periods
2. **Stripe Abstraction**: Interface layer that can be stubbed for testing
3. **Plan Mapping**: Translation between IntentVision plans and Stripe product/price IDs
4. **Future Path**: Clean upgrade path to production Stripe integration

## Decision

### 1. Billing Snapshot Model

**Decision**: Create `billingSnapshots` collection that aggregates usage events into billing periods.

**Rationale**:
- Usage events are granular (per-operation); billing needs aggregation
- Snapshots provide audit trail for invoices
- Decouples real-time metering from billing cycles
- Enables billing reconciliation and dispute resolution

**Architecture**:
```
                                    BILLING SNAPSHOT FLOW
+------------------+     +-------------------+     +--------------------+
|   Usage Events   |     |  Billing Snapshot |     |   Stripe Invoice   |
|   (real-time)    |---->|   (periodic)      |---->|   (future)         |
+------------------+     +-------------------+     +--------------------+
        |                        |                         |
        v                        v                         v
  per-operation            daily/monthly              payment processor
  granular events          aggregations               integration

FIRESTORE COLLECTIONS:

organizations/{orgId}/usageEvents/{eventId}
  - eventType: 'forecast_call' | 'alert_fired' | 'metric_ingested' | 'api_call'
  - quantity: number
  - occurredAt: timestamp
  - metadata: {...}
                    |
                    | aggregated by billing:snapshot CLI
                    v
organizations/{orgId}/billingSnapshots/{snapshotId}
  - periodStart: timestamp
  - periodEnd: timestamp
  - status: 'pending' | 'finalized' | 'invoiced' | 'paid'
  - usage: {
      forecasts: { count: number, unit_price: number, total: number },
      alerts: { count: number, unit_price: number, total: number },
      metrics: { count: number, unit_price: number, total: number },
      apiCalls: { count: number, unit_price: number, total: number }
    }
  - planId: string
  - planSnapshot: {...}  // frozen plan details at snapshot time
  - stripeInvoiceId?: string  // populated after Stripe sync
  - createdAt: timestamp
  - finalizedAt?: timestamp
```

**Data Model**:
```typescript
type BillingSnapshotStatus = 'pending' | 'finalized' | 'invoiced' | 'paid';

interface UsageLineItem {
  count: number;
  unitPrice: number;  // in cents
  total: number;      // count * unitPrice
}

interface BillingSnapshot {
  id: string;
  orgId: string;
  periodStart: Date;
  periodEnd: Date;
  status: BillingSnapshotStatus;
  usage: {
    forecasts: UsageLineItem;
    alerts: UsageLineItem;
    metrics: UsageLineItem;
    apiCalls: UsageLineItem;
  };
  subtotal: number;         // sum of all line item totals (cents)
  planId: string;
  planSnapshot: Plan;       // frozen plan details
  stripeInvoiceId?: string;
  stripePaymentIntentId?: string;
  createdAt: Date;
  finalizedAt?: Date;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
}
```

### 2. Stripe Abstraction Layer

**Decision**: Create `StripeClient` interface with stub implementation for development/testing.

**Rationale**:
- Allows testing billing flows without real Stripe account
- Enables gradual rollout of payment processing
- Provides clear contract for production implementation
- Supports multiple payment processors in future (if needed)

**Architecture**:
```
                    STRIPE ABSTRACTION LAYER
+------------------------------------------------------------------+
|                        Application Code                            |
|   - billing:snapshot CLI                                          |
|   - billing reconciliation jobs                                   |
|   - admin billing endpoints                                       |
+------------------------------------------------------------------+
                              |
                              | uses interface
                              v
+------------------------------------------------------------------+
|                    StripeClient Interface                         |
|   createInvoice(snapshot: BillingSnapshot): Promise<Invoice>     |
|   finalizeInvoice(invoiceId: string): Promise<Invoice>           |
|   getInvoice(invoiceId: string): Promise<Invoice>                |
|   createCustomer(org: Organization): Promise<Customer>           |
|   syncSubscription(orgId: string, planId: string): Promise<Sub>  |
+------------------------------------------------------------------+
                              |
          +-------------------+-------------------+
          |                                       |
          v                                       v
+--------------------+                 +--------------------+
|  StubStripeClient  |                 | RealStripeClient   |
|  (development)     |                 | (production)       |
+--------------------+                 +--------------------+
| - Returns mock IDs |                 | - Calls Stripe API |
| - Logs operations  |                 | - Uses stripe-node |
| - No side effects  |                 | - Handles webhooks |
+--------------------+                 +--------------------+
```

**Interface**:
```typescript
interface StripeClient {
  // Customer management
  createCustomer(input: CreateCustomerInput): Promise<StripeCustomer>;
  getCustomer(customerId: string): Promise<StripeCustomer | null>;
  updateCustomer(customerId: string, input: UpdateCustomerInput): Promise<StripeCustomer>;

  // Subscription management
  createSubscription(input: CreateSubscriptionInput): Promise<StripeSubscription>;
  updateSubscription(subscriptionId: string, input: UpdateSubscriptionInput): Promise<StripeSubscription>;
  cancelSubscription(subscriptionId: string): Promise<StripeSubscription>;

  // Invoice management
  createInvoice(input: CreateInvoiceInput): Promise<StripeInvoice>;
  finalizeInvoice(invoiceId: string): Promise<StripeInvoice>;
  voidInvoice(invoiceId: string): Promise<StripeInvoice>;
  getInvoice(invoiceId: string): Promise<StripeInvoice | null>;

  // Usage-based billing
  reportUsage(subscriptionItemId: string, quantity: number, timestamp: Date): Promise<void>;
}

// Stub implementation
class StubStripeClient implements StripeClient {
  private invoiceCounter = 0;
  private customerCounter = 0;

  async createInvoice(input: CreateInvoiceInput): Promise<StripeInvoice> {
    const invoiceId = `in_stub_${++this.invoiceCounter}`;
    console.log(`[STUB STRIPE] Created invoice ${invoiceId}`, input);
    return {
      id: invoiceId,
      status: 'draft',
      amount_due: input.amount,
      currency: 'usd',
      // ... other fields
    };
  }
  // ... other stubbed methods
}
```

### 3. Plan to Stripe Product Mapping

**Decision**: Static mapping table between IntentVision PlanIds and Stripe product/price IDs.

**Rationale**:
- Plans defined in code, Stripe products defined in Stripe dashboard
- Mapping allows flexibility without code changes
- Environment-specific mappings (test vs production Stripe)

**Architecture**:
```
        INTENTVISION PLANS              STRIPE PRODUCTS
+-----------------------------+    +-----------------------------+
|  PlanId     | Name          |    |  Product ID  | Price ID     |
+-------------+---------------+    +--------------+--------------+
|  free       | Free Tier     |--->|  prod_free   | price_free   |
|  starter    | Starter       |--->|  prod_start  | price_start  |
|  growth     | Growth        |--->|  prod_growth | price_growth |
|  enterprise | Enterprise    |--->|  prod_ent    | price_ent    |
+-------------+---------------+    +--------------+--------------+

CONFIG (environment-based):
{
  "stripe": {
    "planMappings": {
      "free": {
        "productId": "prod_xxx",
        "priceId": "price_xxx",
        "metered": false
      },
      "starter": {
        "productId": "prod_yyy",
        "priceId": "price_yyy",
        "metered": true,
        "usageType": "licensed"
      }
    }
  }
}
```

**Configuration**:
```typescript
interface StripePlanMapping {
  productId: string;
  priceId: string;
  metered: boolean;
  usageType?: 'licensed' | 'metered';
  billingCycle?: 'monthly' | 'yearly';
}

interface StripeConfig {
  apiKey: string;              // STRIPE_SECRET_KEY
  webhookSecret: string;       // STRIPE_WEBHOOK_SECRET
  planMappings: Record<PlanId, StripePlanMapping>;
}

// Environment-specific configs
const stripeConfigs: Record<Environment, StripeConfig> = {
  development: {
    apiKey: 'sk_test_...',
    webhookSecret: 'whsec_...',
    planMappings: { /* test mode products */ }
  },
  production: {
    apiKey: 'sk_live_...',
    webhookSecret: 'whsec_...',
    planMappings: { /* live mode products */ }
  }
};
```

### 4. Future Billing Integration Path

**Decision**: Document clear path from current stub to production Stripe.

**Phase 12 (Current)**: Billing Plumbing
```
- BillingSnapshot model and collection
- StubStripeClient implementation
- billing:snapshot CLI command
- Admin billing endpoints (read-only)
```

**Phase N+1**: Stripe Test Mode
```
- RealStripeClient with test API keys
- Stripe webhook handler
- Customer creation on tenant signup
- Invoice sync on snapshot finalization
```

**Phase N+2**: Stripe Production
```
- Live API keys in production
- Payment method collection UI
- Subscription lifecycle management
- Invoice.paid webhook handling
```

**Phase N+3**: Advanced Billing
```
- Usage-based billing (metered subscriptions)
- Proration handling
- Credit/refund flows
- Revenue recognition exports
```

## CLI Commands

### billing:snapshot

Generate billing snapshots for all organizations:

```bash
# Generate snapshots for previous day (default)
npx tsx packages/api/src/cli/billing.ts snapshot

# Generate snapshot for specific date range
npx tsx packages/api/src/cli/billing.ts snapshot \
  --start 2025-12-01 \
  --end 2025-12-15

# Generate snapshot for specific org
npx tsx packages/api/src/cli/billing.ts snapshot \
  --org-id org_abc123

# Dry run (show what would be created)
npx tsx packages/api/src/cli/billing.ts snapshot --dry-run

# Finalize pending snapshots
npx tsx packages/api/src/cli/billing.ts snapshot --finalize
```

### billing:report

Generate billing reports:

```bash
# List all pending invoices
npx tsx packages/api/src/cli/billing.ts report --status pending

# Export billing data for accounting
npx tsx packages/api/src/cli/billing.ts report \
  --format csv \
  --output billing-2025-12.csv

# Show revenue by plan
npx tsx packages/api/src/cli/billing.ts report --by-plan
```

## Consequences

### Positive
- Clean separation between metering and billing
- Testable billing flows without payment processor
- Audit trail for all billing events
- Flexible upgrade path to production billing
- Support for multiple billing models (subscription, usage-based, hybrid)

### Negative
- Additional complexity in data model
- Snapshot aggregation requires scheduled jobs
- Plan mapping maintenance overhead

### Risks
- Snapshot timing edge cases (events spanning periods)
- Stripe API changes affecting interface
- Currency/tax handling complexity in future

## Alternatives Considered

### 1. Direct Stripe Integration (No Abstraction)

**Rejected because:**
- Tight coupling to Stripe
- Difficult to test without real account
- No path for alternative processors

### 2. Usage Events Direct to Stripe

**Rejected because:**
- Stripe metered billing has per-event costs
- Lose control over billing aggregation
- Harder to customize billing rules

### 3. Third-Party Billing Platform (e.g., Lago, Orb)

**Rejected because:**
- Additional infrastructure dependency
- Cost overhead for early stage
- Can migrate later if needed

## Related Documents

- 045-AA-AACR-phase-11-usage-metering.md (Usage event foundation)
- 046-DR-ADRC-usage-metering-plan-enforcement.md (Plan limits)
- 044-DR-ADRC-sellable-alpha-plan-tenant-architecture.md (Plan model)

---

*Architecture Decision Record - Phase 12 Billing Plumbing*
