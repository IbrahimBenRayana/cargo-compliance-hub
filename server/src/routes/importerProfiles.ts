/**
 * Saved importers (CBP foreign IOR rule, docs/specs/foreign-ior-rule.md §3):
 * the entry wizard looks up what the org last declared for an importer of
 * record. Profiles are written by the entry save, not here.
 */
import { Router, type Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { requireCapability } from '../middleware/requireCapability.js';
import { CAPABILITIES } from '../config/plans.js';
import { findImporterProfile } from '../services/importerProfiles.js';

const router = Router();
router.use(authMiddleware);
router.use(requireCapability(CAPABILITIES.ABI_ENTRY));

// GET /api/v1/importer-profiles/lookup?number=12-3456789
router.get('/lookup', async (req: AuthRequest, res: Response): Promise<void> => {
  const number = typeof req.query.number === 'string' ? req.query.number : '';
  if (!number || number.length > 20) {
    res.status(400).json({ error: 'number (string, ≤20 chars) is required' });
    return;
  }
  const profile = await findImporterProfile(req.user!.orgId, number);
  res.json({
    data: profile && {
      iorNumber: profile.iorNumber,
      name: profile.name,
      usIorStatus: profile.usIorStatus,
      ctpatStatus: profile.ctpatStatus,
      declaredByEmail: profile.declaredByEmail,
      declaredAt: profile.declaredAt,
    },
  });
});

export default router;
