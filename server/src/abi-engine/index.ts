/**
 * Native ABI engine — direct CATAIR filing to CBP ACE.
 * See docs/abi-engine/MIGRATION_PLAN.md. No imports from customscity/*:
 * this module is the CustomsCity replacement, not a wrapper.
 */
export {
  RECORD_LENGTH,
  writeRecord,
  parseRecord,
  normalizeTransactionLine,
  assertRecordDef,
  RecordCodecError,
} from './records/codec.js';
export type { RecordDef, FieldDef, FieldClass, Designation, ParsedRecord, CodecIssue } from './records/codec.js';

export { buildBatch, parseBatch, scenarioTag } from './envelope/batch.js';
export type {
  BatchInput,
  BlockInput,
  SenderIdentity,
  ParsedBatch,
  ParsedBlock,
  ParsedCondition,
} from './envelope/batch.js';

export { CONDITION_CODES, APPLICATION_CODES } from './envelope/conditionCodes.js';
export * as envelopeRecordDefs from './envelope/recordDefs.js';

// ── Entry Summary (AE/AX) ──────────────────────────────────
export { buildEntrySummary } from './ae/builder.js';
export type {
  AeEntrySummaryInput,
  AeLine,
  AeTariff,
  AeBond,
  AeManifest,
  AeManifestBill,
  AeAdCvdCase,
  AeParty,
  AeFee,
} from './ae/builder.js';
export { parseAeResponse, parseAeResponseBatch } from './ae/responseParser.js';
export type {
  AeSummaryResponse,
  AeCondition,
  AeDisposition,
  AeReference,
  AeResponseBatch,
} from './ae/responseParser.js';
export { computeEntryCheckDigit, formatEntryNumber } from './ae/checkDigit.js';
export {
  ENTRY_TYPE_CODES,
  MOT_CODES,
  BOND_WAIVER_REASON_CODES,
  USER_FEE_CLASS_CODES,
  IR_TAX_CLASS_CODES,
  OTHER_REVENUE_CLASS_CODES,
  REFERENCE_DATA_TYPES,
} from './ae/tables.js';
export * as aeHeaderRecordDefs from './ae/headerRecordDefs.js';
export * as aeLineRecordDefs from './ae/lineRecordDefs.js';
export * as aeResponseDefs from './ae/responseDefs.js';

// ── Payload schema v2 (decision D2) ────────────────────────
export {
  zAbiPayloadV2,
  zEntrySummaryV2,
  zLineV2,
  zTariffV2,
  parseAbiPayloadV2,
  isAbiPayloadV2,
} from './payload/schemaV2.js';
export type { AbiPayloadV2, EntrySummaryV2, LineV2, TariffV2 } from './payload/schemaV2.js';
export { toAeEntrySummaryInput, toWireDate } from './payload/toAeInput.js';
export { migrateV1ToV2, splitV1EntryNumber } from './payload/migrateV1.js';

// ── Duty engine (workstream F) ─────────────────────────────
export { parseRateExpression, computeDutyCents } from './duty/rateExpression.js';
export type { RateComponent, DutyBasis } from './duty/rateExpression.js';
export {
  computeLineMpfCents,
  applyMpfMinMax,
  computeLineHmfCents,
  hmfApplies,
  informalEntryFeeCents,
  dutiableMailFeeCents,
  manualEntrySurchargeCents,
  MPF_RATE_PER_MILLION,
  HMF_RATE_PER_MILLION,
  HMF_DE_MINIMIS_CENTS,
} from './duty/fees.js';
export { enrichWithDuty, StaticRateSource } from './duty/engine.js';
export type { HtsRate, HtsRateSource, DutyEngineOptions } from './duty/engine.js';

// ── Refdata: USITC HTS (workstream F) ──────────────────────
export { fetchUsitcRows, normalizeUsitcRows, ingestChapter } from './refdata/usitcHts.js';
export type { UsitcRow, NormalizedHtsLine, HtsRateLineStore } from './refdata/usitcHts.js';
export { DbHtsRateSource } from './refdata/dbRateSource.js';
export type { HtsRateLineReader } from './refdata/dbRateSource.js';
