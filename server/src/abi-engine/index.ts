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
