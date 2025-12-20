/**
 * IntentVision TypeScript SDK Client
 *
 * Phase 19: Developer Experience - OpenAPI, SDK, and Sandbox Keys
 *
 * Main client for interacting with the IntentVision API.
 */

import type {
  IngestEventParams,
  IngestEventResponse,
  GetForecastOptions,
  ForecastResponse,
  RunForecastParams,
  RunForecastResponse,
  CreateAlertParams,
  UpdateAlertParams,
  AlertRule,
  Metric,
  TimeseriesOptions,
  TimeseriesData,
  Organization,
  ApiError,
} from './types.js';
import { IntentVisionError } from './types.js';

export interface IntentVisionClientConfig {
  /** IntentVision API key (iv_...) */
  apiKey: string;
  /** Base URL for the API (default: https://api.intentvision.com) */
  baseUrl?: string;
  /** Use sandbox mode (default: false) */
  sandbox?: boolean;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * IntentVision API Client
 *
 * @example
 * ```typescript
 * const client = new IntentVisionClient({
 *   apiKey: process.env.INTENTVISION_API_KEY!,
 * });
 *
 * // Ingest data
 * await client.ingestEvent({
 *   source: 'stripe',
 *   metric: 'mrr',
 *   value: 125000,
 *   timestamp: new Date().toISOString(),
 * });
 *
 * // Get forecast
 * const forecast = await client.getForecast('mrr', { horizonDays: 30 });
 * ```
 */
export class IntentVisionClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: IntentVisionClientConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    if (!config.apiKey.startsWith('iv_')) {
      throw new Error('Invalid API key format. Keys must start with "iv_"');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.intentvision.com';
    this.timeout = config.timeout || 30000;
  }

