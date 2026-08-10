/**
 * CBP ABI certification scenarios (Phase 3) — executable fixtures.
 *
 * Values come verbatim from the CBP test package ("ABI Test complete list
 * of scenarios (Trade).docx"); "Client Rep will supply" values flow in via
 * CertParams. HTS rates are pinned from the ingested USITC 2026-aug-06
 * revision so the harness is hermetic. Package standing rules applied by
 * the aeScenario helper: $10,000 line values, statement payment, scenario
 * number in the B-record (pos 60) AND the Broker Reference Number.
 *
 * First batch: 001–005, 007, 008, 010, 015–017. The remaining scenarios
 * land batch by batch; companion-app scenarios (006/021/022/050/062–066/
 * 080) reuse the apps/ builders.
 */
import { type Scenario, aeScenario, aeRejectScenario } from './aeBase.js';

export const SCENARIOS: Scenario[] = [
  aeScenario('001', 'Singapore Free Trade Agreement', {
    // 9999.00.84 is the Singapore FTA provision marker the package pairs
    // with the substantive classification; both rates are Free (USITC).
    rates: { '99990084': 'Free', '8443992050': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'SG';
      line.countryOfExport = 'SG';
      line.spiClaimCode = 'SG';
      line.descriptions = ['PRINTER PARTS'];
      line.parties = [
        { type: 'M', identifier: 'SGSIGPRI123SIN' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99990084', valueDollars: 0, uomCode1: 'X' },
        { htsNumber: '8443992050', valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 10000 },
      ];
    },
  }),

  aeScenario('002', 'US – Israel Free Trade Area Agreement', {
    rates: {
      '6110303059': { general: '32%', special: 'Free (AU,BH, CL,CO,IL,JO,KR, MA,OM,P, PA,PE,S,SG)' },
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'EG';
      line.countryOfExport = 'EG';
      // Package instructs SPI "N" (Israel FTA extension / QIZ). The USITC
      // Special column does not print N, so the preference duty is pinned
      // here rather than derived: eligible per the scenario ⇒ Free.
      line.spiClaimCode = 'N';
      line.descriptions = ['KNIT SWEATERS, MAN-MADE FIBERS'];
      line.parties = [
        { type: 'M', identifier: 'EGCAIKNI456CAI' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        {
          htsNumber: '6110303059',
          valueDollars: 10000,
          uomCode1: 'DOZ',
          quantity1Hundredths: 10000,
          uomCode2: 'KG',
          quantity2Hundredths: 50000,
          dutyCents: 0, // pinned: see SPI note above
        },
      ];
      line.textileCategoryCode = '646';
    },
    notes: 'SPI N (Israel FTA) is not in the USITC Special column — duty pinned to Free per the scenario’s eligibility statement. Confirm SPI letter with client rep.',
  }),

  aeScenario('003', 'Live Entry Indicator', {
    rates: { '8507600020': '3.41%' },
    mutate: (p) => {
      p.entrySummary.indicators = { ...p.entrySummary.indicators, liveEntry: true };
    },
  }),

  aeScenario('004', 'Single Entry Bond with Surety and Bond Information', {
    rates: { '8507600020': '3.41%' },
    mutate: (p) => {
      p.entrySummary.bonds = [
        {
          bondTypeCode: '9',
          designationTypeCode: 'B',
          suretyCompanyCode: '891',
          stbAmountDollars: 150000,
          stbProducerAccountNumber: 'AB12345678',
        },
      ];
    },
    notes: 'Importer of Record Number: client rep will supply (flows from CertParams).',
  }),

  aeScenario('005', 'Census Warning Override within AE', {
    rates: { '2711120010': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.descriptions = ['PROPANE, LIQUEFIED'];
      line.tariffs = [
        { htsNumber: '2711120010', valueDollars: 30323, uomCode1: 'M3', quantity1Hundredths: 5078 },
      ];
      // Override code 49 = parameter change requested (package bonus info).
      // The condition code being overridden arrives on the AX census warning
      // at cert time; the dry-run pins a placeholder.
      line.censusOverrides = [{ conditionCode: '13Q', overrideCode: '49' }];
    },
    notes: 'Census condition code comes from the live AX warning during cert; 13Q is a dry-run placeholder.',
  }),

  aeScenario('007', 'MOT/Port of Unlading', {
    rates: { '8507600020': '3.41%' },
    mutate: (p, params) => {
      p.entrySummary.motCode = '11';
      p.entrySummary.cargo = { ...p.entrySummary.cargo, carrierCode: 'HLCU', districtPortOfUnlading: '3205' };
      // In-bond movement claimed ⇒ the in-bond date is required (ESF-40)
      // and must sit between import date and estimated entry (ESF-155).
      p.entrySummary.dates = { ...p.entrySummary.dates, inBond: `${params.currentYear}0816` };
      p.entrySummary.manifests = [
        {
          manifestedQuantity: 100,
          uomCode: 'CTNS',
          bills: [
            { type: 'I', identifier: '615310393' },
            { type: 'M', issuerCode: 'HLCU', identifier: 'HAM190603443' },
            { type: 'H', issuerCode: 'DMAL', identifier: 'LEH260068' },
          ],
        },
      ];
    },
    notes: 'Package prints the master bill as HLCUHAM190603443 — split per Appendix E into SCAC issuer HLCU + number HAM190603443.',
  }),

  aeScenario('008', 'GSP', {
    rates: {
      '3802100020': { general: '4.8%', special: 'Free (A*,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' },
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'PH';
      line.countryOfExport = 'PH';
      line.spiClaimCode = 'A';
      line.descriptions = ['ACTIVATED CARBON'];
      line.parties = [
        { type: 'M', identifier: 'PHMANCAR789MNL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '3802100020', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 20000 },
      ];
    },
  }),

  aeRejectScenario('010', 'In-Transit Date Validation', {
    rates: { '8507600020': '3.41%' },
    mutate: (p, params) => {
      const cy = params.currentYear;
      // Package dates: importation 02/01, exportation 01/21, in-transit
      // 01/22 — the in-transit date precedes the import date, which
      // ESF-155 forbids. Our system must refuse to transmit this.
      p.entrySummary.dates = { estimatedEntry: `${cy}0210`, importation: `${cy}0201`, inBond: `${cy}0122` };
      p.entrySummary.lines[0].dateOfExportation = `${cy}0121`;
      p.entrySummary.manifests = [
        {
          manifestedQuantity: 100,
          uomCode: 'CTNS',
          bills: [
            { type: 'I', identifier: '111271425' },
            { type: 'M', issuerCode: 'MAEU', identifier: '123456789012' },
          ],
        },
      ];
    },
    notes: 'Intentionally invalid: in-transit 01/22 is earlier than importation 02/01 (ESF-155). Rejection evidence goes to the client rep.',
  }),

  aeScenario('015', 'Deletion of an Entry Summary', {
    rates: {},
    action: 'D',
    mutate: () => {},
  }),

  aeRejectScenario('016', 'Invalid Entry Type for AE', {
    rates: { '8507600020': '3.41%' },
    mutate: (p) => {
      // Type 86 (Section 321) is not a valid AE entry type — AE Table 2.
      p.entrySummary.entryTypeCode = '86';
    },
    notes: 'Intentionally invalid: type 86 must be rejected client-side (AE Table 2).',
  }),

  aeScenario('017', 'Replacement of an Entry Summary', {
    rates: { '8507600020': '3.41%' },
    action: 'R',
    mutate: () => {},
  }),
];

export const SCENARIO_INDEX: Map<string, Scenario> = new Map(SCENARIOS.map((s) => [s.id, s]));
export type { Scenario } from './aeBase.js';
export { DRY_RUN_PARAMS, type CertParams } from './params.js';
