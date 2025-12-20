/**
 * LLM Provider Abstraction
 *
 * Phase 17: Operator Assistant Agent
 *
 * Pluggable LLM backend supporting multiple providers:
 * - OpenAI (GPT-4, GPT-4 Turbo, etc.)
 * - Anthropic (Claude 3.5, Claude 3, etc.)
 * - Google (Gemini, Vertex AI)
 * - Azure OpenAI
 * - Custom/Self-hosted (via baseUrl)
 *
 * Environment Variables:
 * - LLM_DEFAULT_PROVIDER: openai | anthropic | google | vertex | azure | custom
 * - LLM_DEFAULT_MODEL: Model name (provider-specific)
 * - OPENAI_API_KEY: OpenAI API key
 * - ANTHROPIC_API_KEY: Anthropic API key
 * - GOOGLE_API_KEY: Google AI API key
 * - VERTEX_PROJECT_ID: GCP project for Vertex AI
 * - VERTEX_REGION: GCP region for Vertex AI (default: us-central1)
 * - AZURE_OPENAI_API_KEY: Azure OpenAI API key
 * - AZURE_OPENAI_ENDPOINT: Azure OpenAI endpoint
 * - LLM_CUSTOM_BASE_URL: Base URL for custom/self-hosted LLM
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Supported LLM provider types
 */
export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'vertex' | 'azure' | 'custom';

/**
 * LLM configuration options
 */
export interface LLMConfig {
  /** Provider type */
  provider: LLMProvider;
  /** API key (for OpenAI, Anthropic, Google, Azure) */
  apiKey?: string;
  /** Model name (provider-specific) */
  model?: string;
  /** Base URL for custom/self-hosted endpoints */
  baseUrl?: string;
  /** GCP Project ID (for Vertex AI) */
  projectId?: string;
  /** GCP Region (for Vertex AI) */
  region?: string;
  /** Azure OpenAI endpoint */
  azureEndpoint?: string;
  /** Azure OpenAI deployment name */
  azureDeployment?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Maximum retries on failure */
  maxRetries?: number;
}

/**
 * Message format for chat completions
 */
export interface LLMMessage {
  /** Message role */
  role: 'system' | 'user' | 'assistant';
  /** Message content */
  content: string;
}

/**
 * Token usage information
 */
export interface LLMUsage {
  /** Tokens in the prompt */
  promptTokens: number;
  /** Tokens in the completion */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
}

/**
 * LLM response format
 */
export interface LLMResponse {
  /** Generated content */
  content: string;
  /** Token usage statistics */
  usage?: LLMUsage;
  /** Model that generated the response */
  model: string;
  /** Provider that generated the response */
  provider: LLMProvider;
  /** Response generation time in ms */
  durationMs?: number;
  /** Finish reason (stop, length, etc.) */
  finishReason?: string;
}

/**
 * Options for chat completion requests
 */
export interface LLMChatOptions {
  /** Sampling temperature (0-2, lower is more deterministic) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Top-p sampling (nucleus sampling) */
  topP?: number;
  /** Stop sequences */
  stop?: string[];
  /** Whether to stream the response (not yet implemented) */
  stream?: boolean;
}

/**
 * LLM client interface - implemented by each provider
 */
export interface LLMClient {
  /** Provider identifier */
  readonly provider: LLMProvider;
  /** Model name */
  readonly model: string;

  /**
   * Send a chat completion request
   * @param messages - Array of messages in the conversation
   * @param options - Optional generation parameters
   * @returns LLM response with generated content
   */
  chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse>;
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Base error class for LLM-related errors
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: LLMProvider,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/**
 * Configuration error - missing or invalid configuration
 */
export class LLMConfigError extends LLMError {
  constructor(message: string, provider: LLMProvider) {
    super(message, provider, 'CONFIG_ERROR', undefined, false);
    this.name = 'LLMConfigError';
  }
}

/**
 * Rate limit error - provider rate limit exceeded
 */
export class LLMRateLimitError extends LLMError {
  constructor(
    message: string,
    provider: LLMProvider,
    public readonly retryAfterMs?: number
  ) {
    super(message, provider, 'RATE_LIMIT', 429, true);
    this.name = 'LLMRateLimitError';
  }
}

/**
 * Authentication error - invalid API key or credentials
 */
export class LLMAuthError extends LLMError {
  constructor(message: string, provider: LLMProvider) {
    super(message, provider, 'AUTH_ERROR', 401, false);
    this.name = 'LLMAuthError';
  }
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default models for each provider
 */
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4-turbo-preview',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-1.5-pro',
  vertex: 'gemini-1.5-pro',
  azure: 'gpt-4',
  custom: 'default',
};

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  timeout: 60000, // 60 seconds
  maxRetries: 3,
  temperature: 0.7,
  maxTokens: 4096,
};

