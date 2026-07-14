import { Router } from 'express';
import { generalLimiter } from '../middleware/rateLimiter.js';
import { getJobStatus } from '../services/backgroundJobs.js';

const router = Router();

// Server-start time is captured at module load. Used to soften the health
// signal in the "cold start" window: cron doesn't fire immediately when
// scheduled, so `statusPoll.lastRun` stays null for up to STATUS_POLL_INTERVAL
// after a deploy. Without this, the footer would show "Degraded" for the
// first 5 minutes of every deploy — misleading.
const SERVER_STARTED_AT = Date.now();

// Public status endpoint — powers the marketing-site footer "system status"
// strip. No auth: the numbers here are safe to expose publicly (last-poll
// timestamps, sync freshness, incident count). Rate-limited so a runaway
// polling client can't hammer the server.
//
// Response shape is intentionally shallow — the landing page renders directly
// off these fields and shouldn't need to interpret job internals.

// CBP status poll runs every 5 minutes. Treat it as "healthy" if the last
// poll was within 6 minutes (one cycle plus a small buffer). Treat as
// "degraded" beyond that.
const CBP_HEALTHY_WINDOW_MS = 6 * 60 * 1000;
// ADD/CVD sync runs daily at 04:00 UTC. Treat as "healthy" if the last sync
// was within 26 hours (one cycle plus a 2-hour buffer for slow days).
const ADD_CVD_HEALTHY_WINDOW_MS = 26 * 60 * 60 * 1000;

router.get('/', generalLimiter, (_req, res) => {
  const jobs = getJobStatus();
  const now = Date.now();

  const cbpLastRunIso = jobs.statusPoll.lastRun;
  const cbpLastPingSecondsAgo = cbpLastRunIso
    ? Math.max(0, Math.floor((now - Date.parse(cbpLastRunIso)) / 1000))
    : null;
  // Cold-start grace: if the server just booted and cron hasn't fired yet,
  // don't report "degraded" — the first CBP poll is imminent.
  const withinColdStart = now - SERVER_STARTED_AT < CBP_HEALTHY_WINDOW_MS;
  const cbpHealthy = cbpLastRunIso
    ? now - Date.parse(cbpLastRunIso) < CBP_HEALTHY_WINDOW_MS
    : withinColdStart;

  const addCvdLastRunIso = jobs.addCvdSync.lastRun;
  // ADD/CVD fires once/day at 04:00 UTC. If the server hasn't been up long
  // enough to have observed a run yet, don't call it unhealthy — the sync
  // will just fire on the next 04:00 UTC. Only treat as unhealthy if the
  // in-memory record is stale AND the server has been up long enough that
  // a sync should have completed (~24h + buffer).
  const uptimeMs = now - SERVER_STARTED_AT;
  const addCvdHealthy = addCvdLastRunIso
    ? now - Date.parse(addCvdLastRunIso) < ADD_CVD_HEALTHY_WINDOW_MS
    : uptimeMs < ADD_CVD_HEALTHY_WINDOW_MS;

  // The failure-tally from the last CBP poll cycle. A non-zero value means
  // one or more filings couldn't be reached from CustomsCity — user-visible
  // as an incident.
  const openIncidents = jobs.statusPoll.stats?.errors ?? 0;

  const allSystemsOperational = cbpHealthy && addCvdHealthy && openIncidents === 0;

  res.set('Cache-Control', 'public, max-age=15');
  res.json({
    cbp: {
      lastPingSecondsAgo: cbpLastPingSecondsAgo,
      lastPingIso: cbpLastRunIso,
      healthy: cbpHealthy,
    },
    addCvd: {
      lastSyncedIso: addCvdLastRunIso,
      healthy: addCvdHealthy,
    },
    openIncidents,
    allSystemsOperational,
    fetchedAtIso: new Date().toISOString(),
  });
});

export default router;
