/**
 * Importer Security Filing (SF/SN + SA) tests — positions and formats
 * asserted against the CATAIR ISF chapter, July 2017 v3 (ISF page refs in
 * comments) and the ISF Status Notification supplement, August 2016 v1
 * (SA page refs).
 */
import { describe, it, expect } from 'vitest';
import { buildIsf, type IsfInput } from '../isf/builder.js';
import {
  parseIsfResponse,
  parseIsfResponseBatch,
  parseIsfStatusAdvisoryBatch,
} from '../isf/responseParser.js';
import { SF10, SF15, SF20, SF30, SF36, SF90, SA20 } from '../isf/recordDefs.js';
import { writeRecord, RecordCodecError } from '../records/codec.js';
import { buildBatch } from '../envelope/batch.js';
import { INPUT_A, INPUT_B, INPUT_Y, INPUT_Z } from '../envelope/recordDefs.js';

const sp = (n: number) => ' '.repeat(n);

// ── Fixtures ───────────────────────────────────────────────

/** Complete ISF-10: all 8 parties, 2 manufacturers with nested SF40s. */
const ISF10_FULL: IsfInput = {
  submissionType: '1',
  shipmentTypeCode: '01',
  action: 'A',
  actionReasonCode: 'CT',
  importer: { qualifier: 'EI', number: '12-3456789' },
  modeOfTransportationCode: '11',
  scac: 'MAEU',
  bond: { holder: '12-3456789', activityCode: '01', type: '8' },
  bills: [{ qualifier: 'BM', scac: 'MAEU', billNumber: '123456789012' }],
  references: [{ qualifier: 'CR', value: 'MYREF001' }],
  containers: [{ descriptionCode: '20', initial: 'MSKU', number: '123456', checkDigit: '7', sizeTypeCode: '4500' }],
  // Deliberately scrambled: the builder must emit IM CN SE BY ST LG CS.
  entities: [
    {
      code: 'BY',
      name: 'ACME IMPORTS LLC',
      addressComponents: [
        { qualifier: '01', information: '100' },
        { qualifier: '02', information: 'MAIN ST' },
      ],
      geography: { city: 'LOS ANGELES', countrySubEntityCode: 'CA', postalCode: '90001', countryCode: 'US' },
    },
    {
      code: 'CS',
      name: 'GLOBAL CONSOL',
      secondaryName: { code: 'DH', name: 'GC LOGISTICS' },
      addressComponents: [{ qualifier: '15', information: 'HARBOUR WAY 2' }],
      geography: { city: 'HONG KONG', countryCode: 'HK' },
    },
    { code: 'SE', identifier: { qualifier: 'DUN', value: '123456789' } },
    { code: 'IM', identifier: { qualifier: 'EI', value: '12-3456789' } },
    {
      code: 'LG',
      name: 'SHENZHEN CFS',
      addressComponents: [{ qualifier: '15', information: 'PORT ROAD 1' }],
      geography: { city: 'SHENZHEN', countryCode: 'CN' },
    },
    { code: 'ST', identifier: { qualifier: 'FR', value: 'A123' } },
    { code: 'CN', identifier: { qualifier: 'EI', value: '12-3456789' } },
  ],
  manufacturers: [
    {
      name: 'SHENZHEN BATTERY CO LTD',
      addressComponents: [
        { qualifier: '01', information: '88' },
        { qualifier: '02', information: 'NANSHAN ROAD' },
        { qualifier: '32', information: '4' },
      ],
      geography: { city: 'SHENZHEN', countrySubEntityCode: 'GD', postalCode: '518000', countryCode: 'CN' },
      tariffs: [
        { htsNumber: '8507600020', countryOfOrigin: 'CN' },
        { htsNumber: '850650', countryOfOrigin: 'CN' },
      ],
    },
    {
      name: 'NINGBO PLASTICS CO',
      addressComponents: [{ qualifier: '15', information: 'INDUSTRIAL ZONE 9' }],
      geography: { city: 'NINGBO', countryCode: 'CN' },
      tariffs: [{ htsNumber: '392690', countryOfOrigin: 'CN' }],
    },
  ],
};

