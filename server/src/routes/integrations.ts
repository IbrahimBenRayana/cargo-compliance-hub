import { Router, Request, Response } from 'express';
import { ccClient } from '../services/customscity.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAPABILITIES } from '../config/plans.js';
import { sendTestEmail, verifyEmailConnection } from '../services/email.js';
import { env } from '../config/env.js';

const router = Router();
router.use(authMiddleware);

// ─── POST /api/v1/integrations/test — Test CC API connection
router.post('/test', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const connected = await ccClient.testConnection();
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

// ─── POST /api/v1/integrations/hts-classify — AI HTS ──────
router.post('/hts-classify', requireCapability(CAPABILITIES.HTS_CLASSIFICATION), async (req: AuthRequest, res: Response): Promise<void> => {
  const { description } = req.body;
  if (!description || !description.trim()) {
    res.status(400).json({ error: 'Description is required' });
    return;
  }
  
  try {
    const result = await ccClient.classifyHTS(description.trim());
    const raw = result.data as any;

    // Actual CC API response structure:
    // {
    //   items: [{
    //     description: "...",
    //     classification: { hts: "7318152061", name: "HEXAGONAL HEAD BOLT..." },
    //     classifierResponse: {
    //       selected_hts: "7318.15.20.61",
    //       explanation: "...",
    //       hts_review_result: {
    //         recomendations: [{ hts: "7318.15.20.61", description: "..." }, ...]
    //       },
    //       coherence_validation?: { is_coherent: bool, explanation: "..." }
    //     }
    //   }]
    // }

    const item = raw?.items?.[0];
    if (!item) {
      res.json({ suggestions: [], message: 'No classification results returned.' });
      return;
    }

    // Check coherence — CC API flags vague descriptions
    const coherence = item?.classifierResponse?.coherence_validation;
    if (coherence && !coherence.is_coherent) {
      res.json({
        suggestions: [],
        message: coherence.explanation || 'Description is too vague for classification. Please be more specific.',
      });
      return;
    }

    const suggestions: { code: string; description: string; score: number | null }[] = [];

    // Primary: grab recommendations from hts_review_result
    const recommendations = item?.classifierResponse?.hts_review_result?.recomendations
      || item?.classifierResponse?.hts_review_result?.recommendations // typo guard
      || [];

    if (recommendations.length > 0) {
      for (const rec of recommendations.slice(0, 10)) {
        suggestions.push({
          code: rec.hts || '',
          description: rec.description || '',
          score: rec.score ?? null,
        });
      }
    }

    // Fallback: if no recommendations, use the top-level classification
    if (suggestions.length === 0 && item?.classification?.hts) {
      suggestions.push({
        code: item.classifierResponse?.selected_hts || item.classification.hts,
        description: item.classification.name || item.classifierResponse?.explanation || '',
        score: null,
      });
    }

    // Clean: filter out empty codes
    const cleaned = suggestions.filter(s => s.code);

    res.json({ suggestions: cleaned });
  } catch (err: any) {
    res.status(502).json({ error: 'HTS classification failed', message: err.message });
  }
});

// ─── GET /api/v1/integrations/mid-list — MID lookup ───────
router.get('/mid-list', requireCapability(CAPABILITIES.ABI_ENTRY), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await ccClient.getMIDList();
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
