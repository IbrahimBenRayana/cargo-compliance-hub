/**
 * ABI transport seam (Phase 4) — the last hop between the engine and CBP.
 *
 * Everything above this interface is transport-agnostic: the engine
 * produces complete A…Z wire batches and consumes response batches. The
 * binding underneath is chosen by configuration:
 *
 *   - mock  — in-memory loopback for the cert console and tests
 *   - mqipt — IBM MQ over MQIPT (CBP connection Option #1); parameters
 *             (queue manager, channel, queues, TLS) arrive from the CBP
 *             client rep and land in env config, not code
 */
export interface SendReceipt {
  /** Transport-level message id (MQ message id once live; uuid on mock). */
  messageId: string;
}

export interface AbiTransport {
  readonly kind: 'mock' | 'mqipt';
  /** Send one complete batch (A…Z lines, 80 chars each) to CBP. */
  send(lines: string[], opts?: { correlationId?: string }): Promise<SendReceipt>;
  /**
   * Fetch available response batches (each a full A…Z line array).
   * Resolves with an empty array when nothing arrived within timeoutMs.
   */
  receive(opts?: { timeoutMs?: number; max?: number }): Promise<string[][]>;
  healthcheck(): Promise<{ ok: boolean; detail?: string }>;
  close(): Promise<void>;
}
