# After-Action Corrective Report: Phase 12 - Billing Plumbing

**Document ID**: 048-AA-AACR-phase-12-billing-plumbing
**Phase**: 12
**Beads Epic**: intentvision-sx4
**Date**: 2025-12-16
**Version**: 0.12.0

---

## Executive Summary

Phase 12 established the billing infrastructure for IntentVision without coupling to a specific payment processor. The system now supports billing snapshots (aggregated usage for billing periods), a Stripe abstraction layer (with stub implementation for testing), and CLI tools for billing operations. This prepares the foundation for production Stripe integration in future phases.

## Objectives

1. **Billing Snapshot Model**: Define schema for periodic usage aggregation
2. **Stripe Abstraction**: Interface layer with stub for development/testing
3. **Plan Mapping**: Translation between IntentVision plans and Stripe products
4. **CLI Tools**: Commands for snapshot generation and billing reports

## Implementation Summary

### 1. Billing Snapshot Schema (intentvision-b8k)

Created `BillingSnapshot` type and `billingSnapshots` collection:

```typescript
type BillingSnapshotStatus = 'pending' | 'finalized' | 'invoiced' | 'paid';

interface UsageLineItem {
  count: number;
  unitPrice: number;  // cents
  total: number;
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
  subtotal: number;
  planId: string;
  planSnapshot: Plan;
  stripeInvoiceId?: string;
  createdAt: Date;
  finalizedAt?: Date;
}
```

### 2. Stripe Client Abstraction (intentvision-c9m)

Created `packages/api/src/services/stripe-client.ts` with:

- `StripeClient` interface defining payment operations
- `StubStripeClient` implementation for testing
- Factory function `createStripeClient()` for environment-based selection

```typescript
interface StripeClient {
  createCustomer(input: CreateCustomerInput): Promise<StripeCustomer>;
  createSubscription(input: CreateSubscriptionInput): Promise<StripeSubscription>;
  createInvoice(input: CreateInvoiceInput): Promise<StripeInvoice>;
  finalizeInvoice(invoiceId: string): Promise<StripeInvoice>;
  reportUsage(subscriptionItemId: string, quantity: number, timestamp: Date): Promise<void>;
}

// Stub logs all operations, returns mock IDs
class StubStripeClient implements StripeClient {
  async createInvoice(input: CreateInvoiceInput): Promise<StripeInvoice> {
    console.log('[STUB STRIPE] createInvoice', input);
    return { id: `in_stub_${Date.now()}`, status: 'draft', ... };
  }
}
```

### 3. Billing Service (intentvision-d4n)

Created `packages/api/src/services/billing-service.ts` with:

- `generateBillingSnapshot()` - Aggregate usage events into snapshot
- `finalizeBillingSnapshot()` - Mark snapshot ready for invoicing
- `getBillingSnapshots()` - Query snapshots by org/status/date range
- `syncToStripe()` - Push snapshot to Stripe (uses abstraction)

```typescript
async function generateBillingSnapshot(
  orgId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<BillingSnapshot> {
  // 1. Query usage events for period
  const events = await getUsageEventsForPeriod(orgId, periodStart, periodEnd);

  // 2. Aggregate by event type
  const usage = aggregateUsageEvents(events);

  // 3. Apply pricing from plan
  const plan = await getOrganizationPlan(orgId);
  const pricedUsage = applyPricing(usage, plan);

  // 4. Create snapshot document
  return createBillingSnapshot({
    orgId,
    periodStart,
    periodEnd,
    status: 'pending',
    usage: pricedUsage,
    planId: plan.id,
    planSnapshot: plan,
  });
}
```

### 4. Plan-to-Stripe Mapping (intentvision-e7p)

Created configuration for plan mappings:

```typescript
const stripePlanMappings: Record<PlanId, StripePlanMapping> = {
  free: {
    productId: process.env.STRIPE_PRODUCT_FREE || 'prod_free_stub',
    priceId: process.env.STRIPE_PRICE_FREE || 'price_free_stub',
    metered: false,
  },
  starter: {
    productId: process.env.STRIPE_PRODUCT_STARTER || 'prod_starter_stub',
    priceId: process.env.STRIPE_PRICE_STARTER || 'price_starter_stub',
    metered: true,
  },
  growth: {
    productId: process.env.STRIPE_PRODUCT_GROWTH || 'prod_growth_stub',
    priceId: process.env.STRIPE_PRICE_GROWTH || 'price_growth_stub',
    metered: true,
  },
  enterprise: {
    productId: process.env.STRIPE_PRODUCT_ENTERPRISE || 'prod_enterprise_stub',
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_stub',
    metered: true,
  },
};
```

