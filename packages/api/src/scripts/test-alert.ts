#!/usr/bin/env tsx
/**
 * Test Alert CLI Script
 *
 * Phase 8: Notification Preferences + Multi-Channel Alerts
 * Beads Task: intentvision-uxb
 *
 * Sends a test alert through the notification system to verify:
 * 1. Firestore preferences are properly configured
 * 2. Alert dispatcher routes to correct channels
 * 3. Email delivery via Resend works end-to-end
 *
 * Usage:
 *   # Set required environment variables
 *   export INTENTVISION_GCP_PROJECT_ID=your-project-id
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
 *   export INTENTVISION_RESEND_API_KEY=re_xxxxxxxxx
 *   export INTENTVISION_ALERT_FROM_EMAIL=jeremy@intentsolutions.io
 *
 *   # Run test alert
 *   npm run alert:test -- --org-id test-org --email user@example.com
 *
 * Options:
 *   --org-id    Organization ID (required)
 *   --email     Email address to send test alert (required)
 *   --severity  Alert severity: info, warning, critical (default: warning)
 *   --metric    Metric key (default: test:alert)
 *   --dry-run   Show what would be sent without sending
 */

import { parseArgs } from 'node:util';
import {
  dispatchAlert,
  ensureTestChannelAndPreference,
  getDispatcherStatus,
  type AlertEvent,
} from '../notifications/index.js';
import { getClientInfo } from '../firestore/client.js';

// =============================================================================
// CLI Argument Parsing
// =============================================================================

interface CliArgs {
  orgId: string;
  email: string;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  dryRun: boolean;
}

