#!/usr/bin/env npx ts-node
/**
 * Database Migration CLI
 *
 * Usage:
 *   npx tsx db/migrate.ts status    - Show migration status
 *   npx tsx db/migrate.ts run       - Run pending migrations
 *   npx tsx db/migrate.ts test      - Test database connection
 */

import { runMigrations, getMigrationStatus, getClient, closeClient } from './config.js';

async function main() {
  const command = process.argv[2] || 'status';

  try {
    switch (command) {
      case 'status': {
        const status = await getMigrationStatus();
        console.log('Migration Status:');
        console.log(`  Applied: ${status.applied.length}`);
        for (const m of status.applied) {
          console.log(`    ✓ ${m}`);
        }
        console.log(`  Pending: ${status.pending.length}`);
        for (const m of status.pending) {
          console.log(`    ○ ${m}`);
        }
        break;
      }

      case 'run': {
        console.log('Running migrations...');
        const applied = await runMigrations();
        if (applied.length === 0) {
          console.log('No pending migrations.');
        } else {
          console.log(`Applied ${applied.length} migration(s).`);
        }
        break;
      }

      case 'test': {
        console.log('Testing database connection...');
        const client = getClient();
        const result = await client.execute('SELECT 1 as test');
        console.log('Connection successful:', result.rows[0]);
        break;
      }

      default:
        console.log('Unknown command:', command);
        console.log('Usage: npx tsx db/migrate.ts [status|run|test]');
        process.exit(1);
    }
  } finally {
    await closeClient();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
