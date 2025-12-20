/**
 * Google Gemini / Vertex AI LLM Provider
 *
 * Phase 17: Operator Assistant Agent
 *
 * Implements the LLMClient interface for Google's Generative AI APIs.
 * Supports:
 * - Google AI Studio (Gemini API) - using GOOGLE_API_KEY
 * - Vertex AI (Google Cloud) - using ADC or service account
 *
 * Environment Variables:
 * - GOOGLE_API_KEY: Google AI API key (for AI Studio)
 * - VERTEX_PROJECT_ID: GCP project ID (for Vertex AI)
 * - VERTEX_REGION: GCP region (default: us-central1)
 * - GOOGLE_CLOUD_PROJECT: Fallback for project ID
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON
 */

import type {
  LLMClient,
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMChatOptions,
  LLMUsage,
  LLMProvider,
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

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiGenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: GeminiGenerationConfig;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      role: string;
      parts: Array<{ text: string }>;
    };
    finishReason: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

interface GeminiErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
    details?: Array<Record<string, unknown>>;
  };
}

// =============================================================================
// Google AI Client Implementation (AI Studio / Gemini API)
// =============================================================================

/**
 * Google AI Studio (Gemini API) Client
 *
 * Uses the Google AI API with API key authentication.
 * Best for development and testing.
 */
export class GoogleAIClient implements LLMClient {
  readonly provider = 'google' as const;
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(config: LLMConfig) {
    // Validate API key
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new LLMConfigError(
        'Google API key is required. Set GOOGLE_API_KEY environment variable or provide apiKey in config.',
        'google'
      );
    }