  // ===========================================================================
  // Private HTTP Methods
  // ===========================================================================

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': '@intentvision/sdk/0.1.0',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      if (!response.ok) {
        if (isJson) {
          const errorData = (await response.json()) as ApiError;
          throw new IntentVisionError(
            errorData.error || 'Request failed',
            errorData.code || 'UNKNOWN_ERROR',
            response.status,
            errorData.details,
            errorData.requestId
          );
        } else {
          throw new IntentVisionError(
            `HTTP ${response.status}: ${response.statusText}`,
            'HTTP_ERROR',
            response.status
          );
        }
      }

      // Return parsed JSON or empty object for 204 responses
      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof IntentVisionError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new IntentVisionError(
          'Request timeout',
          'TIMEOUT_ERROR',
          408
        );
      }

      throw new IntentVisionError(
        (error as Error).message || 'Request failed',
        'NETWORK_ERROR',
        0
      );
    }
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  private async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  // ===========================================================================
  // Events API
  // ===========================================================================

  /**
   * Ingest a single event data point
   *
   * @param event - Event data to ingest
   * @returns Ingest response with event ID
   *
   * @example
   * ```typescript
   * await client.ingestEvent({
   *   source: 'stripe',
   *   metric: 'mrr',
   *   value: 125000,
   *   timestamp: new Date().toISOString(),
   *   dimensions: { plan: 'growth' },
   * });
   * ```
   */
  async ingestEvent(event: IngestEventParams): Promise<IngestEventResponse> {
    return this.post<IngestEventResponse>('/v1/events', event);
  }

  // ===========================================================================
  // Forecasts API
  // ===========================================================================

  /**
   * Get forecast for a metric
   *
   * @param metricName - Name of the metric
   * @param options - Forecast options (horizon, date range)
   * @returns Forecast data with predictions
   *
   * @example
   * ```typescript
   * const forecast = await client.getForecast('mrr', {
   *   horizonDays: 30,
   * });
   *
   * console.log(forecast.points);
   * ```
   */
  async getForecast(
    metricName: string,
    options?: GetForecastOptions
  ): Promise<ForecastResponse> {
    const params = new URLSearchParams();
    if (options?.horizonDays) {
      params.set('horizonDays', options.horizonDays.toString());
    }
    if (options?.from) {
      params.set('from', options.from);
    }
    if (options?.to) {
      params.set('to', options.to);
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get<ForecastResponse>(
      `/v1/metrics/${encodeURIComponent(metricName)}/forecasts${query}`
    );
  }

  /**
   * Run forecast for a metric
   *
   * @param params - Forecast parameters
   * @returns Forecast run response with forecast ID
   *
   * @example
   * ```typescript
   * const result = await client.runForecast({
   *   metricName: 'mrr',
   *   horizonDays: 30,
   *   backend: 'statistical',
   * });
   *
   * console.log(`Forecast ID: ${result.forecastId}`);
   * ```
   */
  async runForecast(params: RunForecastParams): Promise<RunForecastResponse> {
    return this.post<RunForecastResponse>('/v1/forecast/run', params);
  }

  // ===========================================================================
  // Alerts API
  // ===========================================================================

  /**
   * List all alert rules
   *
   * @returns List of alert rules
   *
   * @example
   * ```typescript
   * const alerts = await client.listAlerts();
   * console.log(`Total alerts: ${alerts.length}`);
   * ```
   */
  async listAlerts(): Promise<AlertRule[]> {
    const response = await this.get<{ alerts: AlertRule[] }>('/v1/alerts');
    return response.alerts;
  }

  /**
   * Get a specific alert rule
   *
   * @param id - Alert rule ID
   * @returns Alert rule
   */
  async getAlert(id: string): Promise<AlertRule> {
    const response = await this.get<{ alert: AlertRule }>(
      `/v1/alerts/${encodeURIComponent(id)}`
    );
    return response.alert;
  }

  /**
   * Create a new alert rule
   *
   * @param params - Alert rule parameters
   * @returns Created alert rule
   *
   * @example
   * ```typescript
   * const alert = await client.createAlert({
   *   name: 'MRR Below Target',
   *   metricName: 'mrr',
   *   condition: { operator: 'lt', value: 100000 },
   *   horizonDays: 7,
   *   channels: [
   *     { type: 'email', to: ['team@company.com'], enabled: true },
   *   ],
   *   enabled: true,
   * });
   * ```
   */
  async createAlert(params: CreateAlertParams): Promise<AlertRule> {
    const response = await this.post<{ alert: AlertRule }>('/v1/alerts', params);
    return response.alert;
  }

  /**
   * Update an existing alert rule
   *
   * @param id - Alert rule ID
   * @param params - Updated alert parameters
   * @returns Updated alert rule
   *
   * @example
   * ```typescript
   * const alert = await client.updateAlert('alert_abc123', {
   *   enabled: false,
   * });
   * ```
   */
  async updateAlert(id: string, params: UpdateAlertParams): Promise<AlertRule> {
    const response = await this.patch<{ alert: AlertRule }>(
      `/v1/alerts/${encodeURIComponent(id)}`,
      params
    );
    return response.alert;
  }

  /**
   * Delete an alert rule
   *
   * @param id - Alert rule ID
   *
   * @example
   * ```typescript
   * await client.deleteAlert('alert_abc123');
   * ```
   */
  async deleteAlert(id: string): Promise<void> {
    await this.delete<void>(`/v1/alerts/${encodeURIComponent(id)}`);
  }

  // ===========================================================================
  // Metrics API
  // ===========================================================================

  /**
   * List all metrics
   *
   * @returns List of metrics
   *
   * @example
   * ```typescript
   * const metrics = await client.listMetrics();
   * metrics.forEach(m => console.log(m.name));
   * ```
   */
  async listMetrics(): Promise<Metric[]> {
    const response = await this.get<{ metrics: Metric[] }>('/v1/metrics');
    return response.metrics;
  }

  /**
   * Get timeseries data for a metric
   *
   * @param metricName - Name of the metric
   * @param options - Query options (date range, limit)
   * @returns Timeseries data
   *
   * @example
   * ```typescript
   * const data = await client.getMetricTimeseries('mrr', {
   *   from: '2025-11-01T00:00:00Z',
   *   to: '2025-12-01T00:00:00Z',
   *   limit: 1000,
   * });
   * ```
   */
  async getMetricTimeseries(
    metricName: string,
    options?: TimeseriesOptions
  ): Promise<TimeseriesData> {
    const params = new URLSearchParams();
    if (options?.from) {
      params.set('from', options.from);
    }
    if (options?.to) {
      params.set('to', options.to);
    }
    if (options?.limit) {
      params.set('limit', options.limit.toString());
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get<TimeseriesData>(
      `/v1/metrics/${encodeURIComponent(metricName)}/timeseries${query}`
    );
  }

  // ===========================================================================
  // Organization API
  // ===========================================================================

  /**
   * Get current organization information
   *
   * @returns Organization details
   *
   * @example
   * ```typescript
   * const org = await client.getOrganization();
   * console.log(`Plan: ${org.plan}`);
   * ```
   */
  async getOrganization(): Promise<Organization> {
    return this.get<Organization>('/orgs/self');
  }
}
