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
import { createTransport, MqiptTransport } from '../abi-engine/transport/index.js';
import { buildAddManufacturers } from '../abi-engine/apps/addManufacturer/builder.js';
import { CERT_MANUFACTURERS } from '../abi-engine/scenarios/certManufacturers.js';
import { buildHtsQuery } from '../abi-engine/apps/htsQuery/builder.js';
import { parseHtsQueryResponseBatch } from '../abi-engine/apps/htsQuery/responseParser.js';
import { buildBatch } from '../abi-engine/envelope/batch.js';
import { deriveMid } from '../abi-engine/payload/mid.js';

const router = Router();
router.use(authMiddleware);
router.use(requirePlatformAdmin);

// Phase-4 transport: mock loopback until CBP's MQIPT parameters land in env.
const transport = createTransport(process.env as Record<string, string | undefined>);

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
    // entityId is a UUID column — cert_params_config's 'default' id is not
    // one, so it stays in newValue (a bad id makes the audit write fail
    // silently — live finding, Aug 21).
    action: 'cert.params_updated', entityType: 'cert_params',
    newValue: { paramsId: PARAMS_ID },
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
  // Multi-phase scenarios (006) branch on their latest attached response.
  const prior = await prisma.certTransmission.findFirst({
    where: { scenarioId: id, responseText: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { responseText: true },
  });
  try {
    const result = await scenario.run(params, { priorResponseText: prior?.responseText ?? undefined });
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

// ─── POST /transmissions/:id/transmit ─────────────────────
// Send a generated transmission through the configured transport. With the
// mock transport this rehearses the full flow; once MQIPT is configured the
// same button reaches CBP CERT.
router.post('/transmissions/:id/transmit', async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.certTransmission.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) {
    res.status(404).json({ error: 'Transmission not found' });
    return;
  }
  if (existing.status !== 'generated') {
    res.status(409).json({ error: `Only freshly generated transmissions can be transmitted (status: ${existing.status})` });
    return;
  }
  if (!existing.wireText) {
    res.status(422).json({ error: 'This transmission has no wire text (client-side rejection scenarios are never transmitted)' });
    return;
  }
  try {
    const receipt = await transport.send(existing.wireText.split('\n'), { correlationId: existing.scenarioId });
    const transmission = await prisma.certTransmission.update({
      where: { id: existing.id },
      data: {
        status: 'transmitted',
        notes: `${existing.notes ? existing.notes + '\n' : ''}[transport:${transport.kind}] message ${receipt.messageId}`,
      },
    });
    await writeAuditLog({
      orgId: req.user!.orgId, userId: req.user!.id,
      action: 'cert.transmitted', entityType: 'cert_transmission', entityId: existing.id,
      newValue: { scenarioId: existing.scenarioId, transport: transport.kind, messageId: receipt.messageId },
      ...getRequestMeta(req),
    });
    res.json({ transmission, transport: transport.kind, messageId: receipt.messageId });
  } catch (err) {
    res.status(502).json({
      error: 'Transport send failed',
      detail: err instanceof Error ? err.message : String(err),
      transport: transport.kind,
    });
  }
});

// ─── GET /transport ───────────────────────────────────────
router.get('/transport', async (_req: AuthRequest, res: Response): Promise<void> => {
  const health = await transport.healthcheck();
  res.json({ transport: transport.kind, ...health });
});

// ─── response auto-attach ─────────────────────────────────
// Every scenario response batch echoes "SCENARIO nnn" in its B-record
// user-data — CBP's own correlation mechanism (the test doc offers it for
// exactly this). Attach the batch to that scenario's newest transmitted
// transmission, run the application parser, and set the lifecycle status
// from the verdict codes.
function scenarioTagOf(batch: string[]): string | null {
  for (const line of batch) {
    if (line.startsWith('B')) {
      const m = line.slice(59, 80).match(/SCENARIO\s+(\d{3})/);
      if (m) return m[1];
    }
  }
  return null;
}

