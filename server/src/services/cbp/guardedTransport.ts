/**
 * Environment guard around the live CBP transport (native go-live spec, D6).
 *
 * Before anything is sent to or read from CBP, the mq-bridge must prove it
 * is connected to the queue manager this environment requires (CERT = QGC1,
 * PROD = QGP2). A wrong queue manager, an unhealthy bridge, a bridge that
 * does not say where it is connected, or no declared environment all
 * refuse: nothing is sent and nothing is drained. Successful checks are
 * cached for a short TTL; refusals never are, so a fixed bridge is picked up
 * on the next call.
 *
 * The mock loopback cannot reach CBP and passes through untouched.
 */
import type { AbiTransport, SendReceipt, TransportHealth } from '../../abi-engine/transport/contract.js';
import { expectedQueueManager, type CbpEnvironment } from './environment.js';

export class CbpEnvironmentMismatchError extends Error {
  readonly code = 'CBP_ENV_MISMATCH';
  constructor(message: string) {
    super(message);
    this.name = 'CbpEnvironmentMismatchError';
  }
}

export class CbpTransportUnavailableError extends Error {
  readonly code = 'CBP_TRANSPORT_UNAVAILABLE';
  constructor(message: string) {
    super(message);
    this.name = 'CbpTransportUnavailableError';
  }
}

export interface VerifyResult {
  ok: boolean;
  detail?: string;
  echoed?: string;
}

/** A transport that can run CBP's TRADE.VERIFY connectivity probe. */
export interface GuardedTransport extends AbiTransport {
  readonly environment: CbpEnvironment;
  healthcheck(): Promise<TransportHealth & { expectedQmgr: string | null }>;
  verify(): Promise<VerifyResult>;
}

interface GuardOptions {
  environment: CbpEnvironment;
  /** How long a successful bridge check is trusted. */
  ttlMs?: number;
  now?: () => number;
}

const DEFAULT_TTL_MS = 60_000;

/** Older bridges only report "connected to QGC1" in the health detail. */
function queueManagerOf(health: TransportHealth): string | undefined {
  if (health.qmgr) return health.qmgr;
  return /connected to (\S+)/.exec(health.detail ?? '')?.[1];
}

type Verifiable = AbiTransport & { verify?: () => Promise<VerifyResult> };

export function guardTransport(inner: Verifiable, opts: GuardOptions): GuardedTransport {
  const { environment } = opts;
  const expected = expectedQueueManager(environment);
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const now = opts.now ?? Date.now;
  let verifiedAt: number | undefined;

  const runVerify = async (): Promise<VerifyResult> =>
    inner.verify ? inner.verify() : { ok: false, detail: `verify is not available on the ${inner.kind} transport` };

  if (inner.kind === 'mock') {
    return {
      kind: inner.kind,
      environment,
      send: (lines, sendOpts) => inner.send(lines, sendOpts),
      receive: (receiveOpts) => inner.receive(receiveOpts),
      healthcheck: async () => ({ ...(await inner.healthcheck()), environment, expectedQmgr: expected }),
      verify: runVerify,
      close: () => inner.close(),
    };
  }

  const assertEnvironment = async (): Promise<void> => {
    if (verifiedAt !== undefined && now() - verifiedAt < ttlMs) return;
    if (!expected) {
      throw new CbpEnvironmentMismatchError(
        'No CBP environment is declared for the live transport (set CBP_ENVIRONMENT to CERT or PROD)',
      );
    }
    const health = await inner.healthcheck();
    if (!health.ok) {
      throw new CbpTransportUnavailableError(`CBP transport is not healthy: ${health.detail ?? 'no detail'}`);
    }
    const actual = queueManagerOf(health);
    if (actual !== expected) {
      throw new CbpEnvironmentMismatchError(
        `Refusing to use the CBP connection: this environment is ${environment} and requires queue manager ` +
          `${expected}, but the bridge is connected to ${actual ?? 'an unreported queue manager'}`,
      );
    }
    verifiedAt = now();
  };

  return {
    kind: inner.kind,
    environment,
    async send(lines: string[], sendOpts?: { correlationId?: string }): Promise<SendReceipt> {
      await assertEnvironment();
      return inner.send(lines, sendOpts);
    },
    async receive(receiveOpts?: { timeoutMs?: number; max?: number }): Promise<string[][]> {
      await assertEnvironment();
      return inner.receive(receiveOpts);
    },
    async verify(): Promise<VerifyResult> {
      await assertEnvironment();
      return runVerify();
    },
    async healthcheck() {
      const health = await inner.healthcheck();
      const qmgr = queueManagerOf(health);
      const matches = !!expected && qmgr === expected;
      return {
        ...health,
        ok: health.ok && matches,
        qmgr,
        environment,
        expectedQmgr: expected,
        detail: health.ok && !matches
          ? `bridge is on ${qmgr ?? 'an unreported queue manager'}; ${environment} requires ${expected ?? 'a declared environment'}`
          : health.detail,
      };
    },
    close: () => inner.close(),
  };
}
