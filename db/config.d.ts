/**
 * IntentVision Database Configuration
 *
 * Uses libSQL for SQLite-compatible storage.
 * Supports both local SQLite and remote Turso sync.
 */
import { Client } from '@libsql/client';
export interface DbConfig {
    /** Database URL (file:// for local, libsql:// for Turso) */
    url: string;
    /** Auth token for Turso (optional for local) */
    authToken?: string;
}
/**
 * Get database configuration from environment
 */
export declare function getDbConfig(): DbConfig;
/**
 * Get or create database client
 */
export declare function getClient(): Client;
/**
 * Close database connection
 */
export declare function closeClient(): Promise<void>;
/**
 * Reset database client (for testing)
 */
export declare function resetClient(): void;
/**
 * Run all pending migrations
 */
export declare function runMigrations(migrationsDir?: string): Promise<string[]>;
/**
 * Check migration status
 */
export declare function getMigrationStatus(): Promise<{
    applied: string[];
    pending: string[];
}>;
//# sourceMappingURL=config.d.ts.map