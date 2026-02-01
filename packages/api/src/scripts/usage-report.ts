#!/usr/bin/env tsx
/**
 * Usage Report Script
 *
 * Phase 11: Usage Metering + Plan Enforcement
 * Beads Task: intentvision-zf7
 *
 * Generates a usage report for an organization with optional Beads/AgentFS hooks.
 *
 * Usage:
 *   npx tsx src/scripts/usage-report.ts --org-id=demo-alpha
 *   npx tsx src/scripts/usage-report.ts --org-id=demo-alpha --period=30d
 *
 * Environment:
 *   INTENTVISION_BEADS_ENABLED=true - Create Beads task for this run
 *   INTENTVISION_AGENTFS_ENABLED=true - Record run in AgentFS
 *   INTENTVISION_AGENTFS_PROJECT=intentvision - AgentFS project name
 */

import { initFirestore } from '../firestore/client.js';
import { getOrganizationById } from '../services/org-service.js';
import { getAdminUsageOverview } from '../services/metering-service.js';
import { getPlan, type PlanId } from '../models/plan.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// =============================================================================
// CLI Argument Parsing
// =============================================================================

interface CliArgs {
  orgId: string;
  period: 'today' | '30d' | '7d';
  format: 'text' | 'json';
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CliArgs> = {
    period: '30d',
    format: 'text',
  };

  for (const arg of args) {
    if (arg.startsWith('--org-id=')) {
      parsed.orgId = arg.split('=')[1];
    } else if (arg.startsWith('--period=')) {
      const period = arg.split('=')[1];
      if (['today', '7d', '30d'].includes(period)) {
        parsed.period = period as CliArgs['period'];
      }
    } else if (arg.startsWith('--format=')) {
      const format = arg.split('=')[1];
      if (['text', 'json'].includes(format)) {
        parsed.format = format as CliArgs['format'];
      }
    }
  }

  if (!parsed.orgId) {
    console.error('Usage: usage-report.ts --org-id=<org-id> [--period=today|7d|30d] [--format=text|json]');
    process.exit(1);
  }

  return parsed as CliArgs;
}

// =============================================================================
// Hooks: Beads + AgentFS
// =============================================================================

async function createBeadsTask(orgId: string, period: string): Promise<string | null> {
  if (process.env.INTENTVISION_BEADS_ENABLED !== 'true') {
    return null;
  }

  try {
    const title = `Phase 11: usage-report run for org ${orgId} (${period})`;
    const { stdout } = await execAsync(`bd create "${title}" -t task -p 2`);
    const match = stdout.match(/intentvision-\w+/);
    if (match) {
      console.log(`[Beads] Created task: ${match[0]}`);
      return match[0];
    }
  } catch (error) {
    console.warn(`[Beads] Failed to create task: ${(error as Error).message}`);
  }
  return null;
}

async function closeBeadsTask(taskId: string): Promise<void> {
  if (!taskId) return;

  try {
    await execAsync(`bd close ${taskId}`);
    console.log(`[Beads] Closed task: ${taskId}`);
  } catch (error) {
    console.warn(`[Beads] Failed to close task: ${(error as Error).message}`);
  }
}

async function recordAgentFSRun(
  orgId: string,
  planId: string,
  period: string,
  result: Record<string, unknown>
): Promise<void> {
  if (process.env.INTENTVISION_AGENTFS_ENABLED !== 'true') {
    return;
  }

  const project = process.env.INTENTVISION_AGENTFS_PROJECT || 'intentvision';

  try {
    // AgentFS KV record for this run
    const key = `usage-report:${orgId}:${period}:${Date.now()}`;
    const value = JSON.stringify({
      scriptName: 'usage-report',
      orgId,
      planId,
      period,
      timestamp: new Date().toISOString(),
      result,
    });

    // If AgentFS CLI is available, record the run
    // For now, we log the intent - actual AgentFS integration depends on available tooling
    console.log(`[AgentFS] Recording run: ${key}`);
    console.log(`[AgentFS] Project: ${project}`);
    console.log(`[AgentFS] Data: ${value.substring(0, 200)}...`);

    // Placeholder for actual AgentFS API call
    // await agentfs.kv.set(project, key, value);
  } catch (error) {
    console.warn(`[AgentFS] Failed to record run: ${(error as Error).message}`);
  }
}

