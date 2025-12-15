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
    fileParallelism: false, // Run test files sequentially to avoid DB locking
    sequence: {
      shuffle: false,
    },
  },
  resolve: {
    alias: {
      '@intentvision/contracts': path.resolve(projectRoot, 'packages/contracts/src'),
    },
  },
});
