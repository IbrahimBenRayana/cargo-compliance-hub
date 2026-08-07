/**
 * USITC refdata tests — normalization fixture is a trimmed real response
 * from /reststop/exportList?from=8507&to=8508 (fetched Aug 2026).
 */
import { describe, it, expect } from 'vitest';
import { normalizeUsitcRows, ingestChapter, type UsitcRow, type HtsRateLineStore } from '../refdata/usitcHts.js';
import { DbHtsRateSource } from '../refdata/dbRateSource.js';
import { enrichWithDuty } from '../duty/engine.js';
import { TYPE01_PAYLOAD_V2 } from './fixtures/type01PayloadV2.js';

const ROWS: UsitcRow[] = [
  { htsno: '8507', indent: '0', description: 'Electric storage batteries…', units: [], general: '', special: '', other: '' },
  { htsno: '8507.10.00', indent: '1', description: 'Lead-acid, engine starting', units: [], general: '3.5%', special: 'Free (A,AU,B…)', other: '40%' },
  { htsno: '', indent: '2', description: 'New:', units: [], general: '', special: '', other: '' },
  { htsno: '8507.10.00.30', indent: '3', description: '12 V batteries', units: ['No.', 'kg'], general: '', special: '', other: '' },
  { htsno: '8507.10.00.90', indent: '2', description: 'Other', units: ['No.', 'kg'], general: '', special: '', other: '' },
  { htsno: '8507.20', indent: '1', description: 'Other lead-acid:', units: [], general: '', special: '', other: '' },
  { htsno: '8507.20.40.00', indent: '2', description: 'Of a kind used as the primary source…', units: ['No.', 'kg'], general: '3.5%', special: 'Free (A*,AU…)', other: '40%' },
  { htsno: '8507.20.80', indent: '2', description: 'Other', units: [], general: '3.5%', special: 'Free (A*…)', other: '40%' },
  { htsno: '8507.20.80.31', indent: '3', description: 'For vehicles', units: ['No.', 'kg'], general: '', special: '', other: '' },
  { htsno: '8507.60.00', indent: '1', description: 'Lithium-ion batteries', units: [], general: '3.4%', special: 'Free (A,AU…)', other: '40%' },
  { htsno: '8507.60.00.20', indent: '2', description: 'Other', units: ['No.', 'kg'], general: '', special: '', other: '' },
];

describe('normalizeUsitcRows', () => {
  const lines = normalizeUsitcRows(ROWS);

  it('keeps only 8/10-digit lines with dots stripped', () => {
    expect(lines.map((l) => l.htsNumber)).toEqual([
      '85071000', '8507100030', '8507100090', '8507204000', '85072080', '8507208031', '85076000', '8507600020',
    ]);
  });

  it('statistical lines inherit the nearest ancestor rate line', () => {
    const stat = lines.find((l) => l.htsNumber === '8507100030')!;
    expect(stat.isRateLine).toBe(false);
    expect(stat.generalRate).toBe('3.5%');
    expect(stat.units).toEqual(['No.', 'kg']);

    const liIon = lines.find((l) => l.htsNumber === '8507600020')!;
    expect(liIon.generalRate).toBe('3.4%');
  });

  it('a sibling subtree does not leak its rate (stack pops on indent)', () => {
    // 8507.20.80.31 must inherit 8507.20.80, not 8507.20.40.00.
    const row = lines.find((l) => l.htsNumber === '8507208031')!;
    expect(row.generalRate).toBe('3.5%');
    // And the 10-digit rate line keeps its own.
    const own = lines.find((l) => l.htsNumber === '8507204000')!;
    expect(own.isRateLine).toBe(true);
  });
});

describe('DbHtsRateSource', () => {
  function reader(rows: Record<string, string>) {
    let calls = 0;
    return {
      calls: () => calls,
      findUnique: async ({ where }: { where: { htsNumber: string } }) => {
        calls++;
        const generalRate = rows[where.htsNumber];
        return generalRate === undefined ? null : { generalRate };
      },
    };
  }

  it('looks up exact 10-digit, falls back to the 8-digit rate line, caches', async () => {
    const r = reader({ '85072080': '3.5%' });
    const source = new DbHtsRateSource(r);
    expect(await source.getRate('8507.20.80.31', '20260820')).toEqual({ general: '3.5%' });
    expect(await source.getRate('8507208031', '20260820')).toEqual({ general: '3.5%' }); // cached
    expect(r.calls()).toBe(2); // 10-digit miss + 8-digit hit, then cache
    expect(await source.getRate('9999999999', '20260820')).toBeNull();
  });

  it('feeds enrichWithDuty end-to-end', async () => {
    const source = new DbHtsRateSource(reader({ '8507600020': '3.41%' }));
    const p = structuredClone(TYPE01_PAYLOAD_V2);
    delete p.entrySummary.lines[0].tariffs[0].dutyCents;
    delete p.entrySummary.grandTotals;
    const priced = await enrichWithDuty(p, source, { applicabilityDate: '20260820' });
    expect(priced.entrySummary.lines[0].tariffs[0].dutyCents).toBe(34100);
  });
});

describe('ingestChapter', () => {
  it('replaces the chapter and filters cross-chapter bleed', async () => {
    const deleted: string[] = [];
    const created: { htsNumber: string; revision: string }[] = [];
    const store: HtsRateLineStore = {
      deleteMany: async ({ where }) => deleted.push(where.htsNumber.startsWith),
      createMany: async ({ data }) => created.push(...data.map((d) => ({ htsNumber: d.htsNumber, revision: d.revision }))),
    };
    // Stub fetch for the range call.
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(ROWS), { status: 200 })) as typeof fetch;
    try {
      const count = await ingestChapter(store, '85', '2026-rev-15');
      expect(count).toBe(8);
      expect(deleted).toEqual(['85']);
      expect(created).toHaveLength(8);
      expect(created[0]).toEqual({ htsNumber: '85071000', revision: '2026-rev-15' });
    } finally {
      globalThis.fetch = original;
    }
  });

  it('rejects malformed chapter ids', async () => {
    const store: HtsRateLineStore = { deleteMany: async () => 0, createMany: async () => 0 };
    await expect(ingestChapter(store, '857', 'r')).rejects.toThrow(/2-digit chapter/);
  });
});
