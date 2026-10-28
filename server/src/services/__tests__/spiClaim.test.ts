/**
 * Per-line trade program claims (audit ENG-M2): captured in the draft,
 * validated against CATAIR AE Table 8, carried onto the 40-record, priced
 * from the HTS Special column, and exempting MPF where the program does.
 */
import { describe, it, expect } from 'vitest';
import { abiDocumentBodySchema } from '../../schemas/abiDocument.js';
import { migrateV1ToV2 } from '../../abi-engine/payload/migrateV1.js';
import { enrichWithDuty, StaticRateSource } from '../../abi-engine/duty/engine.js';
import { toAeEntrySummaryInput } from '../../abi-engine/payload/toAeInput.js';
import { buildEntrySummary } from '../../abi-engine/ae/builder.js';
import { RecordCodecError } from '../../abi-engine/records/codec.js';
import { entryBody } from './fixtures/entryBody.js';

// USITC 8415.82.01.20 (air conditioners), as in CERT scenario 006.
const RATES = new StaticRateSource({
  '8415820120': { general: '2.2%', special: 'Free (A,AU,B,BH,C,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' },
  '8507600030': { general: '3.4%', special: 'Free (A,AU,B,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' },
  '6403599045': { general: '10%', special: 'Free (AU,BH,CL,CO,IL,JO,KR,MA,OM,P,PA,PE,SG)' },
});

const mx = (spi?: string) => entryBody({ hts: '8415820120', origin: 'MX', spi });

async function priced(body: ReturnType<typeof entryBody>) {
  return enrichWithDuty(migrateV1ToV2(body), RATES, { applicabilityDate: '20260820' });
}

describe('SPI claim', () => {
  it('accepts Table 8 codes and rejects expired or unknown ones', () => {
    expect(abiDocumentBodySchema.safeParse(mx('S')).success).toBe(true);
    expect(abiDocumentBodySchema.safeParse(mx('S+')).success).toBe(true);
    expect(abiDocumentBodySchema.safeParse(mx()).success).toBe(true);
    expect(abiDocumentBodySchema.safeParse(mx('MX')).success).toBe(false); // NAFTA, ended 2020
    expect(abiDocumentBodySchema.safeParse(mx('QQ')).success).toBe(false);
  });

  it('USMCA prices at the Special rate and drops line MPF', async () => {
    const claimed = (await priced(mx('S'))).entrySummary.lines[0];
    expect(claimed.spiClaimCode).toBe('S');
    expect(claimed.tariffs[0].dutyCents).toBe(0);
    expect(claimed.fees?.some((f) => f.classCode === '499')).toBeFalsy();

    const unclaimed = (await priced(mx())).entrySummary.lines[0];
    expect(unclaimed.tariffs[0].dutyCents).toBe(22000);
    expect(unclaimed.fees?.some((f) => f.classCode === '499')).toBe(true);
  });

  it('goes on the 40-record at positions 25-26', async () => {
    const lines = buildEntrySummary(toAeEntrySummaryInput(await priced(mx('S')), 'A'));
    const forty = lines.find((r) => r.startsWith('40'))!;
    expect(forty.slice(24, 26)).toBe('S ');
  });

  it('refuses a claim the HTS does not list (no silent general rate)', async () => {
    await expect(priced(entryBody({ hts: '6403599045', origin: 'MX', spi: 'S' }))).rejects.toBeInstanceOf(RecordCodecError);
  });
});