/** ISF-5 (FROB) with the trailing SF40 block and an SF50. */
const ISF5_FULL: IsfInput = {
  submissionType: '2',
  shipmentTypeCode: '01',
  action: 'A',
  actionReasonCode: 'CT',
  importer: { qualifier: '2', number: 'MAEU' },
  bills: [{ qualifier: 'OB', scac: 'MAEU', billNumber: '987654321098' }],
  // Scrambled: the builder must emit BKP before ST (ISF-9 Note 1).
  entities: [
    { code: 'ST', identifier: { qualifier: 'DUN', value: '987654321' } },
    {
      code: 'BKP',
      name: 'BOOKING PARTNERS BV',
      addressComponents: [{ qualifier: '15', information: 'KADE 12' }],
      geography: { city: 'ROTTERDAM', countryCode: 'NL' },
    },
  ],
  tariffs: [{ htsNumber: '850760' }, { htsNumber: '392690' }],
  frob: {
    portOfUnladingQualifier: 'UN',
    foreignPortOfUnlading: 'NLRTM',
    placeOfDeliveryQualifier: 'UN',
    placeOfDelivery: 'DEHAM',
  },
};

// ── Record layouts (exact 80-char assertions) ──────────────

describe('ISF input record layouts', () => {
  const lines = buildIsf(ISF10_FULL);
  const find = (id: string, nth = 0) => lines.filter((l) => l.startsWith(id))[nth];

  it('lays out the SF10 header per ISF-14..15', () => {
    const expected =
      'SF10' + '1' + '01' + 'A' + 'CT' + 'EI ' + '12-3456789' + sp(5) + // qualifier left justified (Note 4)
      sp(8) + '11' + sp(15) + 'MAEU' + // DOB, MOT, transaction number (space on Add), SCAC
      '12-3456789' + sp(5) + '01' + '8' + sp(3) + sp(2); // bond holder/activity/type, filler, country
    expect(expected).toHaveLength(80);
    expect(lines[0]).toBe(expected);
  });

  it('lays out the SF15 bill with SCAC concatenated to the number per ISF-23', () => {
    const expected = 'SF15' + 'BM' + 'MAEU123456789012' + sp(34) + sp(24);
    expect(expected).toHaveLength(80);
    expect(find('SF15')).toBe(expected);
  });

  it('lays out the SF20 reference per ISF-25', () => {
    const expected = 'SF20' + 'CR ' + 'MYREF001' + sp(42) + sp(23);
    expect(expected).toHaveLength(80);
    expect(find('SF20')).toBe(expected);
  });

  it('lays out the SF25 container with a zero-filled 15N serial per ISF-27', () => {
    const expected = 'SF25' + '20' + 'MSKU' + '000000000123456' + '7' + '4500' + sp(50);
    expect(expected).toHaveLength(80);
    expect(find('SF25')).toBe(expected);
  });

  it('lays out an identifier-only SF30 per ISF-28', () => {
    const expected = 'SF30' + 'IM ' + sp(35) + 'EI ' + '12-3456789' + sp(10) + sp(2) + sp(8) + sp(5);
    expect(expected).toHaveLength(80);
    expect(find('SF30')).toBe(expected); // IM is emitted first
  });

  it('lays out a name-route SF30 with identifier fields blank per ISF-28', () => {
    const expected = 'SF30' + 'BY ' + 'ACME IMPORTS LLC' + sp(19) + sp(3) + sp(20) + sp(2) + sp(8) + sp(5);
    expect(expected).toHaveLength(80);
    expect(find('SF30', 3)).toBe(expected); // IM, CN, SE, then BY
  });

  it('lays out the SF31 secondary name per ISF-32', () => {
    const expected = 'SF31' + 'DH ' + 'GC LOGISTICS' + sp(23) + sp(38);
    expect(expected).toHaveLength(80);
    expect(find('SF31')).toBe(expected);
  });

  it('lays out the SF35 with two qualifier+information pairs per ISF-33', () => {
    const expected = 'SF35' + '01' + '88' + sp(33) + '02' + 'NANSHAN ROAD' + sp(23) + sp(2);
    expect(expected).toHaveLength(80);
    expect(find('SF35', 3)).toBe(expected); // BY, LG, CS, then MF1's first SF35
  });

  it('lays out a single-pair SF35 with the second pair space filled', () => {
    const expected = 'SF35' + '32' + '4' + sp(34) + sp(2) + sp(35) + sp(2);
    expect(expected).toHaveLength(80);
    expect(find('SF35', 4)).toBe(expected); // MF1's second SF35 (odd component)
  });

  it('lays out the SF36 geographic area per ISF-35', () => {
    const expected = 'SF36' + 'SHENZHEN' + sp(27) + 'GD ' + sp(6) + '518000' + sp(9) + 'CN' + sp(15);
    expect(expected).toHaveLength(80);
    expect(find('SF36', 3)).toBe(expected); // BY, LG, CS, then MF1's SF36
  });

  it('lays out the SF40 with a left-justified 10N HTS per ISF-36', () => {
    const full = 'SF40' + '8507600020' + 'CN' + sp(64);
    const sixDigit = 'SF40' + '850650' + sp(4) + 'CN' + sp(64);
    expect(full).toHaveLength(80);
    expect(find('SF40', 0)).toBe(full);
    expect(find('SF40', 1)).toBe(sixDigit);
  });

  it('lays out the SF13 with zero-filled 11N values per ISF-21', () => {
    const type11 = buildIsf({
      ...ISF10_FULL,
      shipmentTypeCode: '11',
      bond: undefined, // no bond required for shipment type 11 (ISF-16 Note 2)
      shipmentInfo: {
        subType: '01',
        estimatedValueDollars: 750,
        estimatedQuantity: 12,
        unitOfMeasure: 'PCS',
        estimatedWeight: 40,
        weightQualifier: 'K',
      },
    });
    const expected = 'SF13' + '01' + '00000000750' + '00000000012' + 'PCS' + '00000000040' + 'K' + sp(37);
    expect(expected).toHaveLength(80);
    expect(type11[1]).toBe(expected); // immediately after the SF10
  });

  it('lays out the SF50 FROB routing per ISF-37', () => {
    const isf5 = buildIsf(ISF5_FULL);
    const expected = 'SF50' + 'UN ' + 'NLRTM' + sp(10) + 'UN ' + 'DEHAM' + sp(10) + sp(40);
    expect(expected).toHaveLength(80);
    expect(isf5[isf5.length - 1]).toBe(expected);
  });

  it('lays out the SF90 output record per ISF-39', () => {
    const expected = 'SF90' + '11' + '123' + 'BILL NUMBER NOT ON FILE' + sp(17) + sp(31);
    expect(expected).toHaveLength(80);
    expect(
      writeRecord(SF90, { messageTypeCode: '11', errorCode: '123', narrativeMessageText: 'BILL NUMBER NOT ON FILE' }),
    ).toBe(expected);
  });
});

