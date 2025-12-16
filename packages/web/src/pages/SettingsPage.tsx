/**
 * IntentVision Settings Page (Notification Preferences)
 *
 * Phase 10: Sellable Alpha Shell
 * Beads Task: intentvision-s4z
 *
 * Manages user notification preferences.
 * Uses GET/PUT /v1/me/preferences/notifications endpoints.
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
    maxWidth: '800px',
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
  channelCard: {
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
  },
  channelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  channelName: {
    fontSize: '1rem',
    fontWeight: '600',
  },
  toggle: {
    position: 'relative' as const,
    width: '48px',
    height: '24px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  toggleEnabled: {
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
  },
  toggleDisabled: {
    background: 'rgba(255, 255, 255, 0.2)',
  },
  toggleKnob: {
    position: 'absolute' as const,
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#fff',
    top: '2px',
    transition: 'left 0.2s',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(0, 0, 0, 0.3)',
    color: '#fff',
    fontSize: '0.875rem',
    marginTop: '0.5rem',
  },
  inputLabel: {
    fontSize: '0.75rem',
    color: '#666',
  },
  inputDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
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
    marginTop: '1rem',
  },
  buttonSecondary: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    marginLeft: '0.5rem',
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
  planBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.65rem',
    fontWeight: '600',
    background: 'rgba(123, 44, 191, 0.3)',
    color: '#c87bff',
    marginLeft: '0.5rem',
  },
  successMessage: {
    background: 'rgba(0, 200, 100, 0.1)',
    border: '1px solid rgba(0, 200, 100, 0.3)',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
    fontSize: '0.875rem',
    color: '#00c864',
  },
};

interface NotificationPreferences {
  email: {
    enabled: boolean;
    address: string;
  };
  slack: {
    enabled: boolean;
    webhookUrl: string;
    available: boolean;
  };
  webhook: {
    enabled: boolean;
    url: string;
    available: boolean;
  };
}

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: {
      enabled: true,
      address: 'demo@example.com',
    },
    slack: {
      enabled: false,
      webhookUrl: '',
      available: false, // Free plan
    },
    webhook: {
      enabled: false,
      url: '',
      available: false, // Free plan
    },
  });
  const [saved, setSaved] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const handleToggle = (channel: 'email' | 'slack' | 'webhook') => {
    if (channel !== 'email' && !preferences[channel].available) {
      return; // Can't toggle unavailable channels
    }
    setPreferences((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        enabled: !prev[channel].enabled,
      },
    }));
    setSaved(false);
  };

  const handleInputChange = (
    channel: 'email' | 'slack' | 'webhook',
    field: string,
    value: string
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [field]: value,
      },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    // In production, this would POST to /v1/me/preferences/notifications
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestNotification = () => {
    // In production, this would POST to /v1/me/preferences/notifications/test
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
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
          <span style={{ ...styles.navLink, color: '#fff' }}>Settings</span>
        </nav>
      </header>

      <main style={styles.main}>
        <h1 style={styles.pageTitle}>Notification Settings</h1>

        <div style={styles.mockBanner}>
          This is a demo view with mock data. In production, this would save to the /v1/me/preferences/notifications API endpoint.
        </div>

        {saved && (
          <div style={styles.successMessage}>
            Notification preferences saved successfully!
          </div>
        )}

        {testSent && (
          <div style={styles.successMessage}>
            Test notification sent! Check your enabled channels.
          </div>
        )}

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Notification Channels</h2>

          {/* Email */}
          <div style={styles.channelCard}>
            <div style={styles.channelHeader}>
              <span style={styles.channelName}>Email</span>
              <div
                style={{
                  ...styles.toggle,
                  ...(preferences.email.enabled
                    ? styles.toggleEnabled
                    : styles.toggleDisabled),
                }}
                onClick={() => handleToggle('email')}
              >
                <div
                  style={{
                    ...styles.toggleKnob,
                    left: preferences.email.enabled ? '26px' : '2px',
                  }}
                />
              </div>
            </div>
            <div>
              <label style={styles.inputLabel}>Email Address</label>
              <input
                type="email"
                style={{
                  ...styles.input,
                  ...(preferences.email.enabled ? {} : styles.inputDisabled),
                }}
                value={preferences.email.address}
                onChange={(e) =>
                  handleInputChange('email', 'address', e.target.value)
                }
                disabled={!preferences.email.enabled}
                placeholder="your@email.com"
              />
            </div>
          </div>

          {/* Slack */}
          <div style={styles.channelCard}>
            <div style={styles.channelHeader}>
              <span style={styles.channelName}>
                Slack
                {!preferences.slack.available && (
                  <span style={styles.planBadge}>Starter+</span>
                )}
              </span>
              <div
                style={{
                  ...styles.toggle,
                  ...(preferences.slack.enabled
                    ? styles.toggleEnabled
                    : styles.toggleDisabled),
                  ...(preferences.slack.available ? {} : { opacity: 0.5, cursor: 'not-allowed' }),
                }}
                onClick={() => handleToggle('slack')}
              >
                <div
                  style={{
                    ...styles.toggleKnob,
                    left: preferences.slack.enabled ? '26px' : '2px',
                  }}
                />
              </div>
            </div>
            <div>
              <label style={styles.inputLabel}>Slack Webhook URL</label>
              <input
                type="url"
                style={{
                  ...styles.input,
                  ...(!preferences.slack.available || !preferences.slack.enabled
                    ? styles.inputDisabled
                    : {}),
                }}
                value={preferences.slack.webhookUrl}
                onChange={(e) =>
                  handleInputChange('slack', 'webhookUrl', e.target.value)
                }
                disabled={!preferences.slack.available || !preferences.slack.enabled}
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>
          </div>

          {/* Webhook */}
          <div style={styles.channelCard}>
            <div style={styles.channelHeader}>
              <span style={styles.channelName}>
                Webhook
                {!preferences.webhook.available && (
                  <span style={styles.planBadge}>Starter+</span>
                )}
              </span>
              <div
                style={{
                  ...styles.toggle,
                  ...(preferences.webhook.enabled
                    ? styles.toggleEnabled
                    : styles.toggleDisabled),
                  ...(preferences.webhook.available ? {} : { opacity: 0.5, cursor: 'not-allowed' }),
                }}
                onClick={() => handleToggle('webhook')}
              >
                <div
                  style={{
                    ...styles.toggleKnob,
                    left: preferences.webhook.enabled ? '26px' : '2px',
                  }}
                />
              </div>
            </div>
            <div>
              <label style={styles.inputLabel}>Webhook URL</label>
              <input
                type="url"
                style={{
                  ...styles.input,
                  ...(!preferences.webhook.available || !preferences.webhook.enabled
                    ? styles.inputDisabled
                    : {}),
                }}
                value={preferences.webhook.url}
                onChange={(e) =>
                  handleInputChange('webhook', 'url', e.target.value)
                }
                disabled={!preferences.webhook.available || !preferences.webhook.enabled}
                placeholder="https://your-service.com/webhook"
              />
            </div>
          </div>

          <div style={{ display: 'flex', marginTop: '1.5rem' }}>
            <button style={styles.button} onClick={handleSave}>
              Save Preferences
            </button>
            <button
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={handleTestNotification}
            >
              Send Test Notification
            </button>
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Upgrade Your Plan</h2>
          <p style={{ color: '#a0a0a0', marginBottom: '1rem' }}>
            Unlock Slack and Webhook notifications with a paid plan.
          </p>
          <button style={styles.button}>
            View Plans
          </button>
        </section>
      </main>
    </div>
  );
}
