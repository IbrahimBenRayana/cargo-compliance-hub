/**
 * Golden tests for the ABI batch envelope, built from the worked examples in
 * the CATAIR "ABI Batch & Block Control" chapter V23 (June 2023) — Input
 * Configuration Examples 1–3 (B&B-17..18) and the response examples
 * (B&B-34..38). If these fixtures ever disagree with the engine, the engine
 * is wrong.
 */
import { describe, it, expect } from 'vitest';
import {
  buildBatch,
  parseBatch,
  scenarioTag,
  writeRecord,
  parseRecord,
  RecordCodecError,
  assertRecordDef,
  RECORD_LENGTH,
} from '../index.js';
import { INPUT_A } from '../envelope/recordDefs.js';

/** Build an 80-char line from {1-based position: text} pairs. */
function mk(pairs: Record<number, string>): string {
  const chars = new Array<string>(RECORD_LENGTH).fill(' ');
  for (const [pos, text] of Object.entries(pairs)) {
    const start = Number(pos) - 1;
    for (let i = 0; i < text.length; i++) chars[start + i] = text[i];
  }
  return chars.join('');
}

const BROKER = { siteCode: '2704', idCode: 'EEE', password: 'PASSWD' };

describe('buildBatch — spec Input Configuration Examples', () => {
  it('Example 1: multiple entry summaries in a single block from a broker', () => {
    const t1 = '10 ENTRY-ONE';
    const t2 = '90 ENTRY-ONE';
    const lines = buildBatch({
      sender: BROKER,
      appId: 'AE',
      transmissionDate: '040108',
      blocks: [{ port: '2704', filerCode: 'EEE', transactionLines: [t1, t2] }],
    });

    expect(lines).toHaveLength(6); // A, B, 2 transactions, Y, Z
    expect(lines[0]).toBe(mk({ 1: 'A', 2: '2704', 6: 'EEE', 9: 'PASSWD', 15: '040108', 26: 'AE' }));
    expect(lines[1]).toBe(mk({ 1: 'B', 4: '2704', 8: 'EEE', 11: 'AE' }));
    expect(lines[2]).toBe(t1.padEnd(80, ' '));
    expect(lines[3]).toBe(t2.padEnd(80, ' '));
    expect(lines[lines.length - 2]).toBe(mk({ 1: 'Y', 4: '2704', 8: 'EEE', 11: 'AE' }));
    expect(lines[lines.length - 1]).toBe(mk({ 1: 'Z', 2: '2704', 6: 'EEE', 15: '040108' }));
    for (const line of lines) expect(line).toHaveLength(80);
  });

  it('Example 2: single summaries in multiple blocks from a service bureau', () => {
    const lines = buildBatch({
      sender: { siteCode: '3002', idCode: 'SB1', password: 'PASSWD' },
      appId: 'AE',
      transmissionDate: '040108',
      blocks: [
        { port: '3003', filerCode: 'CU1', transactionLines: ['10 X'] },
        { port: '3004', filerCode: 'CU2', transactionLines: ['10 Y'] },
      ],
    });

    expect(lines[0]).toBe(mk({ 1: 'A', 2: '3002', 6: 'SB1', 9: 'PASSWD', 15: '040108', 26: 'AE' }));
    expect(lines[1]).toBe(mk({ 1: 'B', 4: '3003', 8: 'CU1', 11: 'AE' }));
    expect(lines[3]).toBe(mk({ 1: 'Y', 4: '3003', 8: 'CU1', 11: 'AE' }));
    expect(lines[4]).toBe(mk({ 1: 'B', 4: '3004', 8: 'CU2', 11: 'AE' }));
    expect(lines[6]).toBe(mk({ 1: 'Y', 4: '3004', 8: 'CU2', 11: 'AE' }));
    expect(lines[7]).toBe(mk({ 1: 'Z', 2: '3002', 6: 'SB1', 15: '040108' }));
  });

  it('Example 3 shape: queries with app id EQ present on A and every B', () => {
    const lines = buildBatch({
      sender: BROKER,
      appId: 'EQ',
      blocks: [{ port: '2704', filerCode: 'EEE', transactionLines: ['J1 Q1', 'J1 Q2', 'J1 Q3'] }],
    });
    expect(lines[0].slice(25, 27)).toBe('EQ');
    expect(lines[1].slice(10, 12)).toBe('EQ');
  });

  it('places the certification scenario tag at B-record position 60', () => {
    const lines = buildBatch({
      sender: BROKER,
      appId: 'AE',
      blocks: [
        { port: '2704', filerCode: 'EEE', userData: scenarioTag(17), transactionLines: ['10 X'] },
      ],
    });
    expect(scenarioTag(17)).toBe('SCENARIO 017');
    expect(lines[1].slice(59, 71)).toBe('SCENARIO 017');
  });

  it('sets preparer fields and indicator when a preparer is given (self-filing importer path)', () => {
    const lines = buildBatch({
      sender: BROKER,
      appId: 'AE',
      blocks: [
        {
          port: '2704',
          filerCode: 'EEE',
          preparer: { port: '1232', filerCode: 'N01' },
          transactionLines: ['10 X'],
        },
      ],
    });
    const b = lines[1];
    expect(b.slice(46, 50)).toBe('1232');
    expect(b.slice(50, 53)).toBe('N01');
    expect(b[55]).toBe('1');
  });
});