function verdictStatusOf(batch: string[]): 'accepted' | 'rejected' | 'conditional' {
  const text = batch.join('\n');
  if (/E1A[I ]?995|SUMMARY HAS BEEN ADDED|SUMMARY HAS BEEN REPLACED/.test(text)) return 'accepted';
  if (/TRANSACTION DATA REJECTED|BATCH REJECTED/.test(text)) return 'rejected';
  return 'conditional';
}

async function attachBatch(batch: string[]): Promise<{ scenarioId: string; transmissionId: string; status: string } | null> {
  const scenarioId = scenarioTagOf(batch);
  if (!scenarioId) return null;
  const transmission = await prisma.certTransmission.findFirst({
    where: { scenarioId, status: { in: ['transmitted', 'rejected', 'conditional'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!transmission) return null;
  const scenario = SCENARIO_INDEX.get(scenarioId);
  const parser = scenario ? RESPONSE_PARSERS[scenario.application] : undefined;
  let responseParsed: unknown;
  try {
    responseParsed = parser ? parser(batch) : undefined;
  } catch {
    responseParsed = undefined; // raw text still attaches; parse failure is visible in the console
  }
  const status = verdictStatusOf(batch);
  await prisma.certTransmission.update({
    where: { id: transmission.id },
    data: {
      responseText: batch.join('\n'),
      responseParsed: responseParsed === undefined ? undefined : JSON.parse(JSON.stringify(responseParsed)),
      status,
    },
  });
  return { scenarioId, transmissionId: transmission.id, status };
}

// ─── POST /transport/receive ──────────────────────────────
// Drain available response batches from the live queue. Each batch is
// audit-logged verbatim (nothing off the queue is ever lost) and scenario
// batches auto-attach to their transmissions via the SCENARIO tag.
router.post('/transport/receive', async (req: AuthRequest, res: Response): Promise<void> => {
  const timeoutMs = Math.min(Math.max(Number(req.body?.timeoutMs) || 5000, 0), 30000);
  try {
    const batches = await transport.receive({ timeoutMs, max: 25 });
    const attached: Array<{ scenarioId: string; transmissionId: string; status: string }> = [];
    for (const batch of batches) {
      await writeAuditLog({
        orgId: req.user!.orgId, userId: req.user!.id,
        action: 'cert.received', entityType: 'cert_transmission',
        newValue: { transport: transport.kind, lines: batch },
        ...getRequestMeta(req),
      });
      const a = await attachBatch(batch);
      if (a) attached.push(a);
    }
    res.json({ transport: transport.kind, batches, attached });
  } catch (err) {
    res.status(502).json({
      error: 'Transport receive failed',
      detail: err instanceof Error ? err.message : String(err),
      transport: transport.kind,
    });
  }
});

// ─── POST /transport/attach-logged ────────────────────────
// One-click backfill: replay every audit-logged received batch through the
// auto-attach so historical responses land on their transmissions. Newest
// batch per scenario wins (rows replayed oldest-first).
router.post('/transport/attach-logged', async (req: AuthRequest, res: Response): Promise<void> => {
  const rows = await prisma.auditLog.findMany({
    where: { action: 'cert.received' },
    orderBy: { createdAt: 'asc' },
    select: { newValue: true },
  });
  const attached: Array<{ scenarioId: string; transmissionId: string; status: string }> = [];
  for (const row of rows) {
    const lines = (row.newValue as { lines?: string[] } | null)?.lines;
    if (!Array.isArray(lines)) continue;
    const a = await attachBatch(lines);
    if (a) attached.push(a);
  }
  await writeAuditLog({
    orgId: req.user!.orgId, userId: req.user!.id,
    action: 'cert.responses_backfilled', entityType: 'cert_transmission',
    newValue: { replayed: rows.length, attached: attached.length },
    ...getRequestMeta(req),
  });
  res.json({ replayed: rows.length, attached });
});

// ─── POST /transport/amf ──────────────────────────────────
// Background data for CERT: add a manufacturer (MID) to ACE's reference
// file via the $I application. Scenario manufacturers don't exist in CERT
// until added — AE filings bounce with F523 MFGR CODE UNKNOWN otherwise.
const amfSchema = z.object({
  name: z.string().min(1).max(100),
  street: z.string().max(94).optional(),
  city: z.string().min(1).max(67),
  countryCode: z.string().length(2),
  stateOrProvince: z.string().optional(),
  zipOrPostalCode: z.string().optional(),
  /** Expected MID — the batch is refused if the details derive differently. */
  expectedMid: z.string().min(6).max(15).optional(),
});
router.post('/transport/amf', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = amfSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  try {
    const derivedMid = deriveMid({
      name: d.name, address: d.street, city: d.city,
      countryCode: d.countryCode, stateOrProvince: d.stateOrProvince,
    });
    if (d.expectedMid && derivedMid !== d.expectedMid.toUpperCase()) {
      res.status(422).json({
        error: `These details derive MID ${derivedMid}, not ${d.expectedMid.toUpperCase()} — fix the firm details or the expected MID`,
      });
      return;
    }
    const params = await loadParams();
    const records = buildAddManufacturers([{
      action: 'add',
      countryCode: d.countryCode.toUpperCase(),
      stateOrProvince: d.stateOrProvince,
      name: d.name.toUpperCase(),
      street: d.street?.toUpperCase(),
      city: d.city.toUpperCase(),
      zipOrPostalCode: d.zipOrPostalCode,
      manufacturerId: derivedMid,
    }]);
    const lines = buildBatch({
      sender: params.sender,
      appId: '$I',
      blocks: [{
        port: params.districtPortOfEntry,
        filerCode: params.filerCode,
        userData: 'AMF BACKGROUND',
        transactionLines: records,
      }],
    });
    const receipt = await transport.send(lines, { correlationId: `AMF-${derivedMid.slice(0, 20)}` });
    await writeAuditLog({
      orgId: req.user!.orgId, userId: req.user!.id,
      action: 'cert.amf_sent', entityType: 'cert_transmission',
      newValue: { mid: derivedMid, transport: transport.kind, messageId: receipt.messageId, lines },
      ...getRequestMeta(req),
    });
    res.json({ mid: derivedMid, transport: transport.kind, messageId: receipt.messageId, lines });
  } catch (err) {
    if (err instanceof RecordCodecError) {
      res.status(422).json({ error: 'AMF batch failed to build', issues: err.issues });
      return;
    }
    res.status(502).json({
      error: 'AMF transmit failed',
      detail: err instanceof Error ? err.message : String(err),
      transport: transport.kind,
    });
  }
});

// ─── POST /transport/amf-bulk ─────────────────────────────
// Add every pending scenario manufacturer to CERT in chunked $I batches.
// Firm details ship in certManufacturers.ts, each verified to derive its
// MID byte-exact; the send re-checks derivation and refuses on mismatch.
router.post('/transport/amf-bulk', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pending = CERT_MANUFACTURERS.filter((m) => !m.added);
    if (pending.length === 0) {
      res.json({ transport: transport.kind, sent: 0, note: 'All scenario manufacturers are marked added.' });
      return;
    }
    for (const m of pending) {
      const derived = deriveMid({ name: m.name, address: m.street, city: m.city, countryCode: m.countryCode });
      if (derived !== m.mid) {
        res.status(422).json({ error: `certManufacturers.ts drift: ${m.mid} derives ${derived}` });
        return;
      }
    }
    const params = await loadParams();
    const CHUNK = 25;
    const receipts: string[] = [];
    for (let i = 0; i < pending.length; i += CHUNK) {
      const chunk = pending.slice(i, i + CHUNK);
      const records = buildAddManufacturers(chunk.map((m) => ({
        action: 'add' as const,
        countryCode: m.countryCode,
        name: m.name,
        street: m.street,
        city: m.city,
        zipOrPostalCode: m.zipOrPostalCode,
        manufacturerId: m.mid,
      })));
      const lines = buildBatch({
        sender: params.sender,
        appId: '$I',
        blocks: [{
          port: params.districtPortOfEntry,
          filerCode: params.filerCode,
          userData: 'AMF BULK',
          transactionLines: records,
        }],
      });
      const receipt = await transport.send(lines, { correlationId: `AMF-BULK-${i / CHUNK + 1}` });
      receipts.push(receipt.messageId);
    }
    await writeAuditLog({
      orgId: req.user!.orgId, userId: req.user!.id,
      action: 'cert.amf_bulk', entityType: 'cert_transmission',
      newValue: { count: pending.length, mids: pending.map((m) => m.mid), messageIds: receipts, transport: transport.kind },
      ...getRequestMeta(req),
    });
    res.json({ transport: transport.kind, sent: pending.length, batches: receipts.length, messageIds: receipts });
  } catch (err) {
    if (err instanceof RecordCodecError) {
      res.status(422).json({ error: 'AMF bulk batch failed to build', issues: err.issues });
      return;
    }
    res.status(502).json({
      error: 'AMF bulk transmit failed',
      detail: err instanceof Error ? err.message : String(err),
      transport: transport.kind,
    });
  }
});

// ─── POST /transport/hts-query ────────────────────────────
// Background data: interrogate ACE's OWN HTS table (HA/HY). CERT's table
// can differ from the published USITC tariff (live evidence: F642/F434 on
// currently-valid numbers) — filings must match what CERT accepts, so we
// query, wait for the HY batch, and parse it in one round-trip.
const htsQuerySchema = z.object({
  /** Single numbers ('99990084') or ranges ('99100000-99109999'). */
  htsNumbers: z.array(z.string().regex(/^\d{8,10}(-\d{8,10})?$/)).min(1).max(100),
  /** YYYYMMDD or MMDDYY; defaults to the params applicability date. */
  asOfDate: z.string().optional(),
});
router.post('/transport/hts-query', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = htsQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const params = await loadParams();
    const asOfDate = parsed.data.asOfDate ?? params.applicabilityDate;
    const records = buildHtsQuery(parsed.data.htsNumbers.map((token) => {
      const [from, to] = token.split('-');
      return { htsNumber: from, toHtsNumber: to, asOfDate };
    }));
    const lines = buildBatch({
      sender: params.sender,
      appId: 'HA',
      blocks: [{
        port: params.districtPortOfEntry,
        filerCode: params.filerCode,
        userData: 'HTS BACKGROUND',
        transactionLines: records,
      }],
    });
    const receipt = await transport.send(lines, { correlationId: 'HTS-QUERY' });
    // Query responses are fast — wait for the HY batch and parse inline.
    const batches = await transport.receive({ timeoutMs: 25000, max: 10 });
    const hyBatch = batches.find((b) => b.some((l) => l.startsWith('W')));
    const parsedResponse = hyBatch ? parseHtsQueryResponseBatch(hyBatch) : null;
    await writeAuditLog({
      orgId: req.user!.orgId, userId: req.user!.id,
      action: 'cert.hts_query', entityType: 'cert_transmission',
      newValue: { htsNumbers: parsed.data.htsNumbers, asOfDate, messageId: receipt.messageId, batches },
      ...getRequestMeta(req),
    });
    res.json({
      transport: transport.kind,
      messageId: receipt.messageId,
      raw: batches,
      parsed: parsedResponse,
      note: hyBatch ? undefined : 'No HY batch arrived within 25s — use Check for responses to drain it later.',
    });
  } catch (err) {
    if (err instanceof RecordCodecError) {
      res.status(422).json({ error: 'HTS query failed to build', issues: err.issues });
      return;
    }
    res.status(502).json({
      error: 'HTS query transmit failed',
      detail: err instanceof Error ? err.message : String(err),
      transport: transport.kind,
    });
  }
});

// ─── POST /transport/verify ───────────────────────────────
// CBP's own connectivity proof: put a probe on TRADE.VERIFY.QR and wait for
// the queue manager's echo on TRADE.VERIFY.QL. Only meaningful on mqipt.
router.post('/transport/verify', async (_req: AuthRequest, res: Response): Promise<void> => {
  if (!(transport instanceof MqiptTransport)) {
    res.json({ transport: transport.kind, ok: false, detail: 'verify is only available on the mqipt transport' });
    return;
  }
  const result = await transport.verify();
  res.json({ transport: transport.kind, ...result });
});

export default router;
