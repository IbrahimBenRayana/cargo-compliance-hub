/**
 * Entry Summary Query (EQ/ER) + Status Notification (UC) tests — positions
 * and formats asserted against the Entry Summary Query chapter V26 May 2026
 * (ESQ page refs) and the Entry Summary Status Notification chapter V30
 * June 2025 (ESS page refs).
 */
import { describe, it, expect } from 'vitest';
import { buildEntrySummaryQuery } from '../apps/esQuery/builder.js';
import { parseEsQueryResponse, parseEsQueryResponseBatch } from '../apps/esQuery/responseParser.js';
import {
  OUTPUT_JA,
  OUTPUT_JB,
  OUTPUT_JC,
  OUTPUT_JD,
  OUTPUT_JE,
  OUTPUT_JF,
  OUTPUT_JG,
  OUTPUT_JH,
  OUTPUT_JI,
  OUTPUT_JK,
  OUTPUT_JM,
  OUTPUT_JZ,
  OUTPUT_4A,
} from '../apps/esQuery/recordDefs.js';
import { parseUcNotification, parseUcNotificationBatch } from '../apps/uc/parser.js';
import { UC_E1, UC_E2, UC_E3, UC_E4, UC_SO70, UC_SO71, UC_SO72 } from '../apps/uc/recordDefs.js';
import { writeRecord, RecordCodecError } from '../records/codec.js';
import { buildBatch } from '../envelope/batch.js';

// ── Entry Summary Query builder (EQ input, ESQ-16..21) ─────

