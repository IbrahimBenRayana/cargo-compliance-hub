import { describe, it, expect } from 'vitest';
import { SCENARIO_INDEX, DRY_RUN_PARAMS } from '../scenarios/index.js';
import { buildBatch } from '../envelope/batch.js';
import { writeRecord } from '../records/codec.js';
import { SF10, SF90 } from '../isf/recordDefs.js';

// Scenario 090: ISF certification as Add, then Replace, then Delete on one
// filing (CBP rep Michael Barela, 10/8/2026). Each generate reads the latest
// attached SN response to pick the next step.

const TXN = 'S7P-12345678901';

/** A CBP SN response accepting (or rejecting) a filing with the given action. */
function snResponse(action: 'A' | 'R' | 'D', accepted: boolean): string {
  const lines = buildBatch({
    sender: { siteCode: '1303', idCode: 'S7P', password: 'X' },
    appId: 'SN',
    blocks: [{
      port: '1303',
      filerCode: 'S7P',
      userData: 'SCENARIO 090',
      transactionLines: [
        writeRecord(SF10, {
          isfSubmissionType: '1',
          shipmentTypeCode: '01',
          actionCode: action,
          isfImporterNumberQualifier: 'EI',
          isfImporterNumber: '56-123456789',
          isfTransactionNumber: accepted ? TXN : undefined,
        }),
        writeRecord(SF90, accepted
          ? { messageTypeCode: '02', narrativeMessageText: 'ISF ACCEPTED' }
          : { messageTypeCode: '01', narrativeMessageText: 'ISF REJECTED' }),
      ],
    }],
  });
  return lines.join('\n');
}

async function sf10Of(prior?: string): Promise<string> {
  const scenario = SCENARIO_INDEX.get('090')!;
  const wire = (await scenario.run(DRY_RUN_PARAMS, { priorResponseText: prior })) as string[];
  return wire.find((l) => l.startsWith('SF10'))!;
}

describe('scenario 090: ISF Add, Replace, Delete', () => {
  it('is registered as an SF transmission', () => {
    const scenario = SCENARIO_INDEX.get('090')!;
    expect(scenario.application).toBe('SF');
    expect(scenario.kind).toBe('transmit');
  });

  it('starts with an Add carrying no transaction number', async () => {
    const sf10 = await sf10Of(undefined);
    expect(sf10[7]).toBe('A');
    expect(sf10.slice(38, 53).trim()).toBe('');
  });

  it('sends a Replace with the transaction number once the Add is accepted', async () => {
    const sf10 = await sf10Of(snResponse('A', true));
    expect(sf10[7]).toBe('R');
    expect(sf10.slice(38, 53).trim()).toBe(TXN);
  });

  it('sends a Delete with the transaction number once the Replace is accepted', async () => {
    const sf10 = await sf10Of(snResponse('R', true));
    expect(sf10[7]).toBe('D');
    expect(sf10.slice(38, 53).trim()).toBe(TXN);
  });

  it('retries the Add when the Add was rejected (never replaces an unknown filing)', async () => {
    const sf10 = await sf10Of(snResponse('A', false));
    expect(sf10[7]).toBe('A');
  });

  it('tags the batch so the SN response auto-attaches to scenario 090', async () => {
    const wire = (await SCENARIO_INDEX.get('090')!.run(DRY_RUN_PARAMS)) as string[];
    expect(wire.find((l) => l.startsWith('B'))!.slice(59, 80)).toContain('SCENARIO 090');
  });
});
