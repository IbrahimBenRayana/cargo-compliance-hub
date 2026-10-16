/**
 * Inbound dispatcher (native go-live spec D1/D3).
 *
 * Works only from stored rows (cbp_inbound_messages), never from the queue.
 * Each undispatched row is offered to the handlers in order; the first that
 * claims it records what it matched. Rows no handler claims are marked
 * dispatched with no entity: the "unmatched" list an admin reviews, so no
 * CBP message is silently dropped. A handler error leaves the row pending
 * (with the error recorded) so a transient failure retries next run.
 */
import { prisma } from '../../config/database.js';

export interface InboundRow {
  id: string;
  environment: string;
  application: string | null;
  userDataTag: string | null;
  lines: string[];
}

export interface InboundMatch {
  entityType: string;
  entityId: string;
  transmissionId?: string;
  parsed?: unknown;
}

export type InboundHandler = (row: InboundRow) => Promise<InboundMatch | null>;

export interface DispatchResult {
  dispatched: number;
  matched: number;
  unmatched: number;
  failed: number;
}

export async function dispatchPending(opts: {
  environment: string;
  handlers: InboundHandler[];
  limit?: number;
}): Promise<DispatchResult> {
  const rows = await prisma.cbpInboundMessage.findMany({
    where: { environment: opts.environment, dispatchedAt: null },
    orderBy: { receivedAt: 'asc' },
    take: opts.limit ?? 100,
    select: { id: true, environment: true, application: true, userDataTag: true, rawText: true },
  });
  const result: DispatchResult = { dispatched: 0, matched: 0, unmatched: 0, failed: 0 };

  for (const r of rows) {
    const row: InboundRow = {
      id: r.id,
      environment: r.environment,
      application: r.application,
      userDataTag: r.userDataTag,
      lines: r.rawText.split('\n'),
    };
    try {
      let match: InboundMatch | null = null;
      for (const handler of opts.handlers) {
        match = await handler(row);
        if (match) break;
      }
      await prisma.cbpInboundMessage.update({
        where: { id: r.id },
        data: {
          dispatchedAt: new Date(),
          parseError: null,
          matchedEntityType: match?.entityType ?? null,
          matchedEntityId: match?.entityId ?? null,
          transmissionId: match?.transmissionId ?? null,
          parsed: match?.parsed === undefined ? undefined : JSON.parse(JSON.stringify(match.parsed)),
        },
      });
      result.dispatched++;
      if (match) result.matched++;
      else result.unmatched++;
    } catch (err) {
      await prisma.cbpInboundMessage.update({
        where: { id: r.id },
        data: { parseError: err instanceof Error ? err.message : String(err) },
      });
      result.failed++;
    }
  }
  return result;
}
