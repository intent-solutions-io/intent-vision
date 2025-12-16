/**
 * Auth Module
 *
 * Task ID: intentvision-cvo (Phase C)
 *
 * Exports authentication components:
 * - JWT token management
 * - API key management
 * - Role-based access control (RBAC)
 * - Authentication middleware
 */

// JWT Token Management
export {
  generateToken,
  verifyToken,
  getTokenExpirySeconds,
  isTokenExpired,
  decodeTokenUnsafe,
  type TokenPayload,
  type JwtHeader,
} from './jwt.js';

// API Key Management
export {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  ApiKeyManager,
  getApiKeyManager,
  resetApiKeyManager,
  type ApiKey,
  type ApiKeyCreateRequest,
  type ApiKeyValidationResult,
} from './api-keys.js';

// Role-Based Access Control
export {
  hasPermission,
  checkPermission,
  hasAllPermissions,
  hasAnyPermission,
  isValidRole,
  validateRoles,
  getHighestRole,
  isRoleHigherOrEqual,
  hasRoleLevel,
  getRolePermissions,
  getAllPermissions,
  ROLES,
  PERMISSIONS,
  type Role,
  type Permission,
} from './rbac.js';

// Authentication Middleware
export {
  authenticateRequest,
  createAuthMiddleware,
  requirePermissions,
  allowAnonymous,
  rateLimiter,
  type AuthContext,
  type AuthenticatedRequest,
  type AuthResult,
  type AuthMiddlewareConfig,
} from './middleware.js';
