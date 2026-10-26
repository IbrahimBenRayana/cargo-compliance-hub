/**
 * API-01 (testing week): the 100/min per-IP general limiter was mounted on the
 * app AND again on the public API router, so each public call counted twice
 * and integrations hit 429 at ~50 requests a minute (the 300/min per-key
 * ceiling could never be reached).
 */
import { describe, it, expect } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { generalLimiter, publicApiIpLimiter } from '../rateLimiter.js';

describe('public API rate limiting', () => {
  it('counts a public API request once against the per-IP limit', async () => {
    const app = express();
    app.use(generalLimiter);
    const api = express.Router();
    api.use(publicApiIpLimiter);
    api.get('/ping', (_req, res) => { res.json({ ok: true }); });
    app.use('/api/public/v1', api);
    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const statuses: number[] = [];
      for (let i = 0; i < 60; i++) statuses.push((await fetch(`http://127.0.0.1:${port}/api/public/v1/ping`)).status);
      expect(statuses.filter((s) => s === 429)).toHaveLength(0);
    } finally {
      server.close();
    }
  });

  // X-07 (testing week): the general limiter ran before express.static and
  // the SPA fallback, so page loads and JS chunks counted as API calls; with
  // route-level code splitting a few navigations returned the 429 JSON
  // instead of the app.
  it('does not count page loads and static assets against the API limit', async () => {
    const app = express();
    app.use(generalLimiter);
    app.get(/^\/assets\/.*/, (_req, res) => { res.type('js').send('x'); });
    app.get(/^\/(?!api\/).*/, (_req, res) => { res.type('html').send('<html></html>'); });
    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const statuses: number[] = [];
      for (let i = 0; i < 120; i++) statuses.push((await fetch(`http://127.0.0.1:${port}/assets/chunk-${i}.js`)).status);
      statuses.push((await fetch(`http://127.0.0.1:${port}/settings`)).status);
      expect(statuses.filter((s) => s === 429)).toHaveLength(0);
    } finally {
      server.close();
    }
  });
});
