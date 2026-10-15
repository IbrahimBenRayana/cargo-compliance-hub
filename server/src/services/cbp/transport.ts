/**
 * The process-wide CBP transport: the configured binding (mock or the
 * mq-bridge), wrapped in the environment guard. Every component that talks
 * to CBP uses this one instance, so the guard can never be bypassed.
 */
import { env } from '../../config/env.js';
import { createTransport } from '../../abi-engine/transport/index.js';
import { guardTransport, type GuardedTransport } from './guardedTransport.js';

export const cbpTransport: GuardedTransport = guardTransport(
  createTransport({
    ABI_TRANSPORT: env.ABI_TRANSPORT,
    MQIPT_BRIDGE_URL: env.MQIPT_BRIDGE_URL,
    MQIPT_BRIDGE_TOKEN: env.MQIPT_BRIDGE_TOKEN,
  }),
  { environment: env.CBP_ENVIRONMENT },
);

/** Inputs for certTrafficGate / certTrafficAllowed. */
export const cbpTrafficConfig = {
  transport: env.ABI_TRANSPORT,
  environment: env.CBP_ENVIRONMENT,
} as const;
