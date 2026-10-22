/**
 * HTTP handler shared by POST /integrations/hts-classify (ISF wizard wand)
 * and POST /compliance/classify-hts (Compliance > Classification).
 * Failures are reported as what they are; never as an empty "no results".
 * Every AI classification uses the user's allowance (limits.ts); a repeat of
 * a recent description is answered from the stored result, free.
 */
import type { Response } from 'express';
import { z } from 'zod';
import logger from '../../config/logger.js';
import type { AuthRequest } from '../../middleware/auth.js';
import { AiRateLimitedError } from '../ai.js';
import { classifyProduct, ClassifyInputError } from './index.js';
import { cachedResult, HtsLimitError, recordRepeat, reserve, usageFor } from './limits.js';

const Body = z.object({ description: z.string() });

export async function classifyHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Description is required.' });
    return;
  }
  const who = { userId: req.user!.id, orgId: req.user!.orgId };
  const description = parsed.data.description;
  try {
    const repeat = await cachedResult(who.orgId, description);
    if (repeat) {
      await recordRepeat(who, description, repeat);
      res.json({ ...repeat, repeat: true, usage: await usageFor(who) });
      return;
    }
    const release = await reserve(who);
    let result;
    try {
      result = await classifyProduct(description, who);
    } finally {
      release();
    }
    res.json({ ...result, usage: await usageFor(who) });
  } catch (err: any) {
    if (err instanceof HtsLimitError) {
      res.status(429).json({ error: err.message, limit: err.scope, resetsAt: err.resetsAt.toISOString(), usage: await usageFor(who).catch(() => undefined) });
    } else if (err instanceof ClassifyInputError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof AiRateLimitedError) {
      res.status(429).json({ error: 'Daily HTS suggestion limit reached. It resets at midnight UTC.' });
    } else {
      logger.error({ err: err?.message }, '[HTS] classify failed');
      res.status(503).json({ error: 'HTS suggestions are temporarily unavailable.' });
    }
  }
}
