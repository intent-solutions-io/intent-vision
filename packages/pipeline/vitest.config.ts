import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: path.resolve(__dirname, '../..'),
    include: ['packages/pipeline/tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@intentvision/contracts': path.resolve(__dirname, '../contracts/src'),
    },
  },
});
