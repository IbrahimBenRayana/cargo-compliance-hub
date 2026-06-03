// Vitest setup — runs once before any test file imports.
//
// env.ts validates DATABASE_URL + JWT_*_SECRET at module load and calls
// process.exit(1) when the schema fails. Pure unit tests have no
// business depending on a .env file (and CI never has one), so we plant
// safe placeholder values up-front. Real values would only matter for
// tests that actually hit the DB or sign tokens — those tests can
// override per-suite.
process.env.DATABASE_URL ??=
  'postgresql://test:test@localhost:5432/mycargolens_test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-16-chars-long';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-16-chars-long';
process.env.NODE_ENV ??= 'test';
