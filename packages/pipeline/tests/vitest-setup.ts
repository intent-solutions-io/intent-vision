/**
 * Vitest Global Setup
 * Runs before each test file to ensure database is initialized
 */

import { getClient, resetClient } from '../../../db/config.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, afterAll } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

beforeAll(async () => {
  // Reset client to get fresh in-memory DB
  resetClient();
  const client = getClient();

  // Run migrations
  const migrationsPath = join(__dirname, '../../../db/migrations');

  try {
    const schema001 = readFileSync(join(migrationsPath, '001_initial_schema.sql'), 'utf-8');
    const schema002 = readFileSync(join(migrationsPath, '002_saas_tables.sql'), 'utf-8');

    // Execute migrations
    const statements001 = schema001
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements001) {
      await client.execute(stmt);
    }

    const statements002 = schema002
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements002) {
      await client.execute(stmt);
    }
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
});

afterAll(async () => {
  // Close client after all tests in file
  const { closeClient } = await import('../../../db/config.js');
  await closeClient();
});
