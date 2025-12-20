#!/usr/bin/env tsx
/**
 * Load Test Harness
 *
 * Phase 20: Load/Resilience Testing and Production Readiness Review
 *
 * Usage:
 *   npx tsx src/scripts/load-test.ts --profile=baseline --target=http://localhost:8080
 *   npx tsx src/scripts/load-test.ts --profile=growth --target=https://staging.intentvision.io
 *   npx tsx src/scripts/load-test.ts --profile=stress --target=http://localhost:8080 --duration=60
 *
 * Options:
 *   --profile=<name>    Load profile: baseline, growth, stress (default: baseline)
 *   --target=<url>      Target API URL (default: http://localhost:8080)
 *   --duration=<sec>    Test duration in seconds (default: 30)
 *   --concurrency=<n>   Concurrent requests (default: 10)
 *   --api-key=<key>     API key for authentication (required for real tests)
 *   --output=<path>     Save JSON results to file
 *   --dry-run           Show configuration without running
 */

import { LOAD_PROFILES, getLoadProfile, calculateRPS, type LoadProfile } from '../config/slos.js';
import {
  type LoadTestResult,
  type LatencyPercentiles,
  type EndpointResult,
  formatReport,
  evaluateSLOs,
  saveReport,
  generateSummaryLine,
  allSLOsPassed,
} from './load-test-report.js';

// =============================================================================
// Types
// =============================================================================

interface LoadTestConfig {
  profile: LoadProfile;
  profileName: string;
  target: string;
  duration: number;
  concurrency: number;
  apiKey?: string;
  outputPath?: string;
  dryRun: boolean;
}

interface RequestResult {
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseArgs(): LoadTestConfig {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      parsed[key] = value ?? 'true';
    }
  }

  // Get profile
  const profileName = parsed['profile'] || 'baseline';
  const profile = getLoadProfile(profileName);
  if (!profile) {
    console.error(`Unknown profile: ${profileName}`);
    console.error(`Available profiles: ${Object.keys(LOAD_PROFILES).join(', ')}`);
    process.exit(1);
  }

  return {
    profile,
    profileName,
    target: parsed['target'] || 'http://localhost:8080',
    duration: parseInt(parsed['duration'] || '30', 10),
    concurrency: parseInt(parsed['concurrency'] || '10', 10),
    apiKey: parsed['api-key'] || process.env.INTENTVISION_API_KEY,
    outputPath: parsed['output'],
    dryRun: parsed['dry-run'] === 'true',
  };
}

// =============================================================================
// HTTP Request Utilities
// =============================================================================

