import { describe, it, expect } from 'vitest';
import { listQuerySchema, listWhere, withListFacts } from '../listQuery.js';

const parse = (q: Record<string, string>) => listQuerySchema.parse(q);
const HOUR = 3_600_000;

describe('listQuerySchema', () => {
  it('reads a comma list of statuses', () => {
    expect(parse({ status: 'submitted,pending_cbp' }).status).toEqual(['submitted', 'pending_cbp']);
  });

  it('refuses a status that does not exist', () => {
    expect(listQuerySchema.safeParse({ status: 'cleared' }).success).toBe(false);
  });

  it('keeps the old lenient paging: a bad page is 1, a bad limit is 20, and limits stop at 100', () => {
    expect(parse({ page: 'abc' }).page).toBe(1);
    expect(parse({ limit: '500' }).limit).toBe(100);
    expect(parse({ limit: '0' }).limit).toBe(20);
    expect(parse({}).limit).toBe(20);
  });

  it('sorts only by known columns, newest first by default', () => {
    expect(parse({})).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc' });
    expect(parse({ sortBy: 'masterBol', sortOrder: 'asc' })).toMatchObject({ sortBy: 'masterBol', sortOrder: 'asc' });
    expect(listQuerySchema.safeParse({ sortBy: 'passwordHash' }).success).toBe(false);
  });

  it('reads origins as upper-case country codes', () => {
    expect(parse({ origin: 'cn,VN' }).origin).toEqual(['CN', 'VN']);
    expect(listQuerySchema.safeParse({ origin: 'China' }).success).toBe(false);
  });

  it('reads departure bounds as instants', () => {
    const q = parse({ etdFrom: '2026-11-01T05:00:00.000Z', etdTo: '2026-11-30T04:59:59.999Z' });
    expect(q.etdFrom?.toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(listQuerySchema.safeParse({ etdFrom: 'next week' }).success).toBe(false);
  });
});

describe('listWhere', () => {
  it('always scopes to the organisation', () => {
    expect(listWhere('o1', parse({}))).toEqual({ orgId: 'o1' });
  });

  it('matches one status exactly and several with in', () => {
    expect(listWhere('o1', parse({ status: 'draft' })).status).toBe('draft');
    expect(listWhere('o1', parse({ status: 'accepted,amended' })).status).toEqual({ in: ['accepted', 'amended'] });
  });

  it('can leave the status out, for counting by status', () => {
    expect(listWhere('o1', parse({ status: 'draft' }), { skipStatus: true }).status).toBeUndefined();
  });

  it('searches the same fields as before', () => {
    const fields = (listWhere('o1', parse({ search: 'HLCU' })).OR as Record<string, unknown>[]).map((c) => Object.keys(c)[0]);
    expect(fields).toEqual(['importerName', 'masterBol', 'houseBol', 'cbpTransactionId', 'vesselName', 'consigneeName']);
  });

  it('filters origin on the first commodity, as the page always has', () => {
    expect(listWhere('o1', parse({ origin: 'CN,VN' })).AND).toEqual([{
      OR: [
        { commodities: { path: ['0', 'countryOfOrigin'], equals: 'CN' } },
        { commodities: { path: ['0', 'countryOfOrigin'], equals: 'VN' } },
      ],
    }]);
  });

  it('bounds the departure date on either side', () => {
    const where = listWhere('o1', parse({ etdFrom: '2026-11-01T00:00:00.000Z' }));
    expect(where.estimatedDeparture).toEqual({ gte: new Date('2026-11-01T00:00:00.000Z') });
  });

  it('narrows to one consolidation', () => {
    const id = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
    expect(listWhere('o1', parse({ consolidationId: id })).consolidationId).toBe(id);
  });
});

describe('withListFacts', () => {
  const base = { id: 'f1', consolidationId: null, estimatedDeparture: null, estimatedLading: null };

  it('gives the exact cutoff when there is a lading date', () => {
    const lading = new Date('2026-11-20T12:00:00.000Z');
    const [row] = withListFacts([{ ...base, estimatedDeparture: new Date('2026-11-21T00:00:00.000Z'), estimatedLading: lading }], new Map());
    expect(row.cutoff).toEqual({ at: new Date(lading.getTime() - 24 * HOUR).toISOString(), basis: 'LADING' });
  });

  it('marks a cutoff taken from the sailing date as an estimate', () => {
    const [row] = withListFacts([{ ...base, estimatedDeparture: new Date('2026-11-21T00:00:00.000Z') }], new Map());
    expect(row.cutoff?.basis).toBe('ETD_ESTIMATE');
  });

  it('has no cutoff without dates, and no group size outside a consolidation', () => {
    const [row] = withListFacts([base], new Map());
    expect(row).toMatchObject({ cutoff: null, consolidationSize: null });
  });

  it('counts the house bills in a consolidation', () => {
    const [row] = withListFacts([{ ...base, consolidationId: 'c1' }], new Map([['c1', 3]]));
    expect(row.consolidationSize).toBe(3);
  });
});
