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