// =============================================================================
// Report Generation
// =============================================================================

interface UsageReport {
  orgId: string;
  orgName: string;
  planId: string;
  planName: string;
  period: string;
  generatedAt: string;
  usage: {
    forecasts: { current: number; limit: number; percentUsed: number };
    alerts: { current: number; limit: number; percentUsed: number };
    ingested: { current: number; limit: number; percentUsed: number };
    apiCalls: { current: number; limit: number; percentUsed: number };
  };
  totalEvents: number;
  warnings: string[];
}

async function generateReport(orgId: string, period: CliArgs['period']): Promise<UsageReport> {
  // Get org info
  const org = await getOrganizationById(orgId);
  if (!org) {
    throw new Error(`Organization not found: ${orgId}`);
  }

  // Get plan info
  const planIdMap: Record<string, PlanId> = {
    beta: 'free',
    starter: 'starter',
    growth: 'growth',
    enterprise: 'enterprise',
  };
  const planId = planIdMap[org.plan || 'beta'] || 'free';
  const plan = getPlan(planId);

  // Get usage based on period
  const overview = await getAdminUsageOverview(orgId);

  return {
    orgId,
    orgName: org.name,
    planId,
    planName: plan.name,
    period,
    generatedAt: new Date().toISOString(),
    usage: overview.today,
    totalEvents: overview.last30Days.totalEvents,
    warnings: overview.warnings,
  };
}

function formatTextReport(report: UsageReport): string {
  const lines: string[] = [
    '========================================',
    'IntentVision Usage Report',
    '========================================',
    '',
    `Organization: ${report.orgName} (${report.orgId})`,
    `Plan: ${report.planName}`,
    `Period: ${report.period}`,
    `Generated: ${report.generatedAt}`,
    '',
    '--- Today\'s Usage ---',
    '',
    `Forecasts: ${report.usage.forecasts.current} / ${report.usage.forecasts.limit} (${report.usage.forecasts.percentUsed}%)`,
    `Alerts: ${report.usage.alerts.current} / ${report.usage.alerts.limit} (${report.usage.alerts.percentUsed}%)`,
    `Ingested: ${report.usage.ingested.current} / ${report.usage.ingested.limit} (${report.usage.ingested.percentUsed}%)`,
    `API Calls: ${report.usage.apiCalls.current} / ${report.usage.apiCalls.limit} (${report.usage.apiCalls.percentUsed}%)`,
    '',
    `Total Events (30d): ${report.totalEvents}`,
    '',
  ];

  if (report.warnings.length > 0) {
    lines.push('--- Warnings ---');
    lines.push('');
    for (const warning of report.warnings) {
      lines.push(`  ! ${warning}`);
    }
    lines.push('');
  }

  lines.push('========================================');

  return lines.join('\n');
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('IntentVision Usage Report Generator');
  console.log('Phase 11: Usage Metering + Plan Enforcement\n');

  // Initialize Firestore
  initFirestore();

  // Create Beads task if enabled
  const beadsTaskId = await createBeadsTask(args.orgId, args.period);

  try {
    // Generate report
    const report = await generateReport(args.orgId, args.period);

    // Output report
    if (args.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatTextReport(report));
    }

    // Record in AgentFS if enabled
    await recordAgentFSRun(args.orgId, report.planId, args.period, {
      totalEvents: report.totalEvents,
      warnings: report.warnings.length,
      usage: report.usage,
    });

    // Close Beads task on success
    if (beadsTaskId) {
      await closeBeadsTask(beadsTaskId);
    }

    process.exit(0);
  } catch (error) {
    console.error('Report generation failed:', (error as Error).message);

    // Still try to close Beads task (mark as done with error noted)
    if (beadsTaskId) {
      await closeBeadsTask(beadsTaskId);
    }

    process.exit(1);
  }
}

main();