// =============================================================================
// Configuration Loading
// =============================================================================

/**
 * Get LLM configuration from environment variables
 */
export function getLLMConfigFromEnv(): Partial<LLMConfig> {
  const provider = (process.env.LLM_DEFAULT_PROVIDER as LLMProvider) || 'openai';

  return {
    provider,
    model: process.env.LLM_DEFAULT_MODEL || DEFAULT_MODELS[provider],
    apiKey: getApiKeyForProvider(provider),
    baseUrl: process.env.LLM_CUSTOM_BASE_URL,
    projectId: process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
    region: process.env.VERTEX_REGION || 'us-central1',
    azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
    azureDeployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    timeout: parseInt(process.env.LLM_TIMEOUT || String(DEFAULT_CONFIG.timeout), 10),
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES || String(DEFAULT_CONFIG.maxRetries), 10),
  };
}

/**
 * Get the API key for a specific provider from environment
 */
function getApiKeyForProvider(provider: LLMProvider): string | undefined {
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'google':
      return process.env.GOOGLE_API_KEY;
    case 'azure':
      return process.env.AZURE_OPENAI_API_KEY;
    case 'vertex':
      // Vertex AI uses ADC (Application Default Credentials)
      return undefined;
    case 'custom':
      return process.env.LLM_CUSTOM_API_KEY;
    default:
      return undefined;
  }
}

// =============================================================================
// Factory Function (implemented in providers/index.ts)
// =============================================================================

/**
 * Factory function to create an LLM client
 * This is re-exported from providers/index.ts with the actual implementation
 */
export type CreateLLMClientFn = (config: LLMConfig) => LLMClient;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Estimate token count for a message (rough approximation)
 * Uses ~4 characters per token as a rough estimate
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token count for an array of messages
 */
export function estimateMessagesTokens(messages: LLMMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    // Add overhead for message structure
    total += estimateTokens(msg.content) + 4;
  }
  return total;
}

/**
 * Truncate messages to fit within a token limit
 * Keeps system messages and recent user/assistant messages
 */
export function truncateMessages(
  messages: LLMMessage[],
  maxTokens: number,
  reserveTokens: number = 1000
): LLMMessage[] {
  const effectiveMax = maxTokens - reserveTokens;

  // Separate system messages from others
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // Calculate system message tokens
  const systemTokens = estimateMessagesTokens(systemMessages);
  const availableForConversation = effectiveMax - systemTokens;

  if (availableForConversation <= 0) {
    // If system messages alone exceed limit, truncate them
    return systemMessages.slice(0, 1);
  }

  // Keep most recent conversation messages that fit
  const result: LLMMessage[] = [...systemMessages];
  let currentTokens = 0;

  // Work backwards from most recent
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i];
    const msgTokens = estimateTokens(msg.content) + 4;

    if (currentTokens + msgTokens <= availableForConversation) {
      result.splice(systemMessages.length, 0, msg);
      currentTokens += msgTokens;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Check if a provider is configured in the environment
 */
export function isProviderConfigured(provider: LLMProvider): boolean {
  switch (provider) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY;
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;
    case 'google':
      return !!process.env.GOOGLE_API_KEY;
    case 'vertex':
      return !!(process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT);
    case 'azure':
      return !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT);
    case 'custom':
      return !!process.env.LLM_CUSTOM_BASE_URL;
    default:
      return false;
  }
}

/**
 * Get list of configured providers
 */
export function getConfiguredProviders(): LLMProvider[] {
  const providers: LLMProvider[] = ['openai', 'anthropic', 'google', 'vertex', 'azure', 'custom'];
  return providers.filter(p => isProviderConfigured(p));
}
