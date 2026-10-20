/**
 * Chapter 99 numbers on an entry line (audit workstream C: BNA-11, ENG-03,
 * MHT-01..07, MHT-11).
 *
 * Rates are the verbatim USITC General texts (2026-aug-06 edition) and the
 * expected stacks and duties are the ones CERT accepted: the CN battery key
 * 9903.91.06 / 9903.05.31 / 9903.94.06 (scenario 025), plain-rate NT52
 * headings replacing column 1 (EU/JP/CH), and 9903.41.10 in lieu (024).
 */
import { describe, it, expect } from 'vitest';
import { abiDocumentBodySchema } from '../../schemas/abiDocument.js';
import { migrateV1ToV2 } from '../../abi-engine/payload/migrateV1.js';
import { orderCh99, ch99SearchWhere } from '../../abi-engine/payload/ch99.js';
import { enrichWithDuty, StaticRateSource } from '../../abi-engine/duty/engine.js';
import { ch99Semantics, parseRateExpression } from '../../abi-engine/duty/rateExpression.js';
import { toAeEntrySummaryInput } from '../../abi-engine/payload/toAeInput.js';
import { validateEntrySummary } from '../../abi-engine/validate/entrySummary.js';
import { buildEntrySummary } from '../../abi-engine/ae/builder.js';
import { RecordCodecError } from '../../abi-engine/records/codec.js';
import { hasCh99Claims, mapABIDocumentToCC } from '../abiDocumentMapper.js';
import { entryBody } from './fixtures/entryBody.js';

const USITC = {
  '8507600030': '3.4%',
  '3920200000': '3%',
  '6403599045': '10%',
  '99039106': 'The duty provided in the applicable subheading + 25%', // 301 review, batteries
  '99030531': 'The duty provided in the applicable subheading + 12.5%', // NT52 CN
  '99039406': 'The duty provided in the applicable subheading', // 232 autos/parts, no additional
  '99038801': 'The duty provided in the applicable subheading plus 25%', // 301 List 1
  '99030539': '10%', // NT52 EU, column 1 below 10%
  '99030549': '12.5%', // NT52 JP
  '99034110': '40%', // JP footwear, in lieu
  '99038203': 'No change',
  '99031701': '', // quota sub-row, no rate
};
const RATES = new StaticRateSource(USITC);

const body = entryBody;

async function line(opts: Parameters<typeof body>[0]) {
  const priced = await enrichWithDuty(migrateV1ToV2(body(opts)), RATES, { applicabilityDate: '20260820' });
  return priced.entrySummary.lines[0];
}

const duties = (l: Awaited<ReturnType<typeof line>>) => Object.fromEntries(l.tariffs.map((t) => [t.htsNumber, t.dutyCents]));

describe('draft schema', () => {
  it('accepts 8-digit ch.99 numbers', () => {
    expect(abiDocumentBodySchema.safeParse(body({ ch99: ['99039106', '99030531'] })).success).toBe(true);
    expect(abiDocumentBodySchema.safeParse(body()).success).toBe(true);
  });

  it.each([
    ['a padded 10-digit form', ['9903910600']],
    ['a ch.1-97 code', ['8507600030']],
    ['a ch.98 provision', ['98020080']],
    ['a duplicate', ['99039106', '99039106']],
  ])('rejects %s', (_label, ch99) => {
    expect(abiDocumentBodySchema.safeParse(body({ ch99 })).success).toBe(false);
  });
});

describe('CBP order and wire shape', () => {
  it('orders by program whatever the input order, and dedupes', () => {
    expect(orderCh99(['99039406', '99030531', '99039106', '9903.05.31'])).toEqual(['99039106', '99030531', '99039406']);
    expect(orderCh99(['99030549', '99034110'])).toEqual(['99034110', '99030549']);
    expect(orderCh99(['99038202', '99030590'])).toEqual(['99030590', '99038202']);
  });

  it('puts overlays first with value 0 and no unit or quantity; the base carries both', async () => {
    const l = migrateV1ToV2(body({ ch99: ['99039406', '99030531', '99039106'] })).entrySummary.lines[0];
    expect(l.tariffs.map((t) => t.htsNumber)).toEqual(['99039106', '99030531', '99039406', '8507600030']);
    for (const t of l.tariffs.slice(0, 3)) {
      expect(t).toEqual({ htsNumber: t.htsNumber, valueDollars: 0 });
    }
    expect(l.tariffs[3]).toMatchObject({ valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 50000 });
  });

  it('builds 50-records with 8-digit numbers and a blank unit, like the CERT goldens', async () => {
    const priced = await enrichWithDuty(migrateV1ToV2(body({ ch99: ['99039106', '99030531', '99039406'] })), RATES, { applicabilityDate: '20260820' });
    const input = toAeEntrySummaryInput(priced, 'A');
    expect(validateEntrySummary(input)).toEqual([]);
    const fifties = buildEntrySummary(input).filter((r) => r.startsWith('50'));
    expect(fifties.map((r) => r.slice(2, 12))).toEqual(['99039106  ', '99030531  ', '99039406  ', '8507600030']);
    for (const r of fifties.slice(0, 3)) expect(r.slice(47, 50).trim()).toBe('');
    expect(fifties[3].slice(47, 50).trim()).toBe('NO');
  });
});

