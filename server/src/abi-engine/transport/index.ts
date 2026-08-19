/**
 * Transport factory — binding chosen by configuration.
 *
 *   ABI_TRANSPORT=mock   (default) in-memory loopback
 *   ABI_TRANSPORT=mqipt  IBM MQ over MQIPT via the mq-bridge sidecar;
 *                        requires MQIPT_BRIDGE_URL (+ optional token).
 */
import type { AbiTransport } from './contract.js';
import { MockTransport } from './mockTransport.js';
import { MqiptTransport } from './mqiptTransport.js';

export type { AbiTransport, SendReceipt } from './contract.js';
export { MockTransport } from './mockTransport.js';
export { MqiptTransport, type MqiptConfig } from './mqiptTransport.js';

export interface TransportEnv {
  ABI_TRANSPORT?: string;
  /** Internal URL of the mq-bridge sidecar (e.g. http://mq-bridge:8080). */
  MQIPT_BRIDGE_URL?: string;
  /** Optional shared secret sent as X-Bridge-Token. */
  MQIPT_BRIDGE_TOKEN?: string;
}

export function createTransport(env: TransportEnv): AbiTransport {
  const kind = (env.ABI_TRANSPORT ?? 'mock').toLowerCase();
  if (kind === 'mqipt') {
    return new MqiptTransport({
      bridgeUrl: env.MQIPT_BRIDGE_URL ?? '',
      token: env.MQIPT_BRIDGE_TOKEN,
    });
  }
  if (kind !== 'mock') {
    throw new Error(`Unknown ABI_TRANSPORT '${kind}' (expected 'mock' or 'mqipt')`);
  }
  return new MockTransport();
}
