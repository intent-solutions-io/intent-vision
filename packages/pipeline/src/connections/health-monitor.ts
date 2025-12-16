/**
 * Health Monitor
 *
 * Task ID: intentvision-wgk.4
 *
 * Tracks health of all external connections with:
 * - Registration of health checkers
 * - Parallel health check execution
 * - Status tracking: healthy, degraded, unhealthy
 * - Last check timestamps
 * - Aggregated health reports
 */

// =============================================================================
// Types
// =============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  /** Connection name */
  name: string;
  /** Health status */
  status: HealthStatus;
  /** Whether the check passed */
  healthy: boolean;
  /** When the check was performed */
  timestamp: Date;
  /** How long the check took (ms) */
  latencyMs: number;
  /** Error message if unhealthy */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface HealthReport {
  /** Overall system health status */
  status: HealthStatus;
  /** When the report was generated */
  timestamp: Date;
  /** Total check duration (ms) */
  durationMs: number;
  /** Results for each connection */
  checks: HealthCheckResult[];
  /** Summary counts */
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export type HealthChecker = () => Promise<boolean>;

export interface RegisteredChecker {
  name: string;
  checker: HealthChecker;
  lastCheck?: HealthCheckResult;
  /** Whether this check is critical (affects overall status) */
  critical?: boolean;
}

// =============================================================================
// Health Monitor
// =============================================================================

export class HealthMonitor {
  private checkers = new Map<string, RegisteredChecker>();
  private checkHistory: HealthCheckResult[] = [];
  private maxHistorySize = 100;

  /**
   * Register a health checker
   *
   * @param name - Unique name for the connection
   * @param checker - Async function that returns true if healthy
   * @param critical - Whether this check is critical (default: true)
   */
  register(
    name: string,
    checker: HealthChecker,
    critical: boolean = true
  ): void {
    if (this.checkers.has(name)) {
      console.warn(`Health checker '${name}' already registered, replacing`);
    }

    this.checkers.set(name, {
      name,
      checker,
      critical,
    });
  }

  /**
   * Unregister a health checker
   */
  unregister(name: string): boolean {
    return this.checkers.delete(name);
  }

  /**
   * Check health of a specific connection
   */
  async check(name: string): Promise<HealthCheckResult> {
    const registered = this.checkers.get(name);
    if (!registered) {
      throw new Error(`Health checker '${name}' not registered`);
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      const healthy = await registered.checker();
      const latencyMs = Date.now() - startTime;

      result = {
        name,
        status: healthy ? 'healthy' : 'unhealthy',
        healthy,
        timestamp: new Date(),
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      result = {
        name,
        status: 'unhealthy',
        healthy: false,
        timestamp: new Date(),
        latencyMs,
        error: (error as Error).message,
      };
    }

    // Update last check
    registered.lastCheck = result;

    // Add to history
    this.addToHistory(result);

    return result;
  }

  /**
   * Check health of all registered connections
   */
  async checkAll(): Promise<HealthReport> {
    const startTime = Date.now();
    const checkPromises: Promise<HealthCheckResult>[] = [];

    // Execute all health checks in parallel
    for (const name of this.checkers.keys()) {
      checkPromises.push(this.check(name));
    }

    const checks = await Promise.all(checkPromises);
    const durationMs = Date.now() - startTime;

    // Calculate summary
    const summary = {
      total: checks.length,
      healthy: checks.filter((c) => c.status === 'healthy').length,
      degraded: checks.filter((c) => c.status === 'degraded').length,
      unhealthy: checks.filter((c) => c.status === 'unhealthy').length,
    };

    // Determine overall status
    const status = this.calculateOverallStatus(checks);

    return {
      status,
      timestamp: new Date(),
      durationMs,
      checks,
      summary,
    };
  }

  /**
   * Get the last check result for a connection
   */
  getLastCheck(name: string): HealthCheckResult | undefined {
    return this.checkers.get(name)?.lastCheck;
  }

  /**
   * Get all last check results
   */
  getLastChecks(): HealthCheckResult[] {
    const results: HealthCheckResult[] = [];
    for (const registered of this.checkers.values()) {
      if (registered.lastCheck) {
        results.push(registered.lastCheck);
      }
    }
    return results;
  }

  /**
   * Get check history
   */
  getHistory(name?: string): HealthCheckResult[] {
    if (name) {
      return this.checkHistory.filter((r) => r.name === name);
    }
    return [...this.checkHistory];
  }

  /**
   * List all registered checkers
   */
  listCheckers(): string[] {
    return Array.from(this.checkers.keys());
  }

  /**
   * Clear all checkers and history
   */
  clear(): void {
    this.checkers.clear();
    this.checkHistory = [];
  }

  /**
   * Get statistics for a connection
   */
  getStats(name: string): {
    name: string;
    totalChecks: number;
    successRate: number;
    avgLatencyMs: number;
    lastCheck?: HealthCheckResult;
  } | null {
    const history = this.getHistory(name);
    if (history.length === 0) {
      return null;
    }

    const successCount = history.filter((r) => r.healthy).length;
    const successRate = successCount / history.length;
    const avgLatencyMs =
      history.reduce((sum, r) => sum + r.latencyMs, 0) / history.length;

    return {
      name,
      totalChecks: history.length,
      successRate,
      avgLatencyMs,
      lastCheck: this.getLastCheck(name),
    };
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Calculate overall system health status
   */
  private calculateOverallStatus(checks: HealthCheckResult[]): HealthStatus {
    if (checks.length === 0) {
      return 'healthy';
    }

    // Get critical checks
    const criticalChecks = checks.filter((check) => {
      const registered = this.checkers.get(check.name);
      return registered?.critical !== false;
    });

    // If any critical check is unhealthy, overall is unhealthy
    const hasUnhealthyCritical = criticalChecks.some(
      (c) => c.status === 'unhealthy'
    );
    if (hasUnhealthyCritical) {
      return 'unhealthy';
    }

    // If any non-critical check is unhealthy, overall is degraded
    const hasUnhealthyNonCritical = checks.some(
      (c) => c.status === 'unhealthy' && !criticalChecks.includes(c)
    );
    if (hasUnhealthyNonCritical) {
      return 'degraded';
    }

    // If any check is degraded, overall is degraded
    const hasDegraded = checks.some((c) => c.status === 'degraded');
    if (hasDegraded) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Add check result to history
   */
  private addToHistory(result: HealthCheckResult): void {
    this.checkHistory.push(result);

    // Trim history if too large
    if (this.checkHistory.length > this.maxHistorySize) {
      this.checkHistory = this.checkHistory.slice(-this.maxHistorySize);
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

let _monitor: HealthMonitor | null = null;

/**
 * Get or create the global health monitor
 */
export function getHealthMonitor(): HealthMonitor {
  if (!_monitor) {
    _monitor = new HealthMonitor();
  }
  return _monitor;
}

/**
 * Reset the global health monitor (for testing)
 */
export function resetHealthMonitor(): void {
  _monitor = null;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Register a health checker on the global monitor
 */
export function registerHealthCheck(
  name: string,
  checker: HealthChecker,
  critical?: boolean
): void {
  const monitor = getHealthMonitor();
  monitor.register(name, checker, critical);
}

/**
 * Check all registered health checkers
 */
export async function checkAllHealth(): Promise<HealthReport> {
  const monitor = getHealthMonitor();
  return monitor.checkAll();
}

/**
 * Check a specific health checker
 */
export async function checkHealth(name: string): Promise<HealthCheckResult> {
  const monitor = getHealthMonitor();
  return monitor.check(name);
}
