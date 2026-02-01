/**
 * Demo Tenant Seed Script
 *
 * Phase 10: Sellable Alpha Shell
 * Beads Task: intentvision-yzd
 *
 * Creates a demo tenant using the self-service onboarding flow:
 * - POST /v1/tenants endpoint (simulated directly)
 * - Creates organization, owner user, and API key
 * - Seeds sample metrics and time series data
 * - Sets up notification preferences
 */

import { initFirestore, getDb, generateId } from '../firestore/client.js';
import {
  COLLECTIONS,
  type Metric,
  type TimeSeriesDocument,
} from '../firestore/schema.js';
import {
  createOrganization,
  createUser,
  getOrganizationBySlug,
} from '../services/org-service.js';
import { createApiKey } from '../auth/api-key.js';
import { upsertUserNotificationPreferences } from '../services/user-preferences-service.js';
import { PLANS } from '../models/plan.js';

async function seedDemoTenant(): Promise<void> {
  console.log('========================================');
  console.log('IntentVision Demo Tenant Seed');
  console.log('Phase 10: Sellable Alpha Shell');
  console.log('========================================');

  // Initialize Firestore
  initFirestore();
  const db = getDb();

  // Demo tenant configuration
  const demoSlug = 'demo-alpha';
  const demoEmail = 'demo@intentvision.io';
  const demoName = 'IntentVision Demo';

  // Check if demo tenant already exists
  console.log(`\nChecking for existing demo tenant: ${demoSlug}...`);
  const existingOrg = await getOrganizationBySlug(demoSlug);

  if (existingOrg) {
    console.log('  Demo tenant already exists. Skipping creation.');
    console.log(`  Organization ID: ${existingOrg.id}`);
    process.exit(0);
  }

  // Create organization with free plan
  console.log(`\nCreating demo organization: ${demoName}`);
  const freePlan = PLANS.free;

  const organization = await createOrganization({
    name: demoName,
    slug: demoSlug,
    plan: 'beta', // Maps to 'free' plan
    contactEmail: demoEmail,
  });

  console.log(`  Organization created: ${organization.id}`);
  console.log(`  Plan: ${freePlan.name}`);
  console.log(`  Limits: ${freePlan.limits.maxMetrics} metrics, ${freePlan.limits.maxAlerts} alerts, ${freePlan.limits.maxForecastsPerDay} forecasts/day`);

  // Create owner user
  console.log('\nCreating demo owner user...');
  const tempAuthUid = `firebase_demo_${Date.now()}`;

  const user = await createUser({
    authUid: tempAuthUid,
    email: demoEmail,
    displayName: 'Demo User',
    organizationId: organization.id,
    role: 'owner',
  });

  console.log(`  User created: ${user.id}`);

  // Set up notification preferences (email enabled by default)
  console.log('\nSetting up notification preferences...');
  await upsertUserNotificationPreferences(user.id, {
    email: {
      enabled: true,
      address: demoEmail,
    },
    slack: {
      enabled: false,
    },
    webhook: {
      enabled: false,
    },
  });
  console.log('  Notification preferences configured');

  // Create API key with full scopes
  console.log('\nCreating demo API key...');
  const { rawKey } = await createApiKey(organization.id, 'Demo API Key', [
    'ingest:write',
    'metrics:read',
    'alerts:read',
    'alerts:write',
  ]);

  console.log('========================================');
  console.log('DEMO API KEY - SAVE THIS:');
  console.log(`  ${rawKey}`);
  console.log('========================================');

  // Create sample metrics (up to plan limit)
  console.log('\nCreating sample metrics...');
  const sampleMetrics = [
    { name: 'mrr', description: 'Monthly Recurring Revenue', unit: 'USD' },
    { name: 'active_users', description: 'Daily Active Users', unit: 'users' },
    { name: 'churn_rate', description: 'Monthly Churn Rate', unit: '%' },
  ];

  for (const metricDef of sampleMetrics) {
    const metricId = generateId('metric');
    const metric: Metric = {
      id: metricId,
      orgId: organization.id,
      name: metricDef.name,
      description: metricDef.description,
      unit: metricDef.unit,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection(COLLECTIONS.metrics(organization.id)).doc(metricId).set(metric);
    console.log(`  Created metric: ${metricDef.name}`);

    // Generate sample time series data
    const points = generateSampleData(metricDef.name);
    const tsDoc: TimeSeriesDocument = {
      id: generateId('ts'),
      orgId: organization.id,
      metricId,
      metricName: metricDef.name,
      startTime: points[0].timestamp,
      endTime: points[points.length - 1].timestamp,
      points,
      pointCount: points.length,
      createdAt: new Date(),
    };

    await db.collection(COLLECTIONS.timeseries(organization.id)).doc(tsDoc.id).set(tsDoc);

    // Update metric stats
    await db.collection(COLLECTIONS.metrics(organization.id)).doc(metricId).update({
      lastDataPoint: points[points.length - 1].timestamp,
      dataPointCount: points.length,
    });
  }

  // Create sample alert rule
  console.log('\nCreating sample alert rule...');
  const alertRuleId = generateId('alert');
  const alertRule = {
    id: alertRuleId,
    orgId: organization.id,
    name: 'MRR Growth Alert',
    metricName: 'mrr',
    condition: 'above',
    threshold: 15000,
    enabled: true,
    channels: ['email'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection(COLLECTIONS.alertRules(organization.id)).doc(alertRuleId).set(alertRule);
  console.log(`  Created alert rule: ${alertRule.name}`);

  // Print summary
  console.log('\n========================================');
  console.log('Demo Tenant Setup Complete!');
  console.log('========================================');
  console.log(`\nOrganization: ${organization.name} (${organization.slug})`);
  console.log(`User: ${user.email} (${user.role})`);
  console.log(`Plan: Free (${freePlan.limits.maxMetrics} metrics, ${freePlan.limits.maxAlerts} alerts)`);
  console.log(`Metrics: ${sampleMetrics.map((m) => m.name).join(', ')}`);

  console.log('\n--- Test Commands ---');
  console.log('\n1. Get dashboard overview:');
  console.log(`curl http://localhost:8080/v1/dashboard \\
  -H "Authorization: Bearer <firebase-token>"`);

  console.log('\n2. Run a forecast:');
  console.log(`curl -X POST http://localhost:8080/v1/forecast/run \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${rawKey}" \\
  -d '{"metricName": "mrr", "horizonDays": 7}'`);

  console.log('\n3. Get forecasts:');
  console.log(`curl "http://localhost:8080/v1/forecast?metricName=mrr" \\
  -H "X-API-Key: ${rawKey}"`);

  console.log('\n4. List alert rules:');
  console.log(`curl "http://localhost:8080/v1/alerts/rules" \\
  -H "X-API-Key: ${rawKey}"`);

  console.log('\n========================================');
  console.log('Dashboard URLs:');
  console.log('  http://localhost:5173/dashboard');
  console.log('  http://localhost:5173/alerts');
  console.log('  http://localhost:5173/settings/notifications');
  console.log('========================================');

  process.exit(0);
}

/**
 * Generate sample time series data based on metric type
 */
function generateSampleData(metricName: string): Array<{ timestamp: Date; value: number }> {
  const now = new Date();
  const points: Array<{ timestamp: Date; value: number }> = [];

  // Generate 30 days of data
  for (let i = 30; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    let value: number;

    switch (metricName) {
      case 'mrr':
        // MRR: Trending up from 10k to 15k with some noise
        value = 10000 + (30 - i) * 150 + (Math.random() - 0.5) * 500;
        break;
      case 'active_users':
        // Active users: Fluctuating around 500 with weekly pattern
        const dayOfWeek = timestamp.getDay();
        const weekendDip = dayOfWeek === 0 || dayOfWeek === 6 ? -100 : 0;
        value = 500 + weekendDip + (Math.random() - 0.5) * 100;
        break;
      case 'churn_rate':
        // Churn rate: Slowly decreasing from 5% to 3%
        value = 5 - (30 - i) * 0.066 + (Math.random() - 0.5) * 0.5;
        break;
      default:
        value = 100 + (Math.random() - 0.5) * 20;
    }

    points.push({
      timestamp,
      value: Math.round(value * 100) / 100,
    });
  }

  return points;
}

seedDemoTenant().catch((error) => {
  console.error('Demo tenant seed failed:', error);
  process.exit(1);
});
