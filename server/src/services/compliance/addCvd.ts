/**
 * ADD/CVD (Anti-Dumping / Countervailing Duty) order lookup.
 *
 * Backed by the `add_cvd_orders` table — populated initially from the
 * bundled JSON seed (see migration 8_add_cvd_orders) and refreshed by
 * the Federal Register sync cron (see addCvdSync.ts). Only orders with
 * status='active' are exposed to end users; status='pending' rows are
 * discovered candidates awaiting admin review.
 *
 * Reads use a small in-memory cache (5 min TTL) so the lookup endpoint
 * stays snappy without hammering the DB on every keystroke.
 *
 * Matching strategy:
 *   • HTS query: longest-prefix wins. "8541.43.00.10" matches "8541.43".
 *   • Country query: exact ISO-2.
 *   • Free text: case-insensitive substring across product / case# /
 *     country / HTS prefix.
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

export type AddCvdType = 'AD' | 'CVD' | 'ADCVD';

export interface AddCvdOrder {
  case: string;
  type: AddCvdType;
  country: string;
  product: string;
  htsPrefixes: string[];
  note: string;
}

// In-memory cache rebuilt every 5 minutes (or on-demand via invalidate()).
const CACHE_TTL_MS = 5 * 60_000;
let cache: { orders: AddCvdOrder[]; loadedAt: number } | null = null;

async function getActiveOrders(): Promise<AddCvdOrder[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.orders;
  }
  try {
    const rows = await prisma.addCvdOrder.findMany({
      where:   { status: 'active' },
      orderBy: { case: 'asc' },
    });
    const orders: AddCvdOrder[] = rows.map((r) => ({
      case:        r.case,
      type:        r.type as AddCvdType,
      country:     r.country,
      product:     r.product,
      htsPrefixes: r.htsPrefixes,
      note:        r.note ?? '',
    }));
    cache = { orders, loadedAt: Date.now() };
    return orders;
  } catch (err) {
    logger.warn({ err }, '[addCvd] DB read failed, returning empty list');
    return cache?.orders ?? [];
  }
}

/** Drop the cache so the next read pulls fresh data. Called by the sync
 *  cron after writing approved candidates. */
export function invalidateAddCvdCache(): void {
  cache = null;
}

function normaliseHts(hts: string): string {
  return (hts || '').replace(/\D/g, '');
}

export async function lookupAddCvd(query: string): Promise<AddCvdOrder[]> {
  const q = (query || '').trim();
  if (!q) return [];
  const orders = await getActiveOrders();

  // HTS-numeric query: longest-prefix match across orders.
  if (/^\d/.test(q)) {
    const digits = normaliseHts(q);
    return orders.filter((o) =>
      o.htsPrefixes.some((p) => digits.startsWith(normaliseHts(p))),
    );
  }

  // Country code query: 2 chars, alphanumeric.
  if (/^[A-Z]{2}$/i.test(q)) {
    const code = q.toUpperCase();
    return orders.filter((o) => o.country === code);
  }

  // Free text: substring search across product, case#, country, HTS list.
  const needle = q.toLowerCase();
  return orders.filter((o) =>
    o.product.toLowerCase().includes(needle) ||
    o.case.toLowerCase().includes(needle) ||
    o.country.toLowerCase().includes(needle) ||
    o.htsPrefixes.some((p) => p.toLowerCase().includes(needle)),
  );
}

export function getAddCvdMeta(): { source: string; lastUpdated: string; note: string } {
  // Metadata is no longer file-driven; the live count + most-recent
  // updatedAt reflect actual DB state. Keep the shape stable for the
  // existing API contract.
  return {
    source:      'U.S. Department of Commerce — Enforcement & Compliance, active AD/CVD orders',
    lastUpdated: cache?.loadedAt ? new Date(cache.loadedAt).toISOString().slice(0, 10) : '',
    note:        'List is refreshed daily from Federal Register. New entries land as candidates and are promoted to active after admin review.',
  };
}
