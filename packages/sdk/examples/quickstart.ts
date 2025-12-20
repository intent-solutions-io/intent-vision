/**
 * IntentVision SDK Quickstart Example
 *
 * Phase 19: Developer Experience - OpenAPI, SDK, and Sandbox Keys
 *
 * This example demonstrates basic usage of the IntentVision SDK.
 */

import { IntentVisionClient } from '../src/index.js';

async function main() {
  // Initialize the client
  const client = new IntentVisionClient({
    apiKey: process.env.INTENTVISION_API_KEY!,
    // baseUrl: 'http://localhost:3000', // Optional: for local development
  });

  console.log('IntentVision SDK Quickstart\n');

  // ==========================================================================
  // 1. Ingest Data
  // ==========================================================================
  console.log('1. Ingesting event data...');

  try {
    const ingestResult = await client.ingestEvent({
      source: 'quickstart',
      metric: 'revenue',
      value: 10000,
      timestamp: new Date().toISOString(),
      dimensions: {
        region: 'us-west',
        product: 'pro',
      },
    });

    console.log('   Event ingested:', ingestResult);
  } catch (error) {
    console.error('   Error ingesting event:', error);
  }

  // ==========================================================================
  // 2. Run Forecast
  // ==========================================================================
  console.log('\n2. Running forecast...');

  try {
    const forecastResult = await client.runForecast({
      metricName: 'revenue',
      horizonDays: 30,
      backend: 'statistical',
    });

    console.log('   Forecast created:', forecastResult);
    console.log(`   - Forecast ID: ${forecastResult.forecastId}`);
    console.log(`   - Points generated: ${forecastResult.pointsGenerated}`);
    console.log(`   - Status: ${forecastResult.status}`);
    if (forecastResult.sandbox) {
      console.log('   - Mode: SANDBOX (limited functionality)');
    }
  } catch (error) {
    console.error('   Error running forecast:', error);
  }

  // ==========================================================================
  // 3. Get Forecast Data
  // ==========================================================================
  console.log('\n3. Retrieving forecast data...');

  try {
    const forecast = await client.getForecast('revenue', { horizonDays: 30 });

    console.log(`   Retrieved forecast for: ${forecast.metric}`);
    console.log(`   Horizon: ${forecast.horizonDays} days`);
    console.log(`   Data points: ${forecast.points.length}`);

    if (forecast.points.length > 0) {
      const firstPoint = forecast.points[0];
      console.log('\n   First prediction:');
      console.log(`   - Timestamp: ${firstPoint.timestamp}`);
      console.log(`   - Predicted: ${firstPoint.predicted}`);
      console.log(
        `   - Confidence: [${firstPoint.confidenceLower}, ${firstPoint.confidenceUpper}]`
      );
    }
  } catch (error) {
    console.error('   Error getting forecast:', error);
  }

  // ==========================================================================
  // 4. Create Alert
  // ==========================================================================
  console.log('\n4. Creating alert rule...');

  try {
    const alert = await client.createAlert({
      name: 'Revenue Alert',
      description: 'Alert when revenue forecast drops below threshold',
      type: 'threshold',
      metricName: 'revenue',
      condition: {
        operator: 'lt',
        value: 8000,
      },
      horizonDays: 7,
      channels: [
        {
          type: 'email',
          to: ['team@example.com'],
          enabled: true,
        },
      ],
      enabled: true,
    });

    console.log('   Alert created:', alert.name);
    console.log(`   - ID: ${alert.id}`);
    console.log(`   - Metric: ${alert.metricName}`);
    console.log(`   - Threshold: ${alert.condition?.value}`);
  } catch (error) {
    console.error('   Error creating alert:', error);
  }

  // ==========================================================================
  // 5. List Metrics
  // ==========================================================================
  console.log('\n5. Listing metrics...');

  try {
    const metrics = await client.listMetrics();

    console.log(`   Found ${metrics.length} metrics:`);
    metrics.forEach((metric) => {
      console.log(`   - ${metric.name} (${metric.dataPointCount || 0} points)`);
    });
  } catch (error) {
    console.error('   Error listing metrics:', error);
  }

  // ==========================================================================
  // 6. Get Organization Info
  // ==========================================================================
  console.log('\n6. Getting organization info...');

  try {
    const org = await client.getOrganization();

    console.log(`   Organization: ${org.name}`);
    console.log(`   - Slug: ${org.slug}`);
    console.log(`   - Plan: ${org.plan}`);
    console.log(`   - Status: ${org.status}`);
  } catch (error) {
    console.error('   Error getting organization:', error);
  }

  console.log('\nQuickstart complete!');
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