    this.apiKey = apiKey;
    this.model = config.model || DEFAULT_MODELS.google;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.timeout = config.timeout || DEFAULT_CONFIG.timeout;
    this.maxRetries = config.maxRetries || DEFAULT_CONFIG.maxRetries;
  }

  /**
   * Send a chat completion request to Google AI
   */
  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const startTime = Date.now();

    // Convert messages to Gemini format
    const { systemInstruction, contents } = this.convertMessages(messages);

    // Build request body
    const requestBody: GeminiRequest = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? DEFAULT_CONFIG.temperature,
        maxOutputTokens: options?.maxTokens ?? DEFAULT_CONFIG.maxTokens,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }

    if (options?.topP !== undefined) {
      requestBody.generationConfig!.topP = options.topP;
    }

    if (options?.stop) {
      requestBody.generationConfig!.stopSequences = options.stop;
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
            `[Google AI] Rate limited, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})`
          );
          await this.sleep(backoffMs);
          continue;
        }

        // Retry other errors with exponential backoff
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(
            `[Google AI] Request failed, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})`
          );
          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError || new LLMError('Request failed after retries', 'google');
  }

  /**
   * Convert LLMMessage array to Gemini format
   */
  private convertMessages(messages: LLMMessage[]): {
    systemInstruction: { parts: Array<{ text: string }> } | undefined;
    contents: GeminiContent[];
  } {
    const systemMessages: string[] = [];
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg.content);
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Ensure conversation starts with a user message
    if (contents.length > 0 && contents[0].role === 'model') {
      contents.unshift({
        role: 'user',
        parts: [{ text: '[Starting conversation]' }],
      });
    }

    // Normalize consecutive messages of the same role
    const normalizedContents = this.normalizeContents(contents);

    return {
      systemInstruction: systemMessages.length > 0
        ? { parts: [{ text: systemMessages.join('\n\n') }] }
        : undefined,
      contents: normalizedContents,
    };
  }

  /**
   * Normalize contents to ensure alternating user/model messages
   */
  private normalizeContents(contents: GeminiContent[]): GeminiContent[] {
    if (contents.length === 0) {
      return [];
    }

    const result: GeminiContent[] = [];
    let lastRole: 'user' | 'model' | null = null;

    for (const content of contents) {
      if (content.role === lastRole) {
        // Combine consecutive messages of the same role
        const lastContent = result[result.length - 1];
        const existingText = lastContent.parts.map(p => p.text).join('\n');
        const newText = content.parts.map(p => p.text).join('\n');
        lastContent.parts = [{ text: `${existingText}\n\n${newText}` }];
      } else {
        result.push({
          role: content.role,
          parts: [...content.parts],
        });
        lastRole = content.role;
      }
    }

    return result;
  }

  /**
   * Make HTTP request to Google AI API
   */
  private async makeRequest(body: GeminiRequest): Promise<GeminiResponse> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return await response.json() as GeminiResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new LLMError('Request timed out', 'google', 'TIMEOUT', undefined, true);
      }

      throw new LLMError(
        `Network error: ${(error as Error).message}`,
        'google',
        'NETWORK_ERROR',
        undefined,
        true
      );
    }
  }

  /**
   * Handle error responses from Google AI API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorBody: GeminiErrorResponse | null = null;

    try {
      errorBody = await response.json() as GeminiErrorResponse;
    } catch {
      // Ignore JSON parse errors
    }

    const errorMessage = errorBody?.error?.message || response.statusText || 'Unknown error';
    const errorCode = errorBody?.error?.status || 'UNKNOWN';

    switch (response.status) {
      case 401:
      case 403:
        throw new LLMAuthError(`Authentication failed: ${errorMessage}`, 'google');

      case 429: {
        throw new LLMRateLimitError(`Rate limit exceeded: ${errorMessage}`, 'google');
      }

      case 400:
        throw new LLMError(
          `Bad request: ${errorMessage}`,
          'google',
          errorCode,
          400,
          false
        );

      case 500:
      case 502:
      case 503:
        throw new LLMError(
          `Server error: ${errorMessage}`,
          'google',
          'SERVER_ERROR',
          response.status,
          true
        );

      default:
        throw new LLMError(
          `API error (${response.status}): ${errorMessage}`,
          'google',
          errorCode,
          response.status,
          response.status >= 500
        );
    }
  }

  /**
   * Parse Gemini response into LLMResponse format
   */
  private parseResponse(response: GeminiResponse, durationMs: number): LLMResponse {
    const candidate = response.candidates[0];

    if (!candidate) {
      throw new LLMError('No response candidates returned', 'google', 'EMPTY_RESPONSE');
    }

    const content = candidate.content.parts
      .map(p => p.text)
      .join('');

    const usage: LLMUsage | undefined = response.usageMetadata
      ? {
          promptTokens: response.usageMetadata.promptTokenCount,
          completionTokens: response.usageMetadata.candidatesTokenCount,
          totalTokens: response.usageMetadata.totalTokenCount,
        }
      : undefined;

    return {
      content,
      usage,
      model: this.model,
      provider: 'google',
      durationMs,
      finishReason: candidate.finishReason,
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
// Vertex AI Client Implementation
// =============================================================================

/**
 * Vertex AI Client
 *
 * Uses Google Cloud's Vertex AI with ADC or service account authentication.
 * Best for production deployments on GCP.
 */
export class VertexAIClient implements LLMClient {
  readonly provider = 'vertex' as const;
  readonly model: string;

  private readonly projectId: string;
  private readonly region: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: LLMConfig) {
    // Validate project ID
    const projectId = config.projectId || process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      throw new LLMConfigError(
        'GCP project ID is required for Vertex AI. Set VERTEX_PROJECT_ID or GOOGLE_CLOUD_PROJECT environment variable.',
        'vertex'
      );
    }

    this.projectId = projectId;
    this.region = config.region || process.env.VERTEX_REGION || 'us-central1';
    this.model = config.model || DEFAULT_MODELS.vertex;
    this.timeout = config.timeout || DEFAULT_CONFIG.timeout;
    this.maxRetries = config.maxRetries || DEFAULT_CONFIG.maxRetries;
  }

  /**
   * Send a chat completion request to Vertex AI
   */
  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const startTime = Date.now();

    // Get access token
    const token = await this.getAccessToken();

    // Convert messages to Gemini format (Vertex uses same format)
    const { systemInstruction, contents } = this.convertMessages(messages);

    // Build request body
    const requestBody: GeminiRequest = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? DEFAULT_CONFIG.temperature,
        maxOutputTokens: options?.maxTokens ?? DEFAULT_CONFIG.maxTokens,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }

    if (options?.topP !== undefined) {
      requestBody.generationConfig!.topP = options.topP;
    }

    if (options?.stop) {
      requestBody.generationConfig!.stopSequences = options.stop;
    }

    // Make request with retries
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(requestBody, token);
        const durationMs = Date.now() - startTime;

        return this.parseResponse(response, durationMs);
      } catch (error) {
        lastError = error as Error;

        // Don't retry auth errors
        if (error instanceof LLMAuthError) {
          // Try refreshing token once
          if (attempt === 0) {
            this.accessToken = null;
            continue;
          }
          throw error;
        }

        // Retry rate limit errors with exponential backoff
        if (error instanceof LLMRateLimitError) {
          const backoffMs = error.retryAfterMs || Math.pow(2, attempt) * 1000;
          console.warn(
            `[Vertex AI] Rate limited, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})`
          );
          await this.sleep(backoffMs);
          continue;
        }

        // Retry other errors with exponential backoff
        if (attempt < this.maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(
            `[Vertex AI] Request failed, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})`
          );
          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError || new LLMError('Request failed after retries', 'vertex');
  }

  /**
   * Get access token for Vertex AI
   * Uses ADC (Application Default Credentials)
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    try {
      // Try to get token from metadata server (Cloud Run, GCE, etc.)
      const metadataUrl = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
      const response = await fetch(metadataUrl, {
        headers: { 'Metadata-Flavor': 'Google' },
      });

      if (response.ok) {
        const data = await response.json() as { access_token: string; expires_in: number };
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in * 1000);
        return this.accessToken;
      }
    } catch {
      // Metadata server not available (not running on GCP)
    }

    // Fallback: try gcloud CLI
    try {
      // Note: This is a stub - in production, you'd use the @google-cloud/google-auth-library
      // or ensure you're running on GCP with proper IAM roles
      throw new LLMConfigError(
        'Vertex AI requires GCP credentials. Run on Cloud Run/GCE with proper IAM roles, or set up GOOGLE_APPLICATION_CREDENTIALS.',
        'vertex'
      );
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      throw new LLMConfigError(
        `Failed to get access token: ${(error as Error).message}`,
        'vertex'
      );
    }
  }

  /**
   * Convert LLMMessage array to Gemini format (same as Google AI)
   */
  private convertMessages(messages: LLMMessage[]): {
    systemInstruction: { parts: Array<{ text: string }> } | undefined;
    contents: GeminiContent[];
  } {
    const systemMessages: string[] = [];
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg.content);
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    if (contents.length > 0 && contents[0].role === 'model') {
      contents.unshift({
        role: 'user',
        parts: [{ text: '[Starting conversation]' }],
      });
    }

    const normalizedContents = this.normalizeContents(contents);

    return {
      systemInstruction: systemMessages.length > 0
        ? { parts: [{ text: systemMessages.join('\n\n') }] }
        : undefined,
      contents: normalizedContents,
    };
  }

  /**
   * Normalize contents to ensure alternating user/model messages
   */
  private normalizeContents(contents: GeminiContent[]): GeminiContent[] {
    if (contents.length === 0) {
      return [];
    }

    const result: GeminiContent[] = [];
    let lastRole: 'user' | 'model' | null = null;

    for (const content of contents) {
      if (content.role === lastRole) {
        const lastContent = result[result.length - 1];
        const existingText = lastContent.parts.map(p => p.text).join('\n');
        const newText = content.parts.map(p => p.text).join('\n');
        lastContent.parts = [{ text: `${existingText}\n\n${newText}` }];
      } else {
        result.push({
          role: content.role,
          parts: [...content.parts],
        });
        lastRole = content.role;
      }
    }

    return result;
  }

  /**
   * Make HTTP request to Vertex AI API
   */
  private async makeRequest(body: GeminiRequest, token: string): Promise<GeminiResponse> {
    const url = `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/google/models/${this.model}:generateContent`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return await response.json() as GeminiResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new LLMError('Request timed out', 'vertex', 'TIMEOUT', undefined, true);
      }

      throw new LLMError(
        `Network error: ${(error as Error).message}`,
        'vertex',
        'NETWORK_ERROR',
        undefined,
        true
      );
    }
  }

  /**
   * Handle error responses from Vertex AI API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorBody: GeminiErrorResponse | null = null;

    try {
      errorBody = await response.json() as GeminiErrorResponse;
    } catch {
      // Ignore JSON parse errors
    }

    const errorMessage = errorBody?.error?.message || response.statusText || 'Unknown error';
    const errorCode = errorBody?.error?.status || 'UNKNOWN';

    switch (response.status) {
      case 401:
      case 403:
        throw new LLMAuthError(`Authentication failed: ${errorMessage}`, 'vertex');

      case 429:
        throw new LLMRateLimitError(`Rate limit exceeded: ${errorMessage}`, 'vertex');

      case 400:
        throw new LLMError(
          `Bad request: ${errorMessage}`,
          'vertex',
          errorCode,
          400,
          false
        );

      case 500:
      case 502:
      case 503:
        throw new LLMError(
          `Server error: ${errorMessage}`,
          'vertex',
          'SERVER_ERROR',
          response.status,
          true
        );

      default:
        throw new LLMError(
          `API error (${response.status}): ${errorMessage}`,
          'vertex',
          errorCode,
          response.status,
          response.status >= 500
        );
    }
  }

  /**
   * Parse Vertex AI response into LLMResponse format
   */
  private parseResponse(response: GeminiResponse, durationMs: number): LLMResponse {
    const candidate = response.candidates[0];

    if (!candidate) {
      throw new LLMError('No response candidates returned', 'vertex', 'EMPTY_RESPONSE');
    }

    const content = candidate.content.parts
      .map(p => p.text)
      .join('');

    const usage: LLMUsage | undefined = response.usageMetadata
      ? {
          promptTokens: response.usageMetadata.promptTokenCount,
          completionTokens: response.usageMetadata.candidatesTokenCount,
          totalTokens: response.usageMetadata.totalTokenCount,
        }
      : undefined;

    return {
      content,
      usage,
      model: this.model,
      provider: 'vertex',
      durationMs,
      finishReason: candidate.finishReason,
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
// Factory Functions
// =============================================================================

/**
 * Create a Google AI (AI Studio) client instance
 */
export function createGoogleAIClient(config: LLMConfig): LLMClient {
  return new GoogleAIClient(config);
}

/**
 * Create a Vertex AI client instance
 */
export function createVertexAIClient(config: LLMConfig): LLMClient {
  return new VertexAIClient(config);
}

/**
 * Create appropriate Google client based on configuration
 * Uses Vertex AI if project ID is set, otherwise Google AI Studio
 */
export function createGoogleClient(config: LLMConfig): LLMClient {
  const provider: LLMProvider = config.provider;

  // If explicitly Vertex, use Vertex
  if (provider === 'vertex') {
    return createVertexAIClient(config);
  }

  // If Google AI API key is available, prefer that
  if (config.apiKey || process.env.GOOGLE_API_KEY) {
    return createGoogleAIClient(config);
  }

  // Fall back to Vertex if project ID is available
  if (config.projectId || process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT) {
    return createVertexAIClient({ ...config, provider: 'vertex' });
  }

  throw new LLMConfigError(
    'No Google AI credentials found. Set GOOGLE_API_KEY for AI Studio or VERTEX_PROJECT_ID for Vertex AI.',
    'google'
  );
}
