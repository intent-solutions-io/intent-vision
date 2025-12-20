/**
 * OnboardingSuccessPage Component
 *
 * Phase 14: Customer Onboarding Flow + First Forecast Experience
 *
 * Shows first forecast results and explains what the forecast means.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '2.5rem',
    maxWidth: '800px',
    width: '100%',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '2rem',
  },
  successIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    color: '#a0a0a0',
    fontSize: '1rem',
  },
  chartContainer: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '12px',
    padding: '2rem',
    marginBottom: '2rem',
  },
  chartTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '1.5rem',
    color: '#fff',
  },
  chart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.5rem',
    height: '200px',
    marginBottom: '1rem',
  },
  bar: {
    flex: 1,
    background: 'linear-gradient(180deg, #00d4ff, #7b2cbf)',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.5s ease',
    position: 'relative' as const,
    minHeight: '10px',
  },
  barLabel: {
    position: 'absolute' as const,
    bottom: '-25px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '0.75rem',
    color: '#666',
    whiteSpace: 'nowrap' as const,
  },
  barValue: {
    position: 'absolute' as const,
    top: '-25px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '0.875rem',
    color: '#fff',
    fontWeight: '500',
    whiteSpace: 'nowrap' as const,
  },
  explanation: {
    background: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '2rem',
  },
  explanationTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    marginBottom: '0.75rem',
    color: '#00d4ff',
  },
  explanationText: {
    fontSize: '0.875rem',
    lineHeight: '1.6',
    color: '#d0d0d0',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  feature: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  featureIcon: {
    fontSize: '1.5rem',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: '0.875rem',
    fontWeight: '600',
    marginBottom: '0.25rem',
    color: '#fff',
  },
  featureDescription: {
    fontSize: '0.75rem',
    color: '#999',
  },
  button: {
    width: '100%',
    padding: '1rem',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    color: '#fff',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  loading: {
    textAlign: 'center' as const,
    color: '#a0a0a0',
  },
};

interface ForecastData {
  timestamp: string;
  predictedValue: number;
  confidenceLower: number;
  confidenceUpper: number;
}

export default function OnboardingSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(true);

  const projectId = searchParams.get('projectId');

  useEffect(() => {
    // Simulate loading forecast data
    // In production, this would fetch from the API
    setTimeout(() => {
      const mockData: ForecastData[] = [
        {
          timestamp: '2025-01-01',
          predictedValue: 15420,
          confidenceLower: 13857,
          confidenceUpper: 16983,
        },
        {
          timestamp: '2025-02-01',
          predictedValue: 17250,
          confidenceLower: 15525,
          confidenceUpper: 18975,
        },
        {
          timestamp: '2025-03-01',
          predictedValue: 19300,
          confidenceLower: 17370,
          confidenceUpper: 21230,
        },
      ];
      setForecastData(mockData);
      setLoading(false);
    }, 1000);
  }, [projectId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loading}>Loading your forecast...</div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...forecastData.map((d) => d.predictedValue));

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.successIcon}>🎉</div>
          <h1 style={styles.title}>Your First Forecast is Ready!</h1>
          <p style={styles.subtitle}>
            Here's what IntentVision predicts for your MRR over the next 3 months
          </p>
        </div>

        <div style={styles.chartContainer}>
          <h3 style={styles.chartTitle}>MRR Forecast - Next 3 Months</h3>
          <div style={styles.chart}>
            {forecastData.map((data, index) => {
              const height = (data.predictedValue / maxValue) * 100;
              return (
                <div
                  key={index}
                  style={{
                    ...styles.bar,
                    height: `${height}%`,
                  }}
                >
                  <span style={styles.barValue}>{formatCurrency(data.predictedValue)}</span>
                  <span style={styles.barLabel}>{formatDate(data.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.explanation}>
          <h4 style={styles.explanationTitle}>What does this mean?</h4>
          <p style={styles.explanationText}>
            Based on your historical MRR data, IntentVision predicts continued growth over the next
            quarter. The forecast shows a healthy upward trend with confidence intervals that help
            you plan for both optimistic and conservative scenarios.
          </p>
        </div>

        <div style={styles.features}>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>📊</span>
            <div style={styles.featureContent}>
              <div style={styles.featureTitle}>Real-time Updates</div>
              <div style={styles.featureDescription}>
                Forecasts update automatically as new data arrives
              </div>
            </div>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>🔔</span>
            <div style={styles.featureContent}>
              <div style={styles.featureTitle}>Smart Alerts</div>
              <div style={styles.featureDescription}>
                Get notified when metrics deviate from predictions
              </div>
            </div>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>⚡</span>
            <div style={styles.featureContent}>
              <div style={styles.featureTitle}>Multiple Models</div>
              <div style={styles.featureDescription}>
                Choose from statistical or AI-powered forecasting
              </div>
            </div>
          </div>
        </div>

        <button
          style={styles.button}
          onClick={() => navigate('/dashboard')}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 212, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
