/**
 * CustomsCity HTTP client — retry/backoff transport plus endpoint methods
 * for ISF documents, manifest queries, ABI documents, and the duty /
 * classification tools.
 *
 * Extracted from services/customscity.ts (Phase 0.4 split — see
 * docs/abi-engine/MIGRATION_PLAN.md). ABI payload/response types are the
 * neutral ones owned by services/abi/types.ts, alias-imported under their
 * legacy CC names so the moved method bodies stay unchanged.
 */

import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import type {
  CCDocumentCreatePayload,
  CCDocumentResponse,
  CCHTSClassifyResponse,
  CCListResponse,
} from './isfTypes.js';
import type {
  CCManifestQueryCreateResponse,
  CCManifestQueryPayload,
  CCManifestQueryResult,
} from './manifestTypes.js';
import type {
  CCDutyCalcAIResponse,
  CCDutyCalcPayload,
  CCDutyCalcResponse,
} from './dutyTypes.js';
import type {
  AbiCreatePayload as CCABICreateDocumentPayload,
  AbiDeleteParams as CCABIDeleteParams,
  AbiListParams as CCABIListParams,
  AbiListResponse as CCABIListResponse,
  AbiSendPayload as CCABISendPayload,
} from '../abi/types.js';

// ─── Retry Configuration ───────────────────────────────────

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,     // 1s → 2s → 4s exponential backoff
  maxDelayMs: 10000,     // Cap at 10s
  retryableStatuses: [408, 429, 500, 502, 503, 504], // Timeout, rate-limit, server errors
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── CustomsCity API Client ────────────────────────────────

export class CustomsCityClient {
  private baseUrl: string;
  private token: string;
  private retryConfig: RetryConfig;

