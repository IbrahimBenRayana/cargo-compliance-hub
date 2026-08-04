/**
 * AbiGateway — the seam between MyCargoLens and the CBP ABI gateway.
 *
 * The contract lives in ./contract.ts and is provider-neutral: it is
 * declared on our terms, not derived from any client's type. CustomsCity
 * (services/customscity.ts → ccClient) satisfies it structurally and is the
 * active implementation today. The native CATAIR engine (Native ABI Engine
 * plan, docs/abi-engine/MIGRATION_PLAN.md) will be a second implementation;
 * cutover becomes a per-org selection made here.
 *
 * Rules for callers:
 *   - Import `abiGateway` (and types from ./contract.js) — NEVER `ccClient`.
 *   - Everything crossing this seam must be expressible in contract types;
 *     if you need a new capability, extend the contract first.
 */
import { ccClient } from '../customscity.js';
import type { AbiGateway } from './contract.js';

export type { AbiGateway } from './contract.js';

/** The active ABI gateway. Becomes a per-org/config selection when the
 *  native engine (NativeAbiGateway) lands — see MIGRATION_PLAN Phase 5. */
export const abiGateway: AbiGateway = ccClient;
