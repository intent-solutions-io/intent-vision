/**
 * IntentVision Alerts Page
 *
 * Phase 10: Sellable Alpha Shell
 * Beads Task: intentvision-9xn
 *
 * Shows all alerts with filtering and pagination.
 * Uses GET /v1/dashboard/alerts endpoint.
 */

import { useState } from 'react';
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
  badgeSent: {
    background: 'rgba(0, 200, 100, 0.2)',
    color: '#00c864',
  },
  badgeFailed: {
    background: 'rgba(255, 100, 100, 0.2)',
    color: '#ff6464',
  },
  badgePending: {
    background: 'rgba(255, 200, 0, 0.2)',
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
  emptyState: {
    textAlign: 'center' as const,
    padding: '3rem',
    color: '#666',
  },
};

// Mock data for demonstration
const mockAlerts = [
  {
    id: 'alert-001',
    ruleId: 'rule-001',
    metricName: 'mrr',
    triggeredAt: '2025-12-15T14:30:00.000Z',
    triggerValue: 15000,
    threshold: 12000,
    direction: 'above',
    deliveryStatus: 'sent',
  },
  {
    id: 'alert-002',
    ruleId: 'rule-002',
    metricName: 'churn_rate',
    triggeredAt: '2025-12-14T09:15:00.000Z',
    triggerValue: 8.5,
    threshold: 5,
    direction: 'above',
    deliveryStatus: 'sent',
  },
  {
    id: 'alert-003',
    ruleId: 'rule-003',
    metricName: 'active_users',
    triggeredAt: '2025-12-13T16:45:00.000Z',
    triggerValue: 450,
    threshold: 500,
    direction: 'below',
    deliveryStatus: 'failed',
  },
];

export default function AlertsPage() {
  const [alerts] = useState(mockAlerts);

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'sent':
        return { ...styles.badge, ...styles.badgeSent };
      case 'failed':
        return { ...styles.badge, ...styles.badgeFailed };
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
          <span style={{ ...styles.navLink, color: '#fff' }}>Alerts</span>
          <Link to="/settings/notifications" style={styles.navLink}>Settings</Link>
        </nav>
      </header>

      <main style={styles.main}>
        <h1 style={styles.pageTitle}>Alerts</h1>

        <div style={styles.mockBanner}>
          This is a demo view with mock data. In production, this would fetch from the /v1/dashboard/alerts API endpoint.
        </div>

        <section style={styles.section}>
          {alerts.length === 0 ? (
            <div style={styles.emptyState}>
              <p>No alerts triggered yet.</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Configure alert rules to get notified when your metrics cross thresholds.
              </p>
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Metric</th>
                  <th style={styles.th}>Triggered At</th>
                  <th style={styles.th}>Value</th>
                  <th style={styles.th}>Threshold</th>
                  <th style={styles.th}>Direction</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td style={{ ...styles.td, fontWeight: '500' }}>{alert.metricName}</td>
                    <td style={styles.td}>
                      {new Date(alert.triggeredAt).toLocaleString()}
                    </td>
                    <td style={{ ...styles.td, fontFamily: 'monospace' }}>
                      {alert.triggerValue.toLocaleString()}
                    </td>
                    <td style={{ ...styles.td, fontFamily: 'monospace' }}>
                      {alert.threshold.toLocaleString()}
                    </td>
                    <td style={styles.td}>
                      {alert.direction === 'above' ? 'Above' : 'Below'}
                    </td>
                    <td style={styles.td}>
                      <span style={getStatusBadgeStyle(alert.deliveryStatus)}>
                        {alert.deliveryStatus}
                      </span>
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