describe('duty semantics from the USITC text', () => {
  it('classifies every form', () => {
    expect(ch99Semantics('99039106', USITC['99039106'])).toBe('additional');
    expect(ch99Semantics('99038801', USITC['99038801'])).toBe('additional');
    expect(ch99Semantics('99039406', USITC['99039406'])).toBe('none');
    expect(ch99Semantics('99038203', 'No change')).toBe('none');
    expect(ch99Semantics('99030539', '10%')).toBe('replacement');
    expect(ch99Semantics('99021234', 'Free')).toBe('replacement');
    expect(ch99Semantics('99990084', 'Free')).toBe('none');
    expect(ch99Semantics('99031701', '')).toBe('unknown');
    expect(parseRateExpression(USITC['99038801'])).toEqual([{ kind: 'overlaySurcharge', perMillion: 250000 }]);
  });

  it('CN batteries stack: 301 + NT52 on top of column 1, 232 adds nothing ($4,090 on $10,000)', async () => {
    const l = await line({ ch99: ['99039106', '99030531', '99039406'] });
    expect(duties(l)).toEqual({ '99039106': 250000, '99030531': 125000, '99039406': 0, '8507600030': 34000 });
  });

  it('a plain-rate NT52 heading replaces column 1 (EU 3% line: $1,000, not $1,300)', async () => {
    const l = await line({ hts: '3920200000', origin: 'IT', quantity: '100 KG', ch99: ['99030539'] });
    expect(duties(l)).toEqual({ '99030539': 100000, '3920200000': 0 });
  });

  it('JP footwear: 40% in lieu and the 12.5% NT52, base deposits zero (CERT 024)', async () => {
    const l = await line({ hts: '6403599045', origin: 'JP', value: 12290, quantity: '2600 PRS', ch99: ['99030549', '99034110'] });
    expect(l.tariffs.map((t) => t.htsNumber)).toEqual(['99034110', '99030549', '6403599045']);
    expect(duties(l)).toEqual({ '99034110': 491600, '99030549': 153625, '6403599045': 0 });
  });

  it('fails closed on a heading with no rate it can apply', async () => {
    await expect(line({ ch99: ['99031701'] })).rejects.toBeInstanceOf(RecordCodecError);
  });
});

describe('ch.99 picker search', () => {
  it('keeps code queries inside chapter 99', () => {
    expect(ch99SearchWhere('9903.88')).toEqual({ htsNumber: { startsWith: '990388' } });
    expect(ch99SearchWhere('99')).toEqual({ htsNumber: { startsWith: '99' } });
    expect(ch99SearchWhere('8507')).toBeNull();
    expect(ch99SearchWhere('9')).toBeNull();
  });

  it('matches every word of a text query, within chapter 99 only', () => {
    expect(ch99SearchWhere('China batteries')).toEqual({
      AND: [
        { htsNumber: { startsWith: '99' } },
        { description: { contains: 'China', mode: 'insensitive' } },
        { description: { contains: 'batteries', mode: 'insensitive' } },
      ],
    });
  });
});

describe('CustomsCity fallback', () => {
  it('never receives ch.99 claims', () => {
    expect(hasCh99Claims(body({ ch99: ['99039106'] }) as never)).toBe(true);
    expect(hasCh99Claims(body() as never)).toBe(false);
    expect(() => mapABIDocumentToCC({ payload: body({ ch99: ['99039106'] }) as never })).toThrow(/Chapter 99/);
    const item = mapABIDocumentToCC({ payload: body() as never }).body[0].manifest[0].invoices[0].items[0];
    expect(item).not.toHaveProperty('additionalHtsNumbers');
  });
});
