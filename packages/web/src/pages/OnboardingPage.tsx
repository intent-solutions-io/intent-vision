/**
 * IntentVision Onboarding Page
 *
 * Phase 14: Customer Onboarding Flow + First Forecast Experience
 *
 * Multi-step wizard for onboarding:
 * 1. Organization setup (name + email)
 * 2. Create first project
 * 3. Connect sample data source OR skip
 * 4. Run first forecast + see results
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingWizard, { type WizardStep } from '../components/OnboardingWizard';

const styles = {
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
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: '#fff',
  },
  subtitle: {
    color: '#a0a0a0',
    marginBottom: '2rem',
  },
  buttons: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem',
  },
  button: {
    flex: 1,
    padding: '1rem',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.2s, opacity 0.2s',
  },
  buttonPrimary: {
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    color: '#fff',
  },
  buttonSecondary: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  dataInfo: {
    background: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
  },
  dataInfoTitle: {
    fontSize: '0.875rem',
    fontWeight: '600',
    marginBottom: '0.5rem',
    color: '#00d4ff',
  },
  dataInfoText: {
    fontSize: '0.75rem',
    color: '#d0d0d0',
  },
  loading: {
    textAlign: 'center' as const,
    color: '#a0a0a0',
  },
};

const STEPS: WizardStep[] = [
  { id: 'org', label: 'Organization', number: 1 },
  { id: 'project', label: 'Project', number: 2 },
  { id: 'data', label: 'Data Source', number: 3 },
  { id: 'forecast', label: 'First Forecast', number: 4 },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Organization
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');

  // Step 2: Project
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectId, setProjectId] = useState('');

  const handleStep1Next = async () => {
    setError('');
    if (!orgName.trim()) {
      setError('Organization name is required');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Valid email is required');
      return;
    }

    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    setLoading(false);
    setCurrentStep(2);
  };

  const handleStep2Next = async () => {
    setError('');
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call to create project
      // In production: POST /orgs/self/projects
      await new Promise((resolve) => setTimeout(resolve, 800));
      const mockProjectId = `proj-${Date.now().toString(36)}`;
      setProjectId(mockProjectId);
      setLoading(false);
      setCurrentStep(3);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  const handleStep3LoadData = async () => {
    setError('');
    setLoading(true);
    try {
      // Simulate API call to load sample data
      // In production: POST /projects/:id/sample-source
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setLoading(false);
      setCurrentStep(4);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  const handleStep3Skip = () => {
    setCurrentStep(4);
  };

  const handleStep4RunForecast = async () => {
    setError('');
    setLoading(true);
    try {
      // Simulate API call to run first forecast
      // In production: POST /projects/:id/first-forecast
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setLoading(false);
      navigate(`/onboarding/success?projectId=${projectId}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <OnboardingWizard currentStep={currentStep} totalSteps={4} steps={STEPS}>
      {/* Step 1: Organization Setup */}
      {currentStep === 1 && (
        <>
          <h2 style={styles.title}>Create Your Organization</h2>
          <p style={styles.subtitle}>
            Let's get started with IntentVision. First, tell us about your organization.
          </p>

          <form style={styles.form} onSubmit={(e) => e.preventDefault()}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Organization Name</label>
              <input
                type="text"
                style={styles.input}
                placeholder="Acme Inc"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={loading}
              />
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
              <span style={styles.hint}>
                We'll use this to send you important updates and alerts
              </span>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.buttons}>
              <button
                type="button"
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  ...(loading ? styles.buttonDisabled : {}),
                }}
                onClick={handleStep1Next}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Continue'}
              </button>
            </div>
          </form>
        </>
      )}

      {/* Step 2: Create Project */}
      {currentStep === 2 && (
        <>
          <h2 style={styles.title}>Create Your First Project</h2>
          <p style={styles.subtitle}>
            Projects help you organize metrics and forecasts. Let's create your first one.
          </p>

          <form style={styles.form} onSubmit={(e) => e.preventDefault()}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Project Name</label>
              <input
                type="text"
                style={styles.input}
                placeholder="My SaaS Metrics"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Description (Optional)</label>
              <input
                type="text"
                style={styles.input}
                placeholder="Track key business metrics"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.buttons}>
              <button
                type="button"
                style={{
                  ...styles.button,
                  ...styles.buttonSecondary,
                }}
                onClick={() => setCurrentStep(1)}
                disabled={loading}
              >
                Back
              </button>
              <button
                type="button"
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  ...(loading ? styles.buttonDisabled : {}),
                }}
                onClick={handleStep2Next}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </>
      )}

      {/* Step 3: Connect Data Source */}
      {currentStep === 3 && (
        <>
          <h2 style={styles.title}>Connect a Data Source</h2>
          <p style={styles.subtitle}>
            Try IntentVision with sample data, or skip this step to connect your own later.
          </p>

          <div style={styles.dataInfo}>
            <div style={styles.dataInfoTitle}>Sample MRR Data</div>
            <div style={styles.dataInfoText}>
              We'll load 12 months of realistic Monthly Recurring Revenue data so you can see how
              forecasting works.
            </div>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          {loading && <div style={styles.loading}>Loading sample data...</div>}

          <div style={styles.buttons}>
            <button
              type="button"
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
              }}
              onClick={handleStep3Skip}
              disabled={loading}
            >
              Skip for Now
            </button>
            <button
              type="button"
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                ...(loading ? styles.buttonDisabled : {}),
              }}
              onClick={handleStep3LoadData}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load Sample Data'}
            </button>
          </div>
        </>
      )}

      {/* Step 4: Run First Forecast */}
      {currentStep === 4 && (
        <>
          <h2 style={styles.title}>Run Your First Forecast</h2>
          <p style={styles.subtitle}>
            Let's generate a forecast to see IntentVision in action. This will predict your MRR for
            the next 3 months.
          </p>

          <div style={styles.dataInfo}>
            <div style={styles.dataInfoTitle}>What will happen?</div>
            <div style={styles.dataInfoText}>
              IntentVision will analyze your historical data and generate predictions using
              statistical models. You'll see a visual forecast with confidence intervals.
            </div>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          {loading && <div style={styles.loading}>Generating your forecast...</div>}

          <div style={styles.buttons}>
            <button
              type="button"
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
              }}
              onClick={() => setCurrentStep(3)}
              disabled={loading}
            >
              Back
            </button>
            <button
              type="button"
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                ...(loading ? styles.buttonDisabled : {}),
              }}
              onClick={handleStep4RunForecast}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Run Forecast'}
            </button>
          </div>
        </>
      )}
    </OnboardingWizard>
  );
}
