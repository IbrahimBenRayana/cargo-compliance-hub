/**
 * Transport factory — binding chosen by configuration.
 *
 *   ABI_TRANSPORT=mock   (default) in-memory loopback
 *   ABI_TRANSPORT=mqipt  IBM MQ over MQIPT; requires the MQIPT_* variables
 *                        issued by CBP after eISA processing.
 */
import type { AbiTransport } from './contract.js';
import { MockTransport } from './mockTransport.js';
import { MqiptTransport } from './mqiptTransport.js';

export type { AbiTransport, SendReceipt } from './contract.js';
export { MockTransport } from './mockTransport.js';
export { MqiptTransport, type MqiptConfig } from './mqiptTransport.js';

export interface TransportEnv {
  ABI_TRANSPORT?: string;
  MQIPT_QUEUE_MANAGER?: string;
  MQIPT_HOST?: string;
  MQIPT_PORT?: string;
  MQIPT_CHANNEL?: string;
  MQIPT_SEND_QUEUE?: string;
  MQIPT_RECEIVE_QUEUE?: string;
  MQIPT_TLS_KEY_REPOSITORY?: string;
  MQIPT_CIPHER_SPEC?: string;
}

export function createTransport(env: TransportEnv): AbiTransport {
  const kind = (env.ABI_TRANSPORT ?? 'mock').toLowerCase();
  if (kind === 'mqipt') {
    return new MqiptTransport({
      queueManager: env.MQIPT_QUEUE_MANAGER ?? '',
      host: env.MQIPT_HOST ?? '',
      port: Number(env.MQIPT_PORT ?? 0),
      channel: env.MQIPT_CHANNEL ?? '',
      sendQueue: env.MQIPT_SEND_QUEUE ?? '',
      receiveQueue: env.MQIPT_RECEIVE_QUEUE ?? '',
      tlsKeyRepository: env.MQIPT_TLS_KEY_REPOSITORY,
      cipherSpec: env.MQIPT_CIPHER_SPEC,
    });
  }
  if (kind !== 'mock') {
    throw new Error(`Unknown ABI_TRANSPORT '${kind}' (expected 'mock' or 'mqipt')`);
  }
  return new MockTransport();
}
