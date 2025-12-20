/**
 * IntentVision Billing Page
 *
 * Phase 12: Owner Billing UI
 *
 * Shows current plan, usage, and billing history.
 * Displays "billing not yet live" notice for beta period.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const styles = {
  container: {
    minHeight: '100vh',
    padding: '2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  logo: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textDecoration: 'none',
  },
  nav: {
    display: 'flex',
    gap: '1rem',
  },
  navLink: {
    color: '#a0a0a0',
    textDecoration: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    transition: 'background 0.2s, color 0.2s',
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  pageTitle: {
    fontSize: '2rem',
    fontWeight: '700',
    marginBottom: '1.5rem',
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  section: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#00d4ff',
  },
  betaBanner: {
    background: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
    color: '#00d4ff',
  },
  mockBanner: {
    background: 'rgba(255, 200, 0, 0.1)',
    border: '1px solid rgba(255, 200, 0, 0.3)',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
    color: '#ffc800',
  },
  planCard: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1rem',
  },
  planName: {
    fontSize: '1.5rem',
    fontWeight: '700',
    marginBottom: '0.5rem',
  },
  planPrice: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#00d4ff',
    marginBottom: '0.5rem',
  },
  planPeriod: {
    fontSize: '0.875rem',
    color: '#666',
    marginBottom: '1rem',
  },
  planFeature: {
    fontSize: '0.875rem',
    color: '#a0a0a0',
    marginBottom: '0.5rem',
    paddingLeft: '1.5rem',
    position: 'relative' as const,
  },
  planFeatureCheck: {
    position: 'absolute' as const,
    left: '0',
    color: '#00d4ff',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  },
  infoItem: {
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    padding: '1rem',
  },
  infoLabel: {
    fontSize: '0.75rem',
    color: '#666',
    marginBottom: '0.25rem',
  },
  infoValue: {
    fontSize: '1.25rem',
    fontWeight: '600',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    textAlign: 'left' as const,
    padding: '0.75rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#666',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  td: {
    padding: '0.75rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  badge: {
    display: 'inline-block',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  badgePaid: {
    background: 'rgba(0, 200, 100, 0.2)',
    color: '#00c864',
  },
  badgePending: {
    background: 'rgba(255, 200, 0, 0.2)',
    color: '#ffc800',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '3rem',
    color: '#666',
  },
};

interface BillingPeriod {
  id: string;
  startDate: string;
  endDate: string;
  amount: number;
  status: 'paid' | 'pending' | 'upcoming';
  invoiceUrl?: string;
}

interface BillingData {
  planName: string;
  planPrice: number;
  currentPeriodUsage: {
    forecasts: number;
    alerts: number;
    dataPoints: number;
  };
  projectedAmount: number;
  billingPeriods: BillingPeriod[];
}

// Mock data for demonstration
const mockBillingData: BillingData = {
  planName: 'Beta',
  planPrice: 0,
  currentPeriodUsage: {
    forecasts: 850,
    alerts: 120,
    dataPoints: 45000,
  },
  projectedAmount: 0,
  billingPeriods: [
    {
      id: 'period-001',
      startDate: '2025-11-01',
      endDate: '2025-11-30',
      amount: 0,
      status: 'paid',
    },
    {
      id: 'period-002',
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      amount: 0,
      status: 'pending',
    },
  ],
};

export default function BillingPage() {
  const [billingData, _setBillingData] = useState<BillingData>(mockBillingData);
  const [_loading, _setLoading] = useState(false);

  // In production, this would fetch from /owner/billing endpoint
  useEffect(() => {
    // fetchBillingData();
  }, []);

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'paid':
        return { ...styles.badge, ...styles.badgePaid };
      default:
        return { ...styles.badge, ...styles.badgePending };
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/" style={styles.logo}>
          IntentVision
        </Link>
        <nav style={styles.nav}>
          <Link to="/dashboard" style={styles.navLink}>Dashboard</Link>
          <Link to="/alerts" style={styles.navLink}>Alerts</Link>
          <span style={{ ...styles.navLink, color: '#fff' }}>Billing</span>
          <Link to="/settings/notifications" style={styles.navLink}>Settings</Link>
        </nav>
      </header>

      <main style={styles.main}>
        <h1 style={styles.pageTitle}>Billing & Plans</h1>

        <div style={styles.mockBanner}>
          This is a demo view with mock data. In production, this would integrate with Stripe or similar payment processor.
        </div>

        <div style={styles.betaBanner}>
          Billing is not yet live. You are on a free Beta plan with full access to all features.
          We'll notify you before any charges begin.
        </div>

        {/* Current Plan */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Current Plan</h2>
          <div style={styles.planCard}>
            <div style={styles.planName}>{billingData.planName} Plan</div>
            <div style={styles.planPrice}>
              ${billingData.planPrice.toFixed(2)}
            </div>
            <div style={styles.planPeriod}>per month</div>
            <div style={styles.planFeature}>
              <span style={styles.planFeatureCheck}>✓</span>
              1,000 forecasts per month
            </div>
            <div style={styles.planFeature}>
              <span style={styles.planFeatureCheck}>✓</span>
              500 alerts per month
            </div>
            <div style={styles.planFeature}>
              <span style={styles.planFeatureCheck}>✓</span>
              100,000 data points per month
            </div>
            <div style={styles.planFeature}>
              <span style={styles.planFeatureCheck}>✓</span>
              Priority support
            </div>
          </div>
        </section>

        {/* Current Period Usage */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Current Period Usage</h2>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Forecasts</div>
              <div style={styles.infoValue}>
                {billingData.currentPeriodUsage.forecasts.toLocaleString()}
              </div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Alerts</div>
              <div style={styles.infoValue}>
                {billingData.currentPeriodUsage.alerts.toLocaleString()}
              </div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Data Points</div>
              <div style={styles.infoValue}>
                {billingData.currentPeriodUsage.dataPoints.toLocaleString()}
              </div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Projected Amount</div>
              <div style={styles.infoValue}>
                ${billingData.projectedAmount.toFixed(2)}
              </div>
            </div>
          </div>
        </section>

        {/* Billing History */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Billing History</h2>
          {billingData.billingPeriods.length === 0 ? (
            <div style={styles.emptyState}>
              <p>No billing history yet.</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Your billing history will appear here once billing goes live.
              </p>
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Period</th>
                  <th style={styles.th}>Start Date</th>
                  <th style={styles.th}>End Date</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {billingData.billingPeriods.map((period) => (
                  <tr key={period.id}>
                    <td style={{ ...styles.td, fontWeight: '500' }}>
                      {new Date(period.startDate).toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric'
                      })}
                    </td>
                    <td style={styles.td}>
                      {new Date(period.startDate).toLocaleDateString()}
                    </td>
                    <td style={styles.td}>
                      {new Date(period.endDate).toLocaleDateString()}
                    </td>
                    <td style={{ ...styles.td, fontWeight: '600' }}>
                      ${period.amount.toFixed(2)}
                    </td>
                    <td style={styles.td}>
                      <span style={getStatusBadgeStyle(period.status)}>
                        {period.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {period.invoiceUrl ? (
                        <a
                          href={period.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#00d4ff', textDecoration: 'none' }}
                        >
                          View
                        </a>
                      ) : (
                        <span style={{ color: '#666' }}>N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
