/**
 * Agent Demo - Demonstrate the agent workflow
 *
 * Run with: npx tsx packages/agent/src/demo.ts
 */

import {
  initializeAgent,
  processRequest,
  getAvailableTools,
} from './index.js';

async function main() {
  console.log('='.repeat(60));
  console.log('IntentVision Agent Demo');
  console.log('='.repeat(60));
  console.log();

  // Initialize with verbose logging
  initializeAgent({ verbose: true });

  console.log();
  console.log('Available tools:', getAvailableTools().join(', '));
  console.log();

  // Test different intents
  const testIntents = [
    'What is the current CPU usage?',
    'Run the pipeline with synthetic data',
    'Analyze the metrics for any anomalies',
    'Show me all active alerts',
  ];

  for (const intent of testIntents) {
    console.log('-'.repeat(60));
    console.log(`Intent: "${intent}"`);
    console.log('-'.repeat(60));

    const response = await processRequest(intent);

    console.log();
    console.log('Response:');
    console.log(`  Success: ${response.success}`);
    console.log(`  Duration: ${response.durationMs}ms`);
    console.log(`  Tool calls: ${response.trace.toolCallCount}`);
    console.log(`  Steps: ${response.trace.steps.length}`);

    if (response.result) {
      console.log('  Result:', JSON.stringify(response.result, null, 4).slice(0, 200) + '...');
    }

    if (response.error) {
      console.log(`  Error: ${response.error}`);
    }

    console.log();
  }

  console.log('='.repeat(60));
  console.log('Demo complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
