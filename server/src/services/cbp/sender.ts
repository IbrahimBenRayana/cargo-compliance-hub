/**
 * Our ABI transmitter identity (batch A record): site code, id code and
 * password issued by CBP. Held as server secrets (native go-live D7), never
 * in the database. Production transmissions refuse to build without it.
 */
import { env } from '../../config/env.js';
import type { SenderIdentity } from '../../abi-engine/envelope/batch.js';

export class CbpSenderMissingError extends Error {
  readonly code = 'CBP_SENDER_MISSING';
}

export function cbpSenderFromEnv(): SenderIdentity | null {
  if (!env.CBP_SENDER_SITE || !env.CBP_SENDER_ID || !env.CBP_SENDER_PASSWORD) return null;
  return { siteCode: env.CBP_SENDER_SITE, idCode: env.CBP_SENDER_ID, password: env.CBP_SENDER_PASSWORD };
}

export function requireCbpSender(): SenderIdentity {
  const sender = cbpSenderFromEnv();
  if (!sender) {
    throw new CbpSenderMissingError('CBP sender identity is not configured (CBP_SENDER_SITE, CBP_SENDER_ID, CBP_SENDER_PASSWORD)');
  }
  return sender;
}