### 5. Billing CLI Commands (intentvision-f2q)

Created `packages/api/src/cli/billing.ts`:

```bash
# Generate billing snapshot
npx tsx packages/api/src/cli/billing.ts snapshot

# Options
npx tsx packages/api/src/cli/billing.ts snapshot --dry-run
npx tsx packages/api/src/cli/billing.ts snapshot --org-id org_abc123
npx tsx packages/api/src/cli/billing.ts snapshot --start 2025-12-01 --end 2025-12-15
npx tsx packages/api/src/cli/billing.ts snapshot --finalize

# Generate billing report
npx tsx packages/api/src/cli/billing.ts report --status pending
npx tsx packages/api/src/cli/billing.ts report --format csv --output billing.csv
npx tsx packages/api/src/cli/billing.ts report --by-plan
```

## Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `src/firestore/schema.ts` | Modified | Added BillingSnapshot types |
| `src/services/billing-service.ts` | Created | Core billing logic |
| `src/services/stripe-client.ts` | Created | Stripe abstraction layer |
| `src/config/stripe-mappings.ts` | Created | Plan to Stripe product mapping |
| `src/cli/billing.ts` | Created | CLI commands for billing |
| `src/routes/admin-billing.ts` | Created | Admin billing API endpoints |
| `src/index.ts` | Modified | Wired billing routes, v0.12.0 |

## Test Results

```
Test Files  5 passed (5)
Tests  34 passed | 22 skipped (56)
```

All existing tests pass. New billing tests added for snapshot generation and Stripe stub.

## Beads Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| intentvision-sx4 | Epic: Phase 12 Billing Plumbing | Completed |
| intentvision-b8k | Define billing snapshot schema | Completed |
| intentvision-c9m | Implement Stripe client abstraction | Completed |
| intentvision-d4n | Create billing service | Completed |
| intentvision-e7p | Configure plan-to-Stripe mappings | Completed |
| intentvision-f2q | Build billing CLI commands | Completed |
| intentvision-g3r | Documentation | Completed |

## CLI Command Reference

### billing:snapshot

```bash
# Basic usage - generates snapshots for yesterday (default)
npx tsx packages/api/src/cli/billing.ts snapshot

# With date range
npx tsx packages/api/src/cli/billing.ts snapshot \
  --start 2025-12-01 \
  --end 2025-12-15

# Single organization
npx tsx packages/api/src/cli/billing.ts snapshot \
  --org-id org_abc123

# Preview mode (no changes)
npx tsx packages/api/src/cli/billing.ts snapshot --dry-run

# Finalize pending snapshots for invoicing
npx tsx packages/api/src/cli/billing.ts snapshot --finalize
```

### billing:report

```bash
# List pending invoices
npx tsx packages/api/src/cli/billing.ts report --status pending

# Export to CSV
npx tsx packages/api/src/cli/billing.ts report \
  --format csv \
  --output billing-december.csv

# Revenue breakdown by plan
npx tsx packages/api/src/cli/billing.ts report --by-plan
```

## Design Decisions

1. **Snapshot-based billing**: Aggregate events into billing periods rather than real-time Stripe sync
2. **Stub-first approach**: Full billing flow testable without Stripe account
3. **Plan snapshot freezing**: Capture plan details at snapshot time for billing consistency
4. **Non-blocking sync**: Stripe operations don't block core business operations
5. **Idempotent snapshots**: Re-running for same period updates existing snapshot

## Future Considerations

- Implement RealStripeClient for production
- Add Stripe webhook handler for payment events
- Support proration for mid-cycle plan changes
- Add credit/refund workflow
- Revenue recognition exports for accounting

## Lessons Learned

1. Separating metering (real-time) from billing (periodic) simplifies both systems
2. Stub implementations should log extensively for debugging
3. Plan mapping should be environment-configurable, not hardcoded
4. CLI tools need both dry-run and verbose modes for operations

---

**Status**: Phase 12 Complete
**Next**: Phase 13 - Production Deployment and Observability
