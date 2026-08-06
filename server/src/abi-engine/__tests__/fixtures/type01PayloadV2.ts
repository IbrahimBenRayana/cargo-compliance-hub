/** Shared v2 payload fixture: a minimal type-01 consumption entry. */
import type { AbiPayloadV2 } from '../../payload/schemaV2.js';

export const TYPE01_PAYLOAD_V2: AbiPayloadV2 = {
  schemaVersion: 2,
  entrySummary: {
    filerCode: 'ABC',
    entryNumber: '1234567',
    districtPortOfEntry: '2704',
    brokerReferenceNumber: 'REF001',
    entryTypeCode: '01',
    motCode: '11',
    dates: {
      estimatedEntry: '20260820',
      importation: '20260815',
      estimatedArrival: '20260814',
    },
    importerOfRecord: { number: '26-164751100', name: 'SIGMA TECHNOLOGY PARTNERS LLC' },
    usStateOfDestination: 'CA',
    bonds: [{ bondTypeCode: '8', designationTypeCode: 'B', suretyCompanyCode: '123' }],
    payment: { typeCode: '2', preliminaryStatementPrintDate: '20260901' },
    cargo: {
      carrierCode: 'MAEU',
      districtPortOfUnlading: '2704',
      conveyanceName: 'EVER GIVEN',
    },
    manifests: [
      {
        manifestedQuantity: 100,
        uomCode: 'CTNS',
        bills: [{ type: 'M', issuerCode: 'MAEU', identifier: '123456789012' }],
      },
    ],
    lines: [
      {
        countryOfOrigin: 'CN',
        countryOfExport: 'CN',
        dateOfExportation: '20260801',
        relatedPartyIndicator: 'N',
        chargesDollars: 500,
        grossWeightKg: 1200,
        descriptions: ['LITHIUM ION BATTERY PACKS'],
        parties: [
          { type: 'M', identifier: 'CNSHEBAT123SHA' },
          { type: 'S', identifier: '26-164751100' },
        ],
        tariffs: [
          {
            htsNumber: '8507600020',
            dutyCents: 34100,
            valueDollars: 10000,
            uomCode1: 'NO',
            quantity1Hundredths: 50000,
          },
        ],
        fees: [
          { classCode: '499', amountCents: 3464 },
          { classCode: '501', amountCents: 1250 },
        ],
      },
    ],
    feeTotals: [
      { classCode: '499', amountCents: 3464 },
      { classCode: '501', amountCents: 1250 },
    ],
    grandTotals: { dutyCents: 34100, userFeeCents: 4714, irTaxCents: 0, adDutyCents: 0, cvDutyCents: 0 },
  },
};
