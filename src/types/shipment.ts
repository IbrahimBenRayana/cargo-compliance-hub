export type ShipmentStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'on_hold' | 'pending_cbp' | 'cancelled' | 'amended';

export interface ShipmentParties {
  manufacturer: string;
  seller: string;
  buyer: string;
  shipToParty: string;
}

export interface ShipmentInfo {
  billOfLading: string;
  vesselName: string;
  voyageNumber: string;
}

export interface ProductInfo {
  htsCode: string;
  countryOfOrigin: string;
  description: string;
}

export interface LogisticsInfo {
  containerStuffingLocation: string;
  consolidator: string;
}

export interface Shipment {
  id: string;
  status: ShipmentStatus;
  parties: ShipmentParties;
  shipmentInfo: ShipmentInfo;
  productInfo: ProductInfo;
  logistics: LogisticsInfo;
  importerName: string;
  departureDate: string;
  filingDeadline: string;
  createdAt: string;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  apiResponse?: string;
}

// ─── Backend Filing Type (matches Prisma model) ────────────
export interface PartyInfo {
  name: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface CommodityInfo {
  htsCode: string;
  countryOfOrigin: string;
  description?: string;
  quantity?: number;
  weight?: { value: number; unit: string };
  value?: { amount: number; currency: string };
}

export interface ContainerInfo {
  number: string;
  type?: string;
  sealNumber?: string;
}

// ─── ISF-5 Specific Data ───────────────────────────────────
export interface ISF5Data {
  // Booking Party
  bookingPartyName?: string;
  bookingPartyTaxID?: string;
  bookingPartyIdentifierCode?: string;
  bookingPartyAddress1?: string;
  bookingPartyAddress2?: string;
  bookingPartyCity?: string;
  bookingPartyStateOrProvince?: string;
  bookingPartyPostalCode?: string;
  bookingPartyCountry?: string;

  // ISF Filer (for ISF-5, filer is typically the carrier/NVOCC)
  ISFFilerName?: string;
  ISFFilerLastName?: string;
  ISFFilerIDCodeQualifier?: string;
  ISFFilerNumber?: string;
  ISFFilerPassportIssuanceCountry?: string;
  ISFFilerDateOfBirth?: string;

  // ISF-5 specific codes
  entryTypeCode?: string;
  USPortOfArrival?: string;
  bondHolderID?: string;
  bondActivityCode?: string;
  ISFShipmentTypeCode?: string;
  foreignPortOfUnlading?: string;
  placeOfDelivery?: string;
}

export interface Filing {
  id: string;
  orgId: string;
  createdById: string;
  filingType: 'ISF-10' | 'ISF-5';
  status: ShipmentStatus;
  ccFilingId?: string | null;
  cbpTransactionId?: string | null;

  importerName?: string | null;
  importerNumber?: string | null;
  consigneeName?: string | null;
  consigneeNumber?: string | null;
  consigneeAddress?: PartyInfo | null;

  manufacturer?: PartyInfo | string | null;
  seller?: PartyInfo | string | null;
  buyer?: PartyInfo | string | null;
  shipToParty?: PartyInfo | string | null;
  containerStuffingLocation?: PartyInfo | string | null;
  consolidator?: PartyInfo | string | null;

  masterBol?: string | null;
  houseBol?: string | null;
  scacCode?: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
  foreignPortOfUnlading?: string | null;
  placeOfDelivery?: string | null;
  estimatedDeparture?: string | null;
  estimatedArrival?: string | null;
  filingDeadline?: string | null;

  bondType?: string | null;
  bondSuretyCode?: string | null;

  // ISF-5 specific data
  isf5Data?: ISF5Data | null;

  commodities: CommodityInfo[];
  containers: ContainerInfo[];

  submittedAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  amendedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;

  createdBy?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  statusHistory?: FilingStatusEntry[];
}

export interface FilingStatusEntry {
  id: string;
  filingId: string;
  status: string;
  message?: string | null;
  ccResponse?: any;
  changedById?: string | null;
  createdAt: string;
}

export interface FilingListResponse {
  data: Filing[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FilingStatsResponse {
  total: number;
  statusCounts: Record<string, number>;
  recentFilings: Filing[];
}

// ─── Backend Submission Log ────────────────────────────────
export interface ApiSubmissionLog {
  id: string;
  orgId: string;
  filingId?: string | null;
  userId?: string | null;
  correlationId?: string | null;
  method: string;
  url: string;
  requestPayload?: any;
  responseStatus?: number | null;
  responseBody?: any;
  latencyMs?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  filing?: {
    id: string;
    filingType: string;
    masterBol?: string | null;
    status: string;
  } | null;
  user?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
}

// ─── Legacy types kept for backward compat ─────────────────
export interface SubmissionLog {
  id: string;
  shipmentId: string;
  billOfLading: string;
  date: string;
  status: 'success' | 'error' | 'pending';
  requestPayload: string;
  responseData: string;
}

export interface ActivityItem {
  id: string;
  type: 'submission' | 'error' | 'alert';
  message: string;
  timestamp: string;
  shipmentId?: string;
}

// ─── Helpers ───────────────────────────────────────────────
export function getPartyName(party: PartyInfo | string | null | undefined): string {
  if (!party) return '';
  if (typeof party === 'string') return party;
  return party.name || '';
}

export function getFirstCommodity(filing: Filing): { htsCode: string; countryOfOrigin: string; description: string } {
  const c = filing.commodities?.[0];
  return {
    htsCode: c?.htsCode || '',
    countryOfOrigin: c?.countryOfOrigin || '',
    description: c?.description || '',
  };
}
