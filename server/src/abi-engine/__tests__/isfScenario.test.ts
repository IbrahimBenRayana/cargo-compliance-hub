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

/** A CBP SA status advisory for the filing (no ISF verdict in it). */
function saAdvisory(): string {
  return [
    'A1303S7PBCFX2J100926     SA',
    'B  1303S7PSA                                               SCENARIO 090',
    'SA10' + TXN,
    'SA30MAEU123456789012',
    'SA50S2NO BILL MATCH (NOT ON FILE)',
    'Y  1303S7PSA00004',
    'Z1303S7P      100926',
  ].join('\n');
}

/** Generate 090 given the scenario's response history, oldest first. */
async function sf10Of(prior?: string, history?: string[]): Promise<string> {
  const scenario = SCENARIO_INDEX.get('090')!;
  const all = history ?? (prior ? [prior] : []);
  const wire = (await scenario.run(DRY_RUN_PARAMS, { priorResponseText: all[all.length - 1], allResponseTexts: all })) as string[];
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

  it('ignores a status advisory that arrives after the Replace (live 10/9 duplicate Add)', async () => {
    // Exactly what happened: the SA advisory followed the accepted Replace;
    // the third generate must still send the Delete, not a second Add.
    const sf10 = await sf10Of(undefined, [snResponse('A', true), snResponse('R', true), saAdvisory()]);
    expect(sf10[7]).toBe('D');
    expect(sf10.slice(38, 53).trim()).toBe(TXN);
  });

  it('reads ISF and SA batches that share one stored response', async () => {
    const sf10 = await sf10Of(undefined, [snResponse('A', true), snResponse('R', true) + '\n' + saAdvisory()]);
    expect(sf10[7]).toBe('D');
  });

  it('a rejected duplicate later in history does not undo an accepted Replace', async () => {
    const sf10 = await sf10Of(undefined, [snResponse('A', true), snResponse('R', true), snResponse('A', false)]);
    expect(sf10[7]).toBe('D');
  });

  it('sends the Replace as a complete transaction (CT), not FR', async () => {
    const sf10 = await sf10Of(snResponse('A', true));
    expect(sf10.slice(8, 10)).toBe('CT');
  });

  it('tags the batch so the SN response auto-attaches to scenario 090', async () => {
    const wire = (await SCENARIO_INDEX.get('090')!.run(DRY_RUN_PARAMS)) as string[];
    expect(wire.find((l) => l.startsWith('B'))!.slice(59, 80)).toContain('SCENARIO 090');
  });
});
