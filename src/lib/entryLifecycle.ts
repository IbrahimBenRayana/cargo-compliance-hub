import type { AbiDocument } from '@/api/client';

/**
 * Client mirror of server/src/services/abiWrite.ts isEntryEditable: any
 * draft; a native entry CBP rejected (to correct and resend it); or a
 * native entry CBP holds (to send a replacement). Never while CBP's answer
 * is pending.
 */
export function isEntryEditable(doc: Pick<AbiDocument, 'status' | 'cbpState' | 'pendingAction' | 'lastTransmissionId'>): boolean {
  if (doc.pendingAction) return false;
  if (doc.status === 'DRAFT') return true;
  if (!doc.lastTransmissionId) return false;
  return isNativeResendable(doc) || doc.cbpState === 'ON_FILE';
}

/** A native entry CBP rejected, with nothing pending. */
export function isNativeResendable(doc: Pick<AbiDocument, 'status' | 'cbpState' | 'pendingAction' | 'lastTransmissionId'>): boolean {
  return doc.status === 'REJECTED' && !!doc.lastTransmissionId && !doc.pendingAction && doc.cbpState !== 'ON_FILE';
}

/** CBP holds this entry summary and nothing is pending: it can be replaced or deleted. */
export function isOnFileAtCbp(doc: Pick<AbiDocument, 'cbpState' | 'pendingAction'>): boolean {
  return doc.cbpState === 'ON_FILE' && !doc.pendingAction;
}
