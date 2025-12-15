/**
 * Auth Module
 *
 * Task ID: intentvision-10op.1
 *
 * Exports authentication components:
 * - API key management
 * - Authentication middleware
 */

export {
  ApiKeyManager,
  getApiKeyManager,
  resetApiKeyManager,
  type ApiKey,
  type ApiKeyCreateRequest,
  type ApiKeyValidationResult,
} from './api-key.js';

export {
  authenticateRequest,
  createAuthMiddleware,
  requireScopes,
  allowAnonymous,
  rateLimiter,
  type AuthenticatedRequest,
  type AuthResult,
  type AuthMiddlewareConfig,
} from './middleware.js';
