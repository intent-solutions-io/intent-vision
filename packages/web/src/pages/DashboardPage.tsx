/**
 * IntentVision Dashboard Page (Minimal Shell)
 *
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Phase 10: Sellable Alpha Shell
 * Beads Tasks: intentvision-p5, intentvision-9xn
 *
 * Shows user info, org info, and API keys.
 * Uses GET /v1/me and GET /v1/me/apiKeys endpoints.
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
    fontSize: '1rem',
    fontWeight: '500',
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
  badgeActive: {
    background: 'rgba(0, 200, 100, 0.2)',
    color: '#00c864',
  },
  badgeRevoked: {
    background: 'rgba(255, 100, 100, 0.2)',
    color: '#ff6464',
  },
  button: {
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    color: '#fff',
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
};

// Mock data for demonstration
const mockUser = {
  id: 'user-demo-001',
  email: 'demo@example.com',
  displayName: 'Demo User',
  role: 'owner',
};

const mockOrg = {
  id: 'org-demo-001',
  name: 'Demo Organization',
  slug: 'demo-org',
  plan: 'beta',
  status: 'active',
};

const mockApiKeys = [
  {
    id: 'key-001',
    name: 'Production Key',
    keyPrefix: 'iv_demo_',
    scopes: ['ingest:write', 'metrics:read', 'alerts:read', 'alerts:write'],
    status: 'active',
    createdAt: '2025-12-15T00:00:00.000Z',
    lastUsedAt: '2025-12-15T12:00:00.000Z',
  },
  {
    id: 'key-002',
    name: 'Development Key',
    keyPrefix: 'iv_dev_',
    scopes: ['ingest:write', 'metrics:read'],
    status: 'active',
    createdAt: '2025-12-10T00:00:00.000Z',
    lastUsedAt: null,
  },
];

export default function DashboardPage() {
  const [user] = useState(mockUser);
  const [org] = useState(mockOrg);
  const [apiKeys] = useState(mockApiKeys);
  const [loading] = useState(false);

  // In production, this would fetch from GET /v1/me and GET /v1/me/apiKeys
  useEffect(() => {
    // fetchUserData();
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/" style={styles.logo}>
          IntentVision
        </Link>
        <nav style={styles.nav}>
          <span style={{ ...styles.navLink, color: '#fff' }}>Dashboard</span>
          <Link to="/alerts" style={styles.navLink}>Alerts</Link>
          <Link to="/settings/notifications" style={styles.navLink}>Settings</Link>
        </nav>
      </header>

      <main style={styles.main}>
        <div style={styles.mockBanner}>
          This is a demo dashboard with mock data. In production, this would fetch from the /v1/me API endpoints.
        </div>

        {/* Organization Info */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Organization</h2>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Name</div>
              <div style={styles.infoValue}>{org.name}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Slug</div>
              <div style={styles.infoValue}>{org.slug}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Plan</div>
              <div style={styles.infoValue}>{org.plan}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Status</div>
              <div style={styles.infoValue}>
                <span style={{ ...styles.badge, ...styles.badgeActive }}>
                  {org.status}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* User Info */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Your Account</h2>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Email</div>
              <div style={styles.infoValue}>{user.email}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Name</div>
              <div style={styles.infoValue}>{user.displayName || 'Not set'}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Role</div>
              <div style={styles.infoValue}>{user.role}</div>
            </div>
          </div>
        </section>

        {/* API Keys */}
        <section style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>API Keys</h2>
            <button style={styles.button}>Create API Key</button>
          </div>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Key Prefix</th>
                <th style={styles.th}>Scopes</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Last Used</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id}>
                  <td style={styles.td}>{key.name}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace' }}>{key.keyPrefix}...</td>
                  <td style={styles.td}>
                    {key.scopes.slice(0, 2).join(', ')}
                    {key.scopes.length > 2 && ` +${key.scopes.length - 2}`}
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        ...(key.status === 'active' ? styles.badgeActive : styles.badgeRevoked),
                      }}
                    >
                      {key.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Quick Start */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Quick Start</h2>
          <div style={{ background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.875rem', overflowX: 'auto' }}>
            <pre style={{ margin: 0, color: '#a0a0a0' }}>
{`# Ingest time series data
curl -X POST https://api.intentvision.io/v1/ingest/timeseries \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "metricName": "mrr",
    "points": [
      {"timestamp": "2025-12-15", "value": 10000}
    ]
  }'`}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}