// ── ISF-10 structure (ISF-7..8) ────────────────────────────

describe('buildIsf — ISF-10', () => {
  it('emits the full usage-map sequence with manufacturers last and SF40s nested', () => {
    const lines = buildIsf(ISF10_FULL);
    expect(lines.map((l) => l.slice(0, 4))).toEqual([
      'SF10',
      'SF15',
      'SF20',
      'SF25',
      'SF30', // IM (identifier only)
      'SF30', // CN (identifier only)
      'SF30', // SE (DUNS)
      'SF30', 'SF35', 'SF36', // BY by name
      'SF30', // ST (FIRMS)
      'SF30', 'SF35', 'SF36', // LG by name
      'SF30', 'SF31', 'SF35', 'SF36', // CS by name + secondary name
      'SF30', 'SF35', 'SF35', 'SF36', 'SF40', 'SF40', // MF 1 + nested HTS
      'SF30', 'SF35', 'SF36', 'SF40', // MF 2 + nested HTS
    ]);
    for (const line of lines) expect(line).toHaveLength(80);
  });

  it('orders entity loops IM CN SE BY ST LG CS then manufacturers (ISF-7 Note 1)', () => {
    const lines = buildIsf(ISF10_FULL);
    const codes = lines.filter((l) => l.startsWith('SF30')).map((l) => l.slice(4, 7).trim());
    expect(codes).toEqual(['IM', 'CN', 'SE', 'BY', 'ST', 'LG', 'CS', 'MF', 'MF']);
  });

  it('emits only the SF10 on a Delete, carrying the ISF transaction number (ISF-4)', () => {
    const lines = buildIsf({
      submissionType: '1',
      shipmentTypeCode: '01',
      action: 'D',
      importer: { qualifier: 'EI', number: '12-3456789' },
      isfTransactionNumber: 'ABC-12345678901',
      bills: [],
      entities: [],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0][7]).toBe('D'); // action, pos 8
    expect(lines[0].slice(8, 10)).toBe('  '); // no action reason on delete
    expect(lines[0].slice(38, 53)).toBe('ABC-12345678901'); // pos 39-53
  });
});

