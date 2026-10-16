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

/**
 * Transport health. Live bridges also report the CBP queue manager they are
 * connected to (QGC1 = CERT, QGP2 = PROD) so the environment guard can
 * refuse a mismatch before anything is sent.
 */
export interface TransportHealth {
  ok: boolean;
  detail?: string;
  qmgr?: string;
  environment?: string;
}

/** A response message read without removing it from the queue. */
export interface BrowsedMessage {
  /** Transport message id (hex MQ MsgId); the key for ack and dedupe. */
  msgId: string;
  lines: string[];
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
  /**
   * At-least-once receive: read waiting responses WITHOUT removing them.
   * The caller stores each one, then calls ack() with those ids. Anything
   * not acked is returned again by the next browse.
   */
  browse(opts?: { timeoutMs?: number; max?: number }): Promise<BrowsedMessage[]>;
  /** Remove stored messages from the queue by id. */
  ack(msgIds: string[]): Promise<{ acked: string[]; missing: string[] }>;
  healthcheck(): Promise<TransportHealth>;
  close(): Promise<void>;
}
