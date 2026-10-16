/**
 * Inbound CBP messages, at least once (native go-live spec D1/D2).
 *
 * The only reader of the MQ response queue. Each pull browses waiting
 * messages (they stay on the queue), stores every one in
 * cbp_inbound_messages, and only then acks those MsgIds, which removes them.
 * A crash between store and ack re-delivers the message; the unique
 * (environment, MsgId) key turns that into a no-op plus a fresh ack. A DB
 * failure stops the pull and acks only what was already stored.
 *
 * Parsing, correlation and status changes happen later in the dispatcher,
 * from the stored rows, so a bug there can never lose a CBP message.
 */
import { prisma } from '../../config/database.js';
import { parseBatch } from '../../abi-engine/envelope/batch.js';
import type { AbiTransport } from '../../abi-engine/transport/contract.js';

/** Stored environment label: CERT, PROD, or MOCK for the loopback. */
export type InboundEnvironment = 'CERT' | 'PROD' | 'MOCK';

/** Application id (A record) and the first block's user data (B record). */
export function envelopeKeys(lines: string[]): { application?: string; userDataTag?: string } {
  try {
    const batch = parseBatch(lines);
    const application = batch.appId?.trim() || undefined;
    const userDataTag = (batch.blocks[0]?.header.values.userData ?? '').trim() || undefined;
    return { application, userDataTag };
  } catch {
    return { application: undefined, userDataTag: undefined };
  }
}

const isUniqueViolation = (err: unknown): boolean => (err as { code?: string })?.code === 'P2002';

export interface PullResult {
  /** The browsed batches, in queue order (stored or already stored). */
  batches: string[][];
  received: number;
  stored: number;
  duplicates: number;
  acked: number;
  missing: number;
}

export async function pullInbound(opts: {
  transport: Pick<AbiTransport, 'browse' | 'ack'>;
  environment: InboundEnvironment;
  max?: number;
  timeoutMs?: number;
}): Promise<PullResult> {
  const messages = await opts.transport.browse({ max: opts.max ?? 25, timeoutMs: opts.timeoutMs ?? 0 });
  const safeToAck: string[] = [];
  let stored = 0;
  let duplicates = 0;
  let failure: unknown;

  for (const m of messages) {
    const { application, userDataTag } = envelopeKeys(m.lines);
    try {
      await prisma.cbpInboundMessage.create({
        data: {
          environment: opts.environment,
          mqMessageId: m.msgId,
          rawText: m.lines.join('\n'),
          application,
          userDataTag,
        },
      });
      stored++;
      safeToAck.push(m.msgId);
    } catch (err) {
      if (isUniqueViolation(err)) {
        duplicates++;
        safeToAck.push(m.msgId);
        continue;
      }
      failure = err;
      break;
    }
  }

  let acked = 0;
  let missing = 0;
  if (safeToAck.length > 0) {
    const result = await opts.transport.ack(safeToAck);
    acked = result.acked.length;
    missing = result.missing.length;
  }
  if (failure) throw failure;
  return { batches: messages.map((m) => m.lines), received: messages.length, stored, duplicates, acked, missing };
}
