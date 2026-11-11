/**
 * GET /filings: what the list may ask for, and the facts each row carries.
 * Every parameter is optional, so callers written before these were added
 * get the same answers they always did.
 */
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { FILING_STATUSES, isfCutoff } from '../dashboard/rules.js';

const SORTABLE = ['createdAt', 'updatedAt', 'estimatedDeparture', 'filingDeadline', 'masterBol', 'importerName', 'status'] as const;
const SEARCHED = ['importerName', 'masterBol', 'houseBol', 'cbpTransactionId', 'vesselName', 'consigneeName'] as const;

const commaList = (item: z.ZodTypeAny) =>
  z.string().transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean)).pipe(z.array(item).max(20));

/** Paging was lenient before: a bad page meant the first one and limits were clamped. */
const clampedInt = (fallback: number, min: number, max: number) =>
  z.string().optional().transform((v) => Math.min(max, Math.max(min, parseInt(v ?? '', 10) || fallback)));

export const listQuerySchema = z.object({
  status: commaList(z.enum(FILING_STATUSES)).optional(),
  filingType: z.string().max(20).optional(),
  search: z.string().trim().max(200).optional(),
  origin: commaList(z.string().toUpperCase().regex(/^[A-Z]{2}$/)).optional(),
  etdFrom: z.string().datetime({ offset: true }).transform((s) => new Date(s)).optional(),
  etdTo: z.string().datetime({ offset: true }).transform((s) => new Date(s)).optional(),
  consolidationId: z.string().uuid().optional(),
  sortBy: z.enum(SORTABLE).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: clampedInt(1, 1, 100_000),
  limit: clampedInt(20, 1, 100),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function listWhere(orgId: string, q: ListQuery, opts: { skipStatus?: boolean } = {}): Prisma.FilingWhereInput {
  const where: Prisma.FilingWhereInput = { orgId };
  if (q.status?.length && !opts.skipStatus) where.status = q.status.length === 1 ? q.status[0] : { in: q.status };
  if (q.filingType) where.filingType = q.filingType;
  if (q.consolidationId) where.consolidationId = q.consolidationId;
  if (q.search) where.OR = SEARCHED.map((field) => ({ [field]: { contains: q.search, mode: 'insensitive' } }));
  if (q.etdFrom || q.etdTo) where.estimatedDeparture = { ...(q.etdFrom && { gte: q.etdFrom }), ...(q.etdTo && { lte: q.etdTo }) };
  // The page has always read a shipment's origin from its first commodity.
  if (q.origin?.length) {
    where.AND = [{ OR: q.origin.map((code) => ({ commodities: { path: ['0', 'countryOfOrigin'], equals: code } })) }];
  }
  return where;
}

interface ListFacts {
  consolidationId: string | null;
  estimatedDeparture: Date | null;
  estimatedLading: Date | null;
}

/** The cutoff follows the dashboard's rule, and a house bill knows how many share its master. */
export function withListFacts<T extends ListFacts>(rows: T[], groupSizes: Map<string, number>) {
  return rows.map((row) => {
    const due = isfCutoff(row);
    return {
      ...row,
      cutoff: due ? { at: due.at.toISOString(), basis: due.basis } : null,
      consolidationSize: row.consolidationId ? groupSizes.get(row.consolidationId) ?? null : null,
    };
  });
}
