/**
 * Billing Snapshot Script
 *
 * Phase 12: Billing Backend
 * Beads Task: intentvision-[phase12]
 *
 * Generates billing snapshots for organizations.
 * Accepts --org-id and --period flags to specify target.
 *
 * Usage:
 *   npm run billing:snapshot -- --org-id=org-123 --period=2024-01
 *   npm run billing:snapshot -- --org-id=org-123 --period=current
 */

import { initFirestore } from '../firestore/client.js';
import {
  generateBillingSnapshot,
  getBillingPeriod,
  getCurrentBillingPeriod,
} from '../services/billing-service.js';

// =============================================================================
// CLI Argument Parsing
// =============================================================================

interface ScriptArgs {
  orgId?: string;
  period?: string;
  help?: boolean;
}

function parseArgs(): ScriptArgs {
  const args: ScriptArgs = {};

  for (const arg of process.argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg.startsWith('--org-id=')) {
      args.orgId = arg.slice('--org-id='.length);
    } else if (arg.startsWith('--period=')) {
      args.period = arg.slice('--period='.length);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
Billing Snapshot Generator

Generates billing snapshots for organizations by aggregating usage events.

Usage:
  npm run billing:snapshot -- --org-id=<orgId> --period=<period>

Arguments:
  --org-id=<orgId>     Organization ID (required)
  --period=<period>    Billing period (required)
                       Format: YYYY-MM (e.g., 2024-01) or "current"
  --help, -h           Show this help message

Examples:
  # Generate snapshot for January 2024
  npm run billing:snapshot -- --org-id=org-123 --period=2024-01

  # Generate snapshot for current month
  npm run billing:snapshot -- --org-id=org-123 --period=current

  # Generate snapshot for previous month
  npm run billing:snapshot -- --org-id=org-dev-001 --period=2025-11
`);
}

// =============================================================================
// Period Parsing
// =============================================================================

interface BillingPeriodSpec {
  start: Date;
  end: Date;
}

function parsePeriod(period: string): BillingPeriodSpec {
  if (period === 'current') {
    const { start, end } = getCurrentBillingPeriod();
    return { start, end };
  }

  // Parse YYYY-MM format
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new Error(
      `Invalid period format: ${period}. Expected YYYY-MM (e.g., 2024-01) or "current"`
    );
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be between 1 and 12`);
  }

  const { start, end } = getBillingPeriod(year, month);
  return { start, end };
}

// =============================================================================
// Main Script
// =============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('Billing Snapshot Generator');
  console.log('Phase 12: Billing Backend');
  console.log('========================================\n');

  // Parse CLI arguments
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Validate arguments
  if (!args.orgId) {
    console.error('Error: --org-id is required\n');
    printHelp();
    process.exit(1);
  }

  if (!args.period) {
    console.error('Error: --period is required\n');
    printHelp();
    process.exit(1);
  }

  // Initialize Firestore
  console.log('Initializing Firestore...');
  initFirestore();
  console.log('Firestore initialized\n');

  // Parse period
  console.log(`Parsing period: ${args.period}`);
  const { start, end } = parsePeriod(args.period);
  console.log(`  Period start: ${start.toISOString()}`);
  console.log(`  Period end:   ${end.toISOString()}\n`);

  // Generate billing snapshot
  console.log(`Generating billing snapshot for org: ${args.orgId}...`);
  const snapshot = await generateBillingSnapshot(args.orgId, start, end);

  console.log('\n========================================');
  console.log('Billing Snapshot Generated');
  console.log('========================================');
  console.log(`Snapshot ID:      ${snapshot.id}`);
  console.log(`Organization:     ${snapshot.orgId}`);
  console.log(`Plan:             ${snapshot.planId}`);
  console.log(`Period:           ${snapshot.periodStart.toISOString().split('T')[0]} to ${snapshot.periodEnd.toISOString().split('T')[0]}`);
  console.log('\nUsage Totals:');
  console.log(`  Forecast Calls:      ${snapshot.totals.forecast_calls}`);
  console.log(`  Alerts Fired:        ${snapshot.totals.alerts_fired}`);
  console.log(`  Metrics Ingested:    ${snapshot.totals.metrics_ingested}`);
  console.log(`\nCreated At:       ${snapshot.createdAt.toISOString()}`);
  console.log('========================================\n');
}

// Run script
main().catch((error) => {
  console.error('\nError:', (error as Error).message);
  console.error('\nStack trace:', (error as Error).stack);
  process.exit(1);
});
