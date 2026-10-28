/**
 * The one CBP queue consumer (native go-live spec D1): pull (browse, store,
 * ack) then dispatch, for the environment this server is declared for.
 * Concurrent callers (the cron tick, the cert console's "Check for
 * responses", an inline query waiting for its reply) join a single run, so
 * the queue is never read twice at once.
 */
import { prisma } from '../../config/database.js';
import { cbpTransport, cbpTrafficConfig } from './transport.js';
import { pullInbound, type InboundEnvironment, type PullResult } from './inbound.js';
import { dispatchPending, type DispatchResult, type InboundHandler } from './dispatcher.js';
import { certInboundHandler } from './certAttach.js';
import { taggedTransmissionHandler, businessKeyHandler } from './transmissionHandlers.js';
import { currencyRateHandler } from './currency.js';

export function inboundEnvironment(): InboundEnvironment {
  if (cbpTrafficConfig.transport === 'mock') return 'MOCK';
  return cbpTrafficConfig.environment === 'PROD' ? 'PROD' : 'CERT';
}

/**
 * Handlers per environment, first claim wins: our tagged transmissions,
 * then cert-console scenarios (CERT only), then unsolicited messages by
 * ISF transaction / entry number.
 */
function handlersFor(environment: InboundEnvironment): InboundHandler[] {
  return environment === 'PROD'
    ? [taggedTransmissionHandler, currencyRateHandler, businessKeyHandler]
    : [taggedTransmissionHandler, certInboundHandler, currencyRateHandler, businessKeyHandler];
}

export interface InboundRun {
  pull: PullResult;
  dispatch: DispatchResult;
}

let running: Promise<InboundRun> | null = null;

export function processInbound(opts?: { timeoutMs?: number }): Promise<InboundRun> {
  if (running) return running;
  const environment = inboundEnvironment();
  running = (async () => {
    const pull = await pullInbound({ transport: cbpTransport, environment, timeoutMs: opts?.timeoutMs ?? 0 });
    const dispatch = await dispatchPending({ environment, handlers: handlersFor(environment) });
    return { pull, dispatch };
  })().finally(() => {
    running = null;
  });
  return running;
}

/**
 * Wait (up to timeoutMs) for a stored response received since `since` that
 * matches, pulling from the queue while waiting. Returns every batch stored
 * since `since`, so callers can show related advisories too.
 */
export async function awaitInbound(opts: {
  since: Date;
  matches: (row: { application: string | null; userDataTag: string | null; rawText: string }) => boolean;
  timeoutMs: number;
}): Promise<{ found: boolean; batches: string[][] }> {
  const deadline = Date.now() + opts.timeoutMs;
  const environment = inboundEnvironment();
  for (;;) {
    await processInbound({ timeoutMs: Math.min(2000, Math.max(0, deadline - Date.now())) });
    const rows = await prisma.cbpInboundMessage.findMany({
      where: { environment, receivedAt: { gte: opts.since } },
      orderBy: { receivedAt: 'asc' },
      select: { application: true, userDataTag: true, rawText: true },
    });
    const found = rows.some(opts.matches);
    if (found || Date.now() >= deadline) {
      return { found, batches: rows.map((r) => r.rawText.split('\n')) };
    }
  }
}
