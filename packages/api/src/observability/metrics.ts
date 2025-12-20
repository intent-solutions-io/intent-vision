/**
 * Metrics Collector
 *
 * Phase 20: Load/Resilience Testing and Production Readiness Review
 *
 * Simple in-memory metrics collector for observability.
 * Tracks request latencies, error rates, and throughput.
 *
 * Note: This is a lightweight implementation for development and testing.
 * In production, consider exporting to Cloud Monitoring or Prometheus.
 */

// =============================================================================
// Types
// =============================================================================

export interface RequestMetric {
  path: string;
  method: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
}

export interface ForecastMetric {
  backend: string;
  durationMs: number;
  success: boolean;
  timestamp: number;
}

export interface AlertMetric {
  delivered: boolean;
  timestamp: number;
}

export interface LatencyStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface MetricsSummary {
  /** Time window start (timestamp) */
  windowStart: number;
  /** Time window end (timestamp) */
  windowEnd: number;
  /** Total requests in window */
  totalRequests: number;
  /** Successful requests (2xx, 3xx) */
  successfulRequests: number;
  /** Client errors (4xx) */
  clientErrors: number;
  /** Server errors (5xx) */
  serverErrors: number;
  /** Error rate (5xx / total) as percentage */
  errorRate: number;
  /** Requests per second */
  requestsPerSecond: number;
  /** Latency statistics */
  latency: LatencyStats;
  /** Breakdown by path */
  pathBreakdown: Record<string, { count: number; avgDurationMs: number }>;
  /** Forecast backend performance */
  forecastBackends: Record<string, { count: number; successRate: number; avgDurationMs: number }>;
  /** Alert delivery rate */
  alertDeliveryRate: number;
}

// =============================================================================
// Metrics Collector Class
// =============================================================================

/**
 * In-memory metrics collector with rolling window support
 */
class MetricsCollector {
  private requests: RequestMetric[] = [];
  private forecasts: ForecastMetric[] = [];
  private alerts: AlertMetric[] = [];

  /** Maximum metrics to retain (prevents memory growth) */
  private readonly maxRetention = 10000;

  /** Default window size in ms (1 minute) */
  private readonly defaultWindowMs = 60000;

  // ===========================================================================
  // Recording Methods
  // ===========================================================================

  /**
   * Record an HTTP request
   */
  recordRequest(
    path: string,
    method: string,
    statusCode: number,
    durationMs: number
  ): void {
    this.requests.push({
      path: this.normalizePath(path),
      method,
      statusCode,
      durationMs,
      timestamp: Date.now(),
    });

    this.trimIfNeeded();
  }

  /**
   * Record a forecast operation
   */
  recordForecast(backend: string, durationMs: number, success: boolean): void {
    this.forecasts.push({
      backend,
      durationMs,
      success,
      timestamp: Date.now(),
    });

    this.trimIfNeeded();
  }

