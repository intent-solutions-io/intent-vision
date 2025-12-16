/**
 * External Connections Module
 *
 * Task ID: intentvision-wgk
 *
 * Exports all connection management utilities:
 * - Turso connection pooling
 * - Nixtla API client with retry/circuit breaker
 * - Webhook signature verification
 * - Health monitoring
 */

// Turso Pool
export {
  TursoPool,
  getTursoPool,
  resetTursoPool,
  type TursoPoolConfig,
} from './turso-pool.js';

// Nixtla Client
export {
  NixtlaClient,
  getNixtlaClient,
  resetNixtlaClient,
  type NixtlaClientConfig,
  type NixtlaForecastRequest,
  type NixtlaForecastResponse,
  type CircuitBreakerState,
} from './nixtla-client.js';

// Webhook Verifier
export {
  WebhookVerifier,
  getWebhookVerifier,
  resetWebhookVerifiers,
  verifyWebhookSignature,
  parseWebhookSignature,
  signWebhookPayload,
  type WebhookVerificationConfig,
  type WebhookSignatureHeader,
  type VerificationResult,
} from './webhook-verifier.js';

// Health Monitor
export {
  HealthMonitor,
  getHealthMonitor,
  resetHealthMonitor,
  registerHealthCheck,
  checkAllHealth,
  checkHealth,
  type HealthStatus,
  type HealthCheckResult,
  type HealthReport,
  type HealthChecker,
} from './health-monitor.js';