// ── ISF-5 structure (ISF-9) ────────────────────────────────

describe('buildIsf — ISF-5', () => {
  it('emits SF10, SF15s, BKP+ST loops, trailing SF40 block, then SF50', () => {
    const lines = buildIsf(ISF5_FULL);
    expect(lines.map((l) => l.slice(0, 4))).toEqual([
      'SF10',
      'SF15',
      'SF30', 'SF35', 'SF36', // BKP by name (emitted before ST)
      'SF30', // ST (DUNS)
      'SF40', 'SF40', // trailing HTS block (ISF-9 Note 2)
      'SF50',
    ]);
    expect(lines[0][4]).toBe('2'); // submission type
    // SF40 country of origin is not required for ISF-5 (ISF-36).
    expect(lines[6].slice(14, 16)).toBe('  ');
  });
});

// ── Structural rejections ──────────────────────────────────

describe('buildIsf — chapter rules', () => {
  const build = (patch: Partial<IsfInput>) => () => buildIsf({ ...ISF10_FULL, ...patch });

  it('requires an SF30 for every mandatory ISF-10 party (SF10 Note 1)', () => {
    const without = ISF10_FULL.entities.filter((e) => e.code !== 'CS');
    expect(build({ entities: without })).toThrow(/entity code CS/);
    expect(build({ manufacturers: [] })).toThrow(/at least one MF/);
  });

  it('requires BKP and ST for ISF-5 and rejects other entity codes (ISF-9 Note 1)', () => {
    expect(() => buildIsf({ ...ISF5_FULL, entities: ISF5_FULL.entities.filter((e) => e.code !== 'BKP') })).toThrow(
      /entity code BKP/,
    );
    expect(() =>
      buildIsf({ ...ISF5_FULL, entities: [...ISF5_FULL.entities, { code: 'SE', identifier: { qualifier: 'EI', value: '12-3456789' } }] }),
    ).toThrow(/required only for BKP and ST/);
  });

  it('rejects an IM without an identifier and duplicate IMs (ISF-28)', () => {
    const nameIm = ISF10_FULL.entities.map((e) =>
      e.code === 'IM'
        ? {
            code: 'IM' as const,
            name: 'ACME IMPORTS LLC',
            addressComponents: [{ qualifier: '15', information: 'MAIN ST 1' }],
            geography: { city: 'LOS ANGELES', countryCode: 'US' },
          }
        : e,
    );
    expect(build({ entities: nameIm })).toThrow(/IM must be reported by entity identifier/);
    expect(
      build({ entities: [...ISF10_FULL.entities, { code: 'IM', identifier: { qualifier: 'EI', value: '98-7654321' } }] }),
    ).toThrow(/single Importer of Record/);
  });

  it('enforces the bond rules of ISF-19 Note 7', () => {
    // Mandatory for shipment types 01/02/07/08/10 on Add/Replace.
    expect(build({ bond: undefined })).toThrow(/bond information is mandatory/);
    // Bond type 9 only with activity 16.
    expect(build({ bond: { holder: '12-3456789', activityCode: '01', type: '9' } })).toThrow(
      /bond type 9 may only be used with bond activity code 16/,
    );
    // Type 9 + activity 16 needs SF20 V1 and SBN references.
    expect(build({ bond: { holder: '12-3456789', activityCode: '16', type: '9' } })).toThrow(/V1 .*SBN|SBN .*V1/);
    expect(
      build({
        bond: { holder: '12-3456789', activityCode: '16', type: '9' },
        references: [
          { qualifier: 'V1', value: '123' },
          { qualifier: 'SBN', value: 'BREF001' },
        ],
      }),
    ).not.toThrow();
  });

  it('requires a 6C reference for carnet shipments (ISF-26)', () => {
    expect(build({ shipmentTypeCode: '06' })).toThrow(/6C/);
  });

  it('pairs the SF13 with shipment type 11 (ISF-16 Note 2, ISF-21)', () => {
    expect(build({ shipmentTypeCode: '11', bond: undefined })).toThrow(/SF13 shipment information record is mandatory/);
    expect(() => buildIsf({ ...ISF5_FULL, shipmentInfo: { subType: '01', estimatedValueDollars: 1, estimatedQuantity: 1, unitOfMeasure: 'PCS', estimatedWeight: 1, weightQualifier: 'K' } })).toThrow(
      /not part of the ISF-5/,
    );
  });

  it('restricts identifier qualifiers to their allowed entity codes (ISF-29..31)', () => {
    const patched = ISF10_FULL.entities.map((e) =>
      e.code === 'ST' ? { code: 'ST' as const, identifier: { qualifier: 'EI' as const, value: '12-3456789' } } : e,
    );
    expect(build({ entities: patched })).toThrow(/qualifier EI may only be used with entity codes SE\/BY\/CN\/IM/);
  });

  it('enforces identifier XOR name+address on entity loops (ISF-31/33/35)', () => {
    const withGeo = ISF10_FULL.entities.map((e) =>
      e.code === 'SE'
        ? { ...e, geography: { city: 'SHANGHAI', countryCode: 'CN' } }
        : e,
    );
    expect(build({ entities: withGeo })).toThrow(/SF35\/SF36 records are not used/);
    const noGeo = ISF10_FULL.entities.map((e) => (e.code === 'BY' ? { ...e, geography: undefined } : e));
    expect(build({ entities: noGeo })).toThrow(/SF36.*mandatory/);
  });

  it('enforces the SF10 header conditionals', () => {
    expect(build({ actionReasonCode: undefined })).toThrow(/action reason code/);
    expect(build({ isfTransactionNumber: 'ABC-12345678901' })).toThrow(/space filled when the action is Add/);
    expect(build({ action: 'D', isfTransactionNumber: undefined })).toThrow(/Delete requires/);
    expect(() => buildIsf({ ...ISF5_FULL, shipmentTypeCode: '02' })).toThrow(/shipment type must be 01/);
    expect(build({ importer: { qualifier: '2', number: 'MAEU' } })).toThrow(/ISF-5 submission types/);
  });

  it('keeps the SF50 and trailing SF40 block exclusive to ISF-5 (ISF-8/9, ISF-37)', () => {
    expect(build({ frob: ISF5_FULL.frob })).toThrow(/requires an ISF-5/);
    expect(build({ tariffs: [{ htsNumber: '850760', countryOfOrigin: 'CN' }] })).toThrow(/no trailing SF40 block/);
    expect(() => buildIsf({ ...ISF5_FULL, tariffs: [] })).toThrow(/1-999 SF40/);
  });

  it('rejects manufacturer loops without nested SF40s and bad HTS numbers (ISF-8/36)', () => {
    const mf = ISF10_FULL.manufacturers![0];
    expect(build({ manufacturers: [{ ...mf, tariffs: [] }] })).toThrow(/1 to 999 SF40/);
    expect(build({ manufacturers: [{ ...mf, tariffs: [{ htsNumber: '85076', countryOfOrigin: 'CN' }] }] })).toThrow(
      /6 to 10 digits/,
    );
    expect(build({ manufacturers: [{ ...mf, tariffs: [{ htsNumber: '850760' }] }] })).toThrow(
      /country of origin is mandatory on ISF-10/,
    );
  });

  it('rejects class violations client-side via the codec', () => {
    expect(build({ scac: 'MA3U' })).toThrow(RecordCodecError); // SCAC is 4A (ISF-14)
    expect(
      build({ containers: [{ descriptionCode: '20', initial: 'MSKU', number: '12A456' }] }),
    ).toThrow(/must be numeric/);
  });
});

