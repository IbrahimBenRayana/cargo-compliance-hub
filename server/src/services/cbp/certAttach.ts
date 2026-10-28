/**
 * Certification-console response attach: CBP echoes "SCENARIO nnn" in the
 * B-record user data of every scenario response, so a batch is attached to
 * that scenario's newest open transmission, parsed with the scenario's
 * application parser, and given a verdict status. Used by the cert console
 * and by the inbound dispatcher (native go-live D1: one queue consumer).
 */
import { prisma } from '../../config/database.js';
import type { InboundHandler } from './dispatcher.js';
import { SCENARIO_INDEX } from '../../abi-engine/scenarios/index.js';
import { parseAeResponseBatch } from '../../abi-engine/ae/responseParser.js';
import { parseCwResponseBatch, parseCjResponseBatch } from '../../abi-engine/index.js';
import { parseAdCvdResponseBatch } from '../../abi-engine/apps/adcvd/responseParser.js';
import { parseQuotaResponseBatch } from '../../abi-engine/apps/quota/responseParser.js';
import { parseTibResponseBatch } from '../../abi-engine/apps/tib/responseParser.js';
import { parseEsQueryResponseBatch } from '../../abi-engine/apps/esQuery/responseParser.js';
import { parseUcNotificationBatch } from '../../abi-engine/apps/uc/parser.js';

export const RESPONSE_PARSERS: Record<string, (lines: string[]) => unknown> = {
  AE: parseAeResponseBatch,
  CW: parseCwResponseBatch,
  CJ: parseCjResponseBatch,
  AD: parseAdCvdResponseBatch,
  QA: parseQuotaResponseBatch,
  TE: parseTibResponseBatch,
  EQ: parseEsQueryResponseBatch,
  UC: parseUcNotificationBatch,
};

// Every scenario response batch echoes "SCENARIO nnn" in its B-record
// user-data — CBP's own correlation mechanism (the test doc offers it for
// exactly this). Attach the batch to that scenario's newest transmitted
// transmission, run the application parser, and set the lifecycle status
// from the verdict codes.
export function scenarioTagOf(batch: string[]): string | null {
  for (const line of batch) {
    if (line.startsWith('B')) {
      const m = line.slice(59, 80).match(/SCENARIO\s+(\d{3})/);
      if (m) return m[1];
    }
  }
  return null;
}

export function verdictStatusOf(batch: string[]): 'accepted' | 'rejected' | 'conditional' {
  const text = batch.join('\n');
  if (/E1A[I ]?995|SUMMARY HAS BEEN ADDED|SUMMARY HAS BEEN REPLACED/.test(text)) return 'accepted';
  if (/TRANSACTION DATA REJECTED|BATCH REJECTED/.test(text)) return 'rejected';
  return 'conditional';
}

export async function attachBatch(batch: string[]): Promise<{ scenarioId: string; transmissionId: string; status: string } | null> {
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
  // A transmission can draw several batches (an ISF SN verdict, then an SA
  // advisory). Append rather than overwrite so the verdict is never lost, and
  // don't let an unrecognised follow-up batch downgrade an earlier verdict.
  const text = batch.join('\n');
  const existing = transmission.responseText;
  if (existing?.includes(text)) return { scenarioId, transmissionId: transmission.id, status: transmission.status };
  const verdict = verdictStatusOf(batch);
  const status = existing && verdict === 'conditional' ? transmission.status : verdict;
  await prisma.certTransmission.update({
    where: { id: transmission.id },
    data: {
      responseText: existing ? `${existing}\n${text}` : text,
      responseParsed: responseParsed === undefined ? undefined : JSON.parse(JSON.stringify(responseParsed)),
      status,
    },
  });
  return { scenarioId, transmissionId: transmission.id, status };
}


/** Dispatcher handler: claims scenario-tagged CERT responses for the cert console. */
export const certInboundHandler: InboundHandler = async (row) => {
  const attached = await attachBatch(row.lines);
  return attached ? { entityType: 'cert_transmission', entityId: attached.transmissionId } : null;
};
