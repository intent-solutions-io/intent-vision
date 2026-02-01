/**
 * API Key Management
 *
 * Task ID: intentvision-cvo (Phase C)
 *
 * Provides API key generation, hashing, and verification:
 * - Secure API key generation
 * - SHA-256 hashing for storage
 * - Key verification against stored hashes
 * - Database storage of key hashes
 */

import { randomBytes, createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../../../../db/config.js';

// =============================================================================
// Types
// =============================================================================

export interface ApiKey {
  keyId: string;
  keyHash: string;
  orgId: string;
  userId?: string;
  name: string;
  roles: string[];
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  rateLimit: number;
  enabled: boolean;
}

export interface ApiKeyCreateRequest {
  orgId: string;
  userId?: string;
  name: string;
  roles?: string[];
  expiresInDays?: number;
  rateLimit?: number;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  key?: ApiKey;
  error?: string;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Generate a new API key
 *
 * @returns Object with the raw key and its hash
 *
 * @example
 * const { key, hash } = generateApiKey();
 * // key: "ivk_abc123..." (store this securely, show once)
 * // hash: "sha256hash..." (store in database)
 */
export function generateApiKey(): { key: string; hash: string } {
  // Generate 32 bytes of randomness
  const token = randomBytes(32).toString('base64url');
  const key = `ivk_${token}`;
  const hash = hashApiKey(key);

  return { key, hash };
}

/**
 * Hash an API key using SHA-256
 *
 * @param key - The raw API key
 * @returns SHA-256 hex hash
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Verify an API key against its hash
 *
 * @param key - The raw API key to verify
 * @param hash - The stored hash to compare against
 * @returns True if the key matches the hash
 */
export function verifyApiKey(key: string, hash: string): boolean {
  const computedHash = hashApiKey(key);
  return computedHash === hash;
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
        user_id TEXT,
        name TEXT NOT NULL,
        roles TEXT NOT NULL,
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
   * Create a new API key in the database
   * Returns the raw key (only returned once, store securely!)
   */
  async createKey(request: ApiKeyCreateRequest): Promise<{
    key: ApiKey;
    rawKey: string;
  }> {
    await this.initialize();

    const keyId = `key_${uuidv4().slice(0, 12)}`;
    const { key: rawKey, hash: keyHash } = generateApiKey();

    const now = new Date().toISOString();
    const expiresAt = request.expiresInDays
      ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const apiKey: ApiKey = {
      keyId,
      keyHash,
      orgId: request.orgId,
      userId: request.userId,
      name: request.name,
      roles: request.roles || ['viewer'],
      createdAt: now,
      expiresAt,
      rateLimit: request.rateLimit || 1000,
      enabled: true,
    };

    const client = getClient();

    await client.execute({
      sql: `
        INSERT INTO api_keys
        (key_id, key_hash, org_id, user_id, name, roles, created_at, expires_at, rate_limit, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        apiKey.keyId,
        apiKey.keyHash,
        apiKey.orgId,
        apiKey.userId || null,
        apiKey.name,
        JSON.stringify(apiKey.roles),
        apiKey.createdAt,
        apiKey.expiresAt || null,
        apiKey.rateLimit,
        apiKey.enabled ? 1 : 0,
      ],
    });

    return { key: apiKey, rawKey };
  }

  /**
   * Validate an API key against the database
   */
  async validateKey(rawKey: string): Promise<ApiKeyValidationResult> {
    await this.initialize();

    if (!rawKey || !rawKey.startsWith('ivk_')) {
      return { valid: false, error: 'Invalid key format' };
    }

    const keyHash = hashApiKey(rawKey);
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
      userId: row.user_id as string | undefined,
      name: row.name as string,
      roles: JSON.parse(row.roles as string),
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

    // Update last used timestamp
    await client.execute({
      sql: 'UPDATE api_keys SET last_used_at = ? WHERE key_id = ?',
      args: [new Date().toISOString(), key.keyId],
    });

    return { valid: true, key };
  }

  /**
   * List all keys for an organization
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
      userId: row.user_id as string | undefined,
      name: row.name as string,
      roles: JSON.parse(row.roles as string),
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
