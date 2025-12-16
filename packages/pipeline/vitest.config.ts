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
    include: ['packages/pipeline/tests/**/*.test.ts'],
    setupFiles: ['packages/pipeline/tests/vitest-setup.ts'],
    fileParallelism: false, // Run test files sequentially to avoid DB locking
    pool: 'forks', // Use separate processes for better isolation
    poolOptions: {
      forks: {
        singleFork: true, // Single process for all tests
      },
    },
    sequence: {
      shuffle: false,
    },
    testTimeout: 30000, // 30s timeout for E2E tests
  },
  resolve: {
    alias: {
      '@intentvision/contracts': path.resolve(projectRoot, 'packages/contracts/src'),
    },
  },
});
