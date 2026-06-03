import { defineConfig } from 'vitest/config';

// Server-side tests only — no DOM, no React. The repo root has a
// vitest.config.ts for the frontend; this one keeps the two suites
// from picking up each other's setup files.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    // Setup file plants safe env-var defaults so any test that
    // transitively imports config/env.ts doesn't trip Zod's validation
    // (which process.exit(1)s on missing JWT_*/DATABASE_URL).
    // DB-touching tests can override per-suite. See src/test-setup.ts.
    setupFiles: ['./src/test-setup.ts'],
  },
});
