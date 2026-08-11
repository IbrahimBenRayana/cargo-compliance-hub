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

// ── Importer Security Filing (SF/SN + SA advisory) ─────────
export { buildIsf } from './isf/builder.js';
export type {
  IsfInput,
  IsfImporter,
  IsfBond,
  IsfShipmentInfo,
  IsfBill,
  IsfReference,
  IsfContainer,
  IsfEntity,
  IsfEntityBase,
  IsfEntityGeography,
  IsfAddressComponent,
  IsfManufacturer,
  IsfTariff,
  IsfSubmissionType,
  IsfShipmentType,
  IsfActionCode,
  IsfActionReasonCode,
  IsfEntityCode,
  IsfEntityIdentifierQualifier,
} from './isf/builder.js';
export { mapFilingToIsfInput } from './isf/fromFiling.js';
export type { PlatformIsfFiling, MapFilingToIsfOptions } from './isf/fromFiling.js';
export {
  parseIsfResponse,
  parseIsfResponseBatch,
  parseIsfStatusAdvisory,
  parseIsfStatusAdvisoryBatch,
} from './isf/responseParser.js';
export type {
  IsfResponse,
  IsfResponseBatch,
  IsfEchoedRecord,
  IsfRecordError,
  IsfDisposition,
  IsfStatusAdvisory,
  IsfStatusAdvisoryBatch,
  IsfBillStatus,
} from './isf/responseParser.js';
export {
  SUBMISSION_TYPES,
  SHIPMENT_TYPES,
  ACTION_REASON_CODES,
  IMPORTER_NUMBER_QUALIFIERS,
  ENTITY_CODES,
  ENTITY_SECONDARY_NAME_CODES,
  ENTITY_IDENTIFIER_QUALIFIERS,
  ADDRESS_COMPONENT_QUALIFIERS,
  REFERENCE_IDENTIFIER_QUALIFIERS,
  BOND_ACTIVITY_CODES,
  BOND_TYPES,
  SF90_MESSAGE_TYPES,
  SA_DISPOSITION_CODES,
} from './isf/recordDefs.js';
export * as isfRecordDefs from './isf/recordDefs.js';

// ── Census Warning Override (CW/CO) + Query (CJ/CL) ────────
export { buildCensusOverride } from './apps/census/cwBuilder.js';
export type { CwCensusOverrideInput, CwEntryOverrides, CwLineOverrides, CwOverride } from './apps/census/cwBuilder.js';
export { parseCwResponse, parseCwResponseBatch } from './apps/census/cwResponseParser.js';
export type { CwOverrideDisposition, CwResponseBatch } from './apps/census/cwResponseParser.js';
export { buildCensusWarningQuery } from './apps/census/cjBuilder.js';
export type { CjCensusWarningQueryInput, CjQuery } from './apps/census/cjBuilder.js';
export { parseCjResponse, parseCjResponseBatch } from './apps/census/cjResponseParser.js';
export type { CjWarningRow, CjResponseBatch } from './apps/census/cjResponseParser.js';
export * as cwRecordDefs from './apps/census/cwRecordDefs.js';
export * as cjRecordDefs from './apps/census/cjRecordDefs.js';

// ── Companion apps: TIB extend/close (TE/TX) + expiration notice (TS) ──
export { buildTibExtension } from './apps/tib/builder.js';
export type { TibExtendCloseInput, TibAction } from './apps/tib/builder.js';
export {
  parseTibResponse,
  parseTibResponseBatch,
  parseTibExpirationNotices,
  parseTibExpirationNoticeBatch,
  TIB_CONDITION_CODES,
} from './apps/tib/responseParser.js';
export type {
  TibResponse,
  TibCondition,
  TibDisposition,
  TibResponseBatch,
  TibExpirationNotice,
  TibExpirationNoticeBatch,
} from './apps/tib/responseParser.js';
export * as tibRecordDefs from './apps/tib/recordDefs.js';

// ── Companion query applications (workstream E) ────────────
export { buildAdCvdCaseQuery } from './apps/adcvd/builder.js';
export type {
  AdCvdCaseQueryInput,
  AdCvdCaseNumberQueryInput,
  AdCvdCriteriaQueryInput,
} from './apps/adcvd/builder.js';
export { parseAdCvdResponse, parseAdCvdResponseBatch } from './apps/adcvd/responseParser.js';
export type {
  AdCvdQueryResponse,
  AdCvdCaseResult,
  AdCvdNamedParty,
  AdCvdContact,
  AdCvdDepositRate,
  AdCvdCaseEvent,
  AdCvdBondCashDetail,
  AdCvdTariffDetail,
  AdCvdSuspensionDetail,
  AdCvdFailedQuery,
  AdCvdResponseBatch,
} from './apps/adcvd/responseParser.js';
export * as adCvdRecordDefs from './apps/adcvd/recordDefs.js';
export { buildQuotaQuery } from './apps/quota/builder.js';
export type { QuotaQueryRequest } from './apps/quota/builder.js';
export { parseQuotaResponse, parseQuotaResponseBatch } from './apps/quota/responseParser.js';
export type {
  QuotaQueryResponse,
  QuotaStatusResult,
  QuotaQueryError,
  QuotaResponseBatch,
} from './apps/quota/responseParser.js';
export * as quotaRecordDefs from './apps/quota/recordDefs.js';

// ── Entry Summary Query (EQ/ER) ────────────────────────────
export { buildEntrySummaryQuery } from './apps/esQuery/builder.js';
export type { EsQueryInput, EsQueryEntry, EsQueryCriteria } from './apps/esQuery/builder.js';
export { parseEsQueryResponse, parseEsQueryResponseBatch } from './apps/esQuery/responseParser.js';
export type {
  EsQueryResponse,
  EsQueryResponseBatch,
  EsQuerySummary,
  EsQueryStatus,
  EsQueryLiquidation,
  EsQueryEstimates,
  EsQueryBond,
  EsQueryProtest,
  EsQueryBill,
  EsQueryCollection,
  EsQueryClassAmount,
  EsQueryCondition,
} from './apps/esQuery/responseParser.js';
export * as esQueryRecordDefs from './apps/esQuery/recordDefs.js';

// ── Entry Summary Status Notification (UC, inbound only) ───
export { parseUcNotification, parseUcNotificationBatch } from './apps/uc/parser.js';
export type {
  UcNotification,
  UcNotificationBatch,
  UcCbpAction,
  UcQuotaLine,
  UcPgaGroup,
  UcPgaReview,
} from './apps/uc/parser.js';
export * as ucRecordDefs from './apps/uc/recordDefs.js';

// ── PGA Message Set (workstream D) ─────────────────────────
export { buildPgaLine } from './pga/builder.js';
export type {
  PgaLineInput,
  PgaSet,
  PgaDataSet,
  PgaDisclaimerSet,
  PgaDisclaimerCode,
  PgaProductCode,
  PgaEntity,
  PgaContact,
  PgaSourceCountry,
  PgaItemIdentity,
  PgaQuantity,
  PgaArrival,
  PgaConformance,
} from './pga/builder.js';
export { DISCLAIMER_CODES } from './pga/recordDefs.js';
export * as pgaRecordDefs from './pga/recordDefs.js';

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

// ── Validation rules (workstream G) ────────────────────────
export { validateEntrySummary } from './validate/entrySummary.js';
export type { ValidationIssue } from './validate/entrySummary.js';