// ── SN response parsing (ISF-10..12, ISF-39) ───────────────

describe('parseIsfResponse', () => {
  const snLines = [
    writeRecord(SF10, {
      isfSubmissionType: '1',
      shipmentTypeCode: '01',
      actionCode: 'A',
      actionReasonCode: 'CT',
      isfImporterNumberQualifier: 'EI',
      isfImporterNumber: '12-3456789',
      isfTransactionNumber: 'ABC-12345678901', // CBP-assigned (ISF-19 Note 5)
    }),
    writeRecord(SF15, { codeQualifier: 'BM', shipmentReferenceIdentifier: 'MAEU123456789012' }),
    writeRecord(SF90, { messageTypeCode: '11', errorCode: '123', narrativeMessageText: 'BILL NUMBER NOT ON FILE' }),
    writeRecord(SF20, { referenceIdentifierQualifier: 'CR', referenceIdentifier: 'MYREF001' }),
    writeRecord(SF30, { entityCode: 'CS', entityName: 'GLOBAL CONSOL' }), // group header echo (map Note 4)
    writeRecord(SF36, { cityName: 'HONG KONG', countryCode: 'HK' }),
    writeRecord(SF90, { messageTypeCode: '13', errorCode: '456', narrativeMessageText: 'POSTAL CODE MISSING' }),
    writeRecord(SF90, { messageTypeCode: '03', narrativeMessageText: 'ISF ACCEPTED WITH WARNINGS' }),
  ];

  it('attaches record-level SF90s to the records they follow and captures the disposition', () => {
    const [response, ...rest] = parseIsfResponse(snLines);
    expect(rest).toHaveLength(0);
    expect(response.isfTransactionNumber).toBe('ABC-12345678901');
    expect(response.echoedRecords.map((r) => r.recordId)).toEqual(['SF10', 'SF15', 'SF20', 'SF30', 'SF36']);
    expect(response.echoedRecords[1].errors).toEqual([
      { messageTypeCode: '11', errorCode: '123', narrative: 'BILL NUMBER NOT ON FILE' },
    ]);
    expect(response.echoedRecords[4].errors).toEqual([
      { messageTypeCode: '13', errorCode: '456', narrative: 'POSTAL CODE MISSING' },
    ]);
    expect(response.echoedRecords[0].errors).toEqual([]);
    expect(response.disposition).toMatchObject({
      messageTypeCode: '03',
      accepted: true,
      narrative: 'ISF ACCEPTED WITH WARNINGS',
    });
    expect(response.accepted).toBe(true);
  });

  it('splits multiple ISF groupings on SF10 and flags rejections (message type 01)', () => {
    const twoGroupings = [
      ...snLines,
      writeRecord(SF10, {
        isfSubmissionType: '1',
        shipmentTypeCode: '01',
        actionCode: 'A',
        actionReasonCode: 'CT',
        isfImporterNumberQualifier: 'EI',
        isfImporterNumber: '98-7654321',
      }),
      writeRecord(SF90, { messageTypeCode: '11', errorCode: '789', narrativeMessageText: 'IMPORTER UNKNOWN' }),
      writeRecord(SF90, { messageTypeCode: '01', narrativeMessageText: 'ISF REJECTED' }),
    ];
    const responses = parseIsfResponse(twoGroupings);
    expect(responses).toHaveLength(2);
    expect(responses[0].accepted).toBe(true);
    expect(responses[1].accepted).toBe(false);
    expect(responses[1].isfTransactionNumber).toBeUndefined();
    expect(responses[1].echoedRecords[0].errors[0].narrative).toBe('IMPORTER UNKNOWN');
    expect(responses[1].disposition?.meaning).toBe('Message Rejected');
  });

  it('parses a full SN batch through the envelope', () => {
    const batch = buildBatch({
      sender: { siteCode: '5301', idCode: 'ABC', password: 'SECRET' },
      appId: 'SN',
      blocks: [{ port: '5301', filerCode: 'ABC', transactionLines: snLines }],
    });
    const parsed = parseIsfResponseBatch(batch);
    expect(parsed.batchRejected).toBe(false);
    expect(parsed.filings).toHaveLength(1);
    expect(parsed.filings[0].isfTransactionNumber).toBe('ABC-12345678901');
  });
});

