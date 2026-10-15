/**
 * CBP environment rules (native go-live spec, decision D6): production talks
 * to CBP PROD (queue manager QGP2), staging to CBP CERT (QGC1), and the two
 * can never be crossed. These are the pure rules every guard builds on.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  cbpEnvShape,
  cbpConfigProblems,
  expectedQueueManager,
  certTrafficAllowed,
} from '../environment.js';

const parse = (raw: Record<string, string | undefined>) => z.object(cbpEnvShape).parse(raw);

describe('cbpEnvShape', () => {
  it('defaults to the mock transport with no CBP environment', () => {
    expect(parse({})).toEqual({
      ABI_TRANSPORT: 'mock',
      CBP_ENVIRONMENT: 'NONE',
      MQIPT_BRIDGE_URL: 'http://mq-bridge:8080',
      MQIPT_BRIDGE_TOKEN: '',
    });
  });

  it('normalises case, matching what is already in the VM .env files', () => {
    const cfg = parse({ ABI_TRANSPORT: 'MQIPT', CBP_ENVIRONMENT: 'cert' });
    expect(cfg.ABI_TRANSPORT).toBe('mqipt');
    expect(cfg.CBP_ENVIRONMENT).toBe('CERT');
  });

  it('treats an empty value as unset', () => {
    expect(parse({ ABI_TRANSPORT: '', CBP_ENVIRONMENT: '' })).toMatchObject({ ABI_TRANSPORT: 'mock', CBP_ENVIRONMENT: 'NONE' });
  });

  it('rejects an unknown transport or environment', () => {
    expect(() => parse({ ABI_TRANSPORT: 'sftp' })).toThrow();
    expect(() => parse({ CBP_ENVIRONMENT: 'TEST' })).toThrow();
  });
});

describe('cbpConfigProblems', () => {
  it('refuses the live MQ transport without a declared CBP environment', () => {
    const problems = cbpConfigProblems({ ABI_TRANSPORT: 'mqipt', CBP_ENVIRONMENT: 'NONE', MQIPT_BRIDGE_TOKEN: 't', NODE_ENV: 'test' });
    expect(problems.join(' ')).toMatch(/CBP_ENVIRONMENT/);
  });

  it('requires the bridge token for the live MQ transport in production', () => {
    const problems = cbpConfigProblems({ ABI_TRANSPORT: 'mqipt', CBP_ENVIRONMENT: 'PROD', MQIPT_BRIDGE_TOKEN: '', NODE_ENV: 'production' });
    expect(problems.join(' ')).toMatch(/MQIPT_BRIDGE_TOKEN/);
  });

  it('accepts a complete CERT or PROD configuration', () => {
    expect(cbpConfigProblems({ ABI_TRANSPORT: 'mqipt', CBP_ENVIRONMENT: 'CERT', MQIPT_BRIDGE_TOKEN: 't', NODE_ENV: 'production' })).toEqual([]);
    expect(cbpConfigProblems({ ABI_TRANSPORT: 'mqipt', CBP_ENVIRONMENT: 'PROD', MQIPT_BRIDGE_TOKEN: 't', NODE_ENV: 'production' })).toEqual([]);
  });

  it('accepts the mock transport with no environment (dev, tests, prod before go-live)', () => {
    expect(cbpConfigProblems({ ABI_TRANSPORT: 'mock', CBP_ENVIRONMENT: 'NONE', MQIPT_BRIDGE_TOKEN: '', NODE_ENV: 'production' })).toEqual([]);
  });
});

describe('expectedQueueManager', () => {
  it('maps CERT to QGC1 and PROD to QGP2 (CBP MQDEF, Aug 2026)', () => {
    expect(expectedQueueManager('CERT')).toBe('QGC1');
    expect(expectedQueueManager('PROD')).toBe('QGP2');
  });

  it('has no queue manager without an environment', () => {
    expect(expectedQueueManager('NONE')).toBeNull();
  });
});

describe('certTrafficAllowed', () => {
  it('allows certification traffic on CBP CERT', () => {
    expect(certTrafficAllowed({ transport: 'mqipt', environment: 'CERT' })).toBe(true);
  });

  it('never allows certification traffic to CBP PROD', () => {
    expect(certTrafficAllowed({ transport: 'mqipt', environment: 'PROD' })).toBe(false);
  });

  it('refuses the live transport when no environment is declared', () => {
    expect(certTrafficAllowed({ transport: 'mqipt', environment: 'NONE' })).toBe(false);
  });

  it('allows the mock loopback anywhere, since it cannot reach CBP', () => {
    expect(certTrafficAllowed({ transport: 'mock', environment: 'NONE' })).toBe(true);
    expect(certTrafficAllowed({ transport: 'mock', environment: 'PROD' })).toBe(true);
  });
});
