/**
 * Backend Registry
 *
 * Task ID: intentvision-8fa.4
 *
 * Centralized registry for forecast and anomaly detection backends.
 * Supports runtime selection, configuration, and health monitoring.
 */

import type {
  ForecastBackend,
  ForecastBackendType,
  AnomalyDetector,
  AnomalyDetectionMethod,
} from '../../../contracts/src/index.js';

import { StubForecastBackend } from '../forecast/forecast-stub.js';
import { StatisticalForecastBackend } from '../forecast/statistical-forecast.js';
import { StubAnomalyDetector } from '../anomaly/anomaly-stub.js';
import { EnsembleAnomalyDetector } from '../anomaly/ensemble-detector.js';

// =============================================================================
// Types
// =============================================================================

export interface BackendConfig {
  /** Backend identifier */
  id: string;
  /** Whether this is the default backend */
  isDefault?: boolean;
  /** Backend-specific configuration */
  config?: Record<string, unknown>;
  /** Priority for automatic selection (higher = preferred) */
  priority?: number;
}

export interface HealthStatus {
  backendId: string;
  healthy: boolean;
  lastCheck: Date;
  latencyMs?: number;
  error?: string;
}

// =============================================================================
// Forecast Backend Registry
// =============================================================================

export class ForecastBackendRegistry {
  private backends = new Map<string, ForecastBackend>();
  private configs = new Map<string, BackendConfig>();
  private healthStatus = new Map<string, HealthStatus>();
  private defaultBackendId: string | null = null;

  constructor() {
    // Register built-in backends
    this.register('stub', new StubForecastBackend(), {
      id: 'stub',
      priority: 0,
    });

    this.register('statistical', new StatisticalForecastBackend(), {
      id: 'statistical',
      isDefault: true,
      priority: 10,
    });
  }

  /**
   * Register a forecast backend
   */
  register(id: string, backend: ForecastBackend, config?: Partial<BackendConfig>): void {
    this.backends.set(id, backend);
    this.configs.set(id, {
      id,
      isDefault: config?.isDefault ?? false,
      config: config?.config,
      priority: config?.priority ?? 5,
    });

    if (config?.isDefault) {
      this.defaultBackendId = id;
    }
  }

  /**
   * Get a backend by ID
   */
  get(id: string): ForecastBackend | undefined {
    return this.backends.get(id);
  }

  /**
   * Get the default backend
   */
  getDefault(): ForecastBackend {
    if (this.defaultBackendId) {
      const backend = this.backends.get(this.defaultBackendId);
      if (backend) return backend;
    }

    // Fall back to highest priority healthy backend
    const sorted = this.listHealthy().sort(
      (a, b) => (this.configs.get(b)?.priority ?? 0) - (this.configs.get(a)?.priority ?? 0)
    );

    if (sorted.length > 0) {
      const backend = this.backends.get(sorted[0]);
      if (backend) return backend;
    }

    // Ultimate fallback to stub
    return this.backends.get('stub') || new StubForecastBackend();
  }

  /**
   * List all registered backend IDs
   */
  list(): string[] {
    return Array.from(this.backends.keys());
  }

  /**
   * List healthy backends
   */
  listHealthy(): string[] {
    return this.list().filter((id) => {
      const status = this.healthStatus.get(id);
      return !status || status.healthy;
    });
  }

  /**
   * Check health of all backends
   */
  async checkHealth(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();

    for (const [id, backend] of this.backends) {
      const startTime = Date.now();
      try {
        const healthy = await backend.healthCheck();
        const status: HealthStatus = {
          backendId: id,
          healthy,
          lastCheck: new Date(),
          latencyMs: Date.now() - startTime,
        };
        this.healthStatus.set(id, status);
        results.set(id, status);
      } catch (error) {
        const status: HealthStatus = {
          backendId: id,
          healthy: false,
          lastCheck: new Date(),
          latencyMs: Date.now() - startTime,
          error: (error as Error).message,
        };
        this.healthStatus.set(id, status);
        results.set(id, status);
      }
    }

    return results;
  }

  /**
   * Get health status for a backend
   */
  getHealthStatus(id: string): HealthStatus | undefined {
    return this.healthStatus.get(id);
  }

  /**
   * Set the default backend
   */
  setDefault(id: string): void {
    if (!this.backends.has(id)) {
      throw new Error(`Backend '${id}' not registered`);
    }
    this.defaultBackendId = id;

    // Update configs
    for (const [backendId, config] of this.configs) {
      config.isDefault = backendId === id;
    }
  }

  /**
   * Get capabilities of all backends
   */
  getCapabilities(): Map<string, ReturnType<ForecastBackend['capabilities']>> {
    const result = new Map();
    for (const [id, backend] of this.backends) {
      result.set(id, backend.capabilities());
    }
    return result;
  }
}

// =============================================================================
// Anomaly Detector Registry
// =============================================================================

