import { defineConfig } from 'vitest/config';

// Server-side tests only — no DOM, no React. The repo root has a
// vitest.config.ts for the frontend; this one keeps the two suites
// from picking up each other's setup files.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    // No setupFiles — pure unit tests.
  },
});
