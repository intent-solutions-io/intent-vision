/**
 * Anthropic Claude LLM Provider
 *
 * Phase 17: Operator Assistant Agent
 *
 * Implements the LLMClient interface for Anthropic's Claude API.
 * Supports:
 * - Claude 3.5 Sonnet
 * - Claude 3 Opus
 * - Claude 3 Haiku
 * - Other Claude models
 *
 * Environment Variables:
 * - ANTHROPIC_API_KEY: Anthropic API key
 * - ANTHROPIC_BASE_URL: Optional custom base URL
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

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicChatRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
}

interface AnthropicChatResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicErrorResponse {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

// =============================================================================
// Anthropic Client Implementation
// =============================================================================

/**
 * Anthropic Claude LLM Client
 *
 * Implements chat completions using Anthropic's Messages API.
 */
export class AnthropicClient implements LLMClient {
  readonly provider = 'anthropic' as const;
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  // Anthropic API version
  private readonly apiVersion = '2023-06-01';

  constructor(config: LLMConfig) {
    // Validate API key
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new LLMConfigError(
        'Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or provide apiKey in config.',
        'anthropic'
      );
    }

    this.apiKey = apiKey;
    this.model = config.model || DEFAULT_MODELS.anthropic;
    this.baseUrl = config.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    this.timeout = config.timeout || DEFAULT_CONFIG.timeout;
    this.maxRetries = config.maxRetries || DEFAULT_CONFIG.maxRetries;

    // Remove trailing slash from base URL
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  /**
   * Send a chat completion request to Anthropic
   */
  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const startTime = Date.now();

    // Convert messages to Anthropic format
    // Anthropic separates system messages from the conversation
    const { systemMessage, conversationMessages } = this.convertMessages(messages);

    // Build request body
    const requestBody: AnthropicChatRequest = {
      model: this.model,
      messages: conversationMessages,
      max_tokens: options?.maxTokens ?? DEFAULT_CONFIG.maxTokens,
    };

    if (systemMessage) {
      requestBody.system = systemMessage;
    }

    if (options?.temperature !== undefined) {
      requestBody.temperature = options.temperature;
    }

    if (options?.topP !== undefined) {
      requestBody.top_p = options.topP;
    }

    if (options?.stop) {
      requestBody.stop_sequences = options.stop;
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
            `[Anthropic] Rate limited, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})`
          );
          await this.sleep(backoffMs);
          continue;
        }

        // Retry other errors with exponential backoff
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(
            `[Anthropic] Request failed, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})`
          );
          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError || new LLMError('Request failed after retries', 'anthropic');
  }

  /**
   * Convert LLMMessage array to Anthropic format
   * Anthropic requires system messages to be separate from conversation
   */
  private convertMessages(messages: LLMMessage[]): {
    systemMessage: string | undefined;
    conversationMessages: AnthropicMessage[];
  } {
    const systemMessages: string[] = [];
    const conversationMessages: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg.content);
      } else {
        conversationMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Anthropic requires conversation to start with a user message
    // If it starts with assistant, we need to handle that
    if (conversationMessages.length > 0 && conversationMessages[0].role === 'assistant') {
      // Prepend a minimal user message
      conversationMessages.unshift({
        role: 'user',
        content: '[Starting conversation]',
      });
    }

    // Ensure alternating user/assistant messages
    // Anthropic is strict about this
    const normalizedMessages = this.normalizeConversation(conversationMessages);

    return {
      systemMessage: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined,
      conversationMessages: normalizedMessages,
    };
  }

  /**
   * Normalize conversation to ensure alternating user/assistant messages
   */
  private normalizeConversation(messages: AnthropicMessage[]): AnthropicMessage[] {
    if (messages.length === 0) {
      return [];
    }

    const result: AnthropicMessage[] = [];
    let lastRole: 'user' | 'assistant' | null = null;

    for (const msg of messages) {
      if (msg.role === lastRole) {
        // Combine consecutive messages of the same role
        const lastMsg = result[result.length - 1];
        lastMsg.content = `${lastMsg.content}\n\n${msg.content}`;
      } else {
        result.push({ ...msg });
        lastRole = msg.role;
      }
    }

    return result;
  }

  /**
   * Make HTTP request to Anthropic API
   */
  private async makeRequest(body: AnthropicChatRequest): Promise<AnthropicChatResponse> {
    const url = `${this.baseUrl}/v1/messages`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': this.apiVersion,
    };

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

      return await response.json() as AnthropicChatResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new LLMError('Request timed out', 'anthropic', 'TIMEOUT', undefined, true);
      }

      throw new LLMError(
        `Network error: ${(error as Error).message}`,
        'anthropic',
        'NETWORK_ERROR',
        undefined,
        true
      );
    }
  }

  /**
   * Handle error responses from Anthropic API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorBody: AnthropicErrorResponse | null = null;

    try {
      errorBody = await response.json() as AnthropicErrorResponse;
    } catch {
      // Ignore JSON parse errors
    }

    const errorMessage = errorBody?.error?.message || response.statusText || 'Unknown error';
    const errorType = errorBody?.error?.type || 'unknown_error';

    switch (response.status) {
      case 401:
        throw new LLMAuthError(`Authentication failed: ${errorMessage}`, 'anthropic');

      case 429: {
        // Parse retry-after header if present
        const retryAfter = response.headers.get('retry-after');
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
        throw new LLMRateLimitError(`Rate limit exceeded: ${errorMessage}`, 'anthropic', retryAfterMs);
      }

      case 400:
        throw new LLMError(
          `Bad request: ${errorMessage}`,
          'anthropic',
          errorType,
          400,
          false
        );

      case 500:
      case 502:
      case 503:
        throw new LLMError(
          `Server error: ${errorMessage}`,
          'anthropic',
          'server_error',
          response.status,
          true
        );

      default:
        throw new LLMError(
          `API error (${response.status}): ${errorMessage}`,
          'anthropic',
          errorType,
          response.status,
          response.status >= 500
        );
    }
  }

  /**
   * Parse Anthropic response into LLMResponse format
   */
  private parseResponse(response: AnthropicChatResponse, durationMs: number): LLMResponse {
    // Extract text content from response
    const textContent = response.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    const usage: LLMUsage = {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };

    return {
      content: textContent,
      usage,
      model: response.model,
      provider: 'anthropic',
      durationMs,
      finishReason: response.stop_reason || undefined,
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
 * Create an Anthropic client instance
 */
export function createAnthropicClient(config: LLMConfig): LLMClient {
  return new AnthropicClient(config);
}
