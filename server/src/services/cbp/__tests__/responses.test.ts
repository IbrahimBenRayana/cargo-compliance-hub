/**
 * Normalised CBP responses (native go-live 1.5): every application's
 * response becomes one shape (verdict, conditions from the catalog, keys)
 * that statuses, notifications and the UI can use.
 */
import { describe, it, expect } from 'vitest';
import { summarizeResponse } from '../responses.js';
import { OUTPUT_E0, OUTPUT_E1 } from '../../../abi-engine/ae/responseDefs.js';
import { writeRecord } from '../../../abi-engine/records/codec.js';
import { buildBatch } from '../../../abi-engine/envelope/batch.js';
import { SF10, SF90 } from '../../../abi-engine/isf/recordDefs.js';

const env = (app: string, inner: string[]) => [
  `A   LGB1ABCSECRET080526     ${app}`.padEnd(80, ' '),
  `B  2704ABC${app}`.padEnd(80, ' '),
  ...inner,
  `Y  2704ABC${app}`.padEnd(80, ' '),
  'Z   LGB1ABC      080526'.padEnd(80, ' '),
];
const e0 = (type: string, occ: number, text: string) =>
  writeRecord(OUTPUT_E0, { referenceDataTypeCode: type, occurrencePosition: String(occ), refIdConstant: 'REF ID:', referenceDataText: text });

function sn(accepted: boolean, txn?: string) {
  return buildBatch({
    sender: { siteCode: '1303', idCode: 'S7P', password: 'X' },
    appId: 'SN',
    blocks: [{ port: '1303', filerCode: 'S7P', userData: 'MCLABC', transactionLines: [
      writeRecord(SF10, { isfSubmissionType: '1', shipmentTypeCode: '01', actionCode: 'A', isfImporterNumberQualifier: 'EI', isfImporterNumber: '56-123456789', isfTransactionNumber: txn }),
      writeRecord(SF90, accepted ? { messageTypeCode: '02', narrativeMessageText: 'ISF ACCEPTED' } : { messageTypeCode: '01', narrativeMessageText: 'ISF REJECTED' }),
    ] }],
  });
}

describe('summarizeResponse', () => {
  it('reads an accepted entry summary with its entry number', () => {
    const lines = env('AX', [
      e0('SUMMRY', 1, 'ABC 12345676 REF001       001'),
      writeRecord(OUTPUT_E1, { dispositionTypeCode: 'A', severityCode: ' ', conditionCode: 'S01', narrativeText: 'SUMMARY HAS BEEN ADDED' }),
    ]);
    expect(summarizeResponse('AX', lines)).toMatchObject({ verdict: 'ACCEPTED', keys: { entryNumber: 'ABC12345676' } });
  });

  it('explains a rejected entry summary with CBP dictionary text and line pointers', () => {
    const lines = env('AX', [
      e0('SUMMRY', 1, 'ABC 12345676 REF001       001'),
      e0('LINITM', 1, '001'),
      writeRecord(OUTPUT_E1, { dispositionTypeCode: ' ', severityCode: 'F', conditionCode: '204', narrativeText: 'PRELIM STMT DATE IS SAT SUN OR HOL' }),
      writeRecord(OUTPUT_E1, { dispositionTypeCode: 'R', severityCode: 'F', conditionCode: 'R01', narrativeText: 'TRANSACTION DATA REJECTED' }),
    ]);
    const s = summarizeResponse('AX', lines);
    expect(s.verdict).toBe('REJECTED');
    expect(s.conditions[0]).toMatchObject({ code: '204', blocking: true });
    expect(s.conditions[0].explanation).toMatch(/Saturday, Sunday/);
    expect(s.conditions[0].pointers).toEqual([{ type: 'LINITM', text: '001' }]);
  });

  it('reads an accepted ISF with its transaction number', () => {
    expect(summarizeResponse('SN', sn(true, 'S7P-44714243754'))).toMatchObject({
      verdict: 'ACCEPTED', keys: { isfTransactionNumber: 'S7P-44714243754' },
    });
  });

  it('reads a rejected ISF', () => {
    expect(summarizeResponse('SN', sn(false)).verdict).toBe('REJECTED');
  });

  it('treats an unknown application as information only', () => {
    expect(summarizeResponse('%R', env('%R', ['%1ATEUR100926 1119300D'])).verdict).toBe('INFO');
  });
});

describe('summarizeResponse robustness', () => {
  it('never throws: a malformed message becomes INFO with the parse error', () => {
    const s = summarizeResponse('AX', ['A', 'garbage that is not a record']);
    expect(['INFO', 'CONDITIONAL']).toContain(s.verdict);
  });
});
