/**
 * Certification traffic (cert-console scenarios, AMF, cert queries, queue
 * drains) may reach CBP only on CERT. On production the cert console must
 * answer 409 before touching the transport (native go-live spec, D6).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { certTrafficGate, transportErrorStatus } from '../certTrafficGate.js';
import { CbpEnvironmentMismatchError, CbpTransportUnavailableError } from '../guardedTransport.js';

function run(cfg: Parameters<typeof certTrafficGate>[0]) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const next = vi.fn() as unknown as NextFunction;
  certTrafficGate(cfg)({} as Request, { status } as unknown as Response, next);
  return { status, json, next };
}

describe('certTrafficGate', () => {
  it('lets certification traffic through on CBP CERT', () => {
    const { next, status } = run({ transport: 'mqipt', environment: 'CERT' });
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it('answers 409 on CBP PROD without calling the handler', () => {
    const { next, status, json } = run({ transport: 'mqipt', environment: 'PROD' });
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CERT_TRAFFIC_DISABLED', environment: 'PROD' }));
  });

  it('answers 409 on the live transport with no declared environment', () => {
    const { next, status } = run({ transport: 'mqipt', environment: 'NONE' });
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(409);
  });

  it('allows the mock loopback (development and tests)', () => {
    const { next } = run({ transport: 'mock', environment: 'NONE' });
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('transportErrorStatus', () => {
  it('maps an environment mismatch to 409', () => {
    expect(transportErrorStatus(new CbpEnvironmentMismatchError('x'))).toBe(409);
  });

  it('maps an unavailable bridge to 503', () => {
    expect(transportErrorStatus(new CbpTransportUnavailableError('x'))).toBe(503);
  });

  it('keeps 502 for any other transport failure', () => {
    expect(transportErrorStatus(new Error('MQRC 2085'))).toBe(502);
  });
});