// ── SA status advisory parsing (SA-5..9) ───────────────────

/*
 * The three envelopes below are byte-exact from the supplement's printed
 * examples (SA-8..9). Their A/B/Y/Z spacing predates the V23 Batch & Block
 * layouts in envelope/recordDefs.ts — the adjustments a V23 reading needs:
 *  - A/Z records print an 8-digit date ('01010801') where V23 has a 6-char
 *    MMDDYY at 15-20 followed by filler, and the printed A carries no app
 *    id at 26-27;
 *  - the printed B ('B018888FLRSA') has a legacy block count '01' where
 *    V23 has filler at 2-3, so port/filer/app id land at the V23 positions
 *    anyway;
 *  - the printed Y ('Y8888FLRSA00005') omits that pos 2-3 filler, shifting
 *    its fields two left of V23;
 *  - the printed Z has a single space where V23 has 6-char filler at 9-14.
 * parseBatch tolerates all of this (parseRecord does not validate and block
 * boundaries only need the control letter), so the byte-exact examples
 * parse; a V23-reconstructed envelope is asserted to give identical results.
 */
const SA_EXAMPLE_S1 = [
  'A8888FLRPASSWD01010801',
  'B018888FLRSA',
  'SA10FLR-00000000001',
  'SA30HBSC999999999999',
  'SA50S1BILL ON FILE',
  'Y8888FLRSA00005',
  'Z8888FLR 01010801',
];

