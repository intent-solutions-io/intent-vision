/**
 * Stripe Client (Stubbed)
 *
 * Phase 12: Billing Backend
 * Beads Task: intentvision-[phase12]
 *
 * Stubbed Stripe client for billing operations.
 * All methods log intent but don't make real Stripe API calls.
 * Ready for future integration with actual Stripe SDK.
 */

// =============================================================================
// Types
// =============================================================================

export interface StripeCustomer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  customerId: string;
  priceId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  metadata?: Record<string, string>;
}

export interface CreateCustomerParams {
  email: string;
  name?: string;
  orgId: string;
}

export interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  orgId: string;
}

export interface UpdateSubscriptionParams {
  subscriptionId: string;
  priceId: string;
}

// =============================================================================
// Plan Mapping
// =============================================================================

/**
 * Map IntentVision plan IDs to Stripe price IDs
 * These are stub IDs - replace with actual Stripe price IDs when integrating
 */
export const STRIPE_PLAN_MAP: Record<string, string> = {
  free: 'price_stub_free',
  starter: 'price_stub_starter_monthly',
  growth: 'price_stub_growth_monthly',
  enterprise: 'price_stub_enterprise_custom',
};

// =============================================================================
// Stripe Client (Stubbed)
// =============================================================================

export class StripeClient {
  private readonly enabled: boolean;

  constructor(apiKey?: string) {
    // API key will be used when implementing real Stripe integration
    const key = apiKey || process.env.STRIPE_SECRET_KEY || 'stub_key';
    this.enabled = !!apiKey && apiKey !== 'stub_key';

    if (!this.enabled) {
      console.log('[Stripe] Running in stub mode - no real API calls will be made');
      console.log(`[Stripe] API key provided: ${key.slice(0, 8)}...`);
    }
  }

  /**
   * Create a Stripe customer
   * STUBBED: Logs intent but doesn't create real customer
   */
  async createCustomer(params: CreateCustomerParams): Promise<StripeCustomer> {
    const { email, name, orgId } = params;

    console.log('[Stripe] STUB: Would create customer:', {
      email,
      name,
      metadata: { orgId },
    });

    // In real implementation:
    // const customer = await this.stripe.customers.create({
    //   email,
    //   name,
    //   metadata: { orgId },
    // });

    // Return stub customer
    const stubCustomer: StripeCustomer = {
      id: `cus_stub_${Date.now()}`,
      email,
      name,
      metadata: { orgId },
    };

    console.log('[Stripe] STUB: Created customer:', stubCustomer.id);
    return stubCustomer;
  }

  /**
   * Create a Stripe subscription
   * STUBBED: Logs intent but doesn't create real subscription
   */
  async createSubscription(
    params: CreateSubscriptionParams
  ): Promise<StripeSubscription> {
    const { customerId, priceId, orgId } = params;

    console.log('[Stripe] STUB: Would create subscription:', {
      customerId,
      priceId,
      metadata: { orgId },
    });

    // In real implementation:
    // const subscription = await this.stripe.subscriptions.create({
    //   customer: customerId,
    //   items: [{ price: priceId }],
    //   metadata: { orgId },
    // });

    // Return stub subscription
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const stubSubscription: StripeSubscription = {
      id: `sub_stub_${Date.now()}`,
      customerId,
      priceId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      metadata: { orgId },
    };

    console.log('[Stripe] STUB: Created subscription:', stubSubscription.id);
    return stubSubscription;
  }

  /**
   * Update a Stripe subscription
   * STUBBED: Logs intent but doesn't update real subscription
   */
  async updateSubscription(
    params: UpdateSubscriptionParams
  ): Promise<StripeSubscription> {
    const { subscriptionId, priceId } = params;

    console.log('[Stripe] STUB: Would update subscription:', {
      subscriptionId,
      newPriceId: priceId,
    });

    // In real implementation:
    // const subscription = await this.stripe.subscriptions.update(subscriptionId, {
    //   items: [{ price: priceId }],
    // });

    // Return stub updated subscription
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const stubSubscription: StripeSubscription = {
      id: subscriptionId,
      customerId: 'cus_stub_existing',
      priceId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    };

    console.log('[Stripe] STUB: Updated subscription:', subscriptionId);
    return stubSubscription;
  }

  /**
   * Cancel a Stripe subscription
   * STUBBED: Logs intent but doesn't cancel real subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<StripeSubscription> {
    console.log('[Stripe] STUB: Would cancel subscription:', subscriptionId);

    // In real implementation:
    // const subscription = await this.stripe.subscriptions.cancel(subscriptionId);

    // Return stub canceled subscription
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const stubSubscription: StripeSubscription = {
      id: subscriptionId,
      customerId: 'cus_stub_existing',
      priceId: 'price_stub_canceled',
      status: 'canceled',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    };

    console.log('[Stripe] STUB: Canceled subscription:', subscriptionId);
    return stubSubscription;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let stripeClientInstance: StripeClient | null = null;

/**
 * Get the Stripe client instance (singleton)
 */
export function getStripeClient(): StripeClient {
  if (!stripeClientInstance) {
    stripeClientInstance = new StripeClient();
  }
  return stripeClientInstance;
}
