/**
 * Turso Connection Pool
 *
 * Task ID: intentvision-wgk.1
 *
 * Manages a pool of Turso/libSQL database connections with:
 * - Configurable pool size (default: 5)
 * - Connection acquisition and release
 * - Health checks
 * - Graceful shutdown with drain
 * - Connection timeout handling
 */

import { createClient, Client } from '@libsql/client';

// =============================================================================
// Types
// =============================================================================

export interface TursoPoolConfig {
  /** Database URL (file:// for local, libsql:// for Turso) */
  url: string;
  /** Auth token for Turso (optional for local) */
  authToken?: string;
  /** Maximum number of connections in pool */
  poolSize?: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs?: number;
  /** Idle connection timeout in milliseconds */
  idleTimeoutMs?: number;
}

interface PooledConnection {
  client: Client;
  inUse: boolean;
  lastUsed: Date;
  createdAt: Date;
}

// =============================================================================
// Turso Pool
// =============================================================================

export class TursoPool {
  private config: Required<TursoPoolConfig>;
  private connections: PooledConnection[] = [];
  private waitQueue: Array<{
    resolve: (client: Client) => void;
    reject: (error: Error) => void;
    timestamp: Date;
  }> = [];
  private isShuttingDown = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: TursoPoolConfig) {
    this.config = {
      url: config.url,
      authToken: config.authToken,
      poolSize: config.poolSize ?? 5,
      connectionTimeoutMs: config.connectionTimeoutMs ?? 10000,
      idleTimeoutMs: config.idleTimeoutMs ?? 300000, // 5 minutes
    };

    // Start periodic idle connection cleanup
    this.startIdleCleanup();
  }

  /**
   * Get a connection from the pool
   * Creates new connection if pool not full, otherwise waits for available connection
   */
  async getConnection(): Promise<Client> {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }

    // Try to find an available connection
    const available = this.connections.find((conn) => !conn.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsed = new Date();
      return available.client;
    }

    // Create new connection if pool not full
    if (this.connections.length < this.config.poolSize) {
      const pooled = await this.createConnection();
      pooled.inUse = true;
      this.connections.push(pooled);
      return pooled.client;
    }

    // Wait for connection to become available
    return this.waitForConnection();
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(client: Client): void {
    const connection = this.connections.find((conn) => conn.client === client);
    if (!connection) {
      console.warn('Attempted to release unknown connection');
      return;
    }

    connection.inUse = false;
    connection.lastUsed = new Date();

    // Serve waiting request if any
    const waiter = this.waitQueue.shift();
    if (waiter) {
      connection.inUse = true;
      waiter.resolve(client);
    }
  }

  /**
   * Check pool health
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Get a connection and test it
      const client = await this.getConnection();
      try {
        await client.execute('SELECT 1');
        return true;
      } finally {
        this.releaseConnection(client);
      }
    } catch (error) {
      console.error('Pool health check failed:', error);
      return false;
    }
  }

  /**
   * Gracefully shutdown the pool
   * Waits for all connections to be released, then closes them
   */
  async drain(timeoutMs: number = 30000): Promise<void> {
    this.isShuttingDown = true;

    // Stop idle cleanup
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Reject all waiting requests
    for (const waiter of this.waitQueue) {
      waiter.reject(new Error('Pool is shutting down'));
    }
    this.waitQueue = [];

    // Wait for all connections to be released
    const startTime = Date.now();
    while (this.connections.some((conn) => conn.inUse)) {
      if (Date.now() - startTime > timeoutMs) {
        console.warn('Drain timeout exceeded, forcefully closing connections');
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Close all connections
    for (const conn of this.connections) {
      try {
        conn.client.close();
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }

    this.connections = [];
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    inUse: number;
    available: number;
    waiting: number;
  } {
    return {
      total: this.connections.length,
      inUse: this.connections.filter((c) => c.inUse).length,
      available: this.connections.filter((c) => !c.inUse).length,
      waiting: this.waitQueue.length,
    };
  }

  /**
   * Execute a callback with a pooled connection
   * Automatically acquires and releases connection
   */
  async withConnection<T>(
    callback: (client: Client) => Promise<T>
  ): Promise<T> {
    const client = await this.getConnection();
    try {
      return await callback(client);
    } finally {
      this.releaseConnection(client);
    }
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private async createConnection(): Promise<PooledConnection> {
    const client = createClient({
      url: this.config.url,
      authToken: this.config.authToken,
    });

    return {
      client,
      inUse: false,
      lastUsed: new Date(),
      createdAt: new Date(),
    };
  }

  private waitForConnection(): Promise<Client> {
    return new Promise((resolve, reject) => {
      const timestamp = new Date();
      this.waitQueue.push({ resolve, reject, timestamp });

      // Set timeout
      setTimeout(() => {
        const index = this.waitQueue.findIndex(
          (w) => w.timestamp === timestamp
        );
        if (index >= 0) {
          this.waitQueue.splice(index, 1);
          reject(
            new Error(
              `Connection timeout after ${this.config.connectionTimeoutMs}ms`
            )
          );
        }
      }, this.config.connectionTimeoutMs);
    });
  }

  private startIdleCleanup(): void {
    // Check for idle connections every minute
    this.healthCheckInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000);
  }

  private cleanupIdleConnections(): void {
    if (this.isShuttingDown) return;

    const now = Date.now();
    const toRemove: number[] = [];

    for (let i = 0; i < this.connections.length; i++) {
      const conn = this.connections[i];
      if (
        !conn.inUse &&
        now - conn.lastUsed.getTime() > this.config.idleTimeoutMs
      ) {
        toRemove.push(i);
      }
    }

    // Remove idle connections (in reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const index = toRemove[i];
      const conn = this.connections[index];
      try {
        conn.client.close();
      } catch (error) {
        console.error('Error closing idle connection:', error);
      }
      this.connections.splice(index, 1);
    }

    if (toRemove.length > 0) {
      console.log(`Cleaned up ${toRemove.length} idle connections`);
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

let _pool: TursoPool | null = null;

/**
 * Get or create the global Turso pool
 */
export function getTursoPool(config?: TursoPoolConfig): TursoPool {
  if (!_pool) {
    if (!config) {
      // Use default config from environment
      const url = process.env.INTENTVISION_DB_URL || 'file:db/intentvision.db';
      const authToken = process.env.INTENTVISION_DB_AUTH_TOKEN;
      config = { url, authToken };
    }
    _pool = new TursoPool(config);
  }
  return _pool;
}

/**
 * Reset the global pool (for testing)
 */
export async function resetTursoPool(): Promise<void> {
  if (_pool) {
    await _pool.drain();
    _pool = null;
  }
}
