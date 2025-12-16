/**
 * Nixtla API Client
 *
 * Task ID: intentvision-wgk.2
 *
 * Resilient Nixtla TimeGPT API client with:
 * - Exponential backoff retry (3 retries, 1s base delay)
 * - Circuit breaker pattern (5 failures = open for 30s)
 * - Request timeout: 30 seconds
 * - Health check endpoint ping
 */

// =============================================================================
// Types
// =============================================================================

export interface NixtlaClientConfig {
  /** API key for Nixtla */
  apiKey: string;
  /** Base URL for Nixtla API */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  maxRetries?: number;
  /** Base delay for exponential backoff (ms) */
  baseDelayMs?: number;
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold?: number;
  /** Circuit breaker open duration (ms) */
  circuitBreakerResetMs?: number;
}

export interface NixtlaForecastRequest {
  /** Time series data */
  timeseries: Array<{ timestamp: string; value: number }>;
  /** Forecast horizon */
  horizon: number;
  /** Frequency (e.g., '1h', '1d') */
  frequency: string;
  /** Confidence levels for prediction intervals */
  confidenceLevels?: number[];
}

export interface NixtlaForecastResponse {
  /** Forecast predictions */
  predictions: Array<{
    timestamp: string;
    value: number;
    intervals?: Record<string, { lower: number; upper: number }>;
  }>;
  /** Model information */
  modelInfo?: Record<string, unknown>;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

// =============================================================================
// Circuit Breaker
// =============================================================================

class CircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;

  constructor(
    private threshold: number,
    private resetMs: number
  ) {}

  /**
   * Check if request should be allowed
   */
  canAttempt(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (this.nextAttemptTime && new Date() >= this.nextAttemptTime) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }

    // half-open state allows one attempt
    return true;
  }

  /**
   * Record successful request
   */
  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }

  /**
   * Record failed request
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      this.nextAttemptTime = new Date(Date.now() + this.resetMs);
    } else if (this.state === 'half-open') {
      // Failed during half-open, go back to open
      this.state = 'open';
      this.nextAttemptTime = new Date(Date.now() + this.resetMs);
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }
}

// =============================================================================
// Nixtla Client
// =============================================================================

export class NixtlaClient {
  private config: Required<NixtlaClientConfig>;
  private circuitBreaker: CircuitBreaker;

  constructor(config: NixtlaClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://api.nixtla.io',
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      baseDelayMs: config.baseDelayMs ?? 1000,
      circuitBreakerThreshold: config.circuitBreakerThreshold ?? 5,
      circuitBreakerResetMs: config.circuitBreakerResetMs ?? 30000,
    };

    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerResetMs
    );
  }

  /**
   * Generate forecast using TimeGPT
   */
  async forecast(
    request: NixtlaForecastRequest
  ): Promise<NixtlaForecastResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.makeRequest('/forecast', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      return response as NixtlaForecastResponse;
    });
  }

  /**
   * Detect anomalies using TimeGPT
   */
  async detectAnomalies(data: {
    timeseries: Array<{ timestamp: string; value: number }>;
  }): Promise<{ anomalies: Array<{ timestamp: string; score: number; isAnomaly: boolean }> }> {
    return this.executeWithRetry(async () => {
      const response = await this.makeRequest('/anomalies', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      return response as { anomalies: Array<{ timestamp: string; score: number; isAnomaly: boolean }> };
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try a simple ping or status endpoint
      await this.makeRequest('/health', {
        method: 'GET',
        timeout: 5000, // Shorter timeout for health check
      });
      return true;
    } catch (error) {
      console.error('Nixtla health check failed:', error);
      return false;
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    // Check circuit breaker
    if (!this.circuitBreaker.canAttempt()) {
      const state = this.circuitBreaker.getState();
      throw new Error(
        `Circuit breaker is open. Next attempt at ${state.nextAttemptTime?.toISOString()}`
      );
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await operation();
        this.circuitBreaker.recordSuccess();
        return result;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx)
        if (this.isClientError(error)) {
          this.circuitBreaker.recordFailure();
          throw error;
        }

        // Last attempt, don't delay
        if (attempt === this.config.maxRetries) {
          this.circuitBreaker.recordFailure();
          break;
        }

        // Calculate backoff delay: baseDelay * 2^attempt
        const delayMs = this.config.baseDelayMs * Math.pow(2, attempt);
        console.log(
          `Nixtla request failed (attempt ${attempt + 1}/${this.config.maxRetries + 1}), retrying in ${delayMs}ms...`
        );

        await this.delay(delayMs);
      }
    }

    throw new Error(
      `Nixtla request failed after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Make HTTP request to Nixtla API
   */
  private async makeRequest(
    path: string,
    options: {
      method: string;
      body?: string;
      timeout?: number;
    }
  ): Promise<unknown> {
    const url = `${this.config.baseUrl}${path}`;
    const timeout = options.timeout ?? this.config.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: options.body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Nixtla API error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if error is a client error (4xx)
   */
  private isClientError(error: unknown): boolean {
    const message = (error as Error).message;
    return /\b4\d{2}\b/.test(message); // Match 4xx status codes
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory
// =============================================================================

let _client: NixtlaClient | null = null;

/**
 * Get or create the global Nixtla client
 */
export function getNixtlaClient(config?: NixtlaClientConfig): NixtlaClient {
  if (!_client) {
    if (!config) {
      const apiKey = process.env.NIXTLA_API_KEY || '';
      if (!apiKey) {
        throw new Error('NIXTLA_API_KEY environment variable is required');
      }
      config = { apiKey };
    }
    _client = new NixtlaClient(config);
  }
  return _client;
}

/**
 * Reset the global client (for testing)
 */
export function resetNixtlaClient(): void {
  _client = null;
}
