/**
 * Operator Tests
 *
 * Task ID: intentvision-10op.4
 *
 * Tests for:
 * - API key management
 * - Authentication middleware
 * - Tenant context
 * - API router
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApiKeyManager,
  resetApiKeyManager,
  getApiKeyManager,
} from '../src/auth/api-key.js';
import {
  authenticateRequest,
  createAuthMiddleware,
  requireScopes,
  rateLimiter,
} from '../src/auth/middleware.js';
import {
  createTenantContext,
  getContext,
  clearContext,
  withTenantContext,
  verifyOrgAccess,
  applyOrgFilter,
  validateOrgOwnership,
  getActiveContextCount,
  cleanupStaleContexts,
} from '../src/tenant/context.js';
import {
  ApiRouter,
  createDefaultRouter,
  resetRouter,
} from '../src/api/router.js';

// =============================================================================
// API Key Tests
// =============================================================================

describe('ApiKeyManager', () => {
  let manager: ApiKeyManager;

  beforeEach(() => {
    resetApiKeyManager();
    manager = new ApiKeyManager();
  });

  describe('Key Creation', () => {
    it('should create an API key', async () => {
      const result = await manager.createKey({
        orgId: 'test-org',
        name: 'Test Key',
      });

      expect(result.key).toBeDefined();
      expect(result.rawKey).toBeDefined();
      expect(result.rawKey.startsWith('iv_')).toBe(true);
      expect(result.key.orgId).toBe('test-org');
      expect(result.key.name).toBe('Test Key');
      expect(result.key.enabled).toBe(true);
    });

    it('should create key with custom scopes', async () => {
      const result = await manager.createKey({
        orgId: 'test-org',
        name: 'Admin Key',
        scopes: ['admin', 'read', 'write'],
      });

      expect(result.key.scopes).toEqual(['admin', 'read', 'write']);
    });

    it('should create key with expiration', async () => {
      const result = await manager.createKey({
        orgId: 'test-org',
        name: 'Expiring Key',
        expiresInDays: 30,
      });

      expect(result.key.expiresAt).toBeDefined();
      const expiresAt = new Date(result.key.expiresAt!);
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      // Should be approximately 30 days
      expect(diff).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    });
  });

  describe('Key Validation', () => {
    it('should validate a valid key', async () => {
      const { rawKey } = await manager.createKey({
        orgId: 'test-org',
        name: 'Valid Key',
      });

      const result = await manager.validateKey(rawKey);
      expect(result.valid).toBe(true);
      expect(result.key).toBeDefined();
      expect(result.key?.orgId).toBe('test-org');
    });

    it('should reject invalid key format', async () => {
      const result = await manager.validateKey('not-a-valid-key');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid key format');
    });

    it('should reject unknown key', async () => {
      const result = await manager.validateKey('iv_unknown_key_12345678901234567890');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Key not found');
    });

    it('should reject disabled key', async () => {
      const { key, rawKey } = await manager.createKey({
        orgId: 'test-org',
        name: 'Disabled Key',
      });

      await manager.revokeKey(key.keyId);

      const result = await manager.validateKey(rawKey);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Key is disabled');
    });
  });

  describe('Key Management', () => {
    it('should list keys for an org', async () => {
      const testId = `list-${Date.now()}`;
      const org1 = `org-1-${testId}`;
      const org2 = `org-2-${testId}`;

      await manager.createKey({ orgId: org1, name: 'Key 1' });
      await manager.createKey({ orgId: org1, name: 'Key 2' });
      await manager.createKey({ orgId: org2, name: 'Key 3' });

      const org1Keys = await manager.listKeys(org1);
      expect(org1Keys).toHaveLength(2);
      expect(org1Keys.every((k) => k.orgId === org1)).toBe(true);
    });

    it('should revoke a key', async () => {
      const { key } = await manager.createKey({
        orgId: 'test-org',
        name: 'To Revoke',
      });

      const revoked = await manager.revokeKey(key.keyId);
      expect(revoked).toBe(true);

      const keys = await manager.listKeys('test-org');
      const revokedKey = keys.find((k) => k.keyId === key.keyId);
      expect(revokedKey?.enabled).toBe(false);
    });

    it('should delete a key', async () => {
      const { key } = await manager.createKey({
        orgId: 'test-org',
        name: 'To Delete',
      });

      const deleted = await manager.deleteKey(key.keyId);
      expect(deleted).toBe(true);

      const keys = await manager.listKeys('test-org');
      expect(keys.find((k) => k.keyId === key.keyId)).toBeUndefined();
    });
  });

  describe('Scope Checking', () => {
    it('should check scopes correctly', async () => {
      const { key } = await manager.createKey({
        orgId: 'test-org',
        name: 'Scoped Key',
        scopes: ['read', 'write'],
      });

      expect(manager.hasScope(key, 'read')).toBe(true);
      expect(manager.hasScope(key, 'write')).toBe(true);
      expect(manager.hasScope(key, 'admin')).toBe(false);
    });

    it('should allow wildcard scope', async () => {
      const { key } = await manager.createKey({
        orgId: 'test-org',
        name: 'Admin Key',
        scopes: ['*'],
      });

      expect(manager.hasScope(key, 'read')).toBe(true);
      expect(manager.hasScope(key, 'write')).toBe(true);
      expect(manager.hasScope(key, 'admin')).toBe(true);
      expect(manager.hasScope(key, 'anything')).toBe(true);
    });
  });
});

// =============================================================================
// Auth Middleware Tests
// =============================================================================

describe('Auth Middleware', () => {
  let manager: ApiKeyManager;
  let validRawKey: string;

  beforeEach(async () => {
    resetApiKeyManager();
    manager = getApiKeyManager();
    const result = await manager.createKey({
      orgId: 'test-org',
      name: 'Test Key',
      scopes: ['read', 'write'],
    });
    validRawKey = result.rawKey;
  });

  it('should authenticate valid request', async () => {
    const result = await authenticateRequest({
      'x-api-key': validRawKey,
    });

    expect(result.authenticated).toBe(true);
    expect(result.request?.orgId).toBe('test-org');
  });

  it('should reject request without key', async () => {
    const result = await authenticateRequest({});

    expect(result.authenticated).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('should allow anonymous when configured', async () => {
    const result = await authenticateRequest({}, { allowAnonymous: true });

    expect(result.authenticated).toBe(false);
    expect(result.statusCode).toBeUndefined();
  });

  it('should check required scopes', async () => {
    const result = await authenticateRequest(
      { 'x-api-key': validRawKey },
      { requiredScopes: ['admin'] }
    );

    expect(result.authenticated).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.error).toContain('Missing required scope');
  });

  it('should create middleware with config', async () => {
    const middleware = createAuthMiddleware({ requiredScopes: ['read'] });
    const result = await middleware({ 'x-api-key': validRawKey });

    expect(result.authenticated).toBe(true);
  });

  it('should create scope-requiring middleware', async () => {
    const middleware = requireScopes('read', 'write');
    const result = await middleware({ 'x-api-key': validRawKey });

    expect(result.authenticated).toBe(true);
  });
});

// =============================================================================
// Tenant Context Tests
// =============================================================================

describe('Tenant Context', () => {
  beforeEach(() => {
    // Clean up any stale contexts
    cleanupStaleContexts(0);
  });

  describe('Context Creation', () => {
    it('should create a context', () => {
      const ctx = createTenantContext({ orgId: 'test-org' });

      expect(ctx.orgId).toBe('test-org');
      expect(ctx.requestId).toBeDefined();
      expect(ctx.timestamp).toBeDefined();

      clearContext(ctx.requestId);
    });

    it('should store and retrieve context', () => {
      const ctx = createTenantContext({ orgId: 'test-org' });
      const retrieved = getContext(ctx.requestId);

      expect(retrieved).toEqual(ctx);

      clearContext(ctx.requestId);
    });

    it('should clear context', () => {
      const ctx = createTenantContext({ orgId: 'test-org' });
      clearContext(ctx.requestId);

      expect(getContext(ctx.requestId)).toBeUndefined();
    });
  });

  describe('Context Execution', () => {
    it('should run async function with context', async () => {
      const result = await withTenantContext(
        { orgId: 'test-org' },
        async (ctx) => {
          expect(ctx.orgId).toBe('test-org');
          return 'done';
        }
      );

      expect(result).toBe('done');
    });

    it('should clean up context after execution', async () => {
      let capturedRequestId: string | undefined;

      await withTenantContext({ orgId: 'test-org' }, async (ctx) => {
        capturedRequestId = ctx.requestId;
      });

      expect(capturedRequestId).toBeDefined();
      expect(getContext(capturedRequestId!)).toBeUndefined();
    });
  });

  describe('Organization Isolation', () => {
    it('should verify org access', () => {
      const ctx = createTenantContext({ orgId: 'org-1' });

      expect(verifyOrgAccess(ctx, 'org-1')).toBe(true);
      expect(verifyOrgAccess(ctx, 'org-2')).toBe(false);

      clearContext(ctx.requestId);
    });

    it('should filter items by org', () => {
      const ctx = createTenantContext({ orgId: 'org-1' });
      const items = [
        { id: '1', org_id: 'org-1' },
        { id: '2', org_id: 'org-2' },
        { id: '3', org_id: 'org-1' },
      ];

      const filtered = applyOrgFilter(ctx, items);
      expect(filtered).toHaveLength(2);
      expect(filtered.every((i) => i.org_id === 'org-1')).toBe(true);

      clearContext(ctx.requestId);
    });

    it('should validate org ownership', () => {
      const ctx = createTenantContext({ orgId: 'org-1' });

      const valid = validateOrgOwnership(ctx, 'org-1');
      expect(valid.valid).toBe(true);

      const invalid = validateOrgOwnership(ctx, 'org-2');
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain('Access denied');

      clearContext(ctx.requestId);
    });
  });

  describe('Context Utilities', () => {
    it('should count active contexts', () => {
      const initial = getActiveContextCount();
      const ctx1 = createTenantContext({ orgId: 'org-1' });
      const ctx2 = createTenantContext({ orgId: 'org-2' });

      expect(getActiveContextCount()).toBe(initial + 2);

      clearContext(ctx1.requestId);
      clearContext(ctx2.requestId);
    });
  });
});

// =============================================================================
// API Router Tests
// =============================================================================

describe('API Router', () => {
  let router: ApiRouter;
  let validRawKey: string;

  beforeEach(async () => {
    resetRouter();
    resetApiKeyManager();
    router = createDefaultRouter();

    // Create a test key
    const manager = getApiKeyManager();
    const result = await manager.createKey({
      orgId: 'test-org',
      name: 'Router Test Key',
      scopes: ['admin', 'read', 'write'],
    });
    validRawKey = result.rawKey;
  });

  describe('Health Endpoint', () => {
    it('should return health status without auth', async () => {
      const response = await router.handle({
        method: 'GET',
        path: '/health',
        headers: {},
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });

  describe('Org Endpoint', () => {
    it('should return org info with auth', async () => {
      const response = await router.handle({
        method: 'GET',
        path: '/api/v1/org',
        headers: { 'x-api-key': validRawKey },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('org_id', 'test-org');
    });

    it('should reject without auth', async () => {
      const response = await router.handle({
        method: 'GET',
        path: '/api/v1/org',
        headers: {},
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Keys Endpoints', () => {
    it('should list keys', async () => {
      const response = await router.handle({
        method: 'GET',
        path: '/api/v1/keys',
        headers: { 'x-api-key': validRawKey },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('keys');
    });

    it('should create key', async () => {
      const response = await router.handle({
        method: 'POST',
        path: '/api/v1/keys',
        headers: {
          'x-api-key': validRawKey,
          'content-type': 'application/json',
        },
        body: { name: 'New Key' },
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('raw_key');
    });

    it('should require name for key creation', async () => {
      const response = await router.handle({
        method: 'POST',
        path: '/api/v1/keys',
        headers: { 'x-api-key': validRawKey },
        body: {},
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Route Matching', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await router.handle({
        method: 'GET',
        path: '/unknown/path',
        headers: { 'x-api-key': validRawKey },
      });

      expect(response.status).toBe(404);
    });
  });
});