export class AnomalyDetectorRegistry {
  private detectors = new Map<string, AnomalyDetector>();
  private configs = new Map<string, BackendConfig>();
  private healthStatus = new Map<string, HealthStatus>();
  private defaultDetectorId: string | null = null;

  constructor() {
    // Register built-in detectors
    this.register('statistical', new StubAnomalyDetector(), {
      id: 'statistical',
      priority: 5,
    });

    this.register('ensemble', new EnsembleAnomalyDetector(), {
      id: 'ensemble',
      isDefault: true,
      priority: 10,
    });
  }

  /**
   * Register an anomaly detector
   */
  register(id: string, detector: AnomalyDetector, config?: Partial<BackendConfig>): void {
    this.detectors.set(id, detector);
    this.configs.set(id, {
      id,
      isDefault: config?.isDefault ?? false,
      config: config?.config,
      priority: config?.priority ?? 5,
    });

    if (config?.isDefault) {
      this.defaultDetectorId = id;
    }
  }

  /**
   * Get a detector by ID
   */
  get(id: string): AnomalyDetector | undefined {
    return this.detectors.get(id);
  }

  /**
   * Get the default detector
   */
  getDefault(): AnomalyDetector {
    if (this.defaultDetectorId) {
      const detector = this.detectors.get(this.defaultDetectorId);
      if (detector) return detector;
    }

    // Fall back to highest priority healthy detector
    const sorted = this.listHealthy().sort(
      (a, b) => (this.configs.get(b)?.priority ?? 0) - (this.configs.get(a)?.priority ?? 0)
    );

    if (sorted.length > 0) {
      const detector = this.detectors.get(sorted[0]);
      if (detector) return detector;
    }

    // Ultimate fallback to statistical
    return this.detectors.get('statistical') || new StubAnomalyDetector();
  }

  /**
   * List all registered detector IDs
   */
  list(): string[] {
    return Array.from(this.detectors.keys());
  }

  /**
   * List healthy detectors
   */
  listHealthy(): string[] {
    return this.list().filter((id) => {
      const status = this.healthStatus.get(id);
      return !status || status.healthy;
    });
  }

  /**
   * Check health of all detectors
   */
  async checkHealth(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();

    for (const [id, detector] of this.detectors) {
      const startTime = Date.now();
      try {
        const healthy = await detector.healthCheck();
        const status: HealthStatus = {
          backendId: id,
          healthy,
          lastCheck: new Date(),
          latencyMs: Date.now() - startTime,
        };
        this.healthStatus.set(id, status);
        results.set(id, status);
      } catch (error) {
        const status: HealthStatus = {
          backendId: id,
          healthy: false,
          lastCheck: new Date(),
          latencyMs: Date.now() - startTime,
          error: (error as Error).message,
        };
        this.healthStatus.set(id, status);
        results.set(id, status);
      }
    }

    return results;
  }

  /**
   * Get health status for a detector
   */
  getHealthStatus(id: string): HealthStatus | undefined {
    return this.healthStatus.get(id);
  }

  /**
   * Set the default detector
   */
  setDefault(id: string): void {
    if (!this.detectors.has(id)) {
      throw new Error(`Detector '${id}' not registered`);
    }
    this.defaultDetectorId = id;

    // Update configs
    for (const [detectorId, config] of this.configs) {
      config.isDefault = detectorId === id;
    }
  }
}

// =============================================================================
// Global Registry Instances
// =============================================================================

let forecastRegistry: ForecastBackendRegistry | null = null;
let anomalyRegistry: AnomalyDetectorRegistry | null = null;

/**
 * Get the global forecast backend registry
 */
export function getForecastRegistry(): ForecastBackendRegistry {
  if (!forecastRegistry) {
    forecastRegistry = new ForecastBackendRegistry();
  }
  return forecastRegistry;
}

/**
 * Get the global anomaly detector registry
 */
export function getAnomalyRegistry(): AnomalyDetectorRegistry {
  if (!anomalyRegistry) {
    anomalyRegistry = new AnomalyDetectorRegistry();
  }
  return anomalyRegistry;
}

/**
 * Reset registries (for testing)
 */
export function resetRegistries(): void {
  forecastRegistry = null;
  anomalyRegistry = null;
}

// =============================================================================
// Convenience Factories
// =============================================================================

/**
 * Create a forecast backend by type
 */
export function createForecastBackend(type?: string): ForecastBackend {
  const registry = getForecastRegistry();
  if (type) {
    const backend = registry.get(type);
    if (backend) return backend;
    throw new Error(`Unknown forecast backend type: ${type}`);
  }
  return registry.getDefault();
}

/**
 * Create an anomaly detector by type
 */
export function createAnomalyDetector(type?: string): AnomalyDetector {
  const registry = getAnomalyRegistry();
  if (type) {
    const detector = registry.get(type);
    if (detector) return detector;
    throw new Error(`Unknown anomaly detector type: ${type}`);
  }
  return registry.getDefault();
}