describe('buildBatch — client-side rejection of invalid input', () => {
  it('rejects an empty batch and empty blocks', () => {
    expect(() => buildBatch({ sender: BROKER, appId: 'AE', blocks: [] })).toThrow(RecordCodecError);
    expect(() =>
      buildBatch({ sender: BROKER, appId: 'AE', blocks: [{ port: '2704', filerCode: 'EEE', transactionLines: [] }] })
    ).toThrow(RecordCodecError);
  });

  it('rejects transaction records longer than 80 characters', () => {
    expect(() =>
      buildBatch({
        sender: BROKER,
        appId: 'AE',
        blocks: [{ port: '2704', filerCode: 'EEE', transactionLines: ['X'.repeat(81)] }],
      })
    ).toThrow(/longer than 80/);
  });

  it('rejects class violations (non-alphanumeric password) with field context', () => {
    try {
      buildBatch({
        sender: { ...BROKER, password: 'PAS_WD' },
        appId: 'AE',
        blocks: [{ port: '2704', filerCode: 'EEE', transactionLines: ['10 X'] }],
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RecordCodecError);
      const issues = (err as RecordCodecError).issues;
      expect(issues[0].field).toBe('password');
      expect(issues[0].message).toContain('class AN');
    }
  });

  it('rejects a bad transmission date (not MMDDYY)', () => {
    expect(() =>
      buildBatch({
        sender: BROKER,
        appId: 'AE',
        transmissionDate: '138108',
        blocks: [{ port: '2704', filerCode: 'EEE', transactionLines: ['10 X'] }],
      })
    ).toThrow(/class D/);
  });

  it('uppercases lowercase input rather than rejecting it (spec: CBP converts to uppercase)', () => {
    const lines = buildBatch({
      sender: { siteCode: '2704', idCode: 'eee', password: 'passwd' },
      appId: 'ae',
      blocks: [{ port: '2704', filerCode: 'eee', transactionLines: ['10 X'] }],
    });
    expect(lines[0].slice(5, 8)).toBe('EEE');
    expect(lines[0].slice(25, 27)).toBe('AE');
  });
});

describe('parseBatch — spec response examples', () => {
  it('a) batch-level rejection: ACE-generated records, conditions, final disposition', () => {
    const response = [
      mk({ 1: 'A', 2: '1234', 6: 'N01', 15: '040108', 60: 'BATCH-AAAAAA-TEXT-001' }),
      mk({ 1: 'B', 80: 'B' }),
      mk({ 1: 'X1', 4: 'F', 5: 'X12', 11: 'NOT A KNOWN ACE APPLICATION ID CODE' }),
      mk({ 1: 'X1', 3: 'R', 4: 'F', 5: '999', 11: 'BATCH REJECTED' }),
      mk({ 1: 'Y', 13: '00002', 80: 'Y' }),
      mk({ 1: 'Z', 80: 'Z' }),
    ];

    const parsed = parseBatch(response);
    expect(parsed.rejected).toBe(true);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0].aceGenerated).toBe(true);
    expect(parsed.blocks[0].imageCount).toBe(2);
    expect(parsed.conditions).toHaveLength(2);
    expect(parsed.conditions[0].conditionCode).toBe('X12');
    expect(parsed.conditions[0].narrative).toBe('NOT A KNOWN ACE APPLICATION ID CODE');
    expect(parsed.conditions[0].finalDisposition).toBe(false);
    expect(parsed.conditions[1].conditionCode).toBe('999');
    expect(parsed.conditions[1].finalDisposition).toBe(true);
    expect(parsed.header?.values.userData).toBe('BATCH-AAAAAA-TEXT-001');
  });

  it('b) block-level rejection: X0 references attach to following X1 conditions', () => {
    const response = [
      mk({ 1: 'A', 2: '1234', 6: 'N01', 15: '040108' }),
      mk({ 1: 'B', 80: 'B' }),
      mk({ 1: 'X0', 4: 'BLOCK', 11: '000001', 18: 'REF ID:', 26: '1201 N01    AE BLOCK-AAAAAA-TEXT-001' }),
      mk({ 1: 'X1', 4: 'F', 5: 'X31', 11: 'PREPARER NOT AUTHRZD FOR PORT' }),
      mk({ 1: 'X0', 4: 'TRNACT', 11: '000001', 18: 'REF ID:', 26: '0000005 00' }),
      mk({ 1: 'X1', 4: 'F', 5: 'X34', 11: 'UNKNOWN RECORD ID FOUND IN GROUPING' }),
      mk({ 1: 'X1', 3: 'R', 4: 'F', 5: '999', 11: 'BATCH REJECTED' }),
      mk({ 1: 'Y', 13: '00005', 80: 'Y' }),
      mk({ 1: 'Z', 80: 'Z' }),
    ];

    const parsed = parseBatch(response);
    expect(parsed.rejected).toBe(true);
    expect(parsed.conditions).toHaveLength(3);
    expect(parsed.conditions[0].reference?.refType).toBe('BLOCK');
    expect(parsed.conditions[0].reference?.occurrence).toBe(1);
    expect(parsed.conditions[0].conditionCode).toBe('X31');
    expect(parsed.conditions[1].reference?.refType).toBe('TRNACT');
    expect(parsed.conditions[1].reference?.referenceText).toBe('0000005 00');
  });

  it('d) unconditional acceptance: AX response blocks with application records pass through', () => {
    const e0 = 'E0 SUMMRY 000001 REFID: N01 50000035 1234567-1';
    const e1 = 'E1A     995 SUMMARY HAS BEEN ADDED';
    const response = [
      mk({ 1: 'A', 2: '1234', 6: 'N01', 15: '010108', 26: 'AX', 60: 'BATCH-AAAAAA-TEXT-001' }),
      mk({ 1: 'B', 4: '1201', 8: 'N01', 11: 'AX', 60: 'BLOCK-AAAAAA-TEXT-001' }),
      e0,
      e1,
      mk({ 1: 'Y', 4: '1201', 8: 'N01', 11: 'AX', 13: '00002' }),
      mk({ 1: 'Z', 2: '1234', 6: 'N01', 15: '010108' }),
    ];

    const parsed = parseBatch(response);
    expect(parsed.rejected).toBe(false);
    expect(parsed.appId).toBe('AX');
    expect(parsed.conditions).toHaveLength(0);
    expect(parsed.blocks).toHaveLength(1);
    const block = parsed.blocks[0];
    expect(block.aceGenerated).toBe(false);
    expect(block.header.values.port).toBe('1201');
    expect(block.transactionLines).toEqual([e0.padEnd(80, ' '), e1.padEnd(80, ' ')]);
    expect(block.imageCount).toBe(2);
    expect(parsed.trailer?.values.siteCode).toBe('1234');
  });

  it('e) CBP-generated UC notification parses as a normal batch', () => {
    const uc = 'E121694    010109';
    const parsed = parseBatch([
      mk({ 1: 'A', 2: '1234', 6: 'N01', 15: '010109', 26: 'UC' }),
      mk({ 1: 'B', 4: '1201', 8: 'N01', 11: 'UC' }),
      uc,
      mk({ 1: 'Y', 4: '1201', 8: 'N01', 11: 'UC', 13: '00001' }),
      mk({ 1: 'Z', 2: '1234', 6: 'N01', 15: '010109' }),
    ]);
    expect(parsed.appId).toBe('UC');
    expect(parsed.rejected).toBe(false);
    expect(parsed.blocks[0].transactionLines).toEqual([uc.padEnd(80, ' ')]);
  });

  it('round-trips: our own built batch parses back to the same structure', () => {
    const built = buildBatch({
      sender: BROKER,
      appId: 'AE',
      transmissionDate: '040108',
      userData: 'BATCH-USER-TEXT',
      blocks: [
        { port: '2704', filerCode: 'EEE', userData: scenarioTag(3), transactionLines: ['10 A', '90 A'] },
      ],
    });
    const parsed = parseBatch(built);
    expect(parsed.appId).toBe('AE');
    expect(parsed.header?.values.userData).toBe('BATCH-USER-TEXT');
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0].header.values.userData).toBe('SCENARIO 003');
    expect(parsed.blocks[0].transactionLines).toHaveLength(2);
    expect(parsed.trailer?.values.transmissionDate).toBe('040108');
  });
});

describe('codec fundamentals', () => {
  it('writeRecord/parseRecord round-trip on the A-record', () => {
    const line = writeRecord(INPUT_A, {
      siteCode: '2704',
      idCode: 'EEE',
      password: 'PASSWD',
      appId: 'AE',
      userData: 'SELF-TEST',
    });
    const parsed = parseRecord(INPUT_A, line);
    expect(parsed.values).toMatchObject({
      controlIdentifier: 'A',
      siteCode: '2704',
      idCode: 'EEE',
      password: 'PASSWD',
      appId: 'AE',
      userData: 'SELF-TEST',
    });
  });

  it('assertRecordDef rejects defs with gaps or overlaps', () => {
    expect(() =>
      assertRecordDef({
        id: 'T',
        name: 'Broken',
        fields: [
          { name: 'a', start: 1, end: 1, class: 'A', designation: 'M' },
          { name: 'b', start: 3, end: 80, class: 'S', designation: 'M' }, // gap at 2
        ],
      })
    ).toThrow(/starts at 3, expected 2/);
  });
});
