#!/usr/bin/env npx tsx
/**
 * Cloud Staging Smoke Test Script
 *
 * Phase 9: Staging Cloud Run + Firestore + Cloud Smoke Tests
 * Beads Task: intentvision-ltq
 *
 * Runs smoke tests against a deployed IntentVision API instance.
 * Validates:
 * - API reachability
 * - Firestore write/read/verify cycle
 * - Environment detection
 *
 * Usage:
 *   npm run smoke:staging                          # Use default staging URL
 *   npm run smoke:staging -- --url https://...     # Custom URL
 *   npm run smoke:staging -- --verbose             # Verbose output
 *   npm run smoke:staging -- --timeout 30000       # Custom timeout
 *
 * Environment Variables:
 *   INTENTVISION_STAGING_URL  - Staging API base URL
 *   INTENTVISION_SMOKE_TIMEOUT - Request timeout in ms (default: 15000)
 *
 * Exit Codes:
 *   0 - All tests passed
 *   1 - Tests failed or error occurred
 */

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_STAGING_URL = process.env.INTENTVISION_STAGING_URL || 'https://intentvision-api-staging.run.app';
const DEFAULT_TIMEOUT = parseInt(process.env.INTENTVISION_SMOKE_TIMEOUT || '15000', 10);

// =============================================================================
// Types
// =============================================================================

interface SmokeTestResult {
  ok: boolean;
  env: string;
  runId: string;
  projectId?: string;
  firestoreWrite?: boolean;
  firestoreRead?: boolean;
  firestoreVerify?: boolean;
  durationMs: number;
  error?: string;
  timestamp: string;
}

interface ApiResponse {
  success: boolean;
  requestId: string;
  timestamp: string;
  data?: SmokeTestResult;
  error?: string;
}

interface CliArgs {
  url: string;
  verbose: boolean;
  timeout: number;
  help: boolean;
}

// =============================================================================
// Argument Parsing
// =============================================================================

function parseArgs(): CliArgs {
  const args: CliArgs = {
    url: DEFAULT_STAGING_URL,
    verbose: false,
    timeout: DEFAULT_TIMEOUT,
    help: false,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    } else if (arg === '--url' && argv[i + 1]) {
      args.url = argv[++i];
    } else if (arg === '--timeout' && argv[i + 1]) {
      args.timeout = parseInt(argv[++i], 10);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
IntentVision Cloud Staging Smoke Test

Usage:
  npm run smoke:staging [options]
  npx tsx src/scripts/smoke-cloud-staging.ts [options]

Options:
  --url <url>       Target API URL (default: ${DEFAULT_STAGING_URL})
  --timeout <ms>    Request timeout in milliseconds (default: ${DEFAULT_TIMEOUT})
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Environment Variables:
  INTENTVISION_STAGING_URL     Staging API base URL
  INTENTVISION_SMOKE_TIMEOUT   Request timeout in ms

Examples:
  npm run smoke:staging
  npm run smoke:staging -- --url https://my-staging.run.app
  npm run smoke:staging -- --verbose --timeout 30000
`);
}

// =============================================================================
// Smoke Test Runner
// =============================================================================

async function runSmokeTest(url: string, timeout: number, verbose: boolean): Promise<boolean> {
  const startTime = Date.now();
  const smokeUrl = `${url.replace(/\/$/, '')}/v1/internal/smoke`;

  console.log('========================================');
  console.log('IntentVision Cloud Smoke Test');
  console.log('Phase 9: Staging Cloud Run + Firestore');
  console.log('========================================');
  console.log(`Target URL: ${smokeUrl}`);
  console.log(`Timeout: ${timeout}ms`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('========================================\n');

  try {
    // Run smoke test
    console.log('[1/3] Sending smoke test request...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(smokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    console.log(`[2/3] Response received in ${responseTime}ms (HTTP ${response.status})`);

    // Parse response
    const result = (await response.json()) as ApiResponse;

    if (verbose) {
      console.log('\nResponse body:');
      console.log(JSON.stringify(result, null, 2));
      console.log('');
    }

    // Validate result
    console.log('[3/3] Validating result...\n');

    const data = result.data;

    if (!data) {
      console.error('ERROR: No data in response');
      return false;
    }

    // Print results table
    console.log('Test Results:');
    console.log('┌────────────────────────┬──────────┐');
    console.log(`│ Environment            │ ${(data.env || 'unknown').padEnd(8)} │`);
    console.log(`│ Run ID                 │ ${(data.runId || 'unknown').slice(0, 8).padEnd(8)} │`);
    console.log(`│ Project ID             │ ${(data.projectId || 'unknown').slice(0, 8).padEnd(8)} │`);
    console.log('├────────────────────────┼──────────┤');
    console.log(`│ Firestore Write        │ ${data.firestoreWrite ? '✓ PASS  ' : '✗ FAIL  '} │`);
    console.log(`│ Firestore Read         │ ${data.firestoreRead ? '✓ PASS  ' : '✗ FAIL  '} │`);
    console.log(`│ Firestore Verify       │ ${data.firestoreVerify ? '✓ PASS  ' : '✗ FAIL  '} │`);
    console.log('├────────────────────────┼──────────┤');
    console.log(`│ Overall                │ ${data.ok ? '✓ PASS  ' : '✗ FAIL  '} │`);
    console.log(`│ Duration               │ ${String(data.durationMs || 0).padStart(5)}ms  │`);
    console.log('└────────────────────────┴──────────┘');

    if (data.error) {
      console.log(`\nError: ${data.error}`);
    }

    console.log('\n========================================');

    if (data.ok) {
      console.log('SMOKE TEST PASSED');
      console.log(`Total time: ${Date.now() - startTime}ms`);
      console.log('========================================');
      return true;
    } else {
      console.log('SMOKE TEST FAILED');
      console.log(`Total time: ${Date.now() - startTime}ms`);
      console.log('========================================');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('\n========================================');
    console.error('SMOKE TEST ERROR');
    console.error('========================================');

    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      console.error(`Request timed out after ${timeout}ms`);
      console.error('The API may be unavailable or responding slowly.');
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      console.error('Could not connect to the API.');
      console.error('Check that the URL is correct and the service is running.');
    } else {
      console.error(`Error: ${errorMessage}`);
    }

    console.error(`URL: ${smokeUrl}`);
    console.error('========================================');

    return false;
  }
}

// =============================================================================
// Health Check (Quick Pre-flight)
// =============================================================================

async function checkHealth(url: string, timeout: number): Promise<boolean> {
  const healthUrl = `${url.replace(/\/$/, '')}/health`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return response.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Quick health check first
  console.log('Pre-flight: Checking API health...');
  const healthy = await checkHealth(args.url, 5000);

  if (!healthy) {
    console.warn('Warning: Health check failed. Proceeding with smoke test anyway...\n');
  } else {
    console.log('Pre-flight: API is responsive.\n');
  }

  // Run smoke test
  const success = await runSmokeTest(args.url, args.timeout, args.verbose);

  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
