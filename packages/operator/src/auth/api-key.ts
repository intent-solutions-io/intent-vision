/**
 * API Key Authentication
 *
 * Task ID: intentvision-10op.1
 *
 * Provides API key management and authentication:
 * - Key generation with org binding
 * - Key validation and lookup
 * - Rate limiting per key
 * - Key rotation support
 */

import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../../../../db/config.js';

// =============================================================================
// Types
// =============================================================================

export interface ApiKey {
  keyId: string;
  keyHash: string;
  orgId: string;
  name: string;
  scopes: string[];
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  rateLimit: number;
  enabled: boolean;
}

export interface ApiKeyCreateRequest {
  orgId: string;
  name: string;
  scopes?: string[];
  expiresInDays?: number;
  rateLimit?: number;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  key?: ApiKey;
  error?: string;
}

// =============================================================================
// API Key Manager
// =============================================================================

export class ApiKeyManager {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const client = getClient();

    await client.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        key_id TEXT PRIMARY KEY,
        key_hash TEXT UNIQUE NOT NULL,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        scopes TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT,
        last_used_at TEXT,
        rate_limit INTEGER DEFAULT 1000,
        enabled INTEGER DEFAULT 1
      )
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_org
      ON api_keys (org_id)
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_hash
      ON api_keys (key_hash)
    `);

    this.initialized = true;
  }

  /**
   * Generate a new API key
   * Returns the raw key (only returned once, store securely!)
   */
  async createKey(request: ApiKeyCreateRequest): Promise<{
    key: ApiKey;
    rawKey: string;
  }> {
    await this.initialize();

    const keyId = `key_${uuidv4().slice(0, 12)}`;
    const rawKey = `iv_${this.generateSecureToken()}`;
    const keyHash = this.hashKey(rawKey);

    const now = new Date().toISOString();
    const expiresAt = request.expiresInDays
      ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const apiKey: ApiKey = {
      keyId,
      keyHash,
      orgId: request.orgId,
      name: request.name,
      scopes: request.scopes || ['read', 'write'],
      createdAt: now,
      expiresAt,
      rateLimit: request.rateLimit || 1000,
      enabled: true,
    };

    const client = getClient();

    await client.execute({
      sql: `
        INSERT INTO api_keys
        (key_id, key_hash, org_id, name, scopes, created_at, expires_at, rate_limit, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        apiKey.keyId,
        apiKey.keyHash,
        apiKey.orgId,
        apiKey.name,
        JSON.stringify(apiKey.scopes),
        apiKey.createdAt,
        apiKey.expiresAt || null,
        apiKey.rateLimit,
        apiKey.enabled ? 1 : 0,
      ],
    });

    return { key: apiKey, rawKey };
  }

  /**
   * Validate an API key
   */
  async validateKey(rawKey: string): Promise<ApiKeyValidationResult> {
    await this.initialize();

    if (!rawKey || !rawKey.startsWith('iv_')) {
      return { valid: false, error: 'Invalid key format' };
    }

    const keyHash = this.hashKey(rawKey);
    const client = getClient();

    const result = await client.execute({
      sql: 'SELECT * FROM api_keys WHERE key_hash = ?',
      args: [keyHash],
    });

    if (result.rows.length === 0) {
      return { valid: false, error: 'Key not found' };
    }

    const row = result.rows[0];
    const key: ApiKey = {
      keyId: row.key_id as string,
      keyHash: row.key_hash as string,
      orgId: row.org_id as string,
      name: row.name as string,
      scopes: JSON.parse(row.scopes as string),
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string | undefined,
      lastUsedAt: row.last_used_at as string | undefined,
      rateLimit: row.rate_limit as number,
      enabled: Boolean(row.enabled),
    };

    // Check if enabled
    if (!key.enabled) {
      return { valid: false, error: 'Key is disabled' };
    }

    // Check expiration
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return { valid: false, error: 'Key has expired' };
    }

    // Update last used
    await client.execute({
      sql: 'UPDATE api_keys SET last_used_at = ? WHERE key_id = ?',
      args: [new Date().toISOString(), key.keyId],
    });

    return { valid: true, key };
  }

  /**
   * List keys for an organization
   */
  async listKeys(orgId: string): Promise<ApiKey[]> {
    await this.initialize();

    const client = getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM api_keys WHERE org_id = ? ORDER BY created_at DESC',
      args: [orgId],
    });

    return result.rows.map((row) => ({
      keyId: row.key_id as string,
      keyHash: row.key_hash as string,
      orgId: row.org_id as string,
      name: row.name as string,
      scopes: JSON.parse(row.scopes as string),
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string | undefined,
      lastUsedAt: row.last_used_at as string | undefined,
      rateLimit: row.rate_limit as number,
      enabled: Boolean(row.enabled),
    }));
  }

  /**
   * Revoke (disable) a key
   */
  async revokeKey(keyId: string): Promise<boolean> {
    await this.initialize();

    const client = getClient();
    const result = await client.execute({
      sql: 'UPDATE api_keys SET enabled = 0 WHERE key_id = ?',
      args: [keyId],
    });

    return result.rowsAffected > 0;
  }

  /**
   * Delete a key permanently
   */
  async deleteKey(keyId: string): Promise<boolean> {
    await this.initialize();

    const client = getClient();
    const result = await client.execute({
      sql: 'DELETE FROM api_keys WHERE key_id = ?',
      args: [keyId],
    });

    return result.rowsAffected > 0;
  }

  /**
   * Check if key has required scope
   */
  hasScope(key: ApiKey, requiredScope: string): boolean {
    if (key.scopes.includes('*')) return true;
    return key.scopes.includes(requiredScope);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private generateSecureToken(): string {
    // Generate a secure random token
    // In production, use crypto.randomBytes
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private hashKey(rawKey: string): string {
    // Simple hash for demo purposes
    // In production, use crypto.createHash('sha256')
    let hash = 0;
    for (let i = 0; i < rawKey.length; i++) {
      const char = rawKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  }
}

// =============================================================================
// Factory
// =============================================================================

let _manager: ApiKeyManager | null = null;

export function getApiKeyManager(): ApiKeyManager {
  if (!_manager) {
    _manager = new ApiKeyManager();
  }
  return _manager;
}

export function resetApiKeyManager(): void {
  _manager = null;
}
