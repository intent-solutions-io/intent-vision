/**
 * Idempotency Manager
 *
 * Task ID: intentvision-79x.2
 *
 * Prevents duplicate processing of the same request.
 * Uses database-backed storage for durability.
 */

import { getClient } from '../../../../../db/config.js';
import type { IdempotencyRecord, IngestResponse } from './types.js';

// =============================================================================
// Configuration
// =============================================================================

export interface IdempotencyConfig {
  /** How long to keep idempotency keys (ms) */
  keyTtl: number;
  /** Table name for storage */
  tableName: string;
}

const DEFAULT_CONFIG: IdempotencyConfig = {
  keyTtl: 24 * 60 * 60 * 1000, // 24 hours
  tableName: 'idempotency_keys',
};

// =============================================================================
// Idempotency Manager
// =============================================================================

export class IdempotencyManager {
  private config: IdempotencyConfig;

  constructor(config: Partial<IdempotencyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the idempotency table
   */
  async initialize(): Promise<void> {
    const client = getClient();
    await client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.config.tableName} (
        key TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        response TEXT NOT NULL
      )
    `);

    // Create index for cleanup queries
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_${this.config.tableName}_expires
      ON ${this.config.tableName}(expires_at)
    `);
  }

  /**
   * Check if a key exists and return cached response
   */
  async check(key: string): Promise<IdempotencyRecord | null> {
    const client = getClient();
    const now = new Date().toISOString();

    const result = await client.execute({
      sql: `
        SELECT key, request_id, created_at, expires_at, response
        FROM ${this.config.tableName}
        WHERE key = ? AND expires_at > ?
      `,
      args: [key, now],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      key: row.key as string,
      request_id: row.request_id as string,
      created_at: row.created_at as string,
      expires_at: row.expires_at as string,
      response: JSON.parse(row.response as string),
    };
  }

  /**
   * Store a new idempotency record
   */
  async store(
    key: string,
    requestId: string,
    response: IngestResponse
  ): Promise<IdempotencyRecord> {
    const client = getClient();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.keyTtl);

    const record: IdempotencyRecord = {
      key,
      request_id: requestId,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      response,
    };

    await client.execute({
      sql: `
        INSERT OR REPLACE INTO ${this.config.tableName}
        (key, request_id, created_at, expires_at, response)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        record.key,
        record.request_id,
        record.created_at,
        record.expires_at,
        JSON.stringify(record.response),
      ],
    });

    return record;
  }

  /**
   * Clean up expired keys
   */
  async cleanup(): Promise<number> {
    const client = getClient();
    const now = new Date().toISOString();

    const result = await client.execute({
      sql: `DELETE FROM ${this.config.tableName} WHERE expires_at <= ?`,
      args: [now],
    });

    return result.rowsAffected || 0;
  }

  /**
   * Generate an idempotency key from request content
   */
  static generateKey(
    orgId: string,
    sourceId: string,
    metricsHash: string
  ): string {
    return `${orgId}:${sourceId}:${metricsHash}`;
  }

  /**
   * Hash metrics for idempotency key generation
   */
  static hashMetrics(metrics: unknown[]): string {
    // Simple hash based on JSON stringification
    // In production, use a proper hash function
    const json = JSON.stringify(metrics);
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Create idempotency manager instance
 */
export function createIdempotencyManager(
  config: Partial<IdempotencyConfig> = {}
): IdempotencyManager {
  return new IdempotencyManager(config);
}
