/**
 * Normalised CBP responses (native go-live 1.5; audit BNA-07).
 *
 * Each application's response parser has its own shape. summarizeResponse
 * turns any of them into one: a verdict, conditions described from CBP's
 * own tables (services/cbp/conditions) with record pointers, and the keys
 * CBP assigned or echoed (entry number, ISF transaction number), so status
 * changes, notifications and the UI work the same for every filing type.
 */
import { parseAeResponseBatch } from '../../abi-engine/ae/responseParser.js';
import { parseIsfResponseBatch, parseIsfStatusAdvisoryBatch } from '../../abi-engine/isf/responseParser.js';
import { parseCargoReleaseResponseBatch } from '../../abi-engine/cargoRelease/responseParser.js';
import type { ParsedCondition } from '../../abi-engine/envelope/batch.js';
import { describeCondition, type CbpConditionView } from './conditions.js';

export type ResponseVerdict = 'ACCEPTED' | 'REJECTED' | 'CONDITIONAL' | 'INFO';

export interface ConditionWithPointers extends CbpConditionView {
  /** Where CBP says the problem is (e.g. LINITM 001, TARIFF 8507600020). */
  pointers?: { type: string; text: string }[];
}

export interface ResponseSummary {
  application: string;
  verdict: ResponseVerdict;
  conditions: ConditionWithPointers[];
  keys: { entryNumber?: string; isfTransactionNumber?: string };
  /** CBP's disposition text, when there is one. */
  narrative?: string;
  /** Set when the message could not be parsed; it is kept for review. */
  parseError?: string;
}

function envelopeConditions(conds: ParsedCondition[]): ConditionWithPointers[] {
  return conds.map((c) => describeCondition({ source: 'batch', code: c.conditionCode, severity: c.severity }));
}

/**
 * Never throws: a malformed message is deterministic, so retrying cannot
 * help. It becomes INFO with parseError and stays visible for review.
 */
export function summarizeResponse(application: string | null, lines: string[]): ResponseSummary {
  const app = (application ?? '').trim();
  try {
    return summarize(app, lines);
  } catch (err) {
    return { application: app, verdict: 'INFO', conditions: [], keys: {}, parseError: err instanceof Error ? err.message : String(err) };
  }
}

function summarize(app: string, lines: string[]): ResponseSummary {
  switch (app) {
    case 'AX': {
      const r = parseAeResponseBatch(lines);
      if (r.batchRejected) return { application: app, verdict: 'REJECTED', conditions: envelopeConditions(r.envelopeConditions), keys: {} };
      const s = r.summaries[0];
      const conditions: ConditionWithPointers[] = (s?.conditions ?? []).map((c) => ({
        ...describeCondition({ source: 'entry-summary', code: c.conditionCode, severity: c.severity, narrative: c.narrative }),
        pointers: c.references.map((ref) => ({ type: ref.type, text: ref.text })),
      }));
      const verdict: ResponseVerdict = !s?.disposition ? 'CONDITIONAL' : s.disposition.accepted ? 'ACCEPTED' : 'REJECTED';
      const entryNumber = s?.entryFilerCode && s.entryNumber ? `${s.entryFilerCode}${s.entryNumber}` : undefined;
      return { application: app, verdict, conditions, keys: { entryNumber }, narrative: s?.disposition?.narrative };
    }
    case 'SN': {
      const r = parseIsfResponseBatch(lines);
      if (r.batchRejected) return { application: app, verdict: 'REJECTED', conditions: envelopeConditions(r.envelopeConditions), keys: {} };
      const f = r.filings[0];
      const conditions: ConditionWithPointers[] = (f?.echoedRecords ?? []).flatMap((rec) =>
        rec.errors.map((e) => ({
          ...describeCondition({ source: 'isf', code: e.errorCode ?? e.messageTypeCode, narrative: e.narrative }),
          blocking: e.messageTypeCode === '11',
          pointers: [{ type: rec.recordId, text: rec.raw.slice(4, 40).trim() }],
        })),
      );
      const verdict: ResponseVerdict = !f?.disposition ? 'CONDITIONAL' : f.accepted ? 'ACCEPTED' : 'REJECTED';
      return { application: app, verdict, conditions, keys: { isfTransactionNumber: f?.isfTransactionNumber }, narrative: f?.disposition?.narrative };
    }
    case 'SA': {
      const r = parseIsfStatusAdvisoryBatch(lines);
      const a = r.advisories[0];
      const conditions = (a?.bills ?? []).map((b) => ({
        ...describeCondition({ source: 'isf-advisory', code: b.dispositionCode, narrative: b.remarks }),
        pointers: [{ type: 'BILL', text: b.billNumber }],
      }));
      return { application: app, verdict: 'INFO', conditions, keys: { isfTransactionNumber: a?.isfTransactionNumber } };
    }
    case 'SX': {
      const r = parseCargoReleaseResponseBatch(lines);
      if (r.batchRejected) return { application: app, verdict: 'REJECTED', conditions: envelopeConditions(r.envelopeConditions), keys: {} };
      const t = r.transactions[0];
      const verdict: ResponseVerdict = !t?.disposition ? 'CONDITIONAL' : t.accepted ? 'ACCEPTED' : 'REJECTED';
      const entryNumber = t?.entryFilerCode && t.entryNumber ? `${t.entryFilerCode}${t.entryNumber}` : undefined;
      return { application: app, verdict, conditions: [], keys: { entryNumber }, narrative: t?.disposition?.narrative };
    }
    default:
      return { application: app, verdict: 'INFO', conditions: [], keys: {} };
  }
}
