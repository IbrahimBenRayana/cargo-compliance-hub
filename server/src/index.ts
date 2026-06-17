// Sentry instrumentation MUST be the first import — see instrument.ts.
import './instrument.js';
import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { authMiddleware, requireRole } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import complianceRoutes from './routes/compliance.js';
import filingRoutes from './routes/filings.js';
import submissionLogRoutes from './routes/submissionLogs.js';
import notificationRoutes from './routes/notifications.js';
import integrationRoutes from './routes/integrations.js';
import templateRoutes from './routes/templates.js';
import settingsRoutes from './routes/settings.js';
import organizationRoutes from './routes/organization.js';
import documentRoutes from './routes/documents.js';
import exportRoutes from './routes/export.js';
import billingRoutes from './routes/billing.js';
import manifestQueryRoutes from './routes/manifestQuery.js';
import abiDocumentsRoutes from './routes/abiDocuments.js';
import dutyCalculationRoutes from './routes/dutyCalculation.js';
import trackingRoutes from './routes/tracking.js';
import contactRoutes from './routes/contact.js';
import { startBackgroundJobs, stopBackgroundJobs, getJobStatus, pollSubmittedFilings, checkDeadlines } from './services/backgroundJobs.js';
import { startNotificationStream, stopNotificationStream } from './services/notificationStream.js';
import { verifyEmailConnection } from './services/email.js';

const app = express();

// ─── Global Middleware ────────────────────────────────────
// Trust the first proxy (nginx) so express-rate-limit sees real client IPs
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://api-cert.customscity.com", "https://api.customscity.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
}));
// CORS: the SPA is the primary client (FRONTEND_URL = app.mycargolens.com),
// but the marketing site at LANDING_URL (mycargolens.com) now calls
// /api/v1/contact. Both origins are allowed in production. In dev we also
// allow the Vite ports + the landing dev server (3100).
app.use(cors({
  origin: env.NODE_ENV === 'production'
    ? [env.FRONTEND_URL, env.LANDING_URL].filter(Boolean) as string[]
    : [env.FRONTEND_URL, env.LANDING_URL, 'http://localhost:8080', 'http://localhost:5173', 'http://localhost:3100'].filter(Boolean) as string[],
  credentials: true,
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// MUST be before express.json() — Stripe webhook needs raw body for signature verification
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));
// cookie-parser populates req.cookies for the /auth/refresh handler, which
// reads its refresh token from an httpOnly cookie instead of the body
// (audit Phase 6). Mounted globally so any future cookie-bearing route
// works without re-mounting; the refresh cookie itself is path-scoped to
// /api/v1/auth/refresh so it doesn't ride along on unrelated requests.
app.use(cookieParser());
app.use(generalLimiter);

// ─── Health Check ─────────────────────────────────────────
// Probes Postgres on every call so Docker's container healthcheck flips
// to unhealthy when the DB is unreachable — that's the trigger we need
// for auto-restart + monitoring alerts. Previously this endpoint returned
// 200 unconditionally, which masked the 22-hour outage on 2026-06-01.
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      db: 'up',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      jobs: getJobStatus(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'degraded',
      db: 'down',
      error: err?.message ?? 'db probe failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── API Routes (v1) ─────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/filings', filingRoutes);
app.use('/api/v1/submission-logs', submissionLogRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/organization', organizationRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/manifest-queries', manifestQueryRoutes);
app.use('/api/v1/abi-documents', abiDocumentsRoutes);
app.use('/api/v1/duty-calculation', dutyCalculationRoutes);
app.use('/api/v1/compliance', complianceRoutes);
app.use('/api/v1/tracking', trackingRoutes);
// Public, unauthenticated — marketing-site contact form. Rate-limited per IP
// inside the route module. Mount here so it sits under the same /api/v1
// prefix as everything else.
app.use('/api/v1/contact', contactRoutes);

// ─── Background Jobs Endpoints ────────────────────────────
// GET job status + POST manual trigger. Pre-fix these were mounted with
// only the generalLimiter (100 req/min/IP) and no auth — anyone on the
// public internet could hammer the CC API budget and spam notifications
// across every org. Now require an authenticated owner. If you need to
// run these from outside a logged-in session, do it via a one-off
// `npm run jobs:*` script on the server, not the public API.
app.get('/api/v1/jobs/status', authMiddleware, requireRole('owner'), (_req, res) => {
  res.json(getJobStatus());
});

app.post('/api/v1/jobs/trigger-status-poll', authMiddleware, requireRole('owner'), async (_req, res) => {
  try {
    await pollSubmittedFilings();
    res.json({ success: true, ...getJobStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/jobs/trigger-deadline-check', authMiddleware, requireRole('owner'), async (_req, res) => {
  try {
    await checkDeadlines();
    res.json({ success: true, ...getJobStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Serve Frontend (production) ──────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (env.NODE_ENV === 'production') {
  // In Docker: compiled JS is at /app/dist/index.js → frontend at /app/public-frontend
  // In bare-metal: look relative to the compiled output
  const frontendPath = path.resolve(__dirname, '..', 'public-frontend');
  app.use(express.static(frontendPath, { maxAge: '1d' }));

  // SPA catch-all: any non-API route serves index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  // Dev: just 404 for non-API routes (Vite handles frontend)
  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });
}

// ─── Error Handler ────────────────────────────────────────
// Sentry's express handler must come BEFORE our app errorHandler so
// thrown errors get captured before being formatted into a JSON response.
// No-op when SENTRY_DSN isn't set (init() is skipped in instrument.ts).
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────
async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 MyCargoLens API running on http://localhost:${env.PORT}`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(`   Frontend:    ${env.FRONTEND_URL}`);
      console.log(`   CC API:      ${env.CC_API_BASE_URL}`);
    });

    // Start background jobs after server is listening
    startBackgroundJobs();

    // Phase 7: open the Postgres LISTEN socket for real-time notification
    // streaming. Failures are non-fatal — clients fall back to 30s polling.
    startNotificationStream().catch(() => {});

    // Verify email connection (non-blocking)
    verifyEmailConnection();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
      stopBackgroundJobs();
      await stopNotificationStream().catch(() => {});
      server.close(() => {
        prisma.$disconnect().then(() => {
          console.log('[Server] Disconnected from database. Goodbye.');
          process.exit(0);
        });
      });
      // Force exit after 10s
      setTimeout(() => {
        console.error('[Server] Forced shutdown after 10s timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Global error nets (audit Phase 10). Pre-fix a stray Promise rejection
    // (typically from a fire-and-forget notification or a bare catch that
    // re-threw) would kill the process without running graceful shutdown,
    // dropping in-flight requests and any pending background work. We
    // forward the error to Sentry, log, and let the process die with code
    // 1 — Docker's restart-on-failure brings it back, but with a captured
    // stack trace instead of silent loss.
    process.on('unhandledRejection', (reason) => {
      // eslint-disable-next-line no-console
      console.error('[Server] Unhandled promise rejection:', reason);
      Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
    });
    process.on('uncaughtException', (err) => {
      // eslint-disable-next-line no-console
      console.error('[Server] Uncaught exception:', err);
      Sentry.captureException(err);
      // After capturing, exit so the container can restart into a clean state.
      // (Sentry's flush is async; give it 2 seconds before forcing exit.)
      Sentry.flush(2000).finally(() => process.exit(1));
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

main();