  /**
   * Record an alert delivery attempt
   */
  recordAlert(delivered: boolean): void {
    this.alerts.push({
      delivered,
      timestamp: Date.now(),
    });

    this.trimIfNeeded();
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get metrics summary for a time window
   */
  getMetrics(windowMs: number = this.defaultWindowMs): MetricsSummary {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Filter to window
    const windowRequests = this.requests.filter((r) => r.timestamp >= windowStart);
    const windowForecasts = this.forecasts.filter((f) => f.timestamp >= windowStart);
    const windowAlerts = this.alerts.filter((a) => a.timestamp >= windowStart);

    // Calculate request stats
    const totalRequests = windowRequests.length;
    const successfulRequests = windowRequests.filter(
      (r) => r.statusCode >= 200 && r.statusCode < 400
    ).length;
    const clientErrors = windowRequests.filter(
      (r) => r.statusCode >= 400 && r.statusCode < 500
    ).length;
    const serverErrors = windowRequests.filter((r) => r.statusCode >= 500).length;
    const errorRate = totalRequests > 0 ? (serverErrors / totalRequests) * 100 : 0;
    const requestsPerSecond = totalRequests / (windowMs / 1000);

    // Calculate latency stats
    const latencies = windowRequests.map((r) => r.durationMs);
    const latency = this.calculateLatencyStats(latencies);

    // Path breakdown
    const pathBreakdown = this.calculatePathBreakdown(windowRequests);

    // Forecast backend performance
    const forecastBackends = this.calculateForecastStats(windowForecasts);

    // Alert delivery rate
    const alertDeliveryRate =
      windowAlerts.length > 0
        ? (windowAlerts.filter((a) => a.delivered).length / windowAlerts.length) * 100
        : 100;

    return {
      windowStart,
      windowEnd: now,
      totalRequests,
      successfulRequests,
      clientErrors,
      serverErrors,
      errorRate: Math.round(errorRate * 100) / 100,
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      latency,
      pathBreakdown,
      forecastBackends,
      alertDeliveryRate: Math.round(alertDeliveryRate * 100) / 100,
    };
  }

  /**
   * Get raw request count for last N seconds
   */
  getRequestCountLastNSeconds(seconds: number): number {
    const cutoff = Date.now() - seconds * 1000;
    return this.requests.filter((r) => r.timestamp >= cutoff).length;
  }

  /**
   * Get error count for last N seconds
   */
  getErrorCountLastNSeconds(seconds: number): number {
    const cutoff = Date.now() - seconds * 1000;
    return this.requests.filter((r) => r.timestamp >= cutoff && r.statusCode >= 500).length;
  }

  /**
   * Get average latency for last N seconds
   */
  getAvgLatencyLastNSeconds(seconds: number): number {
    const cutoff = Date.now() - seconds * 1000;
    const recent = this.requests.filter((r) => r.timestamp >= cutoff);
    if (recent.length === 0) return 0;
    const sum = recent.reduce((acc, r) => acc + r.durationMs, 0);
    return Math.round(sum / recent.length);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.requests = [];
    this.forecasts = [];
    this.alerts = [];
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Normalize path for grouping (replace IDs with placeholders)
   */
  private normalizePath(path: string): string {
    return path
      .replace(/\/[a-f0-9-]{36}/gi, '/:id') // UUIDs
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\/[a-z0-9]{20,}/gi, '/:id'); // Long alphanumeric IDs
  }

  /**
   * Calculate latency percentiles
   */
  private calculateLatencyStats(latencies: number[]): LatencyStats {
    if (latencies.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: Math.round(sum / count),
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate path breakdown
   */
  private calculatePathBreakdown(
    requests: RequestMetric[]
  ): Record<string, { count: number; avgDurationMs: number }> {
    const breakdown: Record<string, { count: number; totalMs: number }> = {};

    for (const req of requests) {
      if (!breakdown[req.path]) {
        breakdown[req.path] = { count: 0, totalMs: 0 };
      }
      breakdown[req.path].count++;
      breakdown[req.path].totalMs += req.durationMs;
    }

    const result: Record<string, { count: number; avgDurationMs: number }> = {};
    for (const [path, data] of Object.entries(breakdown)) {
      result[path] = {
        count: data.count,
        avgDurationMs: Math.round(data.totalMs / data.count),
      };
    }

    return result;
  }

  /**
   * Calculate forecast backend stats
   */
  private calculateForecastStats(
    forecasts: ForecastMetric[]
  ): Record<string, { count: number; successRate: number; avgDurationMs: number }> {
    const byBackend: Record<string, ForecastMetric[]> = {};

    for (const f of forecasts) {
      if (!byBackend[f.backend]) {
        byBackend[f.backend] = [];
      }
      byBackend[f.backend].push(f);
    }

    const result: Record<string, { count: number; successRate: number; avgDurationMs: number }> = {};
    for (const [backend, items] of Object.entries(byBackend)) {
      const successCount = items.filter((i) => i.success).length;
      const totalMs = items.reduce((acc, i) => acc + i.durationMs, 0);
      result[backend] = {
        count: items.length,
        successRate: Math.round((successCount / items.length) * 100 * 100) / 100,
        avgDurationMs: Math.round(totalMs / items.length),
      };
    }

    return result;
  }

  /**
   * Trim old metrics to prevent memory growth
   */
  private trimIfNeeded(): void {
    if (this.requests.length > this.maxRetention) {
      this.requests = this.requests.slice(-this.maxRetention);
    }
    if (this.forecasts.length > this.maxRetention) {
      this.forecasts = this.forecasts.slice(-this.maxRetention);
    }
    if (this.alerts.length > this.maxRetention) {
      this.alerts = this.alerts.slice(-this.maxRetention);
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Global metrics collector instance
 */
export const metrics = new MetricsCollector();

// =============================================================================
// Default Export
// =============================================================================

export default metrics;