describe('buildEntrySummaryQuery — J1 entry-number path', () => {
  it('emits an exact J1-record for a single entry with computed check digit (ESQ-18)', () => {
    const lines = buildEntrySummaryQuery({ entries: [{ filerCode: 'ABC', entryNumber: '1234567' }] });
    expect(lines).toHaveLength(1);
    // 'J1' + 3 fill + filer(6-8) + 2 fill + entry(11-18, check digit 6 appended)
    expect(lines[0]).toBe('J1   ABC  12345676' + ' '.repeat(62));
  });

  it('packs up to five entries per J1-record at the exact positions (ESQ-18)', () => {
    const lines = buildEntrySummaryQuery({
      entries: [
        { filerCode: 'ABC', entryNumber: '1234567' },
        { filerCode: '999', entryNumber: '9999999' }, // check digit 0
      ],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('J1   ABC  12345676999  99999990' + ' '.repeat(49));
  });

  it('chunks a sixth entry into a second J1-record (Note 1, ESQ-18)', () => {
    const entries = Array.from({ length: 6 }, () => ({ filerCode: 'ABC', entryNumber: '1234567' }));
    const lines = buildEntrySummaryQuery({ entries });
    expect(lines).toHaveLength(2);
    expect(lines[1].slice(0, 2)).toBe('J1');
    expect(lines[1].slice(10, 18)).toBe('12345676'); // Entry Number (1) slot only
    expect(lines[1].slice(18, 80).trim()).toBe('');
    for (const line of lines) expect(line).toHaveLength(80);
  });

  it('prefixes a J0 detail-return request when asked (ESQ-17)', () => {
    const lines = buildEntrySummaryQuery({
      returnDetail: true,
      entries: [{ filerCode: 'ABC', entryNumber: '1234567' }],
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('J0Y' + ' '.repeat(77));
  });

  it('rejects a bad entry-number check digit client-side', () => {
    expect(() => buildEntrySummaryQuery({ entries: [{ filerCode: 'ABC', entryNumber: '12345670' }] })).toThrow(
      /check digit/
    );
  });
});

describe('buildEntrySummaryQuery — J2 criteria path', () => {
  it('emits an exact J2-record with flags and collection code (ESQ-19..21)', () => {
    const lines = buildEntrySummaryQuery({
      criteria: {
        type: 'EES',
        fromDateTime: '060126120000AM',
        toDateTime: '063026115959PM',
        entrySummaries: true,
        collectionBillInformationCode: '1',
      },
    });
    expect(lines).toHaveLength(1);
    // 'J2' + fill + type(4-6) + fill + from(8-21) + to(22-35) + fill +
    // Entry Summaries Flag(37) + 4 unused flags + collection code(42)
    expect(lines[0]).toBe('J2 EES 060126120000AM063026115959PM Y    1' + ' '.repeat(38));
  });

  it('rejects malformed date/times and unknown criteria types', () => {
    const base = { fromDateTime: '060126120000AM', toDateTime: '063026115959PM' };
    expect(() =>
      buildEntrySummaryQuery({ criteria: { ...base, type: 'EES', fromDateTime: '2026-06-01' } })
    ).toThrow(/MMDDYYHHMMSSXX/);
    expect(() =>
      buildEntrySummaryQuery({ criteria: { ...base, type: 'BAD' as never } })
    ).toThrow(/unknown criteria query type/);
  });

  it('enforces the one-query-type-per-block rule (ESQ-16)', () => {
    expect(() => buildEntrySummaryQuery({})).toThrow(RecordCodecError);
    expect(() => buildEntrySummaryQuery({})).toThrow(/either entries .* or criteria/);
    expect(() =>
      buildEntrySummaryQuery({
        entries: [{ filerCode: 'ABC', entryNumber: '1234567' }],
        criteria: { type: 'EES', fromDateTime: '060126120000AM', toDateTime: '063026115959PM' },
      })
    ).toThrow(/cannot be combined/);
  });
});

// ── Entry Summary Query response parser (ER output, ESQ-23..53) ─

function summaryReplyLines(): string[] {
  return [
    writeRecord(OUTPUT_JA, {
      criteriaQueryTypeCode: 'EES',
      requestedFromDateTime: '060126120000AM',
      requestedToDateTime: '063026115959PM',
    }),
    writeRecord(OUTPUT_JB, {
      entryFilerCode: 'ABC',
      entryNumber: '12345676',
      versionNumber: '00100',
      acceptDateTime: '061526043015PM',
      pscIndicator: 'Y',
      pscAcceptDate: '062026',
      ownershipDataReturnedIndicator: 'Y',
      liquidationStatusCode: '2',
      liquidationDate: '121526',
      centerId: 'CEE007',
    }),
    writeRecord(OUTPUT_JC, {
      entrySummaryControlStatus: '1',
      entrySummaryStatusCode: '1',
      entrySummaryStatusDate: '061526',
      lateFilingStatusCode: '0',
      releaseStatusCode: '1',
      releaseDate: '061426',
      collectionStatusCode: '2',
      collectionDate: '062526',
      censusHeaderStatusCode: '0',
      invoiceStatusCode: ' ',
      protestStatusCode: 'NO',
      quotaStatusCode: ' ',
      extensionSuspensionStatusCode1: '49',
    }),
    writeRecord(OUTPUT_JD, {
      cbpReviewIndicator: '2',
      entryDate: '061426',
      liquidatedDuty: '34100',
      liquidatedInterest: '-1250', // negative per JD Note 3
      immediateDeliveryIndicator: 'N',
    }),
    writeRecord(OUTPUT_JE, { estimatedDuty: '34100', estimatedFees: '4714' }),
    writeRecord(OUTPUT_JF, {
      importerOfRecordNumber: '26-164751100',
      entryType: '01',
      districtPortOfEntry: '2704',
      entrySummaryFilingDate: '061526',
    }),
    writeRecord(OUTPUT_JG, { importSpecialistTeam: '110', centerId: 'CEE007', numberOfLineItems: '001' }),
    writeRecord(OUTPUT_JH, { preliminaryStatementPrintDate: '070126', brokerReferenceNumber: 'REF001' }),
    writeRecord(OUTPUT_JI, {
      suretyCode: '123',
      primarySuretyIndicator: 'Y',
      bondTypeCode: '8',
      bondDesignationTypeCode: 'B',
      multipleBondsIndicator: 'N',
      bondNumber: '998877661',
      suretyLiabilityAmount: '0000050000',
    }),
    writeRecord(OUTPUT_JK, {
      billNumber: '12345678901',
      billDate: '070126',
      billType: '2',
      billCollectionStatus: '01',
      totalBillAmount: '00000123456',
    }),
    'JL COLLECTION DATA NOT ON FILE', // JL Note 1 sentinel
    writeRecord(OUTPUT_JM, { classCode: '499', classCodeAmount: '00000003464' }),
    // Detail grouping (raw AE records + 4A), returned when J0 requested
    writeRecord(OUTPUT_4A, { cbpLineNumber: '00001' }),
    '40  010 HKHK031409'.padEnd(80, ' '),
    writeRecord(OUTPUT_JZ, {
      conditionCode: '013',
      narrativeText: 'ENTRY SUMMARY NOT FOUND FOR QUERY',
      entryFilerCode: 'ABC',
      entryNumber: '99999990',
      districtPortOfEntry: '2704',
    }),
  ];
}

describe('parseEsQueryResponse', () => {
  const response = parseEsQueryResponse(summaryReplyLines());

  it('echoes the JA criteria header (ESQ-24)', () => {
    expect(response.criteria).toEqual({
      type: 'EES',
      fromDateTime: '060126120000AM',
      toDateTime: '063026115959PM',
    });
  });

  it('parses JB identity, version, PSC, and liquidation state (ESQ-25..26)', () => {
    expect(response.summaries).toHaveLength(1);
    const s = response.summaries[0];
    expect(s.entryFilerCode).toBe('ABC');
    expect(s.entryNumber).toBe('12345676');
    expect(s.versionNumber).toBe('00100');
    expect(s.acceptDateTime).toBe('061526043015PM');
    expect(s.postSummaryCorrection).toBe(true);
    expect(s.pscAcceptDate).toBe('062026');
    expect(s.ownershipDataReturned).toBe(true);
    expect(s.liquidationStatusCode).toBe('2');
    expect(s.liquidationDate).toBe('121526');
    expect(s.centerId).toBe('CEE007');
  });

  it('parses JC status/date data (ESQ-28..32)', () => {
    const st = response.summaries[0].status!;
    expect(st.controlStatusCode).toBe('1');
    expect(st.statusCode).toBe('1');
    expect(st.statusDate).toBe('061526');
    expect(st.releaseStatusCode).toBe('1');
    expect(st.releaseDate).toBe('061426');
    expect(st.collectionStatusCode).toBe('2');
    expect(st.protestStatusCode).toBe('NO');
    expect(st.extensionSuspensionStatusCodes).toEqual(['49']);
  });

  it('parses JD liquidated amounts incl. the adjacent negative sign (Note 3, ESQ-34)', () => {
    const liq = response.summaries[0].liquidation!;
    expect(liq.cbpReviewIndicator).toBe('2');
    expect(liq.liquidatedDutyCents).toBe(34100);
    expect(liq.liquidatedInterestCents).toBe(-1250);
    expect(liq.immediateDeliveryIndicator).toBe('N');
  });

  it('parses JE estimates and JF/JG/JH identity, team, and reference data', () => {
    const s = response.summaries[0];
    expect(s.estimates).toMatchObject({ estimatedDutyCents: 34100, estimatedFeesCents: 4714 });
    expect(s.importerOfRecordNumber).toBe('26-164751100');
    expect(s.entryType).toBe('01');
    expect(s.districtPortOfEntry).toBe('2704');
    expect(s.entrySummaryFilingDate).toBe('061526');
    expect(s.importSpecialistTeam).toBe('110');
    expect(s.numberOfLineItems).toBe(1);
    expect(s.preliminaryStatementPrintDate).toBe('070126');
    expect(s.brokerReferenceNumber).toBe('REF001');
  });

  it('parses JI bond/surety and JK bill data (ESQ-40..44)', () => {
    const s = response.summaries[0];
    expect(s.bonds).toEqual([
      {
        suretyCode: '123',
        primarySurety: true,
        bondTypeCode: '8',
        bondDesignationTypeCode: 'B',
        multipleBonds: false,
        bondNumber: '998877661',
        singleEntryBondAmountCents: undefined,
        suretyLiabilityAmountDollars: 50000,
      },
    ]);
    expect(s.bills).toEqual([
      {
        billNumber: '12345678901',
        billDate: '070126',
        billType: '2',
        billCollectionStatus: '01',
        totalBillAmountCents: 123456,
        paidAmountCents: undefined,
        principalAmountCents: undefined,
        interestAmountCents: undefined,
      },
    ]);
    expect(s.classAmounts).toEqual([{ classCode: '499', amountCents: 3464 }]);
  });

  it('flags the not-on-file sentinel lines instead of mis-parsing them (JI/JK/JL/JN Note 1)', () => {
    const s = response.summaries[0];
    expect(s.collectionDataNotOnFile).toBe(true);
    expect(s.collections).toEqual([]);

    const r2 = parseEsQueryResponse([
      writeRecord(OUTPUT_JB, {
        entryFilerCode: 'ABC',
        entryNumber: '12345676',
        versionNumber: '00100',
        acceptDateTime: '061526043015PM',
        pscIndicator: ' ',
        ownershipDataReturnedIndicator: 'Y',
        liquidationStatusCode: '2',
        centerId: 'CEE007',
      }),
      'JI 891 NO BOND ON FILE IN ACE EBOND', // exact example, ESQ-41
      'JK BILLING DATA NOT ON FILE', // exact example, ESQ-44
      'JN 037 Y BILLING DATA NOT ON FILE', // exact example, ESQ-49
    ]);
    expect(r2.summaries[0].noBondOnFile).toBe(true);
    expect(r2.summaries[0].bonds).toEqual([]);
    expect(r2.summaries[0].billingDataNotOnFile).toBe(true);
    expect(r2.summaries[0].bills).toEqual([]);
    expect(r2.summaries[0].suretyBills).toEqual([]);
    expect(r2.summaries[0].postSummaryCorrection).toBe(false);
  });

  it('captures the raw 10-90 detail grouping incl. the 4A line number (ESQ-52..53)', () => {
    const s = response.summaries[0];
    expect(s.detailLines).toHaveLength(2);
    expect(s.detailLines[0].slice(0, 7)).toBe('4A00001');
    expect(s.detailLines[1].slice(0, 2)).toBe('40');
  });

  it('parses JZ returned conditions with the chapter narrative (ESQ-50..51)', () => {
    expect(response.conditions).toEqual([
      {
        conditionCode: '013',
        narrative: 'ENTRY SUMMARY NOT FOUND FOR QUERY',
        entryFilerCode: 'ABC',
        entryNumber: '99999990',
        districtPortOfEntry: '2704',
      },
    ]);
  });

  it('parses a full ER batch through the envelope', () => {
    const wire = buildBatch({
      sender: { siteCode: 'LGB1', idCode: 'ABC', password: 'SECRET' },
      appId: 'ER',
      blocks: [{ port: '2704', filerCode: 'ABC', transactionLines: summaryReplyLines() }],
    });
    const parsed = parseEsQueryResponseBatch(wire);
    expect(parsed.batchRejected).toBe(false);
    expect(parsed.response.summaries).toHaveLength(1);
    expect(parsed.response.summaries[0].entryNumber).toBe('12345676');
    expect(parsed.response.conditions).toHaveLength(1);
  });
});

// ── UC status notification parser (inbound only, ESS-14..33) ─

describe('parseUcNotification', () => {
  it('lays out the E1-record exactly per ESS-15..17 and parses a rejection', () => {
    const e1 = writeRecord(UC_E1, {
      dispositionTypeCode: '4',
      sourceOfActionCode: '1',
      importSpecialistTeam: '110',
      notificationReasonCode: '003',
      dateOfAction: '080126',
      entryFilerCode: 'ABC',
      entryNumber: '12345676',
      brokerReferenceNumber: 'REF001',
    });
    expect(e1).toBe('E141110003080126' + ' '.repeat(34) + 'ABC  12345676' + ' '.repeat(5) + 'REF001' + ' '.repeat(6));

    const [n] = parseUcNotification([
      e1,
      writeRecord(UC_E2, {
        cbpUser: 'DOE JOHN',
        telephoneNumber: '2025551234',
        actionIdentificationNumber: '12345676',
        telephoneExtensionNumber: '1234',
      }),
      writeRecord(UC_E3, { remarks: 'CLASSIFICATION INCORRECT ON LINE 001;' }),
      writeRecord(UC_E3, { remarks: 'SEE HTS 8507600020' }),
    ]);
    expect(n.dispositionTypeCode).toBe('4');
    expect(n.dispositionDescription).toBe('Entry summary rejected/PSC rejected');
    expect(n.manual).toBe(true);
    expect(n.importSpecialistTeam).toBe('110');
    expect(n.notificationReasonCode).toBe('003');
    expect(n.notificationReasonDescription).toBe('Classification');
    expect(n.dateOfAction).toBe('080126');
    expect(n.entryFilerCode).toBe('ABC');
    expect(n.entryNumber).toBe('12345676');
    expect(n.brokerReferenceNumber).toBe('REF001');
    expect(n.cbpAction).toEqual({
      cbpUser: 'DOE JOHN',
      telephoneNumber: '2025551234',
      telephoneExtension: '1234',
      actionIdentificationNumber: '12345676',
    });
    expect(n.remarks).toBe('CLASSIFICATION INCORRECT ON LINE 001;SEE HTS 8507600020');
  });

  it('parses disposition 8 — PSC presented by another filer (ownership change, E1 Note 1)', () => {
    const [n] = parseUcNotification([
      writeRecord(UC_E1, {
        dispositionTypeCode: '8',
        sourceOfActionCode: '2',
        importSpecialistTeam: '110',
        dateOfAction: '080126',
        entryFilerCode: 'ABC',
        entryNumber: '12345676',
      }),
    ]);
    expect(n.dispositionTypeCode).toBe('8');
    expect(n.dispositionDescription).toMatch(/presented by another filer/);
    expect(n.manual).toBe(false);
    expect(n.cbpAction).toBeUndefined(); // no E2 for type 8 (E2 Note 3)
  });

  it('parses a quota notification with E4 line statuses (ESS-25..26)', () => {
    const [n] = parseUcNotification([
      writeRecord(UC_E1, {
        dispositionTypeCode: 'Q',
        sourceOfActionCode: '2',
        importSpecialistTeam: '110',
        dateOfAction: '080126',
        entryFilerCode: 'ABC',
        entryNumber: '12345676',
      }),
      writeRecord(UC_E4, {
        lineItemIdentifier: '001',
        quotaLineStatusCode: 'Q01',
        quotaLineStatusDescription: 'QUOTA PROCESSED / ACCEPTED',
        requestedQuotaQuantity: '000000005000',
        quotaRequestedUomCode: 'KG',
      }),
      writeRecord(UC_E4, {
        lineItemIdentifier: '*02', // CBP-added line carries an asterisk
        quotaLineStatusCode: 'Q02',
        quotaLineStatusDescription: 'QUOTA APPORTIONED',
        requestedQuotaQuantity: '000000005000',
        quotaRequestedUomCode: 'KG',
        reservedQuotaQuantity: '000000002500',
        reservedQuotaUomCode: 'KG',
      }),
    ]);
    expect(n.dispositionTypeCode).toBe('Q');
    expect(n.quotaLines).toHaveLength(2);
    expect(n.quotaLines[0]).toMatchObject({
      lineItemIdentifier: '001',
      statusCode: 'Q01',
      statusDescription: 'QUOTA PROCESSED / ACCEPTED',
      requestedQuantityHundredths: 5000,
      requestedUomCode: 'KG',
    });
    expect(n.quotaLines[1]).toMatchObject({
      lineItemIdentifier: '*02',
      statusCode: 'Q02',
      reservedQuantityHundredths: 2500,
      reservedUomCode: 'KG',
    });
  });

  it('parses a PGA notification: SO70 disposition + SO71 review + SO72 comment (ESS-27..33)', () => {
    const so70 = writeRecord(UC_SO70, {
      governmentAgencyCode: 'FDA',
      governmentAgencyProgramCode: 'DEV',
      statusActionDate: '052616',
      statusActionTime: '0919',
      pgaEntryLevelStatusCode: '01',
      pgaEntryLevelStatusMessage: 'DATA UNDER PGA REVIEW', // Note 8 example
      beginningCbpLine: '001',
      beginningPgaLine: '001',
      pgaProcessingGroupVersion: '01',
    });
    // Positions per ESS-27: agency 5-7, date 11-16, time 17-20, entry status
    // 21-22, message 23-50, version 79-80.
    expect(so70.slice(0, 4)).toBe('SO70');
    expect(so70.slice(4, 7)).toBe('FDA');
    expect(so70.slice(10, 16)).toBe('052616');
    expect(so70.slice(16, 20)).toBe('0919');
    expect(so70.slice(20, 22)).toBe('01');
    expect(so70.slice(22, 43)).toBe('DATA UNDER PGA REVIEW');
    expect(so70.slice(78, 80)).toBe('01');

    const [n] = parseUcNotification([
      writeRecord(UC_E1, {
        dispositionTypeCode: 'P',
        sourceOfActionCode: '2',
        dateOfAction: '052616',
        entryFilerCode: 'ABC',
        entryNumber: '12345676',
      }),
      so70,
      writeRecord(UC_SO71, {
        referenceIdQualifier: '06',
        referenceIdNumber: 'A12345678901',
        referenceIdReceiptDate: '052616',
        referenceIdReceiptTime: '091845',
        subReasonCode1: '188',
      }),
      writeRecord(UC_SO72, { commentsToTrade: 'CONTACT FDA DISTRICT OFFICE FOR EXAM SCHEDULING' }),
    ]);
    expect(n.dispositionTypeCode).toBe('P');
    expect(n.pgaGroups).toHaveLength(1);
    const g = n.pgaGroups[0];
    expect(g).toMatchObject({
      agencyCode: 'FDA',
      agencyProgramCode: 'DEV',
      statusActionDate: '052616',
      statusActionTime: '0919',
      entryLevelStatusCode: '01',
      entryLevelStatusMessage: 'DATA UNDER PGA REVIEW',
      beginningCbpLine: '001',
      beginningPgaLine: '001',
      processingGroupVersion: '01',
    });
    expect(g.reviews).toEqual([
      {
        referenceIdQualifier: '06',
        referenceIdNumber: 'A12345678901',
        referenceIdReceiptDate: '052616',
        referenceIdReceiptTime: '091845',
        subReasonCodes: ['188'],
        referenceIdQualifier2: undefined,
        referenceIdNumber2: undefined,
      },
    ]);
    expect(g.comments).toEqual(['CONTACT FDA DISTRICT OFFICE FOR EXAM SCHEDULING']);
  });

  it('parses a full UC wire batch (single block, single grouping — ESS-14)', () => {
    const wire = buildBatch({
      sender: { siteCode: 'LGB1', idCode: 'ABC', password: 'SECRET' },
      appId: 'UC',
      blocks: [
        {
          port: '2704',
          filerCode: 'ABC',
          transactionLines: [
            writeRecord(UC_E1, {
              dispositionTypeCode: '6',
              sourceOfActionCode: '1',
              importSpecialistTeam: '110',
              dateOfAction: '080126',
              entryFilerCode: 'ABC',
              entryNumber: '12345676',
            }),
          ],
        },
      ],
    });
    const parsed = parseUcNotificationBatch(wire);
    expect(parsed.batchRejected).toBe(false);
    expect(parsed.notifications).toHaveLength(1);
    expect(parsed.notifications[0].dispositionTypeCode).toBe('6');
    expect(parsed.notifications[0].dispositionDescription).toBe('Entry summary canceled');
  });
});
