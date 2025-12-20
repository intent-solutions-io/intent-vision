/**
 * LLM Providers Index
 *
 * Phase 17: Operator Assistant Agent
 *
 * Central entry point for LLM providers.
 * Exports factory functions and provides unified client creation.
 *
 * Usage:
 *   import { createLLMClient, getLLMClient } from './llm/providers/index.js';
 *
 *   // Create with explicit config
 *   const client = createLLMClient({ provider: 'anthropic', apiKey: '...' });
 *
 *   // Get client using environment variables
 *   const defaultClient = getLLMClient();
 */

import type { LLMClient, LLMConfig, LLMProvider } from '../provider.js';
import {
  LLMConfigError,
  getLLMConfigFromEnv,
  isProviderConfigured,
  getConfiguredProviders,
  DEFAULT_MODELS,
} from '../provider.js';
import { createOpenAIClient } from './openai.js';
import { createAnthropicClient } from './anthropic.js';
import { createGoogleClient, createVertexAIClient } from './google.js';

// =============================================================================
// Re-exports
// =============================================================================

export { OpenAIClient, createOpenAIClient } from './openai.js';
export { AnthropicClient, createAnthropicClient } from './anthropic.js';
export {
  GoogleAIClient,
  VertexAIClient,
  createGoogleAIClient,
  createVertexAIClient,
  createGoogleClient,
} from './google.js';

// Re-export types and utilities from provider.ts
export * from '../provider.js';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an LLM client for the specified provider
 *
 * @param config - LLM configuration with provider type
 * @returns LLM client instance
 * @throws LLMConfigError if provider is not supported or misconfigured
 */
export function createLLMClient(config: LLMConfig): LLMClient {
  const { provider } = config;

  switch (provider) {
    case 'openai':
      return createOpenAIClient(config);

    case 'anthropic':
      return createAnthropicClient(config);

    case 'google':
      return createGoogleClient(config);

    case 'vertex':
      return createVertexAIClient(config);

    case 'azure':
      // Azure uses OpenAI-compatible API with custom endpoint
      return createAzureOpenAIClient(config);

    case 'custom':
      // Custom/self-hosted uses OpenAI-compatible API
      return createCustomClient(config);

    default:
      throw new LLMConfigError(
        `Unsupported LLM provider: ${provider}. Supported providers: openai, anthropic, google, vertex, azure, custom`,
        provider
      );
  }
}

/**
 * Create an Azure OpenAI client
 * Uses the OpenAI client with Azure-specific configuration
 */
function createAzureOpenAIClient(config: LLMConfig): LLMClient {
  const endpoint = config.azureEndpoint || process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = config.apiKey || process.env.AZURE_OPENAI_API_KEY;
  const deployment = config.azureDeployment || process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint) {
    throw new LLMConfigError(
      'Azure OpenAI endpoint is required. Set AZURE_OPENAI_ENDPOINT environment variable.',
      'azure'
    );
  }

  if (!apiKey) {
    throw new LLMConfigError(
      'Azure OpenAI API key is required. Set AZURE_OPENAI_API_KEY environment variable.',
      'azure'
    );
  }

  // Azure OpenAI uses deployment name as the model
  const model = deployment || config.model || 'gpt-4';

  // Build Azure endpoint URL
  // Azure format: https://{resource}.openai.azure.com/openai/deployments/{deployment}
  const baseUrl = `${endpoint.replace(/\/$/, '')}/openai/deployments/${model}`;

  // Use OpenAI client with Azure configuration
  // Note: Azure uses api-version query parameter, which would need custom handling
  // For now, we use the OpenAI client which should work with basic operations
  return createOpenAIClient({
    ...config,
    provider: 'openai',
    apiKey,
    baseUrl,
    model,
  });
}

/**
 * Create a custom/self-hosted LLM client
 * Assumes OpenAI-compatible API
 */
function createCustomClient(config: LLMConfig): LLMClient {
  const baseUrl = config.baseUrl || process.env.LLM_CUSTOM_BASE_URL;

  if (!baseUrl) {
    throw new LLMConfigError(
      'Custom LLM base URL is required. Set LLM_CUSTOM_BASE_URL environment variable.',
      'custom'
    );
  }

  // Use OpenAI client with custom base URL
  return createOpenAIClient({
    ...config,
    provider: 'openai',
    baseUrl,
    apiKey: config.apiKey || process.env.LLM_CUSTOM_API_KEY || 'not-needed',
    model: config.model || 'default',
  });
}

// =============================================================================
// Singleton / Default Client
// =============================================================================

let defaultClient: LLMClient | null = null;

/**
 * Get the default LLM client based on environment configuration
 *
 * Uses LLM_DEFAULT_PROVIDER environment variable to determine provider.
 * Falls back to first configured provider if not set.
 *
 * @param forceRefresh - Force recreation of the client
 * @returns LLM client instance
 * @throws LLMConfigError if no provider is configured
 */
export function getLLMClient(forceRefresh: boolean = false): LLMClient {
  if (defaultClient && !forceRefresh) {
    return defaultClient;
  }

  const envConfig = getLLMConfigFromEnv();

  // If provider is explicitly set, use it
  if (envConfig.provider && isProviderConfigured(envConfig.provider)) {
    defaultClient = createLLMClient(envConfig as LLMConfig);
    return defaultClient;
  }

  // Try to find a configured provider
  const configuredProviders = getConfiguredProviders();

  if (configuredProviders.length === 0) {
    throw new LLMConfigError(
      'No LLM provider configured. Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, VERTEX_PROJECT_ID, AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT, or LLM_CUSTOM_BASE_URL',
      envConfig.provider || 'openai'
    );
  }

  // Use the first configured provider
  const provider = configuredProviders[0];
  console.log(`[LLM] Using auto-detected provider: ${provider}`);

  defaultClient = createLLMClient({
    ...envConfig,
    provider,
    model: envConfig.model || DEFAULT_MODELS[provider],
  } as LLMConfig);

  return defaultClient;
}

/**
 * Reset the default client (for testing)
 */
export function resetLLMClient(): void {
  defaultClient = null;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get information about LLM configuration status
 */
export function getLLMStatus(): {
  defaultProvider: LLMProvider | undefined;
  configuredProviders: LLMProvider[];
  defaultModel: string;
  isConfigured: boolean;
} {
  const envConfig = getLLMConfigFromEnv();
  const configuredProviders = getConfiguredProviders();

  return {
    defaultProvider: envConfig.provider,
    configuredProviders,
    defaultModel: envConfig.model || DEFAULT_MODELS[envConfig.provider || 'openai'],
    isConfigured: configuredProviders.length > 0,
  };
}

/**
 * Check if LLM functionality is available
 */
export function isLLMConfigured(): boolean {
  return getConfiguredProviders().length > 0;
}

/**
 * Get a list of all supported providers
 */
export function getSupportedProviders(): LLMProvider[] {
  return ['openai', 'anthropic', 'google', 'vertex', 'azure', 'custom'];
}
