export type ShipmentStatus = 'draft' | 'submitted' | 'accepted' | 'rejected';

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
