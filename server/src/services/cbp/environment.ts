/**
 * CBP environment rules (native go-live spec, decision D6).
 *
 * Production talks to CBP PROD and staging to CBP CERT; the two must never
 * be crossed. The environment is declared explicitly (CBP_ENVIRONMENT) and
 * every guard derives from the rules here:
 *   - the queue manager each environment requires (CBP MQDEF, Aug 2026:
 *     CERT = QGC1 on cbpgw-trade-cert:31531, PROD = QGP2 on
 *     cbpgw-trade-prod:31530);
 *   - certification traffic (the cert console's scenarios, AMF, queries)
 *     reaches CBP only on CERT.
 *
 * Pure module: no env access, so config/env.ts can import it at boot.
 */
import { z } from 'zod';

export type AbiTransportKind = 'mock' | 'mqipt';
export type CbpEnvironment = 'NONE' | 'CERT' | 'PROD';

const blankToUndefined = (normalise: (s: string) => string) => (v: unknown) =>
  typeof v === 'string' && v.trim() !== '' ? normalise(v.trim()) : undefined;

/** Env-schema fields merged into config/env.ts. */
export const cbpEnvShape = {
  ABI_TRANSPORT: z.preprocess(
    blankToUndefined((s) => s.toLowerCase()),
    z.enum(['mock', 'mqipt']).default('mock'),
  ),
  CBP_ENVIRONMENT: z.preprocess(
    blankToUndefined((s) => s.toUpperCase()),
    z.enum(['NONE', 'CERT', 'PROD']).default('NONE'),
  ),
  /** Internal URL of the mq-bridge sidecar (compose network only). */
  MQIPT_BRIDGE_URL: z.string().default('http://mq-bridge:8080'),
  /** Shared secret sent to the bridge as X-Bridge-Token. */
  MQIPT_BRIDGE_TOKEN: z.string().default(''),
  /**
   * Our ABI transmitter identity for the batch A record (site code, id code,
   * password), issued by CBP. Secrets, not DB rows (go-live D7).
   */
  CBP_SENDER_SITE: z.string().trim().default(''),
  CBP_SENDER_ID: z.string().trim().default(''),
  CBP_SENDER_PASSWORD: z.string().default(''),
};

const QUEUE_MANAGERS: Record<Exclude<CbpEnvironment, 'NONE'>, string> = {
  CERT: 'QGC1',
  PROD: 'QGP2',
};

/** The CBP queue manager an environment must be connected to. */
export function expectedQueueManager(environment: CbpEnvironment): string | null {
  return environment === 'NONE' ? null : QUEUE_MANAGERS[environment];
}

/**
 * Certification traffic (scenarios, AMF, cert queries, queue drains) may
 * reach CBP only on CERT. The mock loopback cannot reach CBP at all, so it
 * stays usable for development and tests.
 */
export function certTrafficAllowed(cfg: { transport: AbiTransportKind; environment: CbpEnvironment }): boolean {
  return cfg.transport === 'mock' || cfg.environment === 'CERT';
}

/** Boot-time configuration problems; empty when the configuration is safe. */
export function cbpConfigProblems(cfg: {
  ABI_TRANSPORT: AbiTransportKind;
  CBP_ENVIRONMENT: CbpEnvironment;
  MQIPT_BRIDGE_TOKEN: string;
  NODE_ENV: string;
}): string[] {
  const problems: string[] = [];
  if (cfg.ABI_TRANSPORT !== 'mqipt') return problems;
  if (cfg.CBP_ENVIRONMENT === 'NONE') {
    problems.push(
      'CBP_ENVIRONMENT must be CERT or PROD when ABI_TRANSPORT=mqipt (staging = CERT, production = PROD)',
    );
  }
  if (cfg.NODE_ENV === 'production' && !cfg.MQIPT_BRIDGE_TOKEN) {
    problems.push('MQIPT_BRIDGE_TOKEN is required when ABI_TRANSPORT=mqipt in production');
  }
  return problems;
}
