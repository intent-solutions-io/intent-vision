/**
 * IntentVision Forecast Demo Page
 *
 * Phase E2E: Single-Metric Forecast Demo
 * Beads Task: intentvision-7ce
 *
 * Minimal UI for demonstrating the single-metric forecast flow:
 * 1. Ingest time series data
 * 2. Run forecast
 * 3. View results with simple visualization
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

const styles = {
  container: {
    minHeight: '100vh',
    padding: '2rem',
    maxWidth: '1200px',
    margin: '0 auto',
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
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  label: {
    fontSize: '0.875rem',
    color: '#888',
  },
  input: {
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(0, 0, 0, 0.3)',
    color: '#fff',
    fontSize: '1rem',
  },
  textarea: {
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(0, 0, 0, 0.3)',
    color: '#fff',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
    minHeight: '200px',
    resize: 'vertical' as const,
  },
  select: {
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(0, 0, 0, 0.3)',
    color: '#fff',
    fontSize: '1rem',
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
    width: 'fit-content',
  },
  buttonSecondary: {
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: '600',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    cursor: 'pointer',
    background: 'transparent',
    color: '#fff',
    width: 'fit-content',
  },
  buttonRow: {
    display: 'flex',
    gap: '1rem',
    marginTop: '0.5rem',
  },
  chart: {
    width: '100%',
    height: '300px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  chartBar: {
    position: 'absolute' as const,
    bottom: '40px',
    width: '8px',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s',
  },
  chartLabel: {
    position: 'absolute' as const,
    bottom: '10px',
    fontSize: '0.625rem',
    color: '#666',
    transform: 'rotate(-45deg)',
    transformOrigin: 'left center',
    whiteSpace: 'nowrap' as const,
  },
  resultCard: {
    background: 'rgba(0, 200, 100, 0.1)',
    borderRadius: '8px',
    padding: '1rem',
    marginTop: '1rem',
    border: '1px solid rgba(0, 200, 100, 0.3)',
  },
  errorCard: {
    background: 'rgba(255, 100, 100, 0.1)',
    borderRadius: '8px',
    padding: '1rem',
    marginTop: '1rem',
    border: '1px solid rgba(255, 100, 100, 0.3)',
    color: '#ff6464',
  },
  badge: {
    display: 'inline-block',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600',
    background: 'rgba(0, 212, 255, 0.2)',
    color: '#00d4ff',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#666',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: '600',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    marginTop: '1rem',
  },
  banner: {
    background: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
    color: '#00d4ff',
  },
};

interface Point {
  timestamp: string;
  value: number;
}

interface ForecastResult {
  forecastId: string;
  backend: string;
  inputPointsCount: number;
  outputPointsCount: number;
  generatedAt: string;
  points: Point[];
  modelInfo?: { name: string; version?: string };
}

// Sample data generator
function generateSampleData(days: number): Point[] {
  const points: Point[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let value = 10000; // Starting MRR
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // Add some realistic variation
    const trend = value * 0.002; // 0.2% daily growth
    const seasonality = Math.sin(i / 7 * Math.PI) * value * 0.02;
    const noise = (Math.random() - 0.5) * value * 0.05;
    value = Math.max(0, value + trend + seasonality + noise);

    points.push({
      timestamp: date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100,
    });
  }
  return points;
}

export default function ForecastDemoPage() {
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('http://localhost:8080');
  const [metricId, setMetricId] = useState('mrr-demo');
  const [metricName, setMetricName] = useState('Monthly Recurring Revenue');
  const [dataPoints, setDataPoints] = useState<string>('');
  const [backend, setBackend] = useState<'stub' | 'stat' | 'timegpt'>('stat');
  const [horizonDays, setHorizonDays] = useState(7);

  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);
  const [historicalData, setHistoricalData] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateSample = () => {
    const points = generateSampleData(90);
    setDataPoints(JSON.stringify(points, null, 2));
    setHistoricalData(points);
  };

  const handleIngest = async () => {
    if (!apiKey) {
      setError('API Key is required');
      return;
    }

    setLoading(true);
    setError(null);
    setIngestResult(null);

    try {
      let points: Point[];
      try {
        points = JSON.parse(dataPoints);
      } catch {
        throw new Error('Invalid JSON format for data points');
      }

      const response = await fetch(`${apiUrl}/v1/demo/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          metricId,
          metricName,
          unit: 'USD',
          points,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Ingest failed');
      }

      setHistoricalData(points);
      setIngestResult(`Ingested ${data.data.pointsIngested} points (total: ${data.data.totalPoints})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleForecast = async () => {
    if (!apiKey) {
      setError('API Key is required');
      return;
    }

    setLoading(true);
    setError(null);
    setForecastResult(null);

    try {
      const response = await fetch(`${apiUrl}/v1/demo/forecast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          metricId,
          horizonDays,
          backend,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Forecast failed');
      }

      setForecastResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Simple bar chart visualization
  const renderChart = () => {
    const allPoints = [
      ...historicalData.slice(-30).map(p => ({ ...p, type: 'historical' })),
      ...(forecastResult?.points || []).map(p => ({ ...p, type: 'forecast' })),
    ];

    if (allPoints.length === 0) {
      return (
        <div style={{ ...styles.chart, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
          No data to display. Ingest data and run a forecast.
        </div>
      );
    }

    const maxValue = Math.max(...allPoints.map(p => p.value));
    const barWidth = Math.max(4, Math.min(12, (styles.chart.width as number || 800) / allPoints.length - 2));

    return (
      <div style={styles.chart}>
        {allPoints.map((point, idx) => {
          const height = (point.value / maxValue) * 220;
          const isForcast = point.type === 'forecast';
          return (
            <div key={idx}>
              <div
                style={{
                  ...styles.chartBar,
                  left: `${20 + idx * (barWidth + 2)}px`,
                  height: `${height}px`,
                  width: `${barWidth}px`,
                  background: isForcast
                    ? 'linear-gradient(180deg, #7b2cbf, #9b4dca)'
                    : 'linear-gradient(180deg, #00d4ff, #0099cc)',
                }}
                title={`${point.timestamp}: ${point.value.toFixed(2)}`}
              />
              {idx % Math.ceil(allPoints.length / 10) === 0 && (
                <div
                  style={{
                    ...styles.chartLabel,
                    left: `${20 + idx * (barWidth + 2)}px`,
                  }}
                >
                  {point.timestamp.split('T')[0].slice(5)}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
          <span><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#00d4ff', borderRadius: '2px', marginRight: '4px', verticalAlign: 'middle' }}></span>Historical</span>
          <span><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#7b2cbf', borderRadius: '2px', marginRight: '4px', verticalAlign: 'middle' }}></span>Forecast</span>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/" style={styles.logo}>
          IntentVision
        </Link>
        <nav style={styles.nav}>
          <Link to="/dashboard" style={styles.navLink}>Dashboard</Link>
          <span style={{ ...styles.navLink, color: '#fff' }}>Forecast Demo</span>
        </nav>
      </header>

      <div style={styles.banner}>
        E2E Single-Metric Forecast Demo - This page demonstrates the complete forecast flow using the /v1/demo/* endpoints.
      </div>

      {/* Configuration */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Configuration</h2>
        <div style={styles.form}>
          <div style={styles.formRow}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>API URL</label>
              <input
                type="text"
                style={styles.input}
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8080"
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>API Key</label>
              <input
                type="password"
                style={styles.input}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="iv_xxx..."
              />
            </div>
          </div>
          <div style={styles.formRow}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Metric ID</label>
              <input
                type="text"
                style={styles.input}
                value={metricId}
                onChange={(e) => setMetricId(e.target.value)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Metric Name</label>
              <input
                type="text"
                style={styles.input}
                value={metricName}
                onChange={(e) => setMetricName(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Data Ingestion */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>1. Ingest Data</h2>
        <div style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Data Points (JSON array)</label>
            <textarea
              style={styles.textarea}
              value={dataPoints}
              onChange={(e) => setDataPoints(e.target.value)}
              placeholder='[{"timestamp": "2025-01-01", "value": 10000}, ...]'
            />
          </div>
          <div style={styles.buttonRow}>
            <button style={styles.buttonSecondary} onClick={generateSample}>
              Generate Sample Data (90 days)
            </button>
            <button style={styles.button} onClick={handleIngest} disabled={loading}>
              {loading ? 'Ingesting...' : 'Ingest Data'}
            </button>
          </div>
          {ingestResult && (
            <div style={styles.resultCard}>
              {ingestResult}
            </div>
          )}
        </div>
      </section>

      {/* Forecast */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>2. Run Forecast</h2>
        <div style={styles.form}>
          <div style={styles.formRow}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Backend</label>
              <select
                style={styles.select}
                value={backend}
                onChange={(e) => setBackend(e.target.value as 'stub' | 'stat' | 'timegpt')}
              >
                <option value="stat">Statistical (EWMA)</option>
                <option value="stub">Stub (Test Data)</option>
                <option value="timegpt">TimeGPT (Nixtla)</option>
              </select>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Horizon (days)</label>
              <input
                type="number"
                style={styles.input}
                value={horizonDays}
                onChange={(e) => setHorizonDays(parseInt(e.target.value) || 7)}
                min={1}
                max={365}
              />
            </div>
          </div>
          <div style={styles.buttonRow}>
            <button style={styles.button} onClick={handleForecast} disabled={loading}>
              {loading ? 'Forecasting...' : 'Run Forecast'}
            </button>
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div style={styles.errorCard}>
          Error: {error}
        </div>
      )}

      {/* Results */}
      {forecastResult && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>3. Forecast Results</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <span style={styles.badge}>{forecastResult.backend}</span>
            <span style={styles.badge}>{forecastResult.modelInfo?.name || 'Unknown Model'}</span>
            <span style={{ fontSize: '0.875rem', color: '#666' }}>
              Generated: {new Date(forecastResult.generatedAt).toLocaleString()}
            </span>
          </div>
          <div style={styles.statsGrid}>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Input Points</span>
              <span style={styles.statValue}>{forecastResult.inputPointsCount}</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Forecast Points</span>
              <span style={styles.statValue}>{forecastResult.outputPointsCount}</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Horizon</span>
              <span style={styles.statValue}>{horizonDays} days</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Forecast ID</span>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{forecastResult.forecastId}</span>
            </div>
          </div>
        </section>
      )}

      {/* Chart */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Visualization</h2>
        {renderChart()}
      </section>
    </div>
  );
}
