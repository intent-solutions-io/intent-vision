/**
 * Authentication Tests
 *
 * Task ID: intentvision-cvo (Phase C)
 *
 * Comprehensive tests for:
 * - JWT generation and verification
 * - API key hashing and verification
 * - RBAC permission checks
 * - Middleware authentication flows
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resetClient } from '../../../db/config.js';

// JWT imports
import {
  generateToken,
  verifyToken,
  getTokenExpirySeconds,
  isTokenExpired,
  decodeTokenUnsafe,
  type TokenPayload,
} from '../src/auth/jwt.js';

// API key imports
import {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  ApiKeyManager,
  resetApiKeyManager,
  getApiKeyManager,
} from '../src/auth/api-keys.js';

// RBAC imports
import {
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
} from '../src/auth/rbac.js';

// Middleware imports
import {
  authenticateRequest,
  createAuthMiddleware,
  requirePermissions,
  allowAnonymous,
  type AuthContext,
} from '../src/auth/middleware.js';

// =============================================================================
// JWT Tests
// =============================================================================

describe('JWT Token Management', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken({
        orgId: 'org-123',
        userId: 'user-456',
        roles: ['admin'],
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should generate tokens with different signatures for different payloads', () => {
      const token1 = generateToken({
        orgId: 'org-123',
        userId: 'user-1',
        roles: ['admin'],
      });

      const token2 = generateToken({
        orgId: 'org-123',
        userId: 'user-2',
        roles: ['admin'],
      });

      expect(token1).not.toBe(token2);
    });

    it('should include all required fields in payload', () => {
      const token = generateToken({
        orgId: 'org-123',
        userId: 'user-456',
        roles: ['operator', 'viewer'],
      });

      const payload = verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.orgId).toBe('org-123');
      expect(payload?.userId).toBe('user-456');
      expect(payload?.roles).toEqual(['operator', 'viewer']);
      expect(payload?.iat).toBeDefined();
      expect(payload?.exp).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = generateToken({
        orgId: 'org-123',
        userId: 'user-456',
        roles: ['admin'],
      });

      const payload = verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.orgId).toBe('org-123');
    });

    it('should reject a malformed token', () => {
      const payload = verifyToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should reject a token with invalid signature', () => {
      const token = generateToken({
        orgId: 'org-123',
        userId: 'user-456',
        roles: ['admin'],
      });

      // Tamper with the token
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;

      const payload = verifyToken(tamperedToken);
      expect(payload).toBeNull();
    });

    it('should reject a token with missing parts', () => {
      const payload = verifyToken('header.payload');
      expect(payload).toBeNull();
    });

    it('should verify token expiry is set to 24 hours', () => {
      const token = generateToken({
        orgId: 'org-123',
        userId: 'user-456',
        roles: ['admin'],
      });

      const payload = verifyToken(token);
      expect(payload).not.toBeNull();

      const now = Math.floor(Date.now() / 1000);
      const expectedExpiry = now + 24 * 60 * 60;

      // Allow 2 second tolerance for test execution time
      expect(payload?.exp).toBeGreaterThan(now);
      expect(payload?.exp).toBeLessThanOrEqual(expectedExpiry + 2);
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for a valid token', () => {
      const token = generateToken({
        orgId: 'org-123',
        userId: 'user-456',
        roles: ['admin'],
      });

      expect(isTokenExpired(token)).toBe(false);
    });

    it('should return true for malformed token', () => {
      expect(isTokenExpired('invalid')).toBe(true);
    });
  });

  describe('decodeTokenUnsafe', () => {
    it('should decode token without verification', () => {
      const token = generateToken({
        orgId: 'org-123',
        userId: 'user-456',
        roles: ['admin'],
      });

      const payload = decodeTokenUnsafe(token);
      expect(payload).not.toBeNull();
      expect(payload?.orgId).toBe('org-123');
    });
  });
});

// =============================================================================
// API Key Tests
// =============================================================================

describe('API Key Management', () => {
  describe('generateApiKey', () => {
    it('should generate a key and hash', () => {
      const { key, hash } = generateApiKey();

      expect(key).toBeDefined();
      expect(hash).toBeDefined();
      expect(key.startsWith('ivk_')).toBe(true);
      expect(hash).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1.key).not.toBe(key2.key);
      expect(key1.hash).not.toBe(key2.hash);
    });
  });

  describe('hashApiKey', () => {
    it('should hash an API key', () => {
      const key = 'ivk_test123';
      const hash = hashApiKey(key);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });

    it('should produce consistent hashes', () => {
      const key = 'ivk_test123';
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('ivk_test1');
      const hash2 = hashApiKey('ivk_test2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyApiKey', () => {
    it('should verify a valid key against its hash', () => {
      const { key, hash } = generateApiKey();
      expect(verifyApiKey(key, hash)).toBe(true);
    });

    it('should reject an invalid key', () => {
      const { hash } = generateApiKey();
      const wrongKey = 'ivk_wrongkey';
      expect(verifyApiKey(wrongKey, hash)).toBe(false);
    });
  });

  describe('ApiKeyManager', () => {
    let manager: ApiKeyManager;

    beforeEach(() => {
      resetClient();
      resetApiKeyManager();
      manager = new ApiKeyManager();
    });

    it('should create an API key', async () => {
      const result = await manager.createKey({
        orgId: 'org-test',
        name: 'Test Key',
      });

      expect(result.key).toBeDefined();
      expect(result.rawKey).toBeDefined();
      expect(result.rawKey.startsWith('ivk_')).toBe(true);
      expect(result.key.orgId).toBe('org-test');
      expect(result.key.name).toBe('Test Key');
    });

    it('should create key with custom roles', async () => {
      const result = await manager.createKey({
        orgId: 'org-test',
        name: 'Admin Key',
        roles: ['admin'],
      });

      expect(result.key.roles).toEqual(['admin']);
    });

    it('should validate a valid key', async () => {
      const { rawKey } = await manager.createKey({
        orgId: 'org-test',
        name: 'Valid Key',
      });

      const validation = await manager.validateKey(rawKey);
      expect(validation.valid).toBe(true);
      expect(validation.key).toBeDefined();
    });

    it('should reject invalid key format', async () => {
      const validation = await manager.validateKey('invalid-key');
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    it('should reject non-existent key', async () => {
      const validation = await manager.validateKey('ivk_nonexistent');
      expect(validation.valid).toBe(false);
    });

    it('should list keys for an organization', async () => {
      await manager.createKey({
        orgId: 'org-test',
        name: 'Key 1',
      });

      await manager.createKey({
        orgId: 'org-test',
        name: 'Key 2',
      });

      const keys = await manager.listKeys('org-test');
      expect(keys).toHaveLength(2);
    });

    it('should revoke a key', async () => {
      const { key, rawKey } = await manager.createKey({
        orgId: 'org-test',
        name: 'Revokable Key',
      });

      const revoked = await manager.revokeKey(key.keyId);
      expect(revoked).toBe(true);

      const validation = await manager.validateKey(rawKey);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('disabled');
    });
  });
});

// =============================================================================
// RBAC Tests
// =============================================================================

describe('Role-Based Access Control', () => {
  describe('hasPermission', () => {
    it('should grant read permission to viewer', () => {
      expect(hasPermission('viewer', 'read')).toBe(true);
    });

    it('should deny write permission to viewer', () => {
      expect(hasPermission('viewer', 'write')).toBe(false);
    });

    it('should grant read and write to operator', () => {
      expect(hasPermission('operator', 'read')).toBe(true);
      expect(hasPermission('operator', 'write')).toBe(true);
    });

    it('should deny delete permission to operator', () => {
      expect(hasPermission('operator', 'delete')).toBe(false);
    });

    it('should grant all permissions to admin', () => {
      expect(hasPermission('admin', 'read')).toBe(true);
      expect(hasPermission('admin', 'write')).toBe(true);
      expect(hasPermission('admin', 'delete')).toBe(true);
      expect(hasPermission('admin', 'admin')).toBe(true);
    });
  });

  describe('checkPermission', () => {
    it('should check permissions across multiple roles', () => {
      expect(checkPermission(['viewer', 'operator'], 'write')).toBe(true);
      expect(checkPermission(['viewer'], 'write')).toBe(false);
    });

    it('should deny permission for empty roles', () => {
      expect(checkPermission([], 'read')).toBe(false);
    });

    it('should ignore invalid roles', () => {
      expect(checkPermission(['invalid-role'], 'read')).toBe(false);
      expect(checkPermission(['viewer', 'invalid-role'], 'read')).toBe(true);
    });
  });

  describe('hasAllPermissions', () => {
    it('should verify user has all required permissions', () => {
      expect(hasAllPermissions(['admin'], ['read', 'write', 'delete'])).toBe(true);
      expect(hasAllPermissions(['operator'], ['read', 'write'])).toBe(true);
      expect(hasAllPermissions(['operator'], ['read', 'write', 'delete'])).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should verify user has at least one permission', () => {
      expect(hasAnyPermission(['viewer'], ['read', 'write'])).toBe(true);
      expect(hasAnyPermission(['viewer'], ['write', 'delete'])).toBe(false);
    });
  });

  describe('validateRoles', () => {
    it('should filter out invalid roles', () => {
      const roles = validateRoles(['admin', 'invalid', 'viewer']);
      expect(roles).toEqual(['admin', 'viewer']);
    });
  });

  describe('getHighestRole', () => {
    it('should return the highest role', () => {
      expect(getHighestRole(['viewer', 'admin'])).toBe('admin');
      expect(getHighestRole(['operator', 'viewer'])).toBe('operator');
      expect(getHighestRole(['viewer'])).toBe('viewer');
    });

    it('should return null for invalid roles', () => {
      expect(getHighestRole(['invalid'])).toBeNull();
    });
  });

  describe('isRoleHigherOrEqual', () => {
    it('should compare role hierarchy', () => {
      expect(isRoleHigherOrEqual('admin', 'operator')).toBe(true);
      expect(isRoleHigherOrEqual('admin', 'admin')).toBe(true);
      expect(isRoleHigherOrEqual('viewer', 'operator')).toBe(false);
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for a role', () => {
      expect(getRolePermissions('viewer')).toEqual(['read']);
      expect(getRolePermissions('operator')).toEqual(['read', 'write']);
      expect(getRolePermissions('admin')).toEqual(['read', 'write', 'delete', 'admin']);
    });
  });

  describe('getAllPermissions', () => {
    it('should return union of all permissions', () => {
      const permissions = getAllPermissions(['viewer', 'operator']);
      expect(permissions).toContain('read');
      expect(permissions).toContain('write');
    });
  });
});

// =============================================================================
// Middleware Tests
// =============================================================================

describe('Authentication Middleware', () => {
  let manager: ApiKeyManager;

  beforeEach(() => {
    resetClient();
    resetApiKeyManager();
    manager = getApiKeyManager();
  });

  describe('JWT Authentication', () => {
    it('should authenticate valid JWT token', async () => {
      const token = generateToken({
        orgId: 'org-123',
        userId: 'user-456',
        roles: ['admin'],
      });

      const result = await authenticateRequest({
        authorization: `Bearer ${token}`,
      });

      expect(result.authenticated).toBe(true);
      expect(result.context?.orgId).toBe('org-123');
      expect(result.context?.userId).toBe('user-456');
      expect(result.context?.roles).toEqual(['admin']);
      expect(result.context?.authMethod).toBe('jwt');
    });

    it('should reject invalid JWT token', async () => {
      const result = await authenticateRequest({
        authorization: 'Bearer invalid-token',
      });

      expect(result.authenticated).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.statusCode).toBe(401);
    });

    it('should enforce permission requirements with JWT', async () => {
      const token = generateToken({
        orgId: 'org-123',
        userId: 'user-456',
        roles: ['viewer'],
      });

      const result = await authenticateRequest(
        { authorization: `Bearer ${token}` },
        { requiredPermissions: ['write'] }
      );

      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('Missing required permission');
      expect(result.statusCode).toBe(403);
    });
  });

  describe('API Key Authentication', () => {
    it('should authenticate valid API key', async () => {
      const { rawKey } = await manager.createKey({
        orgId: 'org-123',
        userId: 'user-456',
        name: 'Test Key',
        roles: ['operator'],
      });

      const result = await authenticateRequest({
        'x-api-key': rawKey,
      });

      expect(result.authenticated).toBe(true);
      expect(result.context?.orgId).toBe('org-123');
      expect(result.context?.roles).toEqual(['operator']);
      expect(result.context?.authMethod).toBe('api-key');
    });

    it('should reject invalid API key', async () => {
      const result = await authenticateRequest({
        'x-api-key': 'ivk_invalid',
      });

      expect(result.authenticated).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should enforce permission requirements with API key', async () => {
      const { rawKey } = await manager.createKey({
        orgId: 'org-123',
        name: 'Viewer Key',
        roles: ['viewer'],
      });

      const result = await authenticateRequest(
        { 'x-api-key': rawKey },
        { requiredPermissions: ['delete'] }
      );

      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('Missing required permission');
      expect(result.statusCode).toBe(403);
    });
  });

  describe('Mixed Authentication', () => {
    it('should prefer JWT over API key when both provided', async () => {
      const token = generateToken({
        orgId: 'org-jwt',
        userId: 'user-jwt',
        roles: ['admin'],
      });

      const { rawKey } = await manager.createKey({
        orgId: 'org-key',
        name: 'Test Key',
        roles: ['viewer'],
      });

      const result = await authenticateRequest({
        authorization: `Bearer ${token}`,
        'x-api-key': rawKey,
      });

      expect(result.authenticated).toBe(true);
      expect(result.context?.orgId).toBe('org-jwt');
      expect(result.context?.authMethod).toBe('jwt');
    });

    it('should fallback to API key if JWT fails', async () => {
      const { rawKey } = await manager.createKey({
        orgId: 'org-key',
        name: 'Test Key',
        roles: ['operator'],
      });

      const result = await authenticateRequest({
        authorization: 'Bearer invalid-token',
        'x-api-key': rawKey,
      });

      expect(result.authenticated).toBe(true);
      expect(result.context?.orgId).toBe('org-key');
      expect(result.context?.authMethod).toBe('api-key');
    });
  });

  describe('Anonymous Access', () => {
    it('should allow anonymous when configured', async () => {
      const result = await authenticateRequest({}, { allowAnonymous: true });

      expect(result.authenticated).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should deny anonymous by default', async () => {
      const result = await authenticateRequest({});

      expect(result.authenticated).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.statusCode).toBe(401);
    });
  });

  describe('Middleware Factories', () => {
    it('should create middleware with required permissions', async () => {
      const middleware = requirePermissions('admin');
      const token = generateToken({
        orgId: 'org-123',
        userId: 'user-456',
        roles: ['admin'],
      });

      const result = await middleware({
        authorization: `Bearer ${token}`,
      });

      expect(result.authenticated).toBe(true);
    });

    it('should create anonymous middleware', async () => {
      const middleware = allowAnonymous();
      const result = await middleware({});

      expect(result.authenticated).toBe(false);
      expect(result.error).toBeUndefined();
    });
  });
});
