/**
 * CustomsCity manifest-query (AMS bill lookup) wire types.
 *
 * Extracted from services/customscity.ts (Phase 0.4 split — see
 * docs/abi-engine/MIGRATION_PLAN.md).
 */

// ── Manifest Query Types ─────────────────────────────────
export interface CCManifestQueryPayload {
  type: 'BOLNUMBER' | 'AWBNUMBER';
  masterBOLNumber: string | null;
  houseBOLNumber: string | null;
  limitOutputOption: '1' | '2' | '3';
  requestRelatedBOL: boolean;
  requestBOLAndEntryInformation: boolean;
}

export interface CCManifestQueryCreateResponse {
  message: string;
  _id: string;
}

export interface CCManifestDisposition {
  dispositionActionDate: string;
  dispositionActionTime: string;
  dispositionCode: string;
  entryNumber?: string;
}

export interface CCManifestHouse {
  awbNumber?: string;
  hawbNumber?: string;
  flightNumber?: string;
  importingCarrierCode?: string;
  scheduledArrivalDate?: string;
  partIndicator?: string;
  manifestQty?: string;
  boardedQty?: string;
  dispositionMsg?: CCManifestDisposition[];
  manifestedPort?: string;
  vesselDeparturePort?: string;
  vesselDepartureDate?: string;
  actualPort?: string;
  actualPortOcean?: string;
  inbondOriginatingPort?: string;
  manifestedInbondDestinationPort?: string;
  actualInbondDestinationManualDiversion?: string;
  actualInbondDestinationEDIDiversion?: string;
  containerLoadPort?: string;
  containerLoadDate?: string;
}

export interface CCManifestResponseItem {
  statusMsg?: any[];
  houses?: CCManifestHouse[];
  lastHouse?: { house: string; masterPartIndicator: string };
  transmissionDate?: string;
  carrierCode?: string;
  conveyanceName?: string;
  importingVesselCodeOrImpConveyanceName?: string;
  voyageFlightTripNo?: string;
  wr1DateOfArrival?: string;
  awbNumber?: string;
  flightNumber?: string;
  importingCarrierCode?: string;
  scheduledArrivalDate?: string;
  masterPartIndicator?: string;
  manifestQty?: string;
  masterBoardedQty?: string;
  modeOfTransport?: string;
  manifestedPortOfUnlading?: string;
  actualPortOcean?: string;
  inbondOriginatingPort?: string;
  manifestedInbondDestinationPort?: string;
  actualInbondDestinationManualDiversion?: string;
  actualInbondDestinationEDIDiversion?: string;
  containerLoadPort?: string;
  containerLoadDate?: string;
}

export interface CCManifestQueryResult {
  data?: {
    type?: string;
    masterBOLNumber?: string;
    requestBOLAndEntryInformation?: boolean;
    requestRelatedBOL?: boolean;
    limitOutputOption?: string;
    response?: CCManifestResponseItem[];
  };
}

