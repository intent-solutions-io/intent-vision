/**
 * IntentVision Contract Tests
 *
 * Minimal test harness validating contract types and fixtures.
 * Uses Node.js built-in test runner (requires Node 20+).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateCanonicalMetric,
  createCanonicalMetric,
  type CanonicalMetric,
  type TimeSeries,
  type MetricBatch,
  type ForecastRequest,
  type ForecastResponse,
  type AnomalyDetectionRequest,
  type AnomalyDetectionResponse,
  type AlertTrigger,
  type AlertRule,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures');

// =============================================================================
// Fixture Loading
// =============================================================================

function loadFixture<T>(filename: string): T {
  const content = readFileSync(join(fixturesDir, filename), 'utf-8');
  return JSON.parse(content) as T;
}

interface MetricsFixture {
  canonical_metrics: CanonicalMetric[];
  time_series: TimeSeries;
  metric_batch: MetricBatch;
  invalid_metrics: unknown[];
}

interface ForecastFixture {
  forecast_request: ForecastRequest;
  forecast_response: ForecastResponse;
}

interface AnomalyFixture {
  anomaly_detection_request: AnomalyDetectionRequest;
  anomaly_detection_response: AnomalyDetectionResponse;
}

interface AlertFixture {
  alert_trigger: AlertTrigger;
  alert_rule: AlertRule;
}

// =============================================================================
// Metrics Spine Tests
// =============================================================================

describe('Metrics Spine Contract', () => {
  const fixture = loadFixture<MetricsFixture>('sample-metrics.json');

  it('validates canonical metrics from fixture', () => {
    for (const metric of fixture.canonical_metrics) {
      assert.doesNotThrow(
        () => validateCanonicalMetric(metric),
        `Valid metric should pass validation`
      );
    }
  });

  it('rejects invalid metrics', () => {
    for (const invalid of fixture.invalid_metrics) {
      assert.throws(
        () => validateCanonicalMetric(invalid),
        `Invalid metric should fail validation`
      );
    }
  });

  it('creates canonical metric with factory function', () => {
    const metric = createCanonicalMetric(
      'org-test',
      'test.metric',
      42.5,
      '2025-12-15T10:00:00.000Z',
      { env: 'test' },
      'test-source'
    );

    assert.strictEqual(metric.org_id, 'org-test');
    assert.strictEqual(metric.metric_key, 'test.metric');
    assert.strictEqual(metric.value, 42.5);
    assert.strictEqual(metric.dimensions.env, 'test');
    assert.strictEqual(metric.provenance.source_id, 'test-source');
    assert.ok(metric.provenance.ingested_at);
  });

  it('validates time series structure', () => {
    const series = fixture.time_series;

    assert.ok(series.org_id);
    assert.ok(series.metric_key);
    assert.ok(series.dimensions);
    assert.ok(Array.isArray(series.data_points));
    assert.ok(series.data_points.length > 0);
    assert.ok(series.metadata.start_time);
    assert.ok(series.metadata.end_time);
    assert.strictEqual(series.metadata.count, series.data_points.length);
  });

  it('validates metric batch structure', () => {
    const batch = fixture.metric_batch;

    assert.ok(batch.batch_id);
    assert.ok(batch.org_id);
    assert.ok(Array.isArray(batch.metrics));
    assert.ok(batch.metadata.created_at);
    assert.ok(batch.metadata.source);
    assert.strictEqual(typeof batch.metadata.count, 'number');
  });
});

// =============================================================================
// Forecast Contract Tests
// =============================================================================

describe('Forecast Contract', () => {
  const fixture = loadFixture<ForecastFixture>('sample-forecast.json');

  it('validates forecast request structure', () => {
    const req = fixture.forecast_request;

    assert.ok(req.request_id);
    assert.ok(req.org_id);
    assert.ok(req.series);
    assert.ok(req.series.data_points.length > 0);
    assert.strictEqual(typeof req.horizon, 'number');
    assert.ok(req.frequency);
  });

  it('validates forecast response structure', () => {
    const res = fixture.forecast_response;

    assert.strictEqual(res.request_id, fixture.forecast_request.request_id);
    assert.strictEqual(res.success, true);
    assert.ok(res.forecast);
    assert.ok(Array.isArray(res.forecast.predictions));
    assert.ok(res.forecast.predictions.length > 0);
    assert.ok(res.backend);
    assert.ok(res.metadata);
  });

  it('validates forecast point with intervals', () => {
    const point = fixture.forecast_response.forecast!.predictions[0];

    assert.ok(point.timestamp);
    assert.strictEqual(typeof point.value, 'number');
    assert.ok(point.intervals);

    const interval80 = point.intervals['0.80'];
    assert.ok(interval80);
    assert.strictEqual(typeof interval80.lower, 'number');
    assert.strictEqual(typeof interval80.upper, 'number');
    assert.ok(interval80.lower < point.value);
    assert.ok(interval80.upper > point.value);
  });

  it('validates forecast metadata', () => {
    const meta = fixture.forecast_response.metadata;

    assert.ok(meta.generated_at);
    assert.strictEqual(typeof meta.duration_ms, 'number');
    assert.strictEqual(typeof meta.input_points, 'number');
    assert.strictEqual(typeof meta.output_points, 'number');
  });
});

// =============================================================================
// Anomaly Detection Contract Tests
// =============================================================================

describe('Anomaly Detection Contract', () => {
  const fixture = loadFixture<AnomalyFixture>('sample-anomaly.json');

  it('validates anomaly detection request structure', () => {
    const req = fixture.anomaly_detection_request;

    assert.ok(req.request_id);
    assert.ok(req.org_id);
    assert.ok(req.series);
    assert.ok(req.series.data_points.length > 0);
  });

  it('validates anomaly detection options', () => {
    const opts = fixture.anomaly_detection_request.options;

    assert.ok(opts);
    assert.strictEqual(typeof opts.sensitivity, 'number');
    assert.ok(opts.sensitivity >= 0 && opts.sensitivity <= 1);
    assert.ok(opts.method);
  });

  it('validates anomaly detection response structure', () => {
    const res = fixture.anomaly_detection_response;

    assert.strictEqual(res.request_id, fixture.anomaly_detection_request.request_id);
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.anomalies));
    assert.ok(res.metadata);
  });

  it('validates detected anomaly structure', () => {
    const anomaly = fixture.anomaly_detection_response.anomalies[0];

    assert.ok(anomaly.anomaly_id);
    assert.ok(anomaly.timestamp);
    assert.strictEqual(typeof anomaly.observed_value, 'number');
    assert.strictEqual(typeof anomaly.expected_value, 'number');
    assert.ok(anomaly.score >= 0 && anomaly.score <= 1);
    assert.ok(anomaly.type);
    assert.ok(anomaly.severity);
    assert.ok(anomaly.description);
  });

  it('validates anomaly context when present', () => {
    const anomaly = fixture.anomaly_detection_response.anomalies[0];

    assert.ok(anomaly.context);
    assert.ok(Array.isArray(anomaly.context.before));
    assert.ok(Array.isArray(anomaly.context.after));
    assert.ok(anomaly.context.statistics);
    assert.strictEqual(typeof anomaly.context.statistics.mean, 'number');
    assert.strictEqual(typeof anomaly.context.statistics.std_dev, 'number');
  });
});

// =============================================================================
// Alert Contract Tests
// =============================================================================

describe('Alert Contract', () => {
  const fixture = loadFixture<AlertFixture>('sample-alert.json');

  it('validates alert trigger structure', () => {
    const alert = fixture.alert_trigger;

    assert.ok(alert.alert_id);
    assert.ok(alert.rule_id);
    assert.ok(alert.org_id);
    assert.ok(alert.triggered_at);
    assert.ok(alert.severity);
    assert.ok(alert.status);
    assert.ok(alert.trigger_type);
    assert.ok(alert.title);
    assert.ok(alert.description);
  });

  it('validates alert metric context', () => {
    const ctx = fixture.alert_trigger.metric_context;

    assert.ok(ctx.metric_key);
    assert.ok(ctx.dimensions);
    assert.strictEqual(typeof ctx.current_value, 'number');
  });

  it('validates alert trigger details match type', () => {
    const alert = fixture.alert_trigger;
    const details = alert.trigger_details;

    assert.strictEqual(details.type, alert.trigger_type);

    if (details.type === 'threshold') {
      assert.ok(details.operator);
      assert.strictEqual(typeof details.threshold, 'number');
      assert.strictEqual(typeof details.actual_value, 'number');
    }
  });

  it('validates alert routing configuration', () => {
    const routing = fixture.alert_trigger.routing;

    assert.ok(Array.isArray(routing.channels));
    assert.ok(routing.channels.length > 0);

    for (const channel of routing.channels) {
      assert.ok(channel.type);
      assert.ok(channel.destination);
    }
  });

  it('validates alert lifecycle', () => {
    const lifecycle = fixture.alert_trigger.lifecycle;

    assert.ok(lifecycle.triggered_at);
    assert.strictEqual(typeof lifecycle.notification_count, 'number');
  });

  it('validates alert rule structure', () => {
    const rule = fixture.alert_rule;

    assert.ok(rule.rule_id);
    assert.ok(rule.org_id);
    assert.ok(rule.name);
    assert.strictEqual(typeof rule.enabled, 'boolean');
    assert.ok(rule.metric_key);
    assert.ok(rule.condition);
    assert.ok(rule.severity);
    assert.ok(rule.routing);
  });
});

// =============================================================================
// Cross-Contract Integration Tests
// =============================================================================

describe('Cross-Contract Integration', () => {
  it('anomaly can be embedded in alert trigger details', () => {
    const alertFixture = loadFixture<AlertFixture>('sample-alert.json');
    const anomalyFixture = loadFixture<AnomalyFixture>('sample-anomaly.json');

    // Verify anomaly structure is compatible with alert trigger details
    const anomaly = anomalyFixture.anomaly_detection_response.anomalies[0];

    const anomalyTriggerDetails = {
      type: 'anomaly' as const,
      anomaly: anomaly,
      detection_method: 'statistical',
    };

    assert.ok(anomalyTriggerDetails.anomaly.anomaly_id);
    assert.ok(anomalyTriggerDetails.detection_method);
  });

  it('forecast can inform alert trigger details', () => {
    const forecastFixture = loadFixture<ForecastFixture>('sample-forecast.json');
    const prediction = forecastFixture.forecast_response.forecast!.predictions[0];

    const forecastTriggerDetails = {
      type: 'forecast' as const,
      predicted_value: prediction.value,
      prediction_timestamp: prediction.timestamp,
      confidence_interval: prediction.intervals?.['0.95']
        ? { lower: prediction.intervals['0.95'].lower, upper: prediction.intervals['0.95'].upper }
        : undefined,
    };

    assert.strictEqual(typeof forecastTriggerDetails.predicted_value, 'number');
    assert.ok(forecastTriggerDetails.prediction_timestamp);
  });

  it('time series flows through forecast and anomaly detection', () => {
    const metricsFixture = loadFixture<MetricsFixture>('sample-metrics.json');
    const forecastFixture = loadFixture<ForecastFixture>('sample-forecast.json');
    const anomalyFixture = loadFixture<AnomalyFixture>('sample-anomaly.json');

    // All use consistent structure
    const metricsSeries = metricsFixture.time_series;
    const forecastSeries = forecastFixture.forecast_request.series;
    const anomalySeries = anomalyFixture.anomaly_detection_request.series;

    // All have same required fields
    for (const series of [metricsSeries, forecastSeries, anomalySeries]) {
      assert.ok(series.org_id);
      assert.ok(series.metric_key);
      assert.ok(series.dimensions);
      assert.ok(Array.isArray(series.data_points));
    }
  });
});
