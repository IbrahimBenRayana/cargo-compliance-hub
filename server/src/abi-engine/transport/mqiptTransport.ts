/**
 * MQIPT transport — IBM MQ over MQ Internet Pass-Thru (CBP connection
 * Option #1, confirmed with the CBP client rep Aug 2026).
 *
 * SCAFFOLD: the connection parameters come from CBP when the eISA is
 * processed (queue manager, host/port, channel, send/receive queue names,
 * TLS certificates, cipher spec). They are configuration, not code — this
 * class validates config shape now and grows the actual IBM MQ client
 * binding (the `ibmmq` package) once CBP issues the parameters. Until
 * then every network method fails loudly and predictably.
 */
import type { AbiTransport, SendReceipt } from './contract.js';

export interface MqiptConfig {
  queueManager: string;
  host: string;
  port: number;
  channel: string;
  /** CBP queue we PUT outbound batches to. */
  sendQueue: string;
  /** Our queue CBP delivers responses to. */
  receiveQueue: string;
  /** Path to the TLS key repository (client cert issued per the eISA). */
  tlsKeyRepository?: string;
  cipherSpec?: string;
}

const REQUIRED: (keyof MqiptConfig)[] = ['queueManager', 'host', 'port', 'channel', 'sendQueue', 'receiveQueue'];

export class MqiptTransport implements AbiTransport {
  readonly kind = 'mqipt' as const;

  constructor(private readonly config: MqiptConfig) {
    const missing = REQUIRED.filter((k) => config[k] === undefined || config[k] === '');
    if (missing.length > 0) {
      throw new Error(
        `MQIPT transport is not configured (missing: ${missing.join(', ')}). ` +
          'The connection parameters are issued by CBP once the eISA is processed.'
      );
    }
  }

  private notImplemented(): never {
    throw new Error(
      'MQIPT binding pending: CBP connection parameters are configured but the MQ client ' +
        'binding ships once CBP opens the connection (install `ibmmq` and implement send/receive here).'
    );
  }

  async send(_lines: string[], _opts?: { correlationId?: string }): Promise<SendReceipt> {
    this.notImplemented();
  }

  async receive(_opts?: { timeoutMs?: number; max?: number }): Promise<string[][]> {
    this.notImplemented();
  }

  async healthcheck(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: false, detail: `MQIPT binding pending (queue manager ${this.config.queueManager})` };
  }

  async close(): Promise<void> {
    /* nothing to close yet */
  }
}
