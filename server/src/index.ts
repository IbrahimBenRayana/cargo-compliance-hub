import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
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
import { startBackgroundJobs, stopBackgroundJobs, getJobStatus, pollSubmittedFilings, checkDeadlines } from './services/backgroundJobs.js';
import { verifyEmailConnection } from './services/email.js';

const app = express();

// ─── Global Middleware ────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://api-cert.customscity.com", "https://api.customscity.com"],
    },
  },
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

// ─── Health Check ─────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
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
    console.log('✅ Database connected');

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 MyCargoLens API running on http://localhost:${env.PORT}`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(`   Frontend:    ${env.FRONTEND_URL}`);
      console.log(`   CC API:      ${env.CC_API_BASE_URL}`);
    });

    // Start background jobs after server is listening
    startBackgroundJobs();

    // Verify email connection (non-blocking)
    verifyEmailConnection();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
      stopBackgroundJobs();
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
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

main();
