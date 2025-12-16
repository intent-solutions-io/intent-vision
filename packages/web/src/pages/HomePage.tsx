/**
 * IntentVision Landing Page
 *
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Beads Task: intentvision-p5
 */

import { Link } from 'react-router-dom';

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  logo: {
    fontSize: '3rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  tagline: {
    fontSize: '1.5rem',
    color: '#a0a0a0',
    marginBottom: '3rem',
    textAlign: 'center' as const,
  },
  cta: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  button: {
    padding: '1rem 2rem',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    textDecoration: 'none',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  primaryButton: {
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    color: '#fff',
    border: 'none',
  },
  secondaryButton: {
    background: 'transparent',
    color: '#00d4ff',
    border: '2px solid #00d4ff',
  },
  features: {
    marginTop: '4rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '2rem',
    maxWidth: '900px',
  },
  featureCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '1.5rem',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  featureTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '0.5rem',
    color: '#00d4ff',
  },
  featureDesc: {
    color: '#a0a0a0',
    lineHeight: 1.6,
  },
};

export default function HomePage() {
  return (
    <div style={styles.container}>
      <h1 style={styles.logo}>IntentVision</h1>
      <p style={styles.tagline}>
        Predictive Analytics for SaaS.<br />
        Know your numbers before they happen.
      </p>

      <div style={styles.cta}>
        <Link
          to="/onboarding"
          style={{ ...styles.button, ...styles.primaryButton }}
        >
          Get Started Free
        </Link>
        <Link
          to="/dashboard"
          style={{ ...styles.button, ...styles.secondaryButton }}
        >
          Sign In
        </Link>
      </div>

      <div style={styles.features}>
        <div style={styles.featureCard}>
          <h3 style={styles.featureTitle}>Time Series Forecasting</h3>
          <p style={styles.featureDesc}>
            Predict MRR, churn, and key SaaS metrics with statistical and ML-powered forecasts.
          </p>
        </div>
        <div style={styles.featureCard}>
          <h3 style={styles.featureTitle}>Smart Alerts</h3>
          <p style={styles.featureDesc}>
            Get notified before problems happen with configurable threshold and anomaly alerts.
          </p>
        </div>
        <div style={styles.featureCard}>
          <h3 style={styles.featureTitle}>API-First</h3>
          <p style={styles.featureDesc}>
            Integrate with your data stack. Ingest from Stripe, PostHog, Segment, or custom webhooks.
          </p>
        </div>
      </div>
    </div>
  );
}