function parseCliArgs(): CliArgs {
  const { values } = parseArgs({
    options: {
      'org-id': { type: 'string' },
      'email': { type: 'string' },
      'severity': { type: 'string', default: 'warning' },
      'metric': { type: 'string', default: 'test:alert' },
      'dry-run': { type: 'boolean', default: false },
      'help': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (!values['org-id']) {
    console.error('Error: --org-id is required');
    printUsage();
    process.exit(1);
  }

  if (!values['email']) {
    console.error('Error: --email is required');
    printUsage();
    process.exit(1);
  }

  const severity = values['severity'] as string;
  if (!['info', 'warning', 'critical'].includes(severity)) {
    console.error('Error: --severity must be info, warning, or critical');
    process.exit(1);
  }

  return {
    orgId: values['org-id'] as string,
    email: values['email'] as string,
    severity: severity as 'info' | 'warning' | 'critical',
    metric: values['metric'] as string,
    dryRun: values['dry-run'] as boolean,
  };
}

function printUsage(): void {
  console.log(`
Usage: npm run alert:test -- [options]

Options:
  --org-id      Organization ID (required)
  --email       Email address to send test alert (required)
  --severity    Alert severity: info, warning, critical (default: warning)
  --metric      Metric key (default: test:alert)
  --dry-run     Show what would be sent without sending
  --help        Show this help message

Environment Variables:
  INTENTVISION_GCP_PROJECT_ID      GCP project ID (required)
  GOOGLE_APPLICATION_CREDENTIALS   Path to service account JSON (local dev)
  INTENTVISION_RESEND_API_KEY      Resend API key (required for email)
  INTENTVISION_ALERT_FROM_EMAIL    From address (default: jeremy@intentsolutions.io)
  INTENTVISION_ENV                 Environment: dev, stage, prod (default: dev)

Examples:
  # Send test alert
  npm run alert:test -- --org-id my-org --email alerts@example.com

  # Send critical test alert
  npm run alert:test -- --org-id my-org --email alerts@example.com --severity critical

  # Dry run (no actual sending)
  npm run alert:test -- --org-id my-org --email alerts@example.com --dry-run
`);
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('IntentVision Test Alert');
  console.log('Phase 8: Notification Preferences');
  console.log('========================================\n');

  const args = parseCliArgs();

  // Show configuration
  console.log('Configuration:');
  const firestoreInfo = getClientInfo();
  const dispatcherStatus = getDispatcherStatus();

  console.log(`  Firestore Mode: ${firestoreInfo.mode}`);
  console.log(`  Project ID: ${firestoreInfo.projectId || 'NOT SET'}`);
  console.log(`  Environment: ${firestoreInfo.environment}`);
  console.log(`  Resend Configured: ${dispatcherStatus.resendConfigured ? 'Yes' : 'No'}`);
  console.log(`  From Email: ${dispatcherStatus.fromEmail}`);
  console.log('');

  console.log('Test Alert Parameters:');
  console.log(`  Org ID: ${args.orgId}`);
  console.log(`  Email: ${args.email}`);
  console.log(`  Severity: ${args.severity}`);
  console.log(`  Metric: ${args.metric}`);
  console.log(`  Dry Run: ${args.dryRun}`);
  console.log('');

  // Validate configuration
  if (!firestoreInfo.projectId) {
    console.error('ERROR: INTENTVISION_GCP_PROJECT_ID is not set');
    console.error('Set this environment variable to your GCP project ID');
    process.exit(1);
  }

  if (!dispatcherStatus.resendConfigured && !args.dryRun) {
    console.warn('WARNING: INTENTVISION_RESEND_API_KEY is not set');
    console.warn('Email alerts will be logged but not sent');
    console.warn('');
  }

  // Ensure test channel and preference exist
  console.log('Ensuring test channel and preference exist...');
  const { channel, preference } = await ensureTestChannelAndPreference(
    args.orgId,
    args.email
  );

  console.log(`  Channel ID: ${channel.id}`);
  console.log(`  Channel Type: ${channel.type}`);
  console.log(`  Channel Email: ${channel.emailAddress}`);
  console.log(`  Preference ID: ${preference.id}`);
  console.log(`  Preference Severity: ${preference.severity}`);
  console.log('');

  // Build test alert
  const alertEvent: AlertEvent = {
    orgId: args.orgId,
    metricKey: args.metric,
    severity: args.severity,
    title: `Test Alert - ${args.severity.toUpperCase()}`,
    message: `This is a test alert generated by the IntentVision test-alert script. If you received this email, the notification system is working correctly.`,
    context: {
      testTimestamp: new Date().toISOString(),
      triggeredBy: 'test-alert.ts',
      phase: 'Phase 8',
    },
    occurredAt: new Date().toISOString(),
  };

  console.log('Test Alert Event:');
  console.log(JSON.stringify(alertEvent, null, 2));
  console.log('');

  if (args.dryRun) {
    console.log('DRY RUN: Would dispatch alert to channels');
    console.log('Exiting without sending.');
    return;
  }

  // Dispatch alert
  console.log('Dispatching alert...');
  console.log('');

  const summary = await dispatchAlert(alertEvent);

  // Show results
  console.log('========================================');
  console.log('Dispatch Summary');
  console.log('========================================');
  console.log(`  Channels Selected: ${summary.channelsSelected}`);
  console.log(`  Channels Notified: ${summary.channelsNotified}`);
  console.log(`  Channels Failed: ${summary.channelsFailed}`);
  console.log(`  Duration: ${summary.durationMs}ms`);
  console.log('');

  if (summary.results.length > 0) {
    console.log('Results:');
    for (const result of summary.results) {
      const status = result.success ? '✓' : '✗';
      console.log(`  ${status} ${result.channelType} → ${result.destination}`);
      if (result.messageId) {
        console.log(`    Message ID: ${result.messageId}`);
      }
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    }
  }

  console.log('');
  console.log('========================================');

  if (summary.channelsFailed > 0) {
    console.log('Some channels failed. Check the errors above.');
    process.exit(1);
  } else if (summary.channelsNotified > 0) {
    console.log('Test alert sent successfully!');
    console.log(`Check ${args.email} for the test email.`);
  } else {
    console.log('No channels were notified.');
    console.log('This may indicate no matching preferences were found.');
  }
}

main().catch((error) => {
  console.error('Test alert failed:', error);
  process.exit(1);
});
