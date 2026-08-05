/**
 * AbiGateway contract — the provider-NEUTRAL seam between MyCargoLens and
 * whatever transmits our filings to CBP.
 *
 * Why this exists (Native ABI Engine, Phase 0.2 — see
 * docs/abi-engine/MIGRATION_PLAN.md): the previous contract was
 * `Pick<typeof ccClient, …>`, i.e. the interface WAS CustomsCity's client
 * type. A second implementation (the native CATAIR engine) could never
 * satisfy it without impersonating CC. This module inverts that: the
 * interface is declared here, on our terms, and `ccClient` merely happens
 * to satisfy it structurally today.
 *
 * Phase 0.4 (customscity.ts split) flipped the last arrow for the ABI entry
 * types: they are now OWNED by ./types.ts under neutral names, and the CC
 * client depends on them. Interim compromise still in force for the rest:
 * the ISF / manifest / duty payload/response *types* below remain aliases
 * of the CC-shaped declarations in services/customscity/*, because every
 * caller, the zod schema, and the frontend types speak that shape. Do not
 * add new CC-specific fields to callers in the meantime.
 */
import type {
  AbiCreatePayload,
  AbiListParams,
  AbiListResponse,
  AbiDeleteParams,
  AbiSendPayload,
} from './types.js';
import type {
  // ISF
  CCDocumentCreatePayload,
  CCDocumentResponse,
  CCListResponse,
  // Tools
  CCHTSClassifyResponse,
} from '../customscity/isfTypes.js';
import type {
  // Manifest query
  CCManifestQueryPayload,
  CCManifestQueryCreateResponse,
  CCManifestQueryResult,
} from '../customscity/manifestTypes.js';
import type {
  // Duty tools
  CCDutyCalcPayload,
  CCDutyCalcResponse,
  CCDutyCalcAIResponse,
} from '../customscity/dutyTypes.js';

// ─── Envelope ──────────────────────────────────────────────

/**
 * Uniform result envelope for every gateway call. `status` is an HTTP-style
 * code (a native engine reports its own outcome codes through the same
 * field); `latencyMs` feeds SubmissionLog.
 */
export interface GatewayResult<T = unknown> {
  data: T;
  status: number;
  latencyMs: number;
}

/** createDocument's richer envelope: CC parses validation failures inline. */
export interface IsfCreateResult extends GatewayResult<CCDocumentResponse> {
  validationErrors?: Array<{ field?: string; message: string }>;
  persisted: boolean;
  processId?: string;
}

// ─── Neutral payload/response names (aliases — see header) ─

export type IsfDocumentPayload = CCDocumentCreatePayload;
export type IsfListResponse = CCListResponse;

// ABI entry types are owned by ./types.ts (Phase 0.4) — re-exported here so
// importers of contract.ts keep resolving the same names.
export type {
  AbiCreatePayload,
  AbiListParams,
  AbiListResponse,
  AbiDeleteParams,
  AbiSendPayload,
} from './types.js';

export type ManifestQueryPayload = CCManifestQueryPayload;
export type ManifestQueryCreateResponse = CCManifestQueryCreateResponse;
export type ManifestQueryResult = CCManifestQueryResult;

export type HtsClassifyResponse = CCHTSClassifyResponse;
export type DutyCalcPayload = CCDutyCalcPayload;
export type DutyCalcResponse = CCDutyCalcResponse;
export type DutyCalcAIResponse = CCDutyCalcAIResponse;

// ─── The contract ──────────────────────────────────────────

export interface AbiGateway {
  // ── ISF filings ──
  createDocument(payload: IsfDocumentPayload): Promise<IsfCreateResult>;
  sendDocument(payload: {
    documentId?: string;
    documentIds?: string[];
    [key: string]: any;
  }): Promise<GatewayResult<any>>;
  listDocuments(dateFrom: string, dateTo: string, skip?: number): Promise<IsfListResponse>;
  getDocumentStatus(params?: Record<string, string>): Promise<GatewayResult<any>>;
  getMessages(params?: Record<string, string>): Promise<GatewayResult<any>>;

  // ── ABI entries (Entry Summary 7501 / Cargo Release 3461) ──
  createABIDocument(payload: AbiCreatePayload): Promise<GatewayResult<any>>;
  listABIDocuments(params: AbiListParams): Promise<GatewayResult<AbiListResponse>>;
  deleteABIDocument(params: AbiDeleteParams): Promise<GatewayResult<any>>;
  sendABIDocument(payload: AbiSendPayload): Promise<GatewayResult<any>>;

  // ── Manifest query (AMS bill lookup, used for pre-fill) ──
  createManifestQuery(payload: ManifestQueryPayload): Promise<GatewayResult<ManifestQueryCreateResponse>>;
  getManifestQueryById(requestId: string): Promise<GatewayResult<ManifestQueryResult>>;
  getManifestQueryLatest(): Promise<GatewayResult<ManifestQueryResult>>;

  // ── Classification & duty tools ──
  classifyHTS(description: string): Promise<GatewayResult<HtsClassifyResponse>>;
  getMIDList(): Promise<GatewayResult<any>>;
  calculateDuty(payload: DutyCalcPayload): Promise<GatewayResult<DutyCalcResponse>>;
  calculateDutyAI(payload: DutyCalcPayload): Promise<GatewayResult<DutyCalcAIResponse>>;

  // ── Connectivity ──
  testConnection(): Promise<boolean>;
}
