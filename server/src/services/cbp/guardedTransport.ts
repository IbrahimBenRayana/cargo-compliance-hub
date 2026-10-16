/**
 * Environment guard around the live CBP transport (native go-live spec, D6).
 *
 * Before anything is sent to or read from CBP, the mq-bridge must prove it
 * is connected to the queue manager this environment requires (CERT = QGC1,
 * PROD = QGP2). A wrong queue manager, an unhealthy bridge, a bridge that
 * does not say where it is connected, or no declared environment all
 * refuse: nothing is sent and nothing is drained. Successful checks are
 * cached for a short TTL; any refusal, error or unhealthy health check clears
 * the cache, so a swapped or fixed bridge is re-checked on the next call.
 *
 * The mock loopback cannot reach CBP and passes through untouched.
 */
import type { AbiTransport, BrowsedMessage, SendReceipt, TransportHealth } from '../../abi-engine/transport/contract.js';
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
      browse: (browseOpts) => inner.browse(browseOpts),
      ack: (ids) => inner.ack(ids),
      healthcheck: async () => ({ ...(await inner.healthcheck()), environment, expectedQmgr: expected }),
      verify: runVerify,
      close: () => inner.close(),
    };
  }

  /**
   * 'traffic' (send/receive) needs a healthy bridge on the right queue
   * manager and caches success. 'probe' (TRADE.VERIFY) only needs the right
   * queue manager: it is the diagnostic for an unhealthy connection, so the
   * business queues being down must not block it. Probes are never cached.
   */
  const assertEnvironment = async (mode: 'traffic' | 'probe'): Promise<void> => {
    if (mode === 'traffic' && verifiedAt !== undefined && now() - verifiedAt < ttlMs) return;
    if (!expected) {
      throw new CbpEnvironmentMismatchError(
        'No CBP environment is declared for the live transport (set CBP_ENVIRONMENT to CERT or PROD)',
      );
    }
    const health = await inner.healthcheck();
    const actual = queueManagerOf(health);
    if (!health.ok && actual === undefined) {
      verifiedAt = undefined;
      throw new CbpTransportUnavailableError(`CBP transport is not healthy: ${health.detail ?? 'no detail'}`);
    }
    if (actual !== expected) {
      verifiedAt = undefined;
      throw new CbpEnvironmentMismatchError(
        `Refusing to use the CBP connection: this environment is ${environment} and requires queue manager ` +
          `${expected}, but the bridge is connected to ${actual ?? 'an unreported queue manager'}`,
      );
    }
    if (mode === 'probe') return;
    if (!health.ok) {
      verifiedAt = undefined;
      throw new CbpTransportUnavailableError(`CBP transport is not healthy: ${health.detail ?? 'no detail'}`);
    }
    verifiedAt = now();
  };

  /** Any failure forgets the cached check, so the next call re-verifies the bridge. */
  const guarded = async <T>(mode: 'traffic' | 'probe', call: () => Promise<T>): Promise<T> => {
    try {
      await assertEnvironment(mode);
      return await call();
    } catch (err) {
      verifiedAt = undefined;
      throw err;
    }
  };

  return {
    kind: inner.kind,
    environment,
    send: (lines: string[], sendOpts?: { correlationId?: string }): Promise<SendReceipt> =>
      guarded('traffic', () => inner.send(lines, sendOpts)),
    receive: (receiveOpts?: { timeoutMs?: number; max?: number }): Promise<string[][]> =>
      guarded('traffic', () => inner.receive(receiveOpts)),
    browse: (browseOpts?: { timeoutMs?: number; max?: number }): Promise<BrowsedMessage[]> =>
      guarded('traffic', () => inner.browse(browseOpts)),
    ack: (ids: string[]) => guarded('traffic', () => inner.ack(ids)),
    verify: (): Promise<VerifyResult> => guarded('probe', runVerify),
    async healthcheck() {
      const health = await inner.healthcheck();
      const qmgr = queueManagerOf(health);
      const matches = !!expected && qmgr === expected;
      if (!health.ok || !matches) verifiedAt = undefined;
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
