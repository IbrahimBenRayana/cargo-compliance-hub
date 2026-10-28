/**
 * Cert-console gate (native go-live spec, D6): certification traffic reaches
 * CBP only on CERT. Routes that send to or read from the MQ queues answer
 * 409 elsewhere, before the handler runs.
 */
import type { NextFunction, Request, Response } from 'express';
import { certTrafficAllowed, type AbiTransportKind, type CbpEnvironment } from './environment.js';
import { CbpEnvironmentMismatchError, CbpTransportUnavailableError } from './guardedTransport.js';

export function certTrafficGate(cfg: { transport: AbiTransportKind; environment: CbpEnvironment }) {
  // Named so route wiring can be asserted (routes/__tests__/certConsoleGate.test.ts).
  return function certOnlyGate(_req: Request, res: Response, next: NextFunction): void {
    if (certTrafficAllowed(cfg)) {
      next();
      return;
    }
    res.status(409).json({
      error:
        cfg.environment === 'PROD'
          ? 'Certification traffic is disabled on production: this server is connected to CBP PROD.'
          : 'Certification traffic needs a CBP CERT connection, and none is declared for this server.',
      code: 'CERT_TRAFFIC_DISABLED',
      environment: cfg.environment,
    });
  };
}

/** HTTP status for a failed transport call. */
export function transportErrorStatus(err: unknown): number {
  if (err instanceof CbpEnvironmentMismatchError) return 409;
  if (err instanceof CbpTransportUnavailableError) return 503;
  return 502;
}
