/**
 * HTTP handler shared by POST /integrations/hts-classify (ISF wizard wand)
 * and POST /compliance/classify-hts (Compliance > Classification).
 * Failures are reported as what they are; never as an empty "no results".
 */
import type { Response } from 'express';
import { z } from 'zod';
import logger from '../../config/logger.js';
import type { AuthRequest } from '../../middleware/auth.js';
import { AiRateLimitedError } from '../ai.js';
import { classifyProduct, ClassifyInputError } from './index.js';

const Body = z.object({ description: z.string() });

export async function classifyHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Description is required.' });
    return;
  }
  try {
    res.json(await classifyProduct(parsed.data.description, { userId: req.user!.id, orgId: req.user!.orgId }));
  } catch (err: any) {
    if (err instanceof ClassifyInputError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof AiRateLimitedError) {
      res.status(429).json({ error: 'Daily HTS suggestion limit reached. It resets at midnight UTC.' });
    } else {
      logger.error({ err: err?.message }, '[HTS] classify failed');
      res.status(503).json({ error: 'HTS suggestions are temporarily unavailable.' });
    }
  }
}
