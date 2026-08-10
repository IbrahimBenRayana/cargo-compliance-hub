/**
 * ABI certification ops console (workstream H) — platform-admin API for
 * running the CBP CERT test: generate scenario transmissions from the
 * Phase-3 fixture registry, track their lifecycle, and parse pasted
 * AX/UC/… responses with the matching application parser.
 *
 * Transport to CBP is Phase 4 (comms method arrives with the filer code);
 * until then "transmitted" is recorded manually after sending through the
 * agreed channel.
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest, requirePlatformAdmin } from '../middleware/auth.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';
import { SCENARIOS, SCENARIO_INDEX, type CertParams } from '../abi-engine/scenarios/index.js';
import { RecordCodecError } from '../abi-engine/records/codec.js';
import { parseAeResponseBatch } from '../abi-engine/ae/responseParser.js';
import { parseCwResponseBatch, parseCjResponseBatch } from '../abi-engine/index.js';
import { parseAdCvdResponseBatch } from '../abi-engine/apps/adcvd/responseParser.js';
import { parseQuotaResponseBatch } from '../abi-engine/apps/quota/responseParser.js';
import { parseTibResponseBatch } from '../abi-engine/apps/tib/responseParser.js';
import { parseEsQueryResponseBatch } from '../abi-engine/apps/esQuery/responseParser.js';
import { parseUcNotificationBatch } from '../abi-engine/apps/uc/parser.js';

const router = Router();
router.use(authMiddleware);
router.use(requirePlatformAdmin);

const PARAMS_ID = 'default';

async function loadParams(): Promise<CertParams> {
  const row =
    (await prisma.certParamsConfig.findUnique({ where: { id: PARAMS_ID } })) ??
    (await prisma.certParamsConfig.create({ data: { id: PARAMS_ID } }));
  return {
    sender: { siteCode: row.senderSiteCode, idCode: row.senderIdCode, password: row.senderPassword },
    filerCode: row.filerCode,
    districtPortOfEntry: row.districtPortOfEntry,
    importerOfRecordNumber: row.importerOfRecordNumber,
    importerName: row.importerName,
    consigneeNumber: row.consigneeNumber,
    suretyCompanyCode: row.suretyCompanyCode,
    currentYear: row.currentYear,
    applicabilityDate: row.applicabilityDate,
  };
}

// ─── GET /params ──────────────────────────────────────────
router.get('/params', async (_req: AuthRequest, res: Response): Promise<void> => {
  const row =
    (await prisma.certParamsConfig.findUnique({ where: { id: PARAMS_ID } })) ??
    (await prisma.certParamsConfig.create({ data: { id: PARAMS_ID } }));
  res.json({ params: row });
});

const paramsSchema = z.object({
  filerCode: z.string().regex(/^[A-Z0-9]{3}$/i),
  importerOfRecordNumber: z.string().min(1).max(12),
  importerName: z.string().min(1).max(60),
  consigneeNumber: z.string().min(1).max(12),
  suretyCompanyCode: z.string().length(3),
  districtPortOfEntry: z.string().length(4),
  currentYear: z.string().regex(/^\d{4}$/),
  applicabilityDate: z.string().regex(/^\d{8}$/),
  senderSiteCode: z.string().min(1).max(4),
  senderIdCode: z.string().min(1).max(4),
  senderPassword: z.string().min(1).max(6),
});

// ─── PUT /params ──────────────────────────────────────────
router.put('/params', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = paramsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const row = await prisma.certParamsConfig.upsert({
    where: { id: PARAMS_ID },
    update: parsed.data,
    create: { id: PARAMS_ID, ...parsed.data },
  });
  await writeAuditLog({
    orgId: req.user!.orgId, userId: req.user!.id,
    action: 'cert.params_updated', entityType: 'cert_params', entityId: PARAMS_ID,
    ...getRequestMeta(req),
  });
  res.json({ params: row });
});

// ─── GET /scenarios ───────────────────────────────────────
// The full 89 with encode status + latest transmission state.
router.get('/scenarios', async (_req: AuthRequest, res: Response): Promise<void> => {
  const latest = await prisma.certTransmission.findMany({
    orderBy: { createdAt: 'desc' },
    distinct: ['scenarioId'],
    select: { scenarioId: true, id: true, status: true, updatedAt: true },
  });
  const latestById = new Map(latest.map((t) => [t.scenarioId, t]));
  const encoded = SCENARIOS.map((s) => ({
    id: s.id,
    title: s.title,
    application: s.application,
    kind: s.kind,
    notes: s.notes ?? null,
    encoded: true,
    latest: latestById.get(s.id) ?? null,
  }));
  res.json({ scenarios: encoded.sort((a, b) => a.id.localeCompare(b.id)) });
});

// ─── POST /scenarios/:id/generate ─────────────────────────
// Run the fixture against the stored params; store wire text (transmit
// scenarios) or client-side rejection evidence (reject scenarios).
router.post('/scenarios/:id/generate', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const scenario = SCENARIO_INDEX.get(id);
  if (!scenario) {
    res.status(404).json({ error: `Scenario ${id} is not encoded` });
    return;
  }
  const params = await loadParams();
  try {
    const result = await scenario.run(params);
    const isWire = Array.isArray(result) && typeof result[0] === 'string';
    const transmission = await prisma.certTransmission.create({
      data: isWire
        ? { scenarioId: id, status: 'generated', wireText: (result as string[]).join('\n') }
        : {
            scenarioId: id,
            status: 'rejected_clientside',
            wireText: '',
            evidenceText: (result as { severity: string; field: string; message: string }[])
              .map((i) => `${i.severity} ${i.field}: ${i.message}`)
              .join('\n'),
          },
    });
    res.status(201).json({ transmission });
  } catch (err) {
    if (err instanceof RecordCodecError) {
      res.status(422).json({
        error: 'Scenario failed to build with the current parameters',
        issues: err.issues,
      });
      return;
    }
    throw err;
  }
});

// ─── GET /scenarios/:id/transmissions ─────────────────────
router.get('/scenarios/:id/transmissions', async (req: AuthRequest, res: Response): Promise<void> => {
  const transmissions = await prisma.certTransmission.findMany({
    where: { scenarioId: String(req.params.id) },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ transmissions });
});

const RESPONSE_PARSERS: Record<string, (lines: string[]) => unknown> = {
  AE: parseAeResponseBatch,
  CW: parseCwResponseBatch,
  CJ: parseCjResponseBatch,
  AD: parseAdCvdResponseBatch,
  QA: parseQuotaResponseBatch,
  TE: parseTibResponseBatch,
  EQ: parseEsQueryResponseBatch,
  UC: parseUcNotificationBatch,
};

const updateSchema = z.object({
  status: z.enum(['generated', 'rejected_clientside', 'transmitted', 'accepted', 'rejected', 'conditional']).optional(),
  responseText: z.string().max(500_000).optional(),
  notes: z.string().max(10_000).optional(),
});

// ─── PATCH /transmissions/:id ─────────────────────────────
// Record lifecycle changes and paste CBP responses; responses are parsed
// with the scenario's application parser and stored alongside the raw text.
router.patch('/transmissions/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.certTransmission.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) {
    res.status(404).json({ error: 'Transmission not found' });
    return;
  }

  let responseParsed: unknown;
  let parseError: string | undefined;
  if (parsed.data.responseText !== undefined) {
    const scenario = SCENARIO_INDEX.get(existing.scenarioId);
    const parser = scenario ? RESPONSE_PARSERS[scenario.application] : undefined;
    if (parser) {
      try {
        responseParsed = parser(parsed.data.responseText.split(/\r?\n/).filter((l) => l.length > 0));
      } catch (err) {
        parseError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  const transmission = await prisma.certTransmission.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      ...(parsed.data.responseText !== undefined
        ? {
            responseText: parsed.data.responseText,
            responseParsed: responseParsed === undefined ? undefined : JSON.parse(JSON.stringify(responseParsed)),
          }
        : {}),
    },
  });
  res.json({ transmission, parseError });
});

export default router;
