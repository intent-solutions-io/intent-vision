import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: projectRoot,
    include: ['packages/operator/tests/**/*.test.ts'],
    fileParallelism: false,
    sequence: {
      shuffle: false,
    },
    env: {
      // Use in-memory SQLite database for tests
      INTENTVISION_DB_URL: ':memory:',
      INTENTVISION_JWT_SECRET: 'test-secret-for-unit-tests',
    },
  },
  resolve: {
    alias: {
      '@intentvision/contracts': path.resolve(projectRoot, 'packages/contracts/src'),
    },
  },
});
