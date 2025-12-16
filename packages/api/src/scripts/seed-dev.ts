/**
 * Development Seed Script
 *
 * Phase 1: Firestore-backed MVP Core
 * Phase 4: Production SaaS Control Plane
 * Beads Tasks: intentvision-002, intentvision-p88
 *
 * Creates sample data for local development:
 * - One organization with SaaS plan
 * - One API key with Phase 4 scopes
 * - Sample time series points
 */

import { initFirestore, getDb, generateId } from '../firestore/client.js';
import { COLLECTIONS, type Organization, type Metric, type TimeSeriesDocument } from '../firestore/schema.js';
import { createApiKey } from '../auth/api-key.js';

async function seed(): Promise<void> {
  console.log('========================================');
  console.log('IntentVision Development Seed');
  console.log('========================================');

  // Initialize Firestore
  initFirestore();
  const db = getDb();

  // Create organization
  const orgId = 'org-dev-001';
  console.log(`\nCreating organization: ${orgId}`);

  const org: Organization = {
    id: orgId,
    name: 'Development Organization',
    slug: 'dev-org',
    plan: 'beta',
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
    settings: {
      defaultForecastHorizon: 7,
      defaultBackend: 'statistical',
    },
    contactEmail: 'dev@example.com',
  };

  await db.collection(COLLECTIONS.organizations).doc(orgId).set(org);
  console.log('  Organization created');

  // Create API key with Phase 4 scopes
  console.log('\nCreating API key...');
  const { rawKey } = await createApiKey(orgId, 'Development Key', ['ingest:write', 'metrics:read', 'alerts:read', 'alerts:write', 'admin']);
  console.log('  API key created');
  console.log('========================================');
  console.log('SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN:');
  console.log(`  ${rawKey}`);
  console.log('========================================');

  // Create sample metric
  const metricName = 'mrr';
  const metricId = generateId('metric');
  console.log(`\nCreating sample metric: ${metricName}`);

  const metric: Metric = {
    id: metricId,
    orgId,
    name: metricName,
    description: 'Monthly Recurring Revenue',
    unit: 'USD',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection(COLLECTIONS.metrics(orgId)).doc(metricId).set(metric);
  console.log('  Metric created');

  // Create sample time series data
  console.log('\nCreating sample time series data...');

  const now = new Date();
  const points = [];

  // Generate 30 days of data
  for (let i = 30; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const baseValue = 10000 + i * 100; // Trending up
    const noise = (Math.random() - 0.5) * 500;
    const value = baseValue + noise;

    points.push({
      timestamp,
      value: Math.round(value * 100) / 100,
    });
  }

  const tsDoc: TimeSeriesDocument = {
    id: generateId('ts'),
    orgId,
    metricId,
    metricName,
    startTime: points[0].timestamp,
    endTime: points[points.length - 1].timestamp,
    points,
    pointCount: points.length,
    createdAt: new Date(),
  };

  await db.collection(COLLECTIONS.timeseries(orgId)).doc(tsDoc.id).set(tsDoc);
  console.log(`  Created ${points.length} data points`);

  // Update metric stats
  await db.collection(COLLECTIONS.metrics(orgId)).doc(metricId).update({
    lastDataPoint: points[points.length - 1].timestamp,
    dataPointCount: points.length,
  });

  console.log('\n========================================');
  console.log('Seed complete!');
  console.log('========================================');
  console.log('\nTest the API with:');
  console.log(`\ncurl -X POST http://localhost:8080/v1/forecast/run \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${rawKey}" \\
  -d '{"metricName": "mrr", "horizonDays": 7}'`);
  console.log('\nOr fetch forecasts:');
  console.log(`\ncurl "http://localhost:8080/v1/forecast?metricName=mrr" \\
  -H "X-API-Key: ${rawKey}"`);

  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
