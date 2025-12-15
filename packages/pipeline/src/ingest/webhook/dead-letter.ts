/**
 * Dead Letter Queue
 *
 * Task ID: intentvision-79x.4
 *
 * Stores failed ingestion requests for later retry or analysis.
 * Implements exponential backoff for retries.
 */

import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../../../../../db/config.js';
import type { DeadLetterEntry, IngestRequest, IngestError } from './types.js';

// =============================================================================
// Configuration
// =============================================================================

export interface DeadLetterConfig {
  /** Table name for storage */
  tableName: string;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  baseDelay: number;
  /** Maximum delay between retries (ms) */
  maxDelay: number;
  /** How long to keep exhausted entries (ms) */
  retentionPeriod: number;
}

const DEFAULT_CONFIG: DeadLetterConfig = {
  tableName: 'dead_letter_queue',
  maxRetries: 5,
  baseDelay: 60 * 1000, // 1 minute
  maxDelay: 60 * 60 * 1000, // 1 hour
  retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// =============================================================================
// Dead Letter Queue
// =============================================================================

export class DeadLetterQueue {
  private config: DeadLetterConfig;

  constructor(config: Partial<DeadLetterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the dead letter table
   */
  async initialize(): Promise<void> {
    const client = getClient();
    await client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.config.tableName} (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        request TEXT NOT NULL,
        error TEXT NOT NULL,
        failed_at TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        next_retry_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Indexes for efficient queries
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_${this.config.tableName}_status
      ON ${this.config.tableName}(status, next_retry_at)
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_${this.config.tableName}_org
      ON ${this.config.tableName}(org_id, status)
    `);
  }

  /**
   * Add a failed request to the dead letter queue
   */
  async add(request: IngestRequest, error: IngestError): Promise<DeadLetterEntry> {
    const client = getClient();
    const now = new Date();
    const nextRetry = new Date(now.getTime() + this.config.baseDelay);

    const entry: DeadLetterEntry = {
      id: uuidv4(),
      request,
      error,
      failed_at: now.toISOString(),
      retry_count: 0,
      next_retry_at: nextRetry.toISOString(),
      status: 'pending',
    };

    await client.execute({
      sql: `
        INSERT INTO ${this.config.tableName}
        (id, org_id, source_id, request, error, failed_at, retry_count, next_retry_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        entry.id,
        request.org_id,
        request.source_id,
        JSON.stringify(request),
        JSON.stringify(error),
        entry.failed_at,
        entry.retry_count,
        entry.next_retry_at,
        entry.status,
      ],
    });

    return entry;
  }

  /**
   * Get entries ready for retry
   */
  async getReadyForRetry(limit: number = 100): Promise<DeadLetterEntry[]> {
    const client = getClient();
    const now = new Date().toISOString();

    const result = await client.execute({
      sql: `
        SELECT id, request, error, failed_at, retry_count, next_retry_at, status
        FROM ${this.config.tableName}
        WHERE status = 'pending' AND next_retry_at <= ?
        ORDER BY next_retry_at ASC
        LIMIT ?
      `,
      args: [now, limit],
    });

    return result.rows.map((row) => ({
      id: row.id as string,
      request: JSON.parse(row.request as string),
      error: JSON.parse(row.error as string),
      failed_at: row.failed_at as string,
      retry_count: row.retry_count as number,
      next_retry_at: row.next_retry_at as string | null,
      status: row.status as DeadLetterEntry['status'],
    }));
  }

  /**
   * Mark an entry as being retried
   */
  async markRetrying(id: string): Promise<void> {
    const client = getClient();
    await client.execute({
      sql: `UPDATE ${this.config.tableName} SET status = 'retrying' WHERE id = ?`,
      args: [id],
    });
  }

  /**
   * Handle retry success - remove from queue
   */
  async markResolved(id: string): Promise<void> {
    const client = getClient();
    await client.execute({
      sql: `UPDATE ${this.config.tableName} SET status = 'resolved' WHERE id = ?`,
      args: [id],
    });
  }

  /**
   * Handle retry failure - schedule next retry or mark exhausted
   */
  async handleRetryFailure(id: string, newError: IngestError): Promise<void> {
    const client = getClient();

    // Get current entry
    const result = await client.execute({
      sql: `SELECT retry_count FROM ${this.config.tableName} WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) return;

    const currentRetries = result.rows[0].retry_count as number;
    const newRetryCount = currentRetries + 1;

    if (newRetryCount >= this.config.maxRetries) {
      // Exhausted retries
      await client.execute({
        sql: `
          UPDATE ${this.config.tableName}
          SET status = 'exhausted', retry_count = ?, next_retry_at = NULL, error = ?
          WHERE id = ?
        `,
        args: [newRetryCount, JSON.stringify(newError), id],
      });
    } else {
      // Schedule next retry with exponential backoff
      const delay = Math.min(
        this.config.baseDelay * Math.pow(2, newRetryCount),
        this.config.maxDelay
      );
      const nextRetry = new Date(Date.now() + delay).toISOString();

      await client.execute({
        sql: `
          UPDATE ${this.config.tableName}
          SET status = 'pending', retry_count = ?, next_retry_at = ?, error = ?
          WHERE id = ?
        `,
        args: [newRetryCount, nextRetry, JSON.stringify(newError), id],
      });
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    retrying: number;
    exhausted: number;
    resolved: number;
    total: number;
  }> {
    const client = getClient();
    const result = await client.execute(`
      SELECT status, COUNT(*) as count
      FROM ${this.config.tableName}
      GROUP BY status
    `);

    const stats = {
      pending: 0,
      retrying: 0,
      exhausted: 0,
      resolved: 0,
      total: 0,
    };

    for (const row of result.rows) {
      const status = row.status as keyof typeof stats;
      const count = row.count as number;
      if (status in stats) {
        stats[status] = count;
      }
      stats.total += count;
    }

    return stats;
  }

  /**
   * Clean up old resolved/exhausted entries
   */
  async cleanup(): Promise<number> {
    const client = getClient();
    const cutoff = new Date(Date.now() - this.config.retentionPeriod).toISOString();

    const result = await client.execute({
      sql: `
        DELETE FROM ${this.config.tableName}
        WHERE status IN ('resolved', 'exhausted') AND created_at < ?
      `,
      args: [cutoff],
    });

    return result.rowsAffected || 0;
  }

  /**
   * Get entries by organization
   */
  async getByOrg(
    orgId: string,
    status?: DeadLetterEntry['status'],
    limit: number = 100
  ): Promise<DeadLetterEntry[]> {
    const client = getClient();

    let sql = `
      SELECT id, request, error, failed_at, retry_count, next_retry_at, status
      FROM ${this.config.tableName}
      WHERE org_id = ?
    `;
    const args: unknown[] = [orgId];

    if (status) {
      sql += ' AND status = ?';
      args.push(status);
    }

    sql += ' ORDER BY failed_at DESC LIMIT ?';
    args.push(limit);

    const result = await client.execute({ sql, args });

    return result.rows.map((row) => ({
      id: row.id as string,
      request: JSON.parse(row.request as string),
      error: JSON.parse(row.error as string),
      failed_at: row.failed_at as string,
      retry_count: row.retry_count as number,
      next_retry_at: row.next_retry_at as string | null,
      status: row.status as DeadLetterEntry['status'],
    }));
  }
}

/**
 * Create dead letter queue instance
 */
export function createDeadLetterQueue(
  config: Partial<DeadLetterConfig> = {}
): DeadLetterQueue {
  return new DeadLetterQueue(config);
}
