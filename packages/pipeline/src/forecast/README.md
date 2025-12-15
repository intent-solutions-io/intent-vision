# Forecast Module

Central orchestrator for IntentVision forecasting operations.

## Overview

The `ForecastService` provides a unified interface for:
- Routing forecast requests to appropriate backends (Nixtla TimeGPT, Statistical, Stub)
- Managing backend registration and health checks
- Storing forecast jobs in database
- Anomaly detection via Nixtla TimeGPT
- Mock mode for testing

## Architecture

```
┌─────────────────────────────────────────┐
│        ForecastService                  │
│  (Orchestrator & Router)                │
└─────────────────────────────────────────┘
         │       │       │
         ▼       ▼       ▼
    ┌─────┐ ┌─────┐ ┌─────┐
    │Nixtla│ │Stats│ │Stub │
    └─────┘ └─────┘ └─────┘
```

## Quick Start

### Basic Usage

```typescript
import { getForecastService } from '@intentvision/pipeline/forecast';
import type { ForecastRequest } from '@intentvision/contracts';

// Get the service (singleton)
const service = getForecastService();

// Generate a forecast
const request: ForecastRequest = {
  request_id: 'req_123',
  org_id: 'org_acme',
  series: {
    metric_key: 'revenue',
    dimensions: { region: 'us-west' },
    data_points: [
      { timestamp: '2025-01-01T00:00:00Z', value: 1000 },
      { timestamp: '2025-01-02T00:00:00Z', value: 1100 },
      // ... more data points
    ],
  },
  horizon: 7,
  frequency: '1d',
  options: {
    confidence_levels: [0.80, 0.95],
    include_history: true,
  },
};

const response = await service.forecast(request);

if (response.success) {
  console.log('Predictions:', response.forecast?.predictions);
}
```

### Backend Selection

The service automatically selects the best available backend:

1. **Nixtla TimeGPT** (default if `NIXTLA_API_KEY` is set)
   - Production-grade foundation model
   - Supports prediction intervals
   - Handles seasonality automatically

2. **Statistical Backend**
   - Holt-Winters exponential smoothing
   - Automatic model selection
   - No external dependencies

3. **Stub Backend**
   - Simple moving average
   - Development/testing only

```typescript
// Use specific backend
const response = await service.forecast(request, 'nixtla-timegpt');

// Or specify in request options
const request: ForecastRequest = {
  // ... other fields
  options: {
    backend: 'custom', // Statistical backend
  },
};
```

### Anomaly Detection

```typescript
import type { TimeSeries } from '@intentvision/contracts';

const series: TimeSeries = {
  metric_key: 'cpu_usage',
  dimensions: { server: 'web-01' },
  data_points: [
    // Historical data with potential anomalies
  ],
};

const result = await service.detectAnomalies(series, 'org_acme');

if (result.success) {
  const anomalies = result.anomalies.filter(a => a.isAnomaly);
  console.log(`Found ${anomalies.length} anomalies`);
}
```

### Health Checks

```typescript
// Check all backends
const statuses = await service.healthCheck();

for (const status of statuses) {
  console.log(`${status.name}: ${status.healthy ? 'OK' : 'FAILED'}`);
}

// Get available backends
const backends = service.getAvailableBackends();
console.log('Available:', backends); // ['nixtla-timegpt', 'custom']
```

## Configuration

### Environment Variables

```bash
# Nixtla TimeGPT API Key (optional)
NIXTLA_API_KEY=your-api-key-here

# Database URL
INTENTVISION_DB_URL=file:db/intentvision.db
```

### Service Configuration

```typescript
import { getForecastService } from '@intentvision/pipeline/forecast';

const service = getForecastService({
  // Explicitly set default backend
  defaultBackend: 'nixtla-timegpt',

  // Override API key (instead of env var)
  nixtlaApiKey: 'your-api-key',

  // Enable mock mode for testing
  mockMode: true,
});
```

### Custom Backend Registration

```typescript
import { ForecastService } from '@intentvision/pipeline/forecast';
import type { ForecastBackend } from '@intentvision/contracts';

class CustomBackend implements ForecastBackend {
  readonly type = 'custom' as const;
  readonly name = 'My Custom Backend';

  async forecast(request) {
    // Implementation
  }

  async healthCheck() {
    return true;
  }

  capabilities() {
    return {
      max_horizon: 100,
      supported_frequencies: ['1h', '1d'],
      supports_intervals: true,
      supports_batch: false,
      supports_exogenous: false,
    };
  }
}

const service = new ForecastService();
service.registerBackend(new CustomBackend());
```

## Database Integration

All forecast jobs are automatically tracked in the `forecast_jobs` table:

```sql
CREATE TABLE forecast_jobs (
    job_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    metric_key TEXT NOT NULL,
    dimensions TEXT DEFAULT '{}',
    backend TEXT NOT NULL DEFAULT 'nixtla-timegpt',
    status TEXT NOT NULL DEFAULT 'pending',
    horizon INTEGER NOT NULL DEFAULT 12,
    frequency TEXT NOT NULL DEFAULT '1h',
    started_at TEXT,
    completed_at TEXT,
    error TEXT,
    forecast_id TEXT REFERENCES forecasts(request_id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Testing

### Mock Mode

```typescript
const service = getForecastService({ mockMode: true });

// Enable mock mode on Nixtla backend
service.enableMockMode();

// Use custom mock responses
const mockResponses = new Map([
  ['forecast', { /* mock forecast response */ }],
]);
service.enableMockMode(mockResponses);

// Disable mock mode
service.disableMockMode();
```

### Reset Singleton

```typescript
import { resetForecastService } from '@intentvision/pipeline/forecast';

// In test teardown
afterEach(() => {
  resetForecastService();
});
```

## Error Handling

The service gracefully handles errors and returns structured responses:

```typescript
const response = await service.forecast(request);

if (!response.success) {
  console.error('Forecast failed:', response.error);
  console.log('Duration:', response.metadata.duration_ms);
}
```

## Logging

All operations are logged via the observability logger:

```
2025-12-15T10:30:00.000Z INFO  [comp=ForecastService] ForecastService initialized
2025-12-15T10:30:01.123Z INFO  [cid=req_123 org=org_acme] Forecast request received
2025-12-15T10:30:02.456Z INFO  [cid=req_123 org=org_acme] Forecast completed
```

## API Reference

### ForecastService

#### Methods

- `forecast(request, backendType?)` - Generate a forecast
- `detectAnomalies(series, orgId, requestId?)` - Detect anomalies
- `getAvailableBackends()` - List available backends
- `healthCheck()` - Check all backends
- `getBackend(type)` - Get backend by type
- `registerBackend(backend)` - Register custom backend
- `enableMockMode(responses?)` - Enable mock mode
- `disableMockMode()` - Disable mock mode

### Factory Functions

- `getForecastService(config?)` - Get singleton service
- `resetForecastService()` - Reset singleton (testing)

## Related Modules

- `@intentvision/contracts` - Type definitions
- `packages/pipeline/src/forecast/nixtla-timegpt.ts` - Nixtla backend
- `packages/pipeline/src/forecast/statistical-forecast.ts` - Statistical backend
- `packages/pipeline/src/forecast/forecast-stub.ts` - Stub backend
