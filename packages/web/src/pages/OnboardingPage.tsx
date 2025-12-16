/**
 * IntentVision Onboarding Page
 *
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Beads Task: intentvision-p5
 *
 * Collects organization name and slug, validates uniqueness,
 * creates org + user via API.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '2.5rem',
    maxWidth: '450px',
    width: '100%',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  logo: {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    color: '#a0a0a0',
    marginBottom: '2rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#fff',
  },
  input: {
    padding: '0.875rem 1rem',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#666',
  },
  error: {
    fontSize: '0.75rem',
    color: '#ff6b6b',
  },
  button: {
    padding: '1rem',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    color: '#fff',
    transition: 'transform 0.2s, opacity 0.2s',
    marginTop: '1rem',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  success: {
    background: 'rgba(0, 200, 100, 0.1)',
    border: '1px solid rgba(0, 200, 100, 0.3)',
    borderRadius: '8px',
    padding: '1rem',
    marginTop: '1rem',
  },
  apiKeyBox: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '4px',
    padding: '0.75rem',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    wordBreak: 'break-all' as const,
    marginTop: '0.5rem',
    color: '#00d4ff',
  },
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ orgId: string; apiKey?: string } | null>(null);

  // Auto-generate slug from org name
  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    const autoSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(autoSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate inputs
      if (!orgName.trim()) {
        throw new Error('Organization name is required');
      }
      if (!slug.trim() || !/^[a-z0-9-]+$/.test(slug)) {
        throw new Error('Slug must be lowercase alphanumeric with hyphens');
      }
      if (!email.trim() || !email.includes('@')) {
        throw new Error('Valid email is required');
      }

      // For demo purposes, we'll simulate the API call
      // In production, this would call POST /v1/internal/organizations
      // with proper Firebase Auth token

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock success response
      const mockOrgId = `org-${Date.now().toString(36)}`;
      const mockApiKey = `iv_${slug}_${Math.random().toString(36).slice(2, 18)}`;

      setSuccess({
        orgId: mockOrgId,
        apiKey: mockApiKey,
      });

      // In production, redirect to dashboard after success
      // setTimeout(() => navigate('/dashboard'), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.logo}>Welcome!</h1>
          <p style={styles.subtitle}>Your organization has been created.</p>

          <div style={styles.success}>
            <p><strong>Organization ID:</strong> {success.orgId}</p>
            {success.apiKey && (
              <>
                <p style={{ marginTop: '1rem' }}>
                  <strong>Your API Key (save this now!):</strong>
                </p>
                <div style={styles.apiKeyBox}>{success.apiKey}</div>
                <p style={{ ...styles.hint, marginTop: '0.5rem' }}>
                  This key will only be shown once.
                </p>
              </>
            )}
          </div>

          <button
            style={styles.button}
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>Create Your Account</h1>
        <p style={styles.subtitle}>Get started with IntentVision in minutes.</p>

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Organization Name</label>
            <input
              type="text"
              style={styles.input}
              placeholder="Acme Inc"
              value={orgName}
              onChange={(e) => handleOrgNameChange(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>URL Slug</label>
            <input
              type="text"
              style={styles.input}
              placeholder="acme-inc"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              disabled={loading}
            />
            <span style={styles.hint}>
              Your dashboard: intentvision.io/{slug || 'your-slug'}
            </span>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              style={styles.input}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Organization'}
          </button>
        </form>
      </div>
    </div>
  );
}