  constructor(baseUrl?: string, token?: string, retryConfig?: Partial<RetryConfig>) {
    this.baseUrl = baseUrl ?? env.CC_API_BASE_URL;
    this.token = token ?? env.CC_API_TOKEN ?? '';
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: any,
    params?: Record<string, string | string[] | number | undefined>,
    retryCount = 0
  ): Promise<{ data: T; status: number; latencyMs: number }> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (Array.isArray(v)) {
          v.forEach((item) => {
            if (item !== undefined && item !== null) {
              url.searchParams.append(k, String(item));
            }
          });
        } else {
          url.searchParams.set(k, String(v));
        }
      });
    }

    const start = Date.now();

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000), // 30s timeout
      });

      const latencyMs = Date.now() - start;

      // Check for Retry-After header (rate limiting)
      const retryAfter = response.headers.get('Retry-After');

      // Retry on retryable status codes
      if (
        this.retryConfig.retryableStatuses.includes(response.status) &&
        retryCount < this.retryConfig.maxRetries
      ) {
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.min(
              this.retryConfig.baseDelayMs * Math.pow(2, retryCount),
              this.retryConfig.maxDelayMs
            );
        logger.warn({ method, path, attempt: retryCount + 1, maxRetries: this.retryConfig.maxRetries, status: response.status, delay }, '[CC API] Retrying after error response');
        await sleep(delay);
        return this.request<T>(method, path, body, params, retryCount + 1);
      }

      const data = await response.json().catch(() => ({})) as T;
      return { data, status: response.status, latencyMs };
    } catch (err: any) {
      // Retry on network errors (timeout, DNS, connection refused)
      if (retryCount < this.retryConfig.maxRetries && (
        err.name === 'TimeoutError' ||
        err.name === 'AbortError' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ENOTFOUND' ||
        err.cause?.code === 'ECONNRESET'
      )) {
        const delay = Math.min(
          this.retryConfig.baseDelayMs * Math.pow(2, retryCount),
          this.retryConfig.maxDelayMs
        );
        logger.warn({ method, path, attempt: retryCount + 1, maxRetries: this.retryConfig.maxRetries, delay, err: err.message }, '[CC API] Retrying after network error');
        await sleep(delay);
        return this.request<T>(method, path, body, params, retryCount + 1);
      }
      throw err;
    }
  }

  // ── ISF Document CRUD ──

  /**
   * Create a new ISF document.
   *
   * CORRECT endpoint: POST /api/documents  (NOT /api/documents/isf!)
   * The /api/documents/isf sub-route runs a stricter validator that always
   * returns validation errors as an array without persisting.
   *
   * Payload must include: { type: "isf", send, sendAs, version, body: [...] }
   *
   * Success response:  { code: "200", message: "Document Created", processId: "..." }
   * Duplicate BOL:     HTTP 400 { errors: '{"BOLValidations":{"BOL Numbers already exist":[...]}}' }
   * Validation fail:   HTTP 201 + Array of { message, field? } (from /isf sub-route only)
   */
  async createDocument(payload: CCDocumentCreatePayload): Promise<{
    data: CCDocumentResponse;
    status: number;
    latencyMs: number;
    validationErrors?: Array<{ field?: string; message: string }>;
    persisted: boolean;
    processId?: string;
  }> {
    const result = await this.request<any>('POST', '/api/documents', payload);

    // Success: { code: "200", message: "Document Created", processId: "..." }
    if (result.data?.code === '200' || result.data?.processId) {
      return {
        data: result.data as CCDocumentResponse,
        status: result.status,
        latencyMs: result.latencyMs,
        validationErrors: undefined,
        persisted: true,
        processId: result.data.processId,
      };
    }

    // Duplicate BOL error or validation errors: HTTP 400 { errors: '{"BOLValidations":...}' }
    if (result.status === 400 && result.data?.errors) {
      const errDetail = typeof result.data.errors === 'string'
        ? result.data.errors
        : JSON.stringify(result.data.errors);

      // Parse the nested JSON errors string to extract individual validation messages
      let parsedErrors: Array<{ field?: string; message: string }> = [];
      try {
        const errObj = typeof result.data.errors === 'string'
          ? JSON.parse(result.data.errors)
          : result.data.errors;
        // CC errors format: { "MBOLNumber: X - HBOLNumber: Y": ["err1", "err2"], "ISFValidations": ["err3"] }
        // CC ships two shapes here:
        //   A) { "FieldX": ["err1", "err2"] }                       — flat array
        //   B) { "BOLValidations": { "BOL Numbers already exist": ["MAEU1234..."] } }
        //                                                          — nested object
        // For shape B, the inner *key* is the human-readable reason and the
        // inner array holds the offending values; flatten to "<reason>: <values>".
        for (const [key, msgs] of Object.entries(errObj)) {
          if (Array.isArray(msgs)) {
            for (const msg of msgs) {
              parsedErrors.push({ field: key, message: String(msg) });
            }
          } else if (msgs && typeof msgs === 'object') {
            for (const [innerReason, innerVals] of Object.entries(msgs as Record<string, unknown>)) {
              const detail = Array.isArray(innerVals)
                ? innerVals.map(String).join(', ')
                : String(innerVals);
              parsedErrors.push({
                field: key,
                message: detail ? `${innerReason}: ${detail}` : innerReason,
              });
            }
          } else {
            parsedErrors.push({ field: key, message: String(msgs) });
          }
        }
      } catch {
        // Fallback: single error with full detail string
        parsedErrors = [{ message: result.data.message || errDetail, field: 'validation' }];
      }

      return {
        data: result.data as CCDocumentResponse,
        status: result.status,
        latencyMs: result.latencyMs,
        validationErrors: parsedErrors,
        persisted: false,
      };
    }

    // Validation array (from /isf sub-route or unexpected format)
    if (Array.isArray(result.data)) {
      return {
        data: {} as CCDocumentResponse,
        status: result.status,
        latencyMs: result.latencyMs,
        validationErrors: result.data as Array<{ field?: string; message: string }>,
        persisted: false,
      };
    }

    // Legacy: document object with _id
    if (result.data?._id || result.data?.id) {
      return {
        ...result,
        validationErrors: undefined,
        persisted: true,
        processId: result.data._id || result.data.id,
      };
    }

    // Unknown response
    return {
      ...result,
      validationErrors: undefined,
      persisted: false,
    };
  }

  /**
   * Send an already-created document to CBP for processing.
   */
  async sendDocument(payload: { documentId?: string; documentIds?: string[]; [key: string]: any }): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('POST', '/api/send', payload);
  }

  /**
   * List ISF documents within a date range.
   */
  async listDocuments(dateFrom: string, dateTo: string, skip = 0): Promise<CCListResponse> {
    const { data } = await this.request<CCListResponse>('GET', '/api/documents', undefined, {
      type: 'ISF',
      dateFrom,
      dateTo,
      skip: String(skip),
    });
    return data;
  }

  /**
   * Get document status. Requires manifestType + at least one BOL filter.
   */
  async getDocumentStatus(params?: Record<string, string>): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('GET', '/api/document-status', undefined, params);
  }

  /**
   * Get CBP response messages.
   */
  async getMessages(params?: Record<string, string>): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('GET', '/api/messages', undefined, params);
  }

  // ── AI & Utility Endpoints ──

  /**
   * AI-powered HTS classification.
   * CC API expects: { items: [{ description: "…" }] }
   * Returns:        { items: [{ description, hts_code, explanation }] }
   */
  async classifyHTS(description: string): Promise<{ data: CCHTSClassifyResponse; status: number; latencyMs: number }> {
    return this.request<CCHTSClassifyResponse>('POST', '/api/hts-classifier', {
      items: [{ description }],
    });
  }

  /**
   * MID (Manufacturer ID) lookup.
   */
  async getMIDList(): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('GET', '/api/query/mid/list');
  }

  /**
   * Duty/tariff calculation.
   */
  async calculateDuty(payload: CCDutyCalcPayload): Promise<{ data: CCDutyCalcResponse; status: number; latencyMs: number }> {
    return this.request<CCDutyCalcResponse>('POST', '/api/duty-calculation-tool', payload);
  }

  /**
   * AI-powered duty calculation. Same payload shape as `calculateDuty` but
   * `hts` is optional on each item — CC's AI classifies from `description`.
   * Response includes `aiRecommendations[]` with the chosen HTS, GRI
   * reasoning, and ranked alternatives.
   */
  async calculateDutyAI(payload: CCDutyCalcPayload): Promise<{ data: CCDutyCalcAIResponse; status: number; latencyMs: number }> {
    return this.request<CCDutyCalcAIResponse>('POST', '/api/duty-calculation-tool-ai', payload);
  }

  // ── Connectivity ──

  // ── Manifest Query ───────────────────────────────────────

  async createManifestQuery(payload: CCManifestQueryPayload) {
    return this.request<CCManifestQueryCreateResponse>('POST', '/api/manifest-query', payload);
  }

  async getManifestQueryById(requestId: string) {
    return this.request<CCManifestQueryResult>('GET', `/api/ManifestQueryByID/${requestId}`);
  }

  async getManifestQueryLatest() {
    return this.request<CCManifestQueryResult>('GET', '/api/ManifestQueryLatestResponse');
  }

  // ── ABI Documents (Entry Summary 7501 + Cargo Release 3461) ────

  /**
   * Create an ABI document on CustomsCity. Idempotency is owned by the caller
   * (correlationId is our internal AbiDocument.id).
   */
  async createABIDocument(
    payload: CCABICreateDocumentPayload
  ): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('POST', '/api/abi/documents', payload);
  }

  /**
   * List ABI documents on CustomsCity. Array filters (entryNumber,
   * masterBOLNumber, houseBOLNumber) are sent as repeated query params per
   * FeathersJS `$in` convention — the widened `request` params loop handles
   * the repetition.
   */
  async listABIDocuments(
    params: CCABIListParams
  ): Promise<{ data: CCABIListResponse; status: number; latencyMs: number }> {
    const query: Record<string, string | string[] | number | undefined> = {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      entryType: params.entryType,
      skip: params.skip ?? 0,
    };
    if (params.status) query.status = params.status;
    if (params.houseBOLNumber && params.houseBOLNumber.length > 0) {
      query.houseBOLNumber = params.houseBOLNumber;
    }
    if (params.masterBOLNumber && params.masterBOLNumber.length > 0) {
      query.masterBOLNumber = params.masterBOLNumber;
    }
    if (params.entryNumber && params.entryNumber.length > 0) {
      query.entryNumber = params.entryNumber;
    }
    return this.request<CCABIListResponse>('GET', '/api/abi/documents', undefined, query);
  }

  /**
   * Delete an ABI document on CustomsCity. Exactly one of entryNumber or
   * mbolNumber should be provided (CC uses kebab-case for these params).
   */
  async deleteABIDocument(
    params: CCABIDeleteParams
  ): Promise<{ data: any; status: number; latencyMs: number }> {
    const query: Record<string, string | undefined> = {};
    if (params.entryNumber) query['entry-number'] = params.entryNumber;
    if (params.mbolNumber) query['mbol-number'] = params.mbolNumber;
    return this.request('DELETE', '/api/abi/documents', undefined, query);
  }

  /**
   * Transmit a previously-created ABI document to CBP via
   * `POST /api/abi/send`. Phase 1 only uses action='add' with application
   * 'entry-summary-cargo-release'.
   */
  async sendABIDocument(
    payload: CCABISendPayload
  ): Promise<{ data: any; status: number; latencyMs: number }> {
    return this.request('POST', '/api/abi/send', payload);
  }

  /**
   * Verify the CC API connection and token validity.
   * Uses a lightweight document listing call — if it returns 200, we're connected.
   */
  async testConnection(): Promise<boolean> {
    try {
      const { status } = await this.request('GET', '/api/documents', undefined, {
        type: 'ISF',
        dateFrom: '2025-01-01',
        dateTo: '2026-12-31',
        skip: '0',
      });
      return status === 200;
    } catch {
      return false;
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────

export const ccClient = new CustomsCityClient();
