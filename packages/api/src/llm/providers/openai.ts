/**
 * OpenAI LLM Provider
 *
 * Phase 17: Operator Assistant Agent
 *
 * Implements the LLMClient interface for OpenAI's API.
 * Compatible with:
 * - OpenAI API (api.openai.com)
 * - Azure OpenAI
 * - OpenAI-compatible APIs (e.g., vLLM, LocalAI, etc.)
 *
 * Environment Variables:
 * - OPENAI_API_KEY: OpenAI API key
 * - OPENAI_BASE_URL: Optional custom base URL
 * - OPENAI_ORG_ID: Optional organization ID
 */

import type {
  LLMClient,
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMChatOptions,
  LLMUsage,
} from '../provider.js';
import {
  LLMError,
  LLMConfigError,
  LLMRateLimitError,
  LLMAuthError,
  DEFAULT_CONFIG,
  DEFAULT_MODELS,
} from '../provider.js';

// =============================================================================
// Types
// =============================================================================

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
    param?: string;
  };
}

// =============================================================================
// OpenAI Client Implementation
// =============================================================================

/**
 * OpenAI LLM Client
 *
 * Implements chat completions using OpenAI's API.
 * Also works with Azure OpenAI and OpenAI-compatible endpoints.
 */
export class OpenAIClient implements LLMClient {
  readonly provider = 'openai' as const;
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly orgId?: string;

  constructor(config: LLMConfig) {
    // Validate API key
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new LLMConfigError(
        'OpenAI API key is required. Set OPENAI_API_KEY environment variable or provide apiKey in config.',
        'openai'
      );
    }

    this.apiKey = apiKey;
    this.model = config.model || DEFAULT_MODELS.openai;
    this.baseUrl = config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.timeout = config.timeout || DEFAULT_CONFIG.timeout;
    this.maxRetries = config.maxRetries || DEFAULT_CONFIG.maxRetries;
    this.orgId = process.env.OPENAI_ORG_ID;

    // Remove trailing slash from base URL
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  /**
   * Send a chat completion request to OpenAI
   */
  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const startTime = Date.now();

    // Build request body
    const requestBody: OpenAIChatRequest = {
      model: this.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? DEFAULT_CONFIG.temperature,
      max_tokens: options?.maxTokens ?? DEFAULT_CONFIG.maxTokens,
    };

    if (options?.topP !== undefined) {
      requestBody.top_p = options.topP;
    }

    if (options?.stop) {
      requestBody.stop = options.stop;
    }

    // Make request with retries
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(requestBody);
        const durationMs = Date.now() - startTime;

        return this.parseResponse(response, durationMs);
      } catch (error) {
        lastError = error as Error;

        // Don't retry auth errors
        if (error instanceof LLMAuthError) {
          throw error;
        }

        // Retry rate limit errors with exponential backoff
        if (error instanceof LLMRateLimitError) {
          const backoffMs = error.retryAfterMs || Math.pow(2, attempt) * 1000;
          console.warn(
            `[OpenAI] Rate limited, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})`
          );
          await this.sleep(backoffMs);
          continue;
        }

        // Retry other errors with exponential backoff
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(
            `[OpenAI] Request failed, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})`
          );
          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError || new LLMError('Request failed after retries', 'openai');
  }

  /**
   * Make HTTP request to OpenAI API
   */
  private async makeRequest(body: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.orgId) {
      headers['OpenAI-Organization'] = this.orgId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return await response.json() as OpenAIChatResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new LLMError('Request timed out', 'openai', 'TIMEOUT', undefined, true);
      }

      throw new LLMError(
        `Network error: ${(error as Error).message}`,
        'openai',
        'NETWORK_ERROR',
        undefined,
        true
      );
    }
  }

  /**
   * Handle error responses from OpenAI API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorBody: OpenAIErrorResponse | null = null;

    try {
      errorBody = await response.json() as OpenAIErrorResponse;
    } catch {
      // Ignore JSON parse errors
    }

    const errorMessage = errorBody?.error?.message || response.statusText || 'Unknown error';

    switch (response.status) {
      case 401:
        throw new LLMAuthError(`Authentication failed: ${errorMessage}`, 'openai');

      case 429: {
        // Parse retry-after header if present
        const retryAfter = response.headers.get('retry-after');
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
        throw new LLMRateLimitError(`Rate limit exceeded: ${errorMessage}`, 'openai', retryAfterMs);
      }

      case 400:
        throw new LLMError(
          `Bad request: ${errorMessage}`,
          'openai',
          errorBody?.error?.code || 'BAD_REQUEST',
          400,
          false
        );

      case 500:
      case 502:
      case 503:
        throw new LLMError(
          `Server error: ${errorMessage}`,
          'openai',
          'SERVER_ERROR',
          response.status,
          true
        );

      default:
        throw new LLMError(
          `API error (${response.status}): ${errorMessage}`,
          'openai',
          'API_ERROR',
          response.status,
          response.status >= 500
        );
    }
  }

  /**
   * Parse OpenAI response into LLMResponse format
   */
  private parseResponse(response: OpenAIChatResponse, durationMs: number): LLMResponse {
    const choice = response.choices[0];

    if (!choice) {
      throw new LLMError('No response choices returned', 'openai', 'EMPTY_RESPONSE');
    }

    const usage: LLMUsage | undefined = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined;

    return {
      content: choice.message.content,
      usage,
      model: response.model,
      provider: 'openai',
      durationMs,
      finishReason: choice.finish_reason,
    };
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an OpenAI client instance
 */
export function createOpenAIClient(config: LLMConfig): LLMClient {
  return new OpenAIClient(config);
}
