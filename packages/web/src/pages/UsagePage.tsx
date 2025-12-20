/**
 * IntentVision Usage Page
 *
 * Phase 11: Admin Usage UI
 *
 * Shows current plan limits and usage metrics.
 * Fetches from /admin/orgs/:orgId/usage/overview endpoint.
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
  planBadge: {
    display: 'inline-block',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: '600',
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    color: '#fff',
    marginBottom: '1rem',
  },
  usageItem: {
    marginBottom: '1.5rem',
  },
  usageLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
  },
  usageMetric: {
    fontWeight: '600',
    color: '#fff',
  },
  usageStats: {
    color: '#a0a0a0',
  },
  usageBarContainer: {
    width: '100%',
    height: '24px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '12px',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  usageBarFill: {
    height: '100%',
    borderRadius: '12px',
    transition: 'width 0.3s ease, background 0.3s ease',
  },
  usageBarText: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#fff',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
  },
  warningBanner: {
    background: 'rgba(255, 200, 0, 0.1)',
    border: '1px solid rgba(255, 200, 0, 0.3)',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
    color: '#ffc800',
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
};

interface UsageMetric {
  name: string;
  used: number;
  limit: number;
  unit: string;
}

interface UsageData {
  planName: string;
  metrics: UsageMetric[];
}

// Mock data for demonstration
const mockUsageData: UsageData = {
  planName: 'Beta',
  metrics: [
    {
      name: 'Forecasts',
      used: 850,
      limit: 1000,
      unit: 'forecasts',
    },
    {
      name: 'Alerts',
      used: 120,
      limit: 500,
      unit: 'alerts',
    },
    {
      name: 'Ingestion',
      used: 45000,
      limit: 100000,
      unit: 'data points',
    },
  ],
};

export default function UsagePage() {
  const [usageData, _setUsageData] = useState<UsageData>(mockUsageData);
  const [_loading, _setLoading] = useState(false);

  // In production, this would fetch from /admin/orgs/:orgId/usage/overview
  useEffect(() => {
    // fetchUsageData();
  }, []);

  const getUsagePercentage = (used: number, limit: number): number => {
    return (used / limit) * 100;
  };

  const getUsageBarColor = (percentage: number): string => {
    if (percentage >= 90) return '#ff4444';
    if (percentage >= 80) return '#ffc800';
    return 'linear-gradient(90deg, #00d4ff, #7b2cbf)';
  };

  const hasWarnings = usageData.metrics.some(
    (metric) => getUsagePercentage(metric.used, metric.limit) >= 80
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/" style={styles.logo}>
          IntentVision
        </Link>
        <nav style={styles.nav}>
          <Link to="/dashboard" style={styles.navLink}>Dashboard</Link>
          <Link to="/alerts" style={styles.navLink}>Alerts</Link>
          <span style={{ ...styles.navLink, color: '#fff' }}>Usage</span>
          <Link to="/settings/notifications" style={styles.navLink}>Settings</Link>
        </nav>
      </header>

      <main style={styles.main}>
        <h1 style={styles.pageTitle}>Usage & Limits</h1>

        <div style={styles.mockBanner}>
          This is a demo view with mock data. In production, this would fetch from the /admin/orgs/:orgId/usage/overview API endpoint.
        </div>

        {hasWarnings && (
          <div style={styles.warningBanner}>
            Warning: You are approaching or have exceeded 80% of your plan limits for one or more metrics.
          </div>
        )}

        {/* Current Plan */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Current Plan</h2>
          <div style={styles.planBadge}>{usageData.planName} Plan</div>
          <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
            Monitor your usage across all platform features. Usage resets monthly on your billing date.
          </p>
        </section>

        {/* Usage Metrics */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Usage Metrics</h2>

          {usageData.metrics.map((metric) => {
            const percentage = getUsagePercentage(metric.used, metric.limit);
            const barColor = getUsageBarColor(percentage);

            return (
              <div key={metric.name} style={styles.usageItem}>
                <div style={styles.usageLabel}>
                  <span style={styles.usageMetric}>{metric.name}</span>
                  <span style={styles.usageStats}>
                    {metric.used.toLocaleString()} / {metric.limit.toLocaleString()} {metric.unit}
                  </span>
                </div>
                <div style={styles.usageBarContainer}>
                  <div
                    style={{
                      ...styles.usageBarFill,
                      width: `${Math.min(percentage, 100)}%`,
                      background: barColor,
                    }}
                  />
                  <span style={styles.usageBarText}>
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        {/* Quick Stats */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Quick Stats</h2>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Total Data Points</div>
              <div style={styles.infoValue}>
                {usageData.metrics
                  .find((m) => m.name === 'Ingestion')
                  ?.used.toLocaleString() || '0'}
              </div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Active Alerts</div>
              <div style={styles.infoValue}>
                {usageData.metrics
                  .find((m) => m.name === 'Alerts')
                  ?.used.toLocaleString() || '0'}
              </div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Forecasts Generated</div>
              <div style={styles.infoValue}>
                {usageData.metrics
                  .find((m) => m.name === 'Forecasts')
                  ?.used.toLocaleString() || '0'}
              </div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Billing Period</div>
              <div style={styles.infoValue}>Monthly</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
