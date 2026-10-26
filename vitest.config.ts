import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@autoreels/media': fileURLToPath(new URL('./packages/media/src/index.ts', import.meta.url)),
      '@autoreels/scheduler': fileURLToPath(
        new URL('./packages/scheduler/src/index.ts', import.meta.url),
      ),
      '@autoreels/contracts': fileURLToPath(
        new URL('./packages/contracts/src/index.ts', import.meta.url),
      ),
      '@autoreels/domain': fileURLToPath(
        new URL('./packages/domain/src/index.ts', import.meta.url),
      ),
      '@autoreels/database': fileURLToPath(
        new URL('./packages/database/src/index.ts', import.meta.url),
      ),
      '@autoreels/editor': fileURLToPath(
        new URL('./packages/editor/src/index.ts', import.meta.url),
      ),
      '@autoreels/workflow-engine': fileURLToPath(
        new URL('./packages/workflow-engine/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10000,
    restoreMocks: true,
  },
});
