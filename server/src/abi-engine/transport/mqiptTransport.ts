/**
 * MQIPT transport — HTTP client to the mq-bridge sidecar.
 *
 * The IBM MQ client libraries are glibc-only and cannot run in the Alpine
 * app image, so the actual MQ binding lives in a Debian sidecar container
 * (server/mq-bridge/) that owns the CBP trade-package credentials (CCDT
 * channel table, CMS keystore) and exposes a minimal internal HTTP API.
 * This class is a thin, dependency-free client for that API — it never
 * sees MQ specifics beyond the receipt/batch shapes of the contract.
 *
 * Config: MQIPT_BRIDGE_URL (internal Docker DNS, e.g. http://mq-bridge:8080)
 * and optional MQIPT_BRIDGE_TOKEN (shared-secret header, defense in depth
 * on top of network isolation).
 */
import type { AbiTransport, SendReceipt } from './contract.js';

export interface MqiptConfig {
  /** Base URL of the mq-bridge sidecar (internal network only). */
  bridgeUrl: string;
  /** Shared secret sent as X-Bridge-Token when set. */
  token?: string;
}

export class MqiptTransport implements AbiTransport {
  readonly kind = 'mqipt' as const;
  private readonly bridgeUrl: string;
  private readonly token?: string;

  constructor(config: MqiptConfig) {
    if (!config.bridgeUrl) {
      throw new Error(
        'MQIPT transport is not configured: MQIPT_BRIDGE_URL is required ' +
          '(the internal URL of the mq-bridge sidecar, e.g. http://mq-bridge:8080).'
      );
    }
    this.bridgeUrl = config.bridgeUrl.replace(/\/+$/, '');
    this.token = config.token;
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.token) headers['x-bridge-token'] = this.token;
    let res: Response;
    try {
      res = await fetch(`${this.bridgeUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(`mq-bridge unreachable at ${this.bridgeUrl}: ${(err as Error).message}`);
    }
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        typeof payload.error === 'string' ? payload.error : `mq-bridge ${path} failed with HTTP ${res.status}`
      );
    }
    return payload as T;
  }

  async send(lines: string[], opts?: { correlationId?: string }): Promise<SendReceipt> {
    const result = await this.call<{ messageId: string }>('POST', '/send', {
      lines,
      correlationId: opts?.correlationId,
    });
    return { messageId: result.messageId };
  }

  async receive(opts?: { timeoutMs?: number; max?: number }): Promise<string[][]> {
    const result = await this.call<{ batches: string[][] }>('POST', '/receive', {
      timeoutMs: opts?.timeoutMs,
      max: opts?.max,
    });
    return result.batches;
  }

  async healthcheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      return await this.call<{ ok: boolean; detail?: string }>('GET', '/health');
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }

  /**
   * CBP's own connectivity proof: the bridge puts a probe on TRADE.VERIFY.QR
   * and waits for the queue manager to echo it back on TRADE.VERIFY.QL.
   * Success means TLS, channel, and queue access are all working.
   */
  async verify(): Promise<{ ok: boolean; detail?: string; echoed?: string }> {
    try {
      return await this.call<{ ok: boolean; detail?: string; echoed?: string }>('POST', '/verify');
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }

  async close(): Promise<void> {
    /* stateless HTTP client — nothing to close */
  }
}
