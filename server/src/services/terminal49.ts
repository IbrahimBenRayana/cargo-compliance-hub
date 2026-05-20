/**
 * Terminal 49 — Container Tracking API client.
 *
 *   Docs:    https://terminal49.com/docs/api-docs/getting-started
 *   Schema:  JSON:API (data / attributes / relationships / included[])
 *   Auth:    Authorization: Token <key>
 *   Limits:  100 tracking requests / minute
 *
 * This module wraps only the endpoints we need today (Phase 1):
 *
 *   createTrackingRequest()  — POST /tracking_requests (BOL/booking/container + SCAC)
 *   getTrackingRequest()     — GET  /tracking_requests/{id}
 *   getShipment()            — GET  /shipments/{id}?include=containers,pod_terminal,...
 *   getContainer()           — GET  /containers/{id}
 *
 * Phase 2 (webhooks) will add register/list/delete webhook endpoints.
 *
 * The service is intentionally thin — JSON:API responses are returned in
 * a flattened, MyCargoLens-friendly shape (the route layer maps these into
 * Prisma rows). Failures throw `Terminal49Error` with `.status` so the
 * route layer can translate 401/404/422 into the right HTTP code.
 */

import { env } from '../config/env.js';
import logger from '../config/logger.js';

const TIMEOUT_MS = 15_000;

export class Terminal49Error extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'Terminal49Error';
    this.status = status;
    this.body = body;
  }
}

export type TrackingRequestType = 'bill_of_lading' | 'booking_number' | 'container';

export interface CreateTrackingRequestInput {
  requestType: TrackingRequestType;
  requestNumber: string;
  scac: string;          // 4-char carrier code
  refNumbers?: string[]; // attached to the resulting shipment
  shipmentTags?: string[];
}

