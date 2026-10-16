/**
 * In-memory loopback transport — lets the cert console and tests exercise
 * the full transmit→receive flow before the MQIPT connection exists.
 *
 * Behavior: send() records the batch and, when a primed response exists
 * (or a responder is installed), queues it for the next receive().
 */
import { randomUUID } from 'node:crypto';
import type { AbiTransport, BrowsedMessage, SendReceipt } from './contract.js';

export type MockResponder = (sentLines: string[]) => string[] | undefined;

export class MockTransport implements AbiTransport {
  readonly kind = 'mock' as const;
  readonly sent: { messageId: string; lines: string[]; correlationId?: string }[] = [];
  private readonly inbox: string[][] = [];
  /** Browse/ack view of the same queue: messages stay until acked. */
  private readonly queue: BrowsedMessage[] = [];
  private responder: MockResponder | undefined;

  /** Queue a specific response batch for the next receive(). */
  prime(responseLines: string[]): void {
    this.inbox.push(responseLines);
    this.queue.push({ msgId: randomUUID().replace(/-/g, '').padEnd(48, '0'), lines: responseLines });
  }

  /** Install a function that fabricates a response for every send. */
  respondWith(responder: MockResponder): void {
    this.responder = responder;
  }

  async send(lines: string[], opts?: { correlationId?: string }): Promise<SendReceipt> {
    const messageId = randomUUID();
    this.sent.push({ messageId, lines: [...lines], correlationId: opts?.correlationId });
    const response = this.responder?.(lines);
    if (response) this.prime(response);
    return { messageId };
  }

  async receive(opts?: { timeoutMs?: number; max?: number }): Promise<string[][]> {
    const max = opts?.max ?? this.inbox.length;
    return this.inbox.splice(0, max);
  }

  async browse(opts?: { timeoutMs?: number; max?: number }): Promise<BrowsedMessage[]> {
    return this.queue.slice(0, opts?.max ?? this.queue.length).map((m) => ({ msgId: m.msgId, lines: [...m.lines] }));
  }

  async ack(msgIds: string[]): Promise<{ acked: string[]; missing: string[] }> {
    const acked: string[] = [];
    const missing: string[] = [];
    for (const id of msgIds) {
      const i = this.queue.findIndex((m) => m.msgId === id);
      if (i >= 0) {
        this.queue.splice(i, 1);
        acked.push(id);
      } else missing.push(id);
    }
    return { acked, missing };
  }

  async healthcheck(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: true, detail: 'mock loopback' };
  }

  async close(): Promise<void> {
    this.inbox.length = 0;
  }
}
