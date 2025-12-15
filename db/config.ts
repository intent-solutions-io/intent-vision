/**
 * IntentVision Database Configuration
 *
 * Uses libSQL for SQLite-compatible storage.
 * Supports both local SQLite and remote Turso sync.
 */

import { createClient, Client } from '@libsql/client';

// =============================================================================
// Configuration
// =============================================================================

export interface DbConfig {
  /** Database URL (file:// for local, libsql:// for Turso) */
  url: string;
  /** Auth token for Turso (optional for local) */
  authToken?: string;
}

/**
 * Get database configuration from environment
 */
export function getDbConfig(): DbConfig {
  // Default to local SQLite for development
  const url = process.env.INTENTVISION_DB_URL || 'file:db/intentvision.db';
  const authToken = process.env.INTENTVISION_DB_AUTH_TOKEN;

  return { url, authToken };
}

// =============================================================================
// Client Factory
// =============================================================================

let _client: Client | null = null;

/**
 * Get or create database client
 */
export function getClient(): Client {
  if (!_client) {
    const config = getDbConfig();
    _client = createClient({
      url: config.url,
      authToken: config.authToken,
    });
  }
  return _client;
}

/**
 * Close database connection
 */
export async function closeClient(): Promise<void> {
  if (_client) {
    _client.close();
    _client = null;
  }
}

// =============================================================================
// Migration Runner
// =============================================================================

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Run all pending migrations
 */
export async function runMigrations(migrationsDir: string = 'db/migrations'): Promise<string[]> {
  const client = getClient();
  const applied: string[] = [];

  // Ensure migrations table exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Get already applied migrations
  const result = await client.execute('SELECT name FROM _migrations');
  const appliedSet = new Set(result.rows.map(r => r.name as string));

  // Get migration files
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Run pending migrations
  for (const file of files) {
    if (!appliedSet.has(file)) {
      console.log(`Applying migration: ${file}`);
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');

      // Use batch execution for the entire migration file
      // First, remove comments and split properly
      const cleanedSql = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');

      // Execute as batch
      await client.executeMultiple(cleanedSql);

      applied.push(file);
      console.log(`Applied: ${file}`);
    }
  }

  return applied;
}

/**
 * Check migration status
 */
export async function getMigrationStatus(): Promise<{ applied: string[]; pending: string[] }> {
  const client = getClient();

  // Ensure migrations table exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const result = await client.execute('SELECT name FROM _migrations ORDER BY name');
  const applied = result.rows.map(r => r.name as string);

  // Get all migration files
  const files = readdirSync('db/migrations')
    .filter(f => f.endsWith('.sql'))
    .sort();

  const appliedSet = new Set(applied);
  const pending = files.filter(f => !appliedSet.has(f));

  return { applied, pending };
}
