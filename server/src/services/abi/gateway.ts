/**
 * AbiGateway — the seam between MyCargoLens and the CBP ABI gateway.
 *
 * Today CustomsCity is the only gateway (services/customscity.ts → ccClient).
 * This module exposes that capability behind an interface so that:
 *   - new code (the public API, future ABI message types) depends on the
 *     ABSTRACTION, not on CustomsCity directly, and
 *   - a second gateway (or direct ACE connectivity) can be added later by
 *     providing another implementation that satisfies `AbiGateway`.
 *
 * Pragmatic first step (Plan B, Phase 0b): the contract is derived from the
 * existing client's public surface via `Pick<typeof ccClient, …>`, and the
 * live `ccClient` is the first implementation — so there is ZERO behavior
 * change and existing callers are untouched. The longer-term goal is to evolve
 * this into a gateway-NEUTRAL contract (provider-agnostic payload/response
 * shapes) and migrate callers onto it incrementally.
 */
import { ccClient } from '../customscity.js';

export type AbiGateway = Pick<
  typeof ccClient,
  | 'createDocument'
  | 'sendDocument'
  | 'getDocumentStatus'
  | 'getMessages'
  | 'listDocuments'
  | 'classifyHTS'
  | 'createABIDocument'
  | 'listABIDocuments'
  | 'sendABIDocument'
  | 'deleteABIDocument'
  | 'createManifestQuery'
  | 'getManifestQueryById'
  | 'getManifestQueryLatest'
  | 'getMIDList'
  | 'testConnection'
>;

/** The active ABI gateway. Swap or select-by-config here when a second
 *  implementation exists (Plan B, Phase 3 — de-risk the single-gateway dependency). */
export const abiGateway: AbiGateway = ccClient;
