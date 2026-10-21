import { Router, Request, Response } from 'express';
import { abiGateway } from '../services/abi/gateway.js';
import { authMiddleware, AuthRequest, requirePlatformAdmin } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAPABILITIES } from '../config/plans.js';
import { classifyLimiter } from '../middleware/rateLimiter.js';
import { classifyHandler } from '../services/htsClassifier/http.js';
import { sendTestEmail, verifyEmailConnection } from '../services/email.js';
import { env } from '../config/env.js';

const router = Router();
router.use(authMiddleware);

// ─── POST /api/v1/integrations/test — Test CC API connection
// Gateway diagnostics (environment, base URL) are for MyCargoLens staff only (audit USA-09).
router.post('/test', requirePlatformAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const connected = await abiGateway.testConnection();
    res.json({
      connected,
      environment: env.CC_ENVIRONMENT,
      baseUrl: env.CC_API_BASE_URL,
    });
  } catch (err: any) {
    res.json({
      connected: false,
      error: err.message,
    });
  }
});

// ─── POST /api/v1/integrations/hts-classify — HTS suggestions ──────
// Native classifier (services/htsClassifier); every plan, for now (2026-10-21).
router.post('/hts-classify', classifyLimiter, classifyHandler);

// ─── GET /api/v1/integrations/mid-list — MID lookup ───────
router.get('/mid-list', requireCapability(CAPABILITIES.ABI_ENTRY), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await abiGateway.getMIDList();
    res.json(result.data);
  } catch (err: any) {
    res.status(502).json({ error: 'MID lookup failed', message: err.message });
  }
});

// ─── POST /api/v1/integrations/test-email — Test SMTP ─────
router.post('/test-email', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const to = req.user!.email;
    const connected = await verifyEmailConnection();
    if (!connected) {
      res.json({ success: false, error: 'SMTP connection failed — check server email configuration.' });
      return;
    }

    const sent = await sendTestEmail(to);
    res.json({
      success: sent,
      message: sent ? `Test email sent to ${to}` : 'Failed to send test email',
    });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// ─── GET /api/v1/integrations/email-status — Check SMTP ──
router.get('/email-status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const connected = await verifyEmailConnection();
    res.json({
      configured: !!env.EMAIL_USER,
      connected,
      from: env.EMAIL_FROM,
    });
  } catch (err: any) {
    res.json({ configured: false, connected: false, error: err.message });
  }
});

export default router;
