/**
 * Barrel for the split CustomsCity integration (Phase 0.4) — new code
 * should import from services/customscity/* modules or
 * services/abi/contract.ts; ABI wire types are owned by
 * services/abi/types.ts.
 *
 * This file preserves the pre-split public surface (old names included) so
 * existing import sites keep working unchanged.
 */

export * from './customscity/isfTypes.js';
export * from './customscity/manifestTypes.js';
export * from './customscity/dutyTypes.js';
export * from './customscity/helpers.js';
export * from './customscity/isfMappers.js';
export * from './customscity/client.js';

// ── Legacy CC-prefixed aliases for the ABI wire types ──────
// The declarations now live in services/abi/types.ts under neutral names
// (Phase 0.4 arrow-flip). These aliases keep pre-split importers compiling.
import type {
  AbiDates,
  AbiLocation,
  AbiIOR,
  AbiBond,
  AbiPayment,
  AbiConsignee,
  AbiBill,
  AbiCarrier,
  AbiPorts,
  AbiParty,
  AbiItemValues,
  AbiItemWeight,
  AbiItem,
  AbiInvoice,
  AbiManifest,
  AbiDocumentBody,
  AbiCreatePayload,
  AbiListResponse,
  AbiListParams,
  AbiDeleteParams,
  AbiSendPayload,
} from './abi/types.js';

export type CCABIDates = AbiDates;
export type CCABILocation = AbiLocation;
export type CCABIIOR = AbiIOR;
export type CCABIBond = AbiBond;
export type CCABIPayment = AbiPayment;
export type CCABIConsignee = AbiConsignee;
export type CCABIBill = AbiBill;
export type CCABICarrier = AbiCarrier;
export type CCABIPorts = AbiPorts;
export type CCABIParty = AbiParty;
export type CCABIItemValues = AbiItemValues;
export type CCABIItemWeight = AbiItemWeight;
export type CCABIItem = AbiItem;
export type CCABIInvoice = AbiInvoice;
export type CCABIManifest = AbiManifest;
export type CCABIDocumentBody = AbiDocumentBody;
export type CCABICreateDocumentPayload = AbiCreatePayload;
export type CCABIListResponse = AbiListResponse;
export type CCABIListParams = AbiListParams;
export type CCABIDeleteParams = AbiDeleteParams;
export type CCABISendPayload = AbiSendPayload;