export interface TrackingRequestSummary {
  id: string;
  status: 'pending' | 'created' | 'failed' | 'awaiting_manifest' | 'tracking_stopped';
  requestType: string;
  requestNumber: string;
  scac: string;
  failedReason: string | null;
  trackedObjectId: string | null;  // shipment UUID once status='created'
  trackedObjectType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerSummary {
  id: string;
  number: string;
  equipmentType: string | null;
  equipmentLength: number | null;
  equipmentHeight: string | null;
  sealNumber: string | null;
  currentStatus: string | null;
  availableForPickup: boolean | null;
  pickupLfd: string | null;
  holdsAtPodTerminal: Array<{ name: string; status: string; description?: string }>;
  feesAtPodTerminal: Array<{ type: string; amount: number; currency_code?: string }>;
  locationAtPodTerminal: string | null;
}

export interface ShipmentSummary {
  id: string;
  billOfLadingNumber: string | null;
  normalizedNumber: string | null;
  shippingLineScac: string | null;
  shippingLineName: string | null;
  shippingLineShortName: string | null;
  customerName: string | null;
  portOfLadingLocode: string | null;
  portOfLadingName: string | null;
  portOfDischargeLocode: string | null;
  portOfDischargeName: string | null;
  destinationLocode: string | null;
  destinationName: string | null;
  podVesselName: string | null;
  podVesselImo: string | null;
  podVoyageNumber: string | null;
  polEtdAt: string | null;
  polAtdAt: string | null;
  podEtaAt: string | null;
  podOriginalEtaAt: string | null;
  podAtaAt: string | null;
  destinationEtaAt: string | null;
  destinationAtaAt: string | null;
  polTimezone: string | null;
  podTimezone: string | null;
  destinationTimezone: string | null;
  lineTrackingLastSucceededAt: string | null;
  lineTrackingStoppedAt: string | null;
  lineTrackingStoppedReason: string | null;
  refNumbers: string[];
  tags: string[];
  containers: ContainerSummary[];
}

// ─── HTTP helper ───────────────────────────────────────────

function isEnabled(): boolean {
  return !!env.TERMINAL49_API_KEY;
}

async function t49Fetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isEnabled()) {
    throw new Terminal49Error('Terminal 49 integration is not configured', 503);
  }

  const url = `${env.TERMINAL49_API_BASE_URL}${path}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Token ${env.TERMINAL49_API_KEY}`,
        Accept:        'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        ...(init.headers || {}),
      },
      signal: ctl.signal,
    });
    const text = await resp.text();
    let body: any = null;
    if (text) {
      try { body = JSON.parse(text); } catch { body = text; }
    }
    if (!resp.ok) {
      const msg = body?.errors?.[0]?.detail || body?.errors?.[0]?.title || `Terminal 49 ${resp.status}`;
      throw new Terminal49Error(msg, resp.status, body);
    }
    return body as T;
  } catch (err: any) {
    if (err instanceof Terminal49Error) throw err;
    if (err?.name === 'AbortError') {
      throw new Terminal49Error('Terminal 49 request timed out', 504);
    }
    logger.warn({ err, path }, '[terminal49] network error');
    throw new Terminal49Error(err?.message || 'Terminal 49 network error', 502);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Flatteners (JSON:API → flat) ──────────────────────────

function flattenTrackingRequest(raw: any): TrackingRequestSummary {
  const a = raw?.attributes ?? {};
  const trackedObject = raw?.relationships?.tracked_object?.data ?? null;
  return {
    id:                raw?.id ?? '',
    status:            a.status ?? 'pending',
    requestType:       a.request_type ?? '',
    requestNumber:     a.request_number ?? '',
    scac:              a.scac ?? '',
    failedReason:      a.failed_reason ?? null,
    trackedObjectId:   trackedObject?.id ?? null,
    trackedObjectType: trackedObject?.type ?? null,
    createdAt:         a.created_at ?? '',
    updatedAt:         a.updated_at ?? '',
  };
}

function flattenContainer(raw: any): ContainerSummary {
  const a = raw?.attributes ?? {};
  return {
    id:                    raw?.id ?? '',
    number:                a.number ?? '',
    equipmentType:         a.equipment_type ?? null,
    equipmentLength:       a.equipment_length ?? null,
    equipmentHeight:       a.equipment_height ?? null,
    sealNumber:            a.seal_number ?? null,
    currentStatus:         a.current_status ?? null,
    availableForPickup:    typeof a.available_for_pickup === 'boolean' ? a.available_for_pickup : null,
    pickupLfd:             a.pickup_lfd ?? null,
    holdsAtPodTerminal:    Array.isArray(a.holds_at_pod_terminal) ? a.holds_at_pod_terminal : [],
    feesAtPodTerminal:     Array.isArray(a.fees_at_pod_terminal) ? a.fees_at_pod_terminal : [],
    locationAtPodTerminal: a.location_at_pod_terminal ?? null,
  };
}

function flattenShipment(raw: any, included: any[] = []): ShipmentSummary {
  const a = raw?.attributes ?? {};
  const containerRefs: Array<{ id: string; type: string }> =
    raw?.relationships?.containers?.data ?? [];
  const containers: ContainerSummary[] = containerRefs
    .map((ref) => included.find((i) => i.id === ref.id && i.type === 'container'))
    .filter(Boolean)
    .map(flattenContainer);

  return {
    id:                          raw?.id ?? '',
    billOfLadingNumber:          a.bill_of_lading_number ?? null,
    normalizedNumber:            a.normalized_number ?? null,
    shippingLineScac:            a.shipping_line_scac ?? null,
    shippingLineName:            a.shipping_line_name ?? null,
    shippingLineShortName:       a.shipping_line_short_name ?? null,
    customerName:                a.customer_name ?? null,
    portOfLadingLocode:          a.port_of_lading_locode ?? null,
    portOfLadingName:            a.port_of_lading_name ?? null,
    portOfDischargeLocode:       a.port_of_discharge_locode ?? null,
    portOfDischargeName:         a.port_of_discharge_name ?? null,
    destinationLocode:           a.destination_locode ?? null,
    destinationName:             a.destination_name ?? null,
    podVesselName:               a.pod_vessel_name ?? null,
    podVesselImo:                a.pod_vessel_imo ?? null,
    podVoyageNumber:             a.pod_voyage_number ?? null,
    polEtdAt:                    a.pol_etd_at ?? null,
    polAtdAt:                    a.pol_atd_at ?? null,
    podEtaAt:                    a.pod_eta_at ?? null,
    podOriginalEtaAt:            a.pod_original_eta_at ?? null,
    podAtaAt:                    a.pod_ata_at ?? null,
    destinationEtaAt:            a.destination_eta_at ?? null,
    destinationAtaAt:            a.destination_ata_at ?? null,
    polTimezone:                 a.pol_timezone ?? null,
    podTimezone:                 a.pod_timezone ?? null,
    destinationTimezone:         a.destination_timezone ?? null,
    lineTrackingLastSucceededAt: a.line_tracking_last_succeeded_at ?? null,
    lineTrackingStoppedAt:       a.line_tracking_stopped_at ?? null,
    lineTrackingStoppedReason:   a.line_tracking_stopped_reason ?? null,
    refNumbers:                  Array.isArray(a.ref_numbers) ? a.ref_numbers : [],
    tags:                        Array.isArray(a.tags) ? a.tags : [],
    containers,
  };
}

// ─── Public API ────────────────────────────────────────────

export function getStatus(): { enabled: boolean; baseUrl: string } {
  return { enabled: isEnabled(), baseUrl: env.TERMINAL49_API_BASE_URL };
}

export async function createTrackingRequest(
  input: CreateTrackingRequestInput,
): Promise<TrackingRequestSummary> {
  const payload = {
    data: {
      type: 'tracking_request',
      attributes: {
        request_type:   input.requestType,
        request_number: input.requestNumber,
        scac:           input.scac.toUpperCase(),
        ref_numbers:    input.refNumbers ?? [],
        shipment_tags:  input.shipmentTags ?? [],
      },
    },
  };
  const json = await t49Fetch<any>('/tracking_requests', {
    method: 'POST',
    body:   JSON.stringify(payload),
  });
  return flattenTrackingRequest(json?.data);
}

export async function getTrackingRequest(id: string): Promise<TrackingRequestSummary> {
  const json = await t49Fetch<any>(`/tracking_requests/${encodeURIComponent(id)}`);
  return flattenTrackingRequest(json?.data);
}

export async function getShipment(id: string): Promise<ShipmentSummary> {
  // include=containers pulls the related container records in one shot — saves an
  // N+1 round trip when the page wants the operator-visible status fields.
  const json = await t49Fetch<any>(
    `/shipments/${encodeURIComponent(id)}?include=containers`,
  );
  return flattenShipment(json?.data, json?.included ?? []);
}

export async function getContainer(id: string): Promise<ContainerSummary> {
  const json = await t49Fetch<any>(`/containers/${encodeURIComponent(id)}`);
  return flattenContainer(json?.data);
}