async function makeRequest(
  target: string,
  method: string,
  path: string,
  body?: unknown,
  apiKey?: string
): Promise<RequestResult> {
  const url = `${target}${path}`;
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const durationMs = Date.now() - startTime;

    return {
      endpoint: path,
      method,
      statusCode: response.status,
      durationMs,
      success: response.status >= 200 && response.status < 400,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    return {
      endpoint: path,
      method,
      statusCode: 0,
      durationMs,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Test Data Generators
// =============================================================================

function generateTimeSeriesData(metricName: string, pointCount: number): unknown {
  const now = Date.now();
  const points = [];

  for (let i = 0; i < pointCount; i++) {
    points.push({
      timestamp: new Date(now - (pointCount - i) * 60000).toISOString(),
      value: Math.random() * 100 + 50 + Math.sin(i / 10) * 20,
    });
  }

  return {
    metric: metricName,
    dataPoints: points,
  };
}

function generateForecastRequest(metricName: string): unknown {
  return {
    metric: metricName,
    horizon: 24,
    backend: 'statistical',
  };
}

// =============================================================================
// Load Test Runner
// =============================================================================

async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  const results: RequestResult[] = [];
  const errors: string[] = [];
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  console.log('Starting load test...');
  console.log(`Profile: ${config.profileName}`);
  console.log(`Target: ${config.target}`);
  console.log(`Duration: ${config.duration}s`);
  console.log(`Concurrency: ${config.concurrency}`);
  console.log('');

  // Calculate expected RPS from profile
  const rps = calculateRPS(config.profile);
  console.log(`Expected load: ${rps.totalRPS} req/s (ingestion: ${rps.ingestionRPS}, forecast: ${rps.forecastRPS})`);
  console.log('');

  // Test endpoints
  const testEndpoints = [
    { method: 'GET', path: '/health', weight: 2 },
    { method: 'GET', path: '/health/ready', weight: 1 },
    { method: 'GET', path: '/health/detailed', weight: 1 },
    { method: 'POST', path: '/v1/ingest/timeseries', weight: 5, needsAuth: true, needsBody: true },
    { method: 'POST', path: '/v1/forecast/run', weight: 3, needsAuth: true, needsBody: true },
    { method: 'GET', path: '/v1/forecast', weight: 2, needsAuth: true },
  ];

  // Create weighted endpoint list
  const weightedEndpoints: typeof testEndpoints = [];
  for (const ep of testEndpoints) {
    for (let i = 0; i < ep.weight; i++) {
      weightedEndpoints.push(ep);
    }
  }

  // Run concurrent requests for the specified duration
  const endTime = startTime + config.duration * 1000;
  let requestCount = 0;

  const runBatch = async (): Promise<void> => {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < config.concurrency; i++) {
      const endpoint = weightedEndpoints[Math.floor(Math.random() * weightedEndpoints.length)];

      // Skip auth-required endpoints if no API key
      if (endpoint.needsAuth && !config.apiKey) {
        continue;
      }

      let body: unknown;
      if (endpoint.needsBody) {
        if (endpoint.path.includes('ingest')) {
          body = generateTimeSeriesData(`load_test_metric_${requestCount}`, 50);
        } else if (endpoint.path.includes('forecast')) {
          body = generateForecastRequest(`load_test_metric_${requestCount}`);
        }
      }

      const promise = makeRequest(
        config.target,
        endpoint.method,
        endpoint.path,
        body,
        endpoint.needsAuth ? config.apiKey : undefined
      ).then((result) => {
        results.push(result);
        if (result.error) {
          errors.push(`${result.method} ${result.endpoint}: ${result.error}`);
        }
        requestCount++;
      });

      promises.push(promise);
    }

    await Promise.all(promises);
  };

  // Progress reporting
  let lastProgressTime = startTime;
  const progressInterval = 5000; // 5 seconds

  while (Date.now() < endTime) {
    await runBatch();

    // Report progress every 5 seconds
    if (Date.now() - lastProgressTime >= progressInterval) {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentRPS = results.length / elapsed;
      console.log(`Progress: ${results.length} requests, ${currentRPS.toFixed(1)} req/s`);
      lastProgressTime = Date.now();
    }

    // Small delay to prevent overwhelming
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  const completedAt = new Date().toISOString();
  const duration = (Date.now() - startTime) / 1000;

  console.log('');
  console.log('Test completed. Analyzing results...');

  // Analyze results
  const successfulRequests = results.filter((r) => r.success).length;
  const failedRequests = results.filter((r) => !r.success).length;
  const latencies = results.map((r) => r.durationMs).sort((a, b) => a - b);

  const latency: LatencyPercentiles = {
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies[latencies.length - 1] || 0,
  };

  // Build endpoint breakdown
  const endpointMap = new Map<string, RequestResult[]>();
  for (const result of results) {
    const key = `${result.method} ${result.endpoint}`;
    if (!endpointMap.has(key)) {
      endpointMap.set(key, []);
    }
    endpointMap.get(key)!.push(result);
  }

  const endpoints: EndpointResult[] = [];
  for (const [key, epResults] of endpointMap) {
    const [method, endpoint] = key.split(' ');
    const epLatencies = epResults.map((r) => r.durationMs).sort((a, b) => a - b);
    const epSuccess = epResults.filter((r) => r.success).length;

    endpoints.push({
      endpoint,
      method,
      totalRequests: epResults.length,
      successfulRequests: epSuccess,
      failedRequests: epResults.length - epSuccess,
      latency: {
        p50: percentile(epLatencies, 50),
        p95: percentile(epLatencies, 95),
        p99: percentile(epLatencies, 99),
        max: epLatencies[epLatencies.length - 1] || 0,
      },
      successRate: (epSuccess / epResults.length) * 100,
    });
  }

  // Build result
  const loadTestResult: LoadTestResult = {
    profile: config.profileName,
    target: config.target,
    startedAt,
    completedAt,
    duration,
    totalRequests: results.length,
    successfulRequests,
    failedRequests,
    latency,
    throughput: results.length / duration,
    sloResults: [],
    endpoints,
    errors: errors.length > 0 ? errors.slice(0, 100) : undefined,
  };

  // Evaluate SLOs
  loadTestResult.sloResults = evaluateSLOs({
    latency,
    successfulRequests,
    totalRequests: results.length,
    failedRequests,
  });

  return loadTestResult;
}

// =============================================================================
// Utility Functions
// =============================================================================

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('='.repeat(70));
  console.log('IntentVision Load Test Harness');
  console.log('Phase 20: Load/Resilience Testing');
  console.log('='.repeat(70));
  console.log('');

  const config = parseArgs();

  if (config.dryRun) {
    console.log('DRY RUN - Configuration:');
    console.log('');
    console.log(`Profile: ${config.profileName}`);
    console.log(`  - Organizations: ${config.profile.orgsCount}`);
    console.log(`  - Metrics/Org: ${config.profile.metricsPerOrg}`);
    console.log(`  - Forecasts/Day/Org: ${config.profile.forecastsPerDayPerOrg}`);
    console.log(`  - Alerts/Org: ${config.profile.alertsPerOrg}`);
    console.log(`  - Data Points/Day: ${config.profile.dataPointsPerDay}`);
    console.log('');
    console.log(`Target: ${config.target}`);
    console.log(`Duration: ${config.duration}s`);
    console.log(`Concurrency: ${config.concurrency}`);
    console.log(`API Key: ${config.apiKey ? '[CONFIGURED]' : '[NOT SET]'}`);
    console.log('');

    const rps = calculateRPS(config.profile);
    console.log('Expected Load:');
    console.log(`  - Ingestion RPS: ${rps.ingestionRPS}`);
    console.log(`  - Forecast RPS: ${rps.forecastRPS}`);
    console.log(`  - Total RPS: ${rps.totalRPS}`);
    console.log('');
    return;
  }

  // Verify target is reachable
  console.log(`Checking target connectivity: ${config.target}`);
  try {
    const healthCheck = await makeRequest(config.target, 'GET', '/health');
    if (!healthCheck.success) {
      console.error(`Target health check failed: ${healthCheck.statusCode}`);
      process.exit(1);
    }
    console.log(`Target is healthy (${healthCheck.durationMs}ms)`);
  } catch (error) {
    console.error(`Cannot reach target: ${error}`);
    process.exit(1);
  }
  console.log('');

  // Run the load test
  const result = await runLoadTest(config);

  // Output report
  console.log(formatReport(result));

  // Summary line for CI
  console.log(generateSummaryLine(result));
  console.log('');

  // Save report if output path specified
  if (config.outputPath) {
    saveReport(result, config.outputPath);
  }

  // Exit with appropriate code
  if (!allSLOsPassed(result)) {
    console.log('WARNING: Some SLOs did not pass');
    process.exit(1);
  }

  console.log('All SLOs passed!');
}

// Run if executed directly
main().catch((error) => {
  console.error('Load test failed:', error);
  process.exit(1);
});
