# IntentVision TypeScript SDK

Official TypeScript/JavaScript SDK for the IntentVision API.

## Installation

```bash
npm install @intentvision/sdk
```

## Quick Start

```typescript
import { IntentVisionClient } from '@intentvision/sdk';

// Initialize the client
const client = new IntentVisionClient({
  apiKey: process.env.INTENTVISION_API_KEY!,
});

// Ingest data
await client.ingestEvent({
  source: 'stripe',
  metric: 'mrr',
  value: 125000,
  timestamp: new Date().toISOString(),
});

// Get forecast
const forecast = await client.getForecast('mrr', { horizonDays: 30 });
console.log(forecast.points);
```

## Configuration

### Client Options

```typescript
const client = new IntentVisionClient({
  apiKey: 'iv_your_api_key_here',      // Required
  baseUrl: 'https://api.intentvision.com', // Optional, defaults to production
  timeout: 30000,                       // Optional, request timeout in ms
});
```

### Environment Variables

```bash
# Set your API key
export INTENTVISION_API_KEY=iv_your_api_key_here
```

## Sandbox vs Production Keys

IntentVision supports two types of API keys:

### Production Keys
- Full access to all features
- Real forecasting with TimeGPT/Nixtla
- Based on your plan limits
- Billable usage

### Sandbox Keys
- Free testing environment
- Limited to 100 requests/day
- Only last 30 days of data
- Statistical forecasting only (no TimeGPT)
- All responses include `sandbox: true` flag

```typescript
// Sandbox responses include a flag
const forecast = await client.runForecast({
  metricName: 'mrr',
  horizonDays: 30,
});

if (forecast.sandbox) {
  console.log('This is a sandbox forecast');
}
```

## API Reference

### Events

#### Ingest Event

Ingest a single event data point.

```typescript
await client.ingestEvent({
  source: 'stripe',           // Data source identifier
  metric: 'mrr',              // Metric name
  value: 125000,              // Numeric value
  timestamp: '2025-12-16T10:30:00Z',  // ISO 8601 timestamp
  dimensions: {               // Optional dimensions
    plan: 'growth',
    region: 'us-west',
  },
  metadata: {                 // Optional metadata
    customer_id: 'cus_123',
  },
});
```

### Forecasts

#### Get Forecast

Retrieve forecast data for a metric.

```typescript
const forecast = await client.getForecast('mrr', {
  horizonDays: 30,            // Optional, default: 7
  from: '2025-12-01T00:00:00Z', // Optional, start date
  to: '2025-12-31T23:59:59Z',   // Optional, end date
});

// Access forecast points
forecast.points.forEach(point => {
  console.log(point.timestamp, point.predicted);
  console.log(`  Confidence: [${point.confidenceLower}, ${point.confidenceUpper}]`);
});
```

#### Run Forecast

Generate a new forecast for a metric.

```typescript
const result = await client.runForecast({
  metricName: 'mrr',
  horizonDays: 30,            // Optional, default: 7
  backend: 'statistical',     // Optional: 'statistical' | 'nixtla'
});

console.log(`Forecast ID: ${result.forecastId}`);
console.log(`Points: ${result.pointsGenerated}`);
console.log(`Status: ${result.status}`);
```

### Alerts

#### List Alerts

Get all alert rules for your organization.

```typescript
const alerts = await client.listAlerts();

alerts.forEach(alert => {
  console.log(`${alert.name} - ${alert.metricName}`);
  console.log(`  Enabled: ${alert.enabled}`);
});
```

#### Create Alert

Create a new alert rule.

```typescript
const alert = await client.createAlert({
  name: 'MRR Below Target',
  description: 'Alert when MRR forecast drops below $100k',
  type: 'threshold',
  metricName: 'mrr',
  condition: {
    operator: 'lt',           // 'gt' | 'lt' | 'gte' | 'lte'
    value: 100000,
  },
  horizonDays: 7,
  channels: [
    {
      type: 'email',
      to: ['team@company.com'],
      enabled: true,
    },
  ],
  enabled: true,
});
```

#### Update Alert

Update an existing alert rule.

```typescript
const updated = await client.updateAlert('alert_abc123', {
  enabled: false,
  condition: {
    operator: 'lt',
    value: 90000,
  },
});
```

#### Delete Alert

Delete an alert rule.

```typescript
await client.deleteAlert('alert_abc123');
```

### Metrics

#### List Metrics

Get all metrics for your organization.

```typescript
const metrics = await client.listMetrics();

metrics.forEach(metric => {
  console.log(`${metric.name}: ${metric.dataPointCount} points`);
});
```

#### Get Timeseries Data

Retrieve historical timeseries data for a metric.

```typescript
const data = await client.getMetricTimeseries('mrr', {
  from: '2025-11-01T00:00:00Z',
  to: '2025-12-01T00:00:00Z',
  limit: 1000,                // Optional, max 10000
});

data.points.forEach(point => {
  console.log(point.timestamp, point.value);
});
```

### Organization

#### Get Organization Info

Get information about your organization.

```typescript
const org = await client.getOrganization();

console.log(`Name: ${org.name}`);
console.log(`Plan: ${org.plan}`);
console.log(`Status: ${org.status}`);
```

## Error Handling

The SDK throws `IntentVisionError` for API errors:

```typescript
import { IntentVisionClient, IntentVisionError } from '@intentvision/sdk';

try {
  await client.ingestEvent({...});
} catch (error) {
  if (error instanceof IntentVisionError) {
    console.error(`API Error: ${error.message}`);
    console.error(`Code: ${error.code}`);
    console.error(`Status: ${error.statusCode}`);
    console.error(`Request ID: ${error.requestId}`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Common Error Codes

- `INVALID_API_KEY` - API key is invalid or revoked
- `INSUFFICIENT_PERMISSIONS` - API key lacks required scopes
- `SANDBOX_LIMIT_EXCEEDED` - Sandbox daily limit reached (100 requests/day)
- `TIMEOUT_ERROR` - Request timeout (default: 30s)
- `NETWORK_ERROR` - Network connectivity issue

## Examples

See the `examples/` directory for complete examples:

- `quickstart.ts` - Basic usage walkthrough
- Run with: `tsx examples/quickstart.ts`

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions.

```typescript
import type {
  IngestEventParams,
  ForecastResponse,
  AlertRule,
  Metric,
} from '@intentvision/sdk';
```

## License

MIT

## Support

- Documentation: https://docs.intentvision.com
- API Reference: https://api.intentvision.com/docs
- Support: support@intentvision.com
