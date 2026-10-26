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
});