const SA_EXAMPLE_S2 = [
  'A8888FLRPASSWD01010801',
  'B018888FLRSA',
  'SA10FLR-00000000001',
  'SA30HBSC555555555555',
  'SA50S2NO BILL MATCH (NOT ON FILE)',
  'Y8888FLRSA00005',
  'Z8888FLR 01010801',
];

const SA_EXAMPLE_S5 = [
  'A8888FLRPASSWD01010801',
  'B018888FLRSA',
  'SA10FLR-00000000001',
  'SA30OBSC777777777777',
  'SA50S5NO BILL MATCH (NOT ON FILE)',
  'Y8888FLRSA00005',
  'Z8888FLR 01010801',
];

describe('parseIsfStatusAdvisoryBatch', () => {
  it('parses the printed S1 example byte-exact (SA-8..9)', () => {
    const parsed = parseIsfStatusAdvisoryBatch(SA_EXAMPLE_S1);
    expect(parsed.batchRejected).toBe(false);
    expect(parsed.advisories).toHaveLength(1);
    const advisory = parsed.advisories[0];
    expect(advisory.isfTransactionNumber).toBe('FLR-00000000001');
    expect(advisory.bills).toHaveLength(1);
    // SA-7 defines pos 5-20 as SCAC+sequence, but the printed examples put
    // a HB/OB bill-type token first — split off tolerantly.
    expect(advisory.bills[0]).toMatchObject({
      billType: 'HB',
      billNumber: 'SC999999999999',
      dispositionCode: 'S1',
      remarks: 'BILL ON FILE',
    });
  });

  it('parses the printed S2 example, with an SA20 CR reference when present', () => {
    const parsed = parseIsfStatusAdvisoryBatch(SA_EXAMPLE_S2);
    expect(parsed.advisories[0].bills[0]).toMatchObject({
      billType: 'HB',
      billNumber: 'SC555555555555',
      dispositionCode: 'S2',
      remarks: 'NO BILL MATCH (NOT ON FILE)',
    });
    // CR is only returned if provided in the original SF input (SA-6).
    const withReference = [
      ...SA_EXAMPLE_S2.slice(0, 3),
      writeRecord(SA20, { codeQualifier: 'CR', referenceData: 'MYREF001' }),
      ...SA_EXAMPLE_S2.slice(3),
    ];
    const advisory = parseIsfStatusAdvisoryBatch(withReference).advisories[0];
    expect(advisory.reference).toEqual({ qualifier: 'CR', value: 'MYREF001' });
  });

  it('parses the printed S5 example with an OB (regular bill) token', () => {
    const parsed = parseIsfStatusAdvisoryBatch(SA_EXAMPLE_S5);
    expect(parsed.advisories[0].bills[0]).toMatchObject({
      billType: 'OB',
      billNumber: 'SC777777777777',
      dispositionCode: 'S5',
      remarks: 'NO BILL MATCH (NOT ON FILE)',
      meaning: 'No bill match (not on file) — 30 days after original file date',
    });
  });

  it('parses identically inside a V23-reconstructed envelope', () => {
    const envelope = [
      writeRecord(INPUT_A, { siteCode: '8888', idCode: 'FLR', password: 'PASSWD', transmissionDate: '010108', appId: 'SA' }),
      writeRecord(INPUT_B, { port: '8888', filerCode: 'FLR', appId: 'SA' }),
      'SA10FLR-00000000001',
      'SA30HBSC999999999999',
      'SA50S1BILL ON FILE',
      writeRecord(INPUT_Y, { port: '8888', filerCode: 'FLR', appId: 'SA' }),
      writeRecord(INPUT_Z, { siteCode: '8888', idCode: 'FLR', transmissionDate: '010108' }),
    ];
    expect(parseIsfStatusAdvisoryBatch(envelope).advisories).toEqual(
      parseIsfStatusAdvisoryBatch(SA_EXAMPLE_S1).advisories,
    );
  });
});
