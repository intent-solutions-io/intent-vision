#!/usr/bin/env tsx
/**
 * Incident Summary CLI Script
 *
 * Phase 17: Operator Assistant Agent
 *
 * Generates an AI-powered summary for an incident using the configured LLM provider.
 *
 * Usage:
 *   npx tsx src/scripts/incident-summary.ts --incident-id=<id> [--provider=openai|anthropic|google]
 *
 * Options:
 *   --incident-id   Incident ID to summarize (required)
 *   --org-id        Organization ID (default: from env or demo-org)
 *   --provider      LLM provider: openai, anthropic, google, vertex (optional)
 *   --model         LLM model name (optional, uses provider default)
 *   --json          Output as JSON instead of formatted text
 *   --help          Show this help message
 *
 * Environment Variables:
 *   LLM_DEFAULT_PROVIDER          Default LLM provider
 *   OPENAI_API_KEY                OpenAI API key
 *   ANTHROPIC_API_KEY             Anthropic API key
 *   GOOGLE_API_KEY                Google AI API key
 *   VERTEX_PROJECT_ID             GCP project for Vertex AI
 *   INTENTVISION_GCP_PROJECT_ID   GCP project for Firestore
 */

import { parseArgs } from 'node:util';
import { initFirestore, getClientInfo } from '../firestore/client.js';
import { generateIncidentSummary } from '../agent/orchestrator.js';
import { getLLMStatus, type LLMProvider, type LLMConfig } from '../llm/providers/index.js';

// =============================================================================
// Types
// =============================================================================

interface CliArgs {
  incidentId: string;
  orgId: string;
  provider?: LLMProvider;
  model?: string;
  json: boolean;
}

// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseCliArgs(): CliArgs {
  const { values } = parseArgs({
    options: {
      'incident-id': { type: 'string' },
      'org-id': { type: 'string', default: process.env.INTENTVISION_ORG_ID || 'demo-org' },
      'provider': { type: 'string' },
      'model': { type: 'string' },
      'json': { type: 'boolean', default: false },
      'help': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (!values['incident-id']) {
    console.error('Error: --incident-id is required');
    printUsage();
    process.exit(1);
  }

  // Validate provider if specified
  const validProviders: LLMProvider[] = ['openai', 'anthropic', 'google', 'vertex', 'azure', 'custom'];
  if (values.provider && !validProviders.includes(values.provider as LLMProvider)) {
    console.error(`Error: Invalid provider '${values.provider}'. Valid options: ${validProviders.join(', ')}`);
    process.exit(1);
  }

  return {
    incidentId: values['incident-id'] as string,
    orgId: values['org-id'] as string,
    provider: values.provider as LLMProvider | undefined,
    model: values.model as string | undefined,
    json: values.json as boolean,
  };
}

function printUsage(): void {
  console.log(`
Incident Summary Generator - Phase 17: Operator Assistant Agent

Usage:
  npx tsx src/scripts/incident-summary.ts --incident-id=<id> [options]

Options:
  --incident-id   Incident ID to summarize (required)
  --org-id        Organization ID (default: demo-org)
  --provider      LLM provider: openai, anthropic, google, vertex, azure, custom
  --model         LLM model name (uses provider default if not specified)
  --json          Output as JSON instead of formatted text
  --help          Show this help message

Environment Variables:
  LLM_DEFAULT_PROVIDER          Default LLM provider
  OPENAI_API_KEY                OpenAI API key
  ANTHROPIC_API_KEY             Anthropic API key
  GOOGLE_API_KEY                Google AI API key
  VERTEX_PROJECT_ID             GCP project for Vertex AI
  INTENTVISION_GCP_PROJECT_ID   GCP project for Firestore

Examples:
  # Generate summary using default provider
  npx tsx src/scripts/incident-summary.ts --incident-id=inc_abc123

  # Use specific provider
  npx tsx src/scripts/incident-summary.ts --incident-id=inc_abc123 --provider=anthropic

  # Output as JSON
  npx tsx src/scripts/incident-summary.ts --incident-id=inc_abc123 --json
`);
}

// =============================================================================
// Output Formatting
// =============================================================================

function formatOutput(
  result: Awaited<ReturnType<typeof generateIncidentSummary>>,
  args: CliArgs
): void {
  if (args.json) {
    console.log(JSON.stringify({
      incidentId: args.incidentId,
      orgId: args.orgId,
      ...result,
    }, null, 2));
    return;
  }

  // Formatted text output
  console.log('');
  console.log('========================================');
  console.log('INCIDENT SUMMARY');
  console.log('========================================');
  console.log('');
  console.log(result.summary);
  console.log('');

  console.log('----------------------------------------');
  console.log('KEY HIGHLIGHTS');
  console.log('----------------------------------------');
  for (const highlight of result.highlights) {
    console.log(`  * ${highlight}`);
  }
  console.log('');

  console.log('----------------------------------------');
  console.log('RECOMMENDED CHECKS');
  console.log('----------------------------------------');
  for (const check of result.recommendedChecks) {
    console.log(`  * ${check}`);
  }
  console.log('');

  console.log('----------------------------------------');
  console.log('METADATA');
  console.log('----------------------------------------');
  console.log(`  Provider: ${result.providerUsed}`);
  console.log(`  Model: ${result.modelUsed}`);
  console.log(`  Duration: ${result.durationMs}ms`);
  if (result.tokenUsage) {
    console.log(`  Tokens: ${result.tokenUsage.promptTokens} prompt + ${result.tokenUsage.completionTokens} completion`);
  }
  console.log('========================================');
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = parseCliArgs();

  if (!args.json) {
    console.log('========================================');
    console.log('IntentVision Incident Summary Generator');
    console.log('Phase 17: Operator Assistant Agent');
    console.log('========================================');
    console.log('');
  }

  // Initialize Firestore
  if (!args.json) {
    console.log('Initializing Firestore...');
  }
  initFirestore();
  const firestoreInfo = getClientInfo();

  if (!args.json) {
    console.log(`  Mode: ${firestoreInfo.mode}`);
    console.log(`  Project: ${firestoreInfo.projectId || 'NOT SET'}`);
    console.log(`  Environment: ${firestoreInfo.environment}`);
    console.log('');
  }

  // Check LLM configuration
  const llmStatus = getLLMStatus();

  if (!args.json) {
    console.log('LLM Configuration:');
    console.log(`  Configured: ${llmStatus.isConfigured}`);
    console.log(`  Default Provider: ${llmStatus.defaultProvider || 'NOT SET'}`);
    console.log(`  Available Providers: ${llmStatus.configuredProviders.join(', ') || 'NONE'}`);
    console.log('');

    if (!llmStatus.isConfigured && !args.provider) {
      console.log('WARNING: No LLM provider configured. Summary will use stub response.');
      console.log('Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, or VERTEX_PROJECT_ID');
      console.log('');
    }
  }

  // Build LLM config if provider/model specified
  let llmConfig: LLMConfig | undefined;
  if (args.provider) {
    llmConfig = {
      provider: args.provider,
      model: args.model,
    };
    if (!args.json) {
      console.log(`Using provider override: ${args.provider}${args.model ? ` (model: ${args.model})` : ''}`);
      console.log('');
    }
  }

  // Generate summary
  if (!args.json) {
    console.log(`Generating summary for incident: ${args.incidentId}`);
    console.log(`Organization: ${args.orgId}`);
    console.log('');
    console.log('Processing...');
  }

  try {
    const result = await generateIncidentSummary(args.orgId, args.incidentId, llmConfig);
    formatOutput(result, args);

    if (!args.json) {
      console.log('');
      console.log('Summary generated successfully!');
    }
  } catch (error) {
    const errorMessage = (error as Error).message;

    if (args.json) {
      console.log(JSON.stringify({
        error: errorMessage,
        incidentId: args.incidentId,
        orgId: args.orgId,
      }, null, 2));
    } else {
      console.error('');
      console.error('ERROR: Failed to generate summary');
      console.error(`  ${errorMessage}`);
      console.error('');

      // Provide helpful hints based on error
      if (errorMessage.includes('not found')) {
        console.error('Hint: Verify the incident ID exists in the specified organization.');
      } else if (errorMessage.includes('API key') || errorMessage.includes('Authentication')) {
        console.error('Hint: Check your LLM provider API key is set correctly.');
      } else if (errorMessage.includes('Rate limit')) {
        console.error('Hint: Wait a moment and try again, or switch to a different provider.');
      }
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
