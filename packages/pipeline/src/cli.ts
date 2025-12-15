#!/usr/bin/env npx tsx
/**
 * IntentVision Pipeline CLI
 *
 * Usage:
 *   npx tsx packages/pipeline/src/cli.ts              - Run with fixture data
 *   npx tsx packages/pipeline/src/cli.ts --synthetic  - Run with synthetic data
 *   npx tsx packages/pipeline/src/cli.ts --help       - Show help
 */

import { runPipeline, PipelineConfig } from './index.js';
import { closeClient } from '../../../db/config.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
IntentVision Pipeline CLI

Usage:
  npx tsx packages/pipeline/src/cli.ts [options]

Options:
  --synthetic     Use synthetic data instead of fixtures
  --org <id>      Organization ID (default: org-demo)
  --horizon <n>   Forecast horizon (default: 6)
  --threshold <n> Alert threshold (default: 80)
  --sensitivity <n> Anomaly sensitivity 0-1 (default: 0.7)
  --help          Show this help message

Examples:
  # Run with fixture data
  npx tsx packages/pipeline/src/cli.ts

  # Run with synthetic data
  npx tsx packages/pipeline/src/cli.ts --synthetic

  # Run with custom settings
  npx tsx packages/pipeline/src/cli.ts --synthetic --org myorg --threshold 70
`);
    return;
  }

  // Parse arguments
  const useSynthetic = args.includes('--synthetic');
  const orgId = getArg(args, '--org') || 'org-demo';
  const forecastHorizon = parseInt(getArg(args, '--horizon') || '6', 10);
  const forecastThreshold = parseFloat(getArg(args, '--threshold') || '80');
  const anomalySensitivity = parseFloat(getArg(args, '--sensitivity') || '0.7');

  const config: PipelineConfig = {
    orgId,
    useSynthetic,
    forecastHorizon,
    forecastThreshold,
    anomalySensitivity,
  };

  if (useSynthetic) {
    config.syntheticOptions = {
      metricKey: 'system.cpu.usage',
      pointCount: 100,
      intervalMs: 5 * 60 * 1000,
      baseValue: 50,
      variance: 25,
    };
  }

  console.log('='.repeat(60));
  console.log('IntentVision Pipeline - Minimal Vertical Slice');
  console.log('='.repeat(60));
  console.log();
  console.log('Configuration:');
  console.log(`  Organization: ${config.orgId}`);
  console.log(`  Data source:  ${useSynthetic ? 'Synthetic' : 'Fixture'}`);
  console.log(`  Forecast horizon: ${forecastHorizon}`);
  console.log(`  Alert threshold: ${forecastThreshold}`);
  console.log(`  Anomaly sensitivity: ${anomalySensitivity}`);
  console.log();

  try {
    const result = await runPipeline(config);

    console.log();
    console.log('='.repeat(60));
    console.log('Pipeline Results');
    console.log('='.repeat(60));
    console.log();
    console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Duration: ${result.durationMs}ms`);
    console.log();
    console.log('Metrics:');
    console.log(`  Processed: ${result.metrics.processed}`);
    console.log(`  Stored: ${result.metrics.stored}`);
    console.log(`  Duplicates: ${result.metrics.duplicates}`);
    console.log();
    console.log('Forecast:');
    console.log(`  Generated: ${result.forecast.generated}`);
    console.log(`  Predictions: ${result.forecast.predictions}`);
    console.log();
    console.log('Anomaly Detection:');
    console.log(`  Detected: ${result.anomaly.detected}`);
    console.log();
    console.log('Alerts:');
    console.log(`  Emitted: ${result.alerts.emitted}`);
    console.log();

    if (result.errors.length > 0) {
      console.log('Errors:');
      result.errors.forEach((e) => console.log(`  - ${e}`));
      console.log();
    }

    console.log('='.repeat(60));

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('Pipeline failed:', (error as Error).message);
    process.exit(1);
  } finally {
    await closeClient();
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

main();
