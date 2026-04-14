import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.js';
import filingRoutes from './routes/filings.js';
import submissionLogRoutes from './routes/submissionLogs.js';
import notificationRoutes from './routes/notifications.js';
import integrationRoutes from './routes/integrations.js';
import templateRoutes from './routes/templates.js';
import settingsRoutes from './routes/settings.js';
import organizationRoutes from './routes/organization.js';
import documentRoutes from './routes/documents.js';
import exportRoutes from './routes/export.js';
import { startBackgroundJobs, stopBackgroundJobs, waitForJobsToFinish, getJobStatus, pollSubmittedFilings, checkDeadlines } from './services/backgroundJobs.js';
import { verifyEmailConnection } from './services/email.js';
import logger from './config/logger.js';

const app = express();

// ─── Global Middleware ────────────────────────────────────
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
app.use(cors({
  origin: env.NODE_ENV === 'production'
    ? [env.FRONTEND_URL]
    : [env.FRONTEND_URL, 'http://localhost:8080', 'http://localhost:5173'],
  credentials: true,
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(generalLimiter);

// ─── Request Correlation ID ───────────────────────────────
// Attach a unique ID to every request for log tracing.
// Forwards X-Request-ID from client if present, otherwise generates one.
app.use((req, res, next) => {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
});

// ─── Health Check ─────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  // Database ping
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  const allOk = Object.values(checks).every(v => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    checks,
    jobs: getJobStatus(),
  });
});

// ─── API Routes (v1) ─────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/filings', filingRoutes);
app.use('/api/v1/submission-logs', submissionLogRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/organization', organizationRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/export', exportRoutes);

// ─── Background Jobs Endpoints ────────────────────────────
// GET job status + POST manual trigger (for admin/testing)
app.get('/api/v1/jobs/status', (_req, res) => {
  res.json(getJobStatus());
});

app.post('/api/v1/jobs/trigger-status-poll', async (_req, res) => {
  try {
    await pollSubmittedFilings();
    res.json({ success: true, ...getJobStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/jobs/trigger-deadline-check', async (_req, res) => {
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
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────
async function main() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    const server = app.listen(env.PORT, () => {
      logger.info({
        port: env.PORT,
        environment: env.NODE_ENV,
        frontend: env.FRONTEND_URL,
        ccApi: env.CC_API_BASE_URL,
      }, 'MyCargoLens API started');
    });

    // Start background jobs after server is listening
    startBackgroundJobs();

    // Verify email connection (non-blocking)
    verifyEmailConnection();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received — shutting down gracefully');
      stopBackgroundJobs();
      await waitForJobsToFinish();
      server.close(() => {
        prisma.$disconnect().then(() => {
          logger.info('Database disconnected. Goodbye.');
          process.exit(0);
        });
      });
      // Force exit after 10s
      setTimeout(() => {
        logger.error('Forced shutdown after 10s timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

main();
