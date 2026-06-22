/**
 * Webhook delivery for the public API.
 *
 * Integrators register callback URLs (WebhookEndpoint) and we POST a JSON event
 * to them on filing/entry status changes — push instead of polling. Each request
 * is signed with HMAC-SHA256 over the raw body (header `X-MCL-Signature:
 * sha256=…`) using the endpoint's secret, so receivers can verify authenticity.
 *
 * Delivery is best-effort: fire-and-forget with a few retries and a per-attempt
 * timeout; the last outcome is recorded on the endpoint for debugging. (A
 * durable retry queue is a future enhancement — see Plan B.)
 */
import { randomBytes, createHmac } from 'node:crypto';
import { prisma } from '../config/database.js';
import logger from '../config/logger.js';

export const WEBHOOK_EVENTS = [
  'filing.submitted',
  'filing.accepted',
  'filing.rejected',
  'entry.sent',
  'entry.accepted',
  'entry.rejected',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const DELIVERY_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 3;

/** Generate a signing secret + its non-secret display prefix. */
export function generateWebhookSecret(): { secret: string; prefix: string } {
  const secret = `whsec_${randomBytes(24).toString('base64url')}`;
  return { secret, prefix: secret.slice(0, 12) };
}

/** HMAC-SHA256 of the body, formatted as the X-MCL-Signature header value. */
export function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Deliver an event to every active endpoint in the org that subscribes to it
 * (an empty `events` array means "all events"). Await-able so it can be tested;
 * production callers use the fire-and-forget emitWebhook wrapper below.
 */
export async function dispatchWebhook(
  orgId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({ where: { orgId, active: true } });
  const targets = endpoints.filter((e) => e.events.length === 0 || e.events.includes(event));
  if (targets.length === 0) return;

  const payload = JSON.stringify({ event, createdAt: new Date().toISOString(), data });
  await Promise.all(targets.map((ep) => deliverOne(ep, event, payload)));
}

/** Fire-and-forget — never blocks or throws into the caller. */
export function emitWebhook(orgId: string, event: WebhookEvent, data: Record<string, unknown>): void {
  void dispatchWebhook(orgId, event, data).catch((err) => {
    logger.error({ err, orgId, event }, 'Webhook dispatch failed');
  });
}

async function deliverOne(
  ep: { id: string; url: string; secret: string },
  event: WebhookEvent,
  payload: string,
): Promise<void> {
  const signature = signPayload(ep.secret, payload);
  let lastStatus = 0;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MyCargoLens-Webhooks/1',
          'X-MCL-Event': event,
          'X-MCL-Signature': signature,
          'X-MCL-Delivery-Attempt': String(attempt),
        },
        body: payload,
        signal: controller.signal,
      });
      lastStatus = res.status;
      lastError = res.ok ? null : `HTTP ${res.status}`;
      if (res.ok) break;
    } catch (err: any) {
      lastStatus = 0;
      lastError = err?.name === 'AbortError' ? 'timeout' : (err?.message ?? 'delivery error');
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(250 * attempt);
  }

  await prisma.webhookEndpoint
    .update({ where: { id: ep.id }, data: { lastStatus, lastError, lastDeliveryAt: new Date() } })
    .catch(() => {});
}
