/**
 * Vitest Global Setup
 * Runs before each test file to ensure database is initialized
 *
 * Task ID: intentvision-rhs.1
 */

import { getClient, resetClient, runMigrations, closeClient } from '../../../db/config.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, afterAll } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _migrationsDone = false;

beforeAll(async () => {
  // Reset client to ensure fresh state
  resetClient();

  // Only run migrations once per test run (shared memory DB persists)
  if (!_migrationsDone) {
    const migrationsPath = join(__dirname, '../../../db/migrations');

    try {
      const applied = await runMigrations(migrationsPath);
      if (applied.length > 0) {
        console.log(`[vitest-setup] Applied ${applied.length} migrations`);
      }
      _migrationsDone = true;
    } catch (error) {
      console.error('[vitest-setup] Failed to initialize test database:', error);
      throw error;
    }
  }
});

afterAll(async () => {
  // Close client after all tests in file
  await closeClient();
});
