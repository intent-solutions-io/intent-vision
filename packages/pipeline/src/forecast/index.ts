/**
 * Forecast Module - Public API
 *
 * Exports:
 * - ForecastService: Central orchestrator for forecast backends
 * - Backend implementations: Nixtla TimeGPT, Statistical, Stub
 * - Factory functions for creating backends and services
 */

// =============================================================================
// Service Orchestrator
// =============================================================================

export {
  ForecastService,
  getForecastService,
  resetForecastService,
  type ForecastServiceConfig,
  type BackendHealthStatus,
  type AnomalyDetectionResult,
} from './forecast-service.js';

// =============================================================================
// Backend Implementations
// =============================================================================

export {
  NixtlaTimeGPTBackend,
  getNixtlaBackend,
  resetNixtlaBackend,
  type NixtlaConfig,
} from './nixtla-timegpt.js';

export {
  StatisticalForecastBackend,
  createStatisticalForecastBackend,
} from './statistical-forecast.js';

export {
  StubForecastBackend,
  createStubForecastBackend,
} from './forecast-stub.js';
