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
    rates: { '9014805000': 'Free' },
    action: 'R',
    mutate: (p) => {
      // Step-2 replacement data from the package.
      p.entrySummary.brokerReferenceNumber = '020REPLCE';
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'GB';
      line.countryOfExport = 'GB';
      line.descriptions = ['NAVIGATIONAL INSTRUMENTS'];
      line.parties = [
        { type: 'M', identifier: 'GBLONNAV321LON' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '9014805000', valueDollars: 53000, uomCode1: 'NO', quantity1Hundredths: 100 },
      ];
    },
    notes: 'Step 1 (original acceptance) is the live-cert half; this fixture is the step-2 Replace transmission.',
  }),

  aeScenario('011', 'Estimated Date of Arrival Validation', {
    rates: { '8507600020': '3.41%' },
    mutate: (p, params) => {
      const cy = params.currentYear;
      p.entrySummary.dates = {
        estimatedEntry: `${cy}0820`,
        importation: `${cy}0125`,
        estimatedArrival: `${cy}0210`,
        inBond: `${cy}0201`,
      };
      p.entrySummary.lines[0].dateOfExportation = `${cy}0110`;
      p.entrySummary.manifests = [
        {
          manifestedQuantity: 100,
          uomCode: 'CTNS',
          bills: [
            { type: 'I', identifier: '115581395' },
            { type: 'I', identifier: '012345684978' },
            { type: 'M', issuerCode: 'MAEU', identifier: '123456789012' },
          ],
        },
      ];
    },
  }),

  aeScenario('012', 'Product Exclusion Number', {
    rates: { '7208900000': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'MX';
      line.countryOfExport = 'MX';
      line.descriptions = ['FLAT-ROLLED STEEL PRODUCTS'];
      line.parties = [
        { type: 'M', identifier: 'MXMTYSTL654MTY' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '7208900000', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 500000 },
      ];
      // Steel product exclusion rides the 54-Record Importer Additional
      // Declaration, type 02 (chapter change log #76 documents STXnnnnnn /
      // STL… identifier formats).
      line.declarations = [{ typeCode: '02', information: 'STL999995' }];
    },
  }),

  aeScenario('013', 'Diamond Certificate', {
    rates: { '7102211020': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'AU';
      line.countryOfExport = 'AU';
      line.descriptions = ['UNWORKED INDUSTRIAL DIAMONDS'];
      line.parties = [
        { type: 'M', identifier: 'AUPERDIA987PER' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '7102211020', valueDollars: 10000, uomCode1: 'CAR', quantity1Hundredths: 25000 },
      ];
      // 52-Record type 06 = Diamond Certificate (Kimberley process, ESF-167;
      // OFAC-format number ≤9 chars — Admin Message 04-002229).
      line.license = { typeCode: '06', number: 'AU0863015' };
    },
  }),

  aeScenario('014', 'Airline Carrier Code', {
    rates: { '8507600020': '3.41%' },
    mutate: (p) => {
      p.entrySummary.motCode = '40';
      // Package value: the '*F' generic air-carrier convention.
      p.entrySummary.cargo = { carrierCode: '*F', conveyanceName: 'FLIGHT 100' };
      // Air rules (ESF-153): master bill identifier mandatory, issuer code
      // never allowed for air.
      p.entrySummary.manifests = [
        { manifestedQuantity: 100, uomCode: 'CTNS', bills: [{ type: 'M', identifier: '12345678' }] },
      ];
    },
  }),

  aeScenario('018', 'Chile Free Trade Agreement', {
    rates: {
      '0811908040': { general: '14.5%', special: 'Free (A+,AU,BH,CL,CO,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' },
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CL';
      line.countryOfExport = 'CL';
      line.spiClaimCode = 'CL';
      line.descriptions = ['FROZEN BERRIES'];
      line.parties = [
        { type: 'M', identifier: 'CLSCLBER246SCL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '0811908040', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 400000 },
      ];
    },
  }),

  aeScenario('019', 'Sets under GRI 3(b)/(c) — X & V Article Set Indicators', {
    rates: { '1902194000': '6.4%', '0712311000': '1.3¢/kg + 1.8%', '2002908020': '11.6%' },
    mutate: (p) => {
      const ior = p.entrySummary.importerOfRecord.number;
      // GRI 3(b) set: every component is dutiable at the set's essential-
      // character rate (spaghetti, 6.4%) — the engine's article-set
      // aggregation is deferred, so the set-rate duties are pinned:
      // X 2400×6.4%=153.60, V 1300×6.4%=83.20 each.
      p.entrySummary.lines = [
        {
          articleSetIndicator: 'X',
          countryOfOrigin: 'CH',
          countryOfExport: 'CH',
          dateOfExportation: p.entrySummary.lines[0].dateOfExportation,
          relatedPartyIndicator: 'N',
          descriptions: ['SPAGHETTI MEAL SET - PASTA'],
          parties: [
            { type: 'M', identifier: 'CHZURPAS135ZUR' },
            { type: 'S', identifier: ior },
          ],
          tariffs: [
            { htsNumber: '1902194000', valueDollars: 2400, uomCode1: 'KG', quantity1Hundredths: 120000, dutyCents: 15360 },
          ],
        },
        {
          articleSetIndicator: 'V',
          countryOfOrigin: 'FR',
          countryOfExport: 'CH',
          dateOfExportation: p.entrySummary.lines[0].dateOfExportation,
          relatedPartyIndicator: 'N',
          descriptions: ['SPAGHETTI MEAL SET - DRIED MUSHROOMS'],
          parties: [
            { type: 'M', identifier: 'FRPARMUS791PAR' },
            { type: 'S', identifier: ior },
          ],
          tariffs: [
            { htsNumber: '0712311000', valueDollars: 1300, uomCode1: 'KG', quantity1Hundredths: 20000, dutyCents: 8320 },
          ],
        },
        {
          articleSetIndicator: 'V',
          countryOfOrigin: 'IT',
          countryOfExport: 'CH',
          dateOfExportation: p.entrySummary.lines[0].dateOfExportation,
          relatedPartyIndicator: 'N',
          descriptions: ['SPAGHETTI MEAL SET - TOMATO PASTE'],
          parties: [
            { type: 'M', identifier: 'ITMILTOM468MIL' },
            { type: 'S', identifier: ior },
          ],
          tariffs: [
            { htsNumber: '2002908020', valueDollars: 1300, uomCode1: 'KG', quantity1Hundredths: 30000, dutyCents: 8320 },
          ],
        },
      ];
    },
    notes: 'Set-rate duties pinned (engine article-set aggregation deferred): all components at the 6.4% essential-character rate.',
  }),

  aeScenario('020', 'Census Warning', {
    rates: { '4703110000': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CL';
      line.countryOfExport = 'CL';
      line.chargesDollars = 17810;
      line.grossWeightKg = 245939;
      line.descriptions = ['CHEMICAL WOODPULP, UNBLEACHED'];
      line.parties = [
        { type: 'M', identifier: 'CLSCLPUL802SCL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // The absurd quantity/UOM pairing is the census-warning trigger; the
      // transmission itself is valid and must go out (ACE responds with the
      // warning that scenarios 021/022 then query and override).
      line.tariffs = [
        { htsNumber: '4703110000', valueDollars: 2054587, uomCode1: 'CTN', quantity1Hundredths: 2455580000 },
      ];
    },
  }),

  aeScenario('023', 'Steel License', {
    rates: { '7222110006': 'Free' },
    mutate: (p, params) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'KR';
      line.countryOfExport = 'KR';
      line.descriptions = ['STAINLESS STEEL BARS'];
      line.parties = [
        { type: 'M', identifier: 'KRSELSTE579SEL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '7222110006', valueDollars: 3876, uomCode1: 'KG', quantity1Hundredths: 150000 },
      ];
      // 52-Record type 01 = Steel Import License (ESF-166). Package: replace
      // MMDDYY with today's date — derived from the applicability date so
      // dry-run goldens stay stable.
      const d = params.applicabilityDate;
      line.license = { typeCode: '01', number: `S23${d.slice(4, 8)}${d.slice(2, 4)}` };
    },
  }),

  aeScenario('024', 'Additional Duty Reporting', {
    rates: { '99034110': '40%', '6403599045': '10%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'JP';
      line.countryOfExport = 'JP';
      line.descriptions = ['LEATHER FOOTWEAR'];
      line.parties = [
        { type: 'M', identifier: 'JPTYOSHO913TYO' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // 9903.41.10 additional duty rides first; the value/quantity report on
      // the ch.64 base line and the 40% computes on that base value.
      line.tariffs = [
        { htsNumber: '99034110', valueDollars: 0, uomCode1: 'X' },
        { htsNumber: '6403599045', valueDollars: 12290, uomCode1: 'PRS', quantity1Hundredths: 260000 },
      ];
    },
  }),

  aeScenario('025', 'Full Bill Data for Rail AMS Shipment', {
    rates: { '8507600020': '3.41%' },
    mutate: (p) => {
      p.entrySummary.motCode = '21';
      p.entrySummary.cargo = { carrierCode: 'CNRU', districtPortOfUnlading: '3802' };
      p.entrySummary.manifests = [
        { manifestedQuantity: 100, uomCode: 'CTNS', bills: [{ type: 'M', issuerCode: 'CNRU', identifier: '32560834' }] },
      ];
    },
  }),

  aeScenario('026', 'Freely Associated States', {
    rates: { '4602198000': { general: '2.3%', special: 'Free (A,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' } },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'FM';
      line.countryOfExport = 'FM';
      // SPI Z (Freely Associated States) is statutory (general note 10) and
      // not printed in the USITC Special column — preference pinned to Free.
      line.spiClaimCode = 'Z';
      line.descriptions = ['BASKETWORK OF VEGETABLE MATERIALS'];
      line.parties = [
        { type: 'M', identifier: 'FMPNIBAS753PNI' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '4602198000', valueDollars: 54575, uomCode1: 'NO', quantity1Hundredths: 500000, dutyCents: 0 },
      ];
    },
    notes: 'SPI Z is statutory (HTS general note 10), not in the Special column — duty pinned to Free.',
  }),
];

export const SCENARIO_INDEX: Map<string, Scenario> = new Map(SCENARIOS.map((s) => [s.id, s]));
export type { Scenario } from './aeBase.js';
export { DRY_RUN_PARAMS, type CertParams } from './params.js';
