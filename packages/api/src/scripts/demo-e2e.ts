#!/usr/bin/env tsx
/**
 * E2E Demo Script
 *
 * Phase E2E: Single-Metric Forecast Demo
 * Beads Task: intentvision-zun
 *
 * Demonstrates the complete single-metric forecast flow:
 * 1. Ingest time series data
 * 2. Run forecast with different backends
 * 3. Retrieve and display results
 *
 * Usage:
 *   # Requires API server running (npm run dev)
 *   # Requires Firestore emulator (firebase emulators:start --only firestore)
 *   # Requires API key from seed script (npm run seed:dev)
 *
 *   API_KEY=iv_xxx tsx src/scripts/demo-e2e.ts
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY;

interface Point {
  timestamp: string;
  value: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  durationMs?: number;
}

// Generate sample MRR data
function generateSampleMRRData(days: number): Point[] {
  const points: Point[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let value = 10000; // Starting MRR
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // Add realistic variation
    const trend = value * 0.002; // 0.2% daily growth
    const seasonality = Math.sin((i / 7) * Math.PI) * value * 0.02;
    const noise = (Math.random() - 0.5) * value * 0.05;
    value = Math.max(0, value + trend + seasonality + noise);

    points.push({
      timestamp: date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100,
    });
  }
  return points;
}

async function apiCall<T>(
  endpoint: string,
  method: string = 'GET',
  body?: unknown
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY!,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response.json() as Promise<ApiResponse<T>>;
}

async function main() {
  console.log('========================================');
  console.log('IntentVision E2E Demo Script');
  console.log('Phase E2E: Single-Metric Forecast Demo');
  console.log('========================================\n');

  if (!API_KEY) {
    console.error('ERROR: API_KEY environment variable is required');
    console.error('Usage: API_KEY=iv_xxx tsx src/scripts/demo-e2e.ts');
    process.exit(1);
  }

  console.log(`API URL: ${API_URL}`);
  console.log(`API Key: ${API_KEY.slice(0, 8)}...`);
  console.log('');

  const metricId = `mrr-demo-${Date.now()}`;
  const metricName = 'Monthly Recurring Revenue';

  // Step 1: Generate and ingest sample data
  console.log('========================================');
  console.log('Step 1: Ingest Sample MRR Data');
  console.log('========================================');

  const sampleData = generateSampleMRRData(90); // 90 days of data
  console.log(`Generated ${sampleData.length} data points`);
  console.log(`Date range: ${sampleData[0].timestamp} to ${sampleData[sampleData.length - 1].timestamp}`);
  console.log(`Value range: $${Math.min(...sampleData.map((p) => p.value)).toFixed(2)} - $${Math.max(...sampleData.map((p) => p.value)).toFixed(2)}`);
  console.log('');

  const ingestResult = await apiCall('/v1/demo/ingest', 'POST', {
    metricId,
    metricName,
    unit: 'USD',
    description: 'Demo MRR metric for E2E testing',
    points: sampleData,
  });

  if (!ingestResult.success) {
    console.error('Ingest failed:', ingestResult.error);
    process.exit(1);
  }

  const ingestData = ingestResult.data as { pointsIngested: number; totalPoints: number };
  console.log(`Ingested ${ingestData.pointsIngested} points`);
  console.log(`Duration: ${ingestResult.durationMs}ms`);
  console.log('');

  // Step 2: List available backends
  console.log('========================================');
  console.log('Step 2: Check Available Backends');
  console.log('========================================');

  const backendsResult = await apiCall<{ backends: Array<{ id: string; name: string; available: boolean }> }>(
    '/v1/demo/backends'
  );

  if (backendsResult.success && backendsResult.data) {
    console.log('Available backends:');
    for (const backend of backendsResult.data.backends) {
      console.log(`  - ${backend.id}: ${backend.name} ${backend.available ? '(available)' : '(unavailable)'}`);
    }
  }
  console.log('');

  // Step 3: Run forecast with stub backend
  console.log('========================================');
  console.log('Step 3a: Run Stub Forecast (7 days)');
  console.log('========================================');

  const stubResult = await apiCall('/v1/demo/forecast', 'POST', {
    metricId,
    horizonDays: 7,
    backend: 'stub',
  });

  if (!stubResult.success) {
    console.error('Stub forecast failed:', stubResult.error);
  } else {
    const stubData = stubResult.data as {
      forecastId: string;
      backend: string;
      inputPointsCount: number;
      outputPointsCount: number;
      points: Point[];
      modelInfo?: { name: string };
    };
    console.log(`Forecast ID: ${stubData.forecastId}`);
    console.log(`Backend: ${stubData.backend}`);
    console.log(`Model: ${stubData.modelInfo?.name || 'N/A'}`);
    console.log(`Input points: ${stubData.inputPointsCount}`);
    console.log(`Output points: ${stubData.outputPointsCount}`);
    console.log(`Duration: ${stubResult.durationMs}ms`);
    console.log('');
    console.log('Forecast points:');
    for (const point of stubData.points) {
      console.log(`  ${point.timestamp}: $${point.value.toFixed(2)}`);
    }
  }
  console.log('');

  // Step 4: Run forecast with statistical backend
  console.log('========================================');
  console.log('Step 3b: Run Statistical Forecast (14 days)');
  console.log('========================================');

  const statResult = await apiCall('/v1/demo/forecast', 'POST', {
    metricId,
    horizonDays: 14,
    backend: 'stat',
    statMethod: 'ewma',
  });

  if (!statResult.success) {
    console.error('Statistical forecast failed:', statResult.error);
  } else {
    const statData = statResult.data as {
      forecastId: string;
      backend: string;
      inputPointsCount: number;
      outputPointsCount: number;
      points: Point[];
      modelInfo?: { name: string };
    };
    console.log(`Forecast ID: ${statData.forecastId}`);
    console.log(`Backend: ${statData.backend}`);
    console.log(`Model: ${statData.modelInfo?.name || 'N/A'}`);
    console.log(`Input points: ${statData.inputPointsCount}`);
    console.log(`Output points: ${statData.outputPointsCount}`);
    console.log(`Duration: ${statResult.durationMs}ms`);
    console.log('');
    console.log('Forecast points:');
    for (const point of statData.points) {
      console.log(`  ${point.timestamp}: $${point.value.toFixed(2)}`);
    }
  }
  console.log('');

  // Step 5: Retrieve metric data with latest forecast
  console.log('========================================');
  console.log('Step 4: Retrieve Metric Data');
  console.log('========================================');

  const metricResult = await apiCall<{
    metric: { id: string; name: string; unit: string };
    historicalPoints: Point[];
    latestForecast: {
      id: string;
      backend: string;
      horizonDays: number;
      points: Point[];
    } | null;
  }>(`/v1/demo/metric?metricId=${metricId}&limit=30`);

  if (!metricResult.success) {
    console.error('Get metric failed:', metricResult.error);
  } else {
    const metricData = metricResult.data!;
    console.log(`Metric: ${metricData.metric.name} (${metricData.metric.id})`);
    console.log(`Unit: ${metricData.metric.unit}`);
    console.log(`Historical points: ${metricData.historicalPoints.length}`);
    console.log(`Duration: ${metricResult.durationMs}ms`);

    if (metricData.latestForecast) {
      console.log('');
      console.log('Latest forecast:');
      console.log(`  ID: ${metricData.latestForecast.id}`);
      console.log(`  Backend: ${metricData.latestForecast.backend}`);
      console.log(`  Horizon: ${metricData.latestForecast.horizonDays} days`);
      console.log(`  Points: ${metricData.latestForecast.points.length}`);
    }
  }
  console.log('');

  // Summary
  console.log('========================================');
  console.log('E2E Demo Complete!');
  console.log('========================================');
  console.log('');
  console.log('Steps completed:');
  console.log('  1. Ingested 90 days of sample MRR data');
  console.log('  2. Checked available forecast backends');
  console.log('  3. Ran stub forecast (7 days)');
  console.log('  4. Ran statistical EWMA forecast (14 days)');
  console.log('  5. Retrieved metric data with latest forecast');
  console.log('');
  console.log('To view the demo UI:');
  console.log('  1. cd packages/web && npm run dev');
  console.log('  2. Navigate to http://localhost:5173/demo/forecast');
  console.log('  3. Enter your API key and explore!');
  console.log('');
}

main().catch((error) => {
  console.error('Demo failed:', error);
  process.exit(1);
});
