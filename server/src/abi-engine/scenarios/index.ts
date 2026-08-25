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
import { type Scenario, aeScenario, aeRejectScenario, appScenario } from './aeBase.js';
import { buildEntrySummaryQuery } from '../apps/esQuery/builder.js';
import { buildAdCvdCaseQuery } from '../apps/adcvd/builder.js';
import { buildQuotaQuery } from '../apps/quota/builder.js';
import { buildTibExtension } from '../apps/tib/builder.js';
import { buildCensusOverride } from '../apps/census/cwBuilder.js';
import { buildCensusWarningQuery } from '../apps/census/cjBuilder.js';

// ── NT52 reciprocal adjustment (F771) + F429 foreign port of lading ──
// Proven by live CERT ACCEPTs on 001/002: every AE entry line carries its
// ORIGIN country's 9903.05.xx reciprocal number as a value-0 tariff placed
// after any 9999/98xx provision marker and before the substantive
// classification. Numbers/rates come from CERT's own HTS table (HA sweeps,
// Aug 2026); where a country has a 0% subdivision-qualified twin (JP/EU/
// KR/CH/TW/CN) the duty-bearing row is used. Vessel scenarios (MOT
// 10/11/12) additionally carry the EXPORT country's Schedule K foreign
// port of lading, verified against CBP ACE Appendix F (April 2, 2026).
const NT52_125 = 'The duty provided in the applicable subheading + 12.5%';
const NT52_100 = 'The duty provided in the applicable subheading + 10%';

export const SCENARIOS: Scenario[] = [
  aeScenario('001', 'Singapore Free Trade Agreement', {
    // 9999.00.84 is the Singapore FTA provision marker the package pairs
    // with the substantive classification; both rates are Free (USITC).
    // CERT-floor findings (live, Aug 21 2026, via the HA query of CERT's
    // own HTS table): 9903.01.25 is NOT ON FILE there (their table predates
    // the IEEPA reciprocal regime — omitted; one not-on-file tariff cascades
    // F642 onto every tariff of the line), and 9999.00.84 carries ZERO
    // reporting units — any UOM is rejected ('X' → F441, 'NO' → F442), so
    // quantity AND uom are omitted entirely.
    // 9903.05.68 fills the F771 adjustment slot — per Karl Fischer
    // (client rep, 8/24/2026): Singapore country-specific reciprocal rate,
    // 12.5%, effective 7/24/2026, CSMS #69326983. The Jul-2026 9903.05.xx
    // country-rate family IS loaded in CERT (unlike the Apr-2025 9903.01.xx
    // family, NOT ON FILE per our HA sweeps).
    rates: {
      '99990084': 'Free',
      '99030568': 'The duty provided in the applicable subheading + 12.5%',
      '8443992050': 'Free',
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'SG';
      line.countryOfExport = 'SG';
      line.spiClaimCode = 'SG';
      line.descriptions = ['PRINTER PARTS'];
      // F429: MOT 11 requires the foreign port of lading (Schedule K).
      line.foreignPortOfLading = '55976'; // Singapore
      line.parties = [
        { type: 'M', identifier: 'SGSIGPRI123SIN' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // Tariff order per ACE's live verdicts: 9999 marker FIRST (marker-
      // second draws F852 HTS OUT OF SEQUENCE + F613 RELATIONSHIP MISMATCH),
      // substantive last. The F771 adjustment slot sits between them once
      // CERT tells us which 9903 number its table carries for this pairing.
      line.tariffs = [
        { htsNumber: '99990084', valueDollars: 0 },
        { htsNumber: '99030568', valueDollars: 0 },
        { htsNumber: '8443992050', valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 10000 },
      ];
    },
  }),

  aeScenario('002', 'US – Israel Free Trade Area Agreement', {
    // NT52 adjustment = the ORIGIN COUNTRY number: Egypt 9903.05.36 at
    // 12.5% (CERT HA sweep 8/25). The textiles row 9903.05.95 alone does
    // NOT satisfy F771 (live-tested: accepted as valid but adjustment
    // still 'missing') — the edit wants the country number, mirroring
    // 001's accepted shape. QIZ preference kills the 32% column-1 duty
    // only; the NT52 12.5% ($1,250) is paid.
    rates: {
      '99030536': 'The duty provided in the applicable subheading + 12.5%',
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
      // F429 (vessel MOT): foreign port of lading — Alexandria, Egypt
      // (Schedule K 72901), matching the QIZ/Egypt export.
      line.foreignPortOfLading = '72901';
      line.parties = [
        { type: 'M', identifier: 'EGCAIKNI456CAI' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030536', valueDollars: 0 },
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
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    mutate: (p) => {
      p.entrySummary.indicators = { ...p.entrySummary.indicators, liveEntry: true };
      const line = p.entrySummary.lines[0];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
    },
  }),

  aeScenario('004', 'Single Entry Bond with Surety and Bond Information', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
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
    // 9903.88.15 added: F771 persisted with NT52 alone (live 8/25) — CN
    // propane is 301 List 4A, and the remedy edit wants the 301 number
    // specifically (chapter note ii). Same 301→NT52→substantive stack as 089.
    rates: {
      '99038815': 'The duty provided in the applicable subheading + 7.5%',
      '99030531': NT52_125,
      '2711120010': 'Free',
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.descriptions = ['PROPANE, LIQUEFIED'];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [
        { htsNumber: '99038815', valueDollars: 0 }, // 301 List 4A 7.5%
        { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
        { htsNumber: '2711120010', valueDollars: 30323, uomCode1: 'M3', quantity1Hundredths: 5078 },
      ];
      // Override code 49 = parameter change requested (package bonus info).
      // The condition code being overridden arrives on the AX census warning
      // at cert time; the dry-run pins a placeholder.
      line.censusOverrides = [{ conditionCode: '27D', overrideCode: '49' }];
    },
    notes: 'Census condition code comes from the live AX warning during cert; 27D = live CERT warning for this line (W27D OR-HI VAL/QTY, seen 8/25).',
  }),

  appScenario('006', 'Census Warning Override \u2014 standalone transmission', 'CW', (params) =>
    buildCensusOverride({
      filerCode: params.filerCode,
      entries: [
        {
          // The scenario-006 AE entry (8415.82.01.20, \$145,682, qty 1 NO) is
          // filed first; once the AX census warning returns, this standalone
          // CW resolves it. Warning code is a dry-run placeholder \u2014 the
          // cert run copies it from the live AX response.
          entryNumber: '0000006',
          lines: [{ lineItemIdentifier: '001', overrides: [{ warningCode: '27D', overrideCode: '49' }] }],
        },
      ],
    })
  , 'AE half filed separately at cert; warning code from the live AX response (27D = live CERT warning for this line (W27D OR-HI VAL/QTY, seen 8/25)).'),

  aeScenario('009', 'Quota Informal', {
    rates: {
      '99030581': NT52_100,
      '1806901500': { general: '3.5%', special: 'Free (A*,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' },
    },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '12';
      // Quota requires certification for cargo release (package note).
      p.entrySummary.cargoReleaseCertification = true;
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'GB';
      line.countryOfExport = 'GB';
      line.relatedPartyIndicator = undefined;
      line.descriptions = ['CHOCOLATE CONFECTIONERY, QUOTA'];
      line.foreignPortOfLading = '41323'; // Felixstowe (Schedule K)
      line.parties = [];
      line.tariffs = [
        { htsNumber: '99030581', valueDollars: 0 }, // NT52 GB 10%
        {
          htsNumber: '1806901500',
          valueDollars: 30,
          uomCode1: 'KG',
          quantity1Hundredths: 500,
          uomCode2: 'CKG',
          quantity2Hundredths: 131,
        },
      ];
    },
    notes: 'FDA data for this HTS rides the PG-record message set (workstream D pending) \u2014 note for the rep.',
  }),

  aeScenario('007', 'MOT/Port of Unlading', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    mutate: (p, params) => {
      const line = p.entrySummary.lines[0];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K; export country CN)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
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
      '99030564': NT52_125,
      '3802100020': { general: '4.8%', special: 'Free (A*,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' },
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'PH';
      line.countryOfExport = 'PH';
      line.spiClaimCode = 'A';
      line.descriptions = ['ACTIVATED CARBON'];
      line.foreignPortOfLading = '56549'; // Manila (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'PHMANCAR789MNL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030564', valueDollars: 0 }, // NT52 PH 12.5%
        { htsNumber: '3802100020', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 20000 },
      ];
    },
  }),

  aeRejectScenario('010', 'In-Transit Date Validation', {
    rates: { '8507600030': '3.41%' },
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
    rates: { '8507600030': '3.41%' },
    mutate: (p) => {
      // Type 86 (Section 321) is not a valid AE entry type — AE Table 2.
      p.entrySummary.entryTypeCode = '86';
    },
    notes: 'Intentionally invalid: type 86 must be rejected client-side (AE Table 2).',
  }),

  aeScenario('017', 'Replacement of an Entry Summary', {
    rates: { '99030581': NT52_100, '9014805000': 'Free' },
    action: 'R',
    mutate: (p) => {
      // Step-2 replacement data from the package.
      p.entrySummary.brokerReferenceNumber = '020REPLCE';
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'GB';
      line.countryOfExport = 'GB';
      line.descriptions = ['NAVIGATIONAL INSTRUMENTS'];
      line.foreignPortOfLading = '41323'; // Felixstowe (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'GBLONNAV321LON' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030581', valueDollars: 0 }, // NT52 GB 10%
        { htsNumber: '9014805000', valueDollars: 53000, uomCode1: 'NO', quantity1Hundredths: 100 },
      ];
    },
    notes: 'Step 1 (original acceptance) is the live-cert half; this fixture is the step-2 Replace transmission.',
  }),

  aeScenario('011', 'Estimated Date of Arrival Validation', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    mutate: (p, params) => {
      const line = p.entrySummary.lines[0];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
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
    rates: { '99030555': NT52_100, '7208900000': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'MX';
      line.countryOfExport = 'MX';
      line.descriptions = ['FLAT-ROLLED STEEL PRODUCTS'];
      line.foreignPortOfLading = '20199'; // Veracruz (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'MXMTYSTL654MTY' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030555', valueDollars: 0 }, // NT52 MX 10%
        { htsNumber: '7208900000', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 500000 },
      ];
      // Steel product exclusion rides the 54-Record Importer Additional
      // Declaration, type 02 (chapter change log #76 documents STXnnnnnn /
      // STL… identifier formats).
      line.declarations = [{ typeCode: '02', information: 'STL999995' }];
    },
  }),

  aeScenario('013', 'Diamond Certificate', {
    rates: { '99030523': NT52_125, '7102211020': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'AU';
      line.countryOfExport = 'AU';
      line.descriptions = ['UNWORKED INDUSTRIAL DIAMONDS'];
      line.foreignPortOfLading = '60267'; // Sydney (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'AUPERDIA987PER' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030523', valueDollars: 0 }, // NT52 AU 12.5%
        { htsNumber: '7102211020', valueDollars: 10000, uomCode1: 'CAR', quantity1Hundredths: 25000 },
      ];
      // 52-Record type 06 = Diamond Certificate (Kimberley process, ESF-167;
      // OFAC-format number ≤9 chars — Admin Message 04-002229).
      line.license = { typeCode: '06', number: 'AU0863015' };
    },
  }),

  aeScenario('014', 'Airline Carrier Code', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    mutate: (p) => {
      // Air MOT: no foreign port of lading (F429 is vessel-only).
      const line = p.entrySummary.lines[0];
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
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
      '99030530': NT52_125,
      '0811908040': { general: '14.5%', special: 'Free (A+,AU,BH,CL,CO,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' },
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CL';
      line.countryOfExport = 'CL';
      line.spiClaimCode = 'CL';
      line.descriptions = ['FROZEN BERRIES'];
      line.foreignPortOfLading = '33797'; // Valparaiso (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'CLSCLBER246SCL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030530', valueDollars: 0 }, // NT52 CL 12.5%
        { htsNumber: '0811908040', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 400000 },
      ];
    },
  }),

  aeScenario('019', 'Sets under GRI 3(b)/(c) — X & V Article Set Indicators', {
    // Export country CH is landlocked — no Schedule K seaport exists, so the
    // foreign port of lading stays unset (flagged for the client rep).
    rates: {
      '99030574': NT52_125, // NT52 CH
      '99030539': NT52_100, // NT52 EU (FR/IT lines)
      '1902194000': '6.4%', '0712311000': '1.3¢/kg + 1.8%', '2002908020': '11.6%',
    },
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
            { htsNumber: '99030574', valueDollars: 0 }, // NT52 CH 12.5%
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
            { htsNumber: '99030539', valueDollars: 0 }, // NT52 EU 10% (FR origin)
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
            { htsNumber: '99030539', valueDollars: 0 }, // NT52 EU 10% (IT origin)
            { htsNumber: '2002908020', valueDollars: 1300, uomCode1: 'KG', quantity1Hundredths: 30000, dutyCents: 8320 },
          ],
        },
      ];
    },
    notes: 'Set-rate duties pinned (engine article-set aggregation deferred): all components at the 6.4% essential-character rate.',
  }),

  aeScenario('020', 'Census Warning', {
    rates: { '99030530': NT52_125, '4703110000': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CL';
      line.countryOfExport = 'CL';
      line.chargesDollars = 17810;
      line.grossWeightKg = 245939;
      line.descriptions = ['CHEMICAL WOODPULP, UNBLEACHED'];
      line.foreignPortOfLading = '33797'; // Valparaiso (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'CLSCLPUL802SCL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // The absurd quantity/UOM pairing is the census-warning trigger; the
      // transmission itself is valid and must go out (ACE responds with the
      // warning that scenarios 021/022 then query and override).
      line.tariffs = [
        { htsNumber: '99030530', valueDollars: 0 }, // NT52 CL 12.5%
        { htsNumber: '4703110000', valueDollars: 2054587, uomCode1: 'CTN', quantity1Hundredths: 2455580000 },
      ];
    },
  }),

  appScenario('021', 'Census Warning Query', 'CJ', (params) =>
    buildCensusWarningQuery({
      filerCode: params.filerCode,
      queries: [{ districtPortOfEntry: params.districtPortOfEntry, entryNumbers: ['0000020'] }],
    })
  , 'Queries the census warning raised by the scenario-020 entry; run before 022.'),

  appScenario('022', 'Census Warning Override', 'CW', (params) =>
    buildCensusOverride({
      filerCode: params.filerCode,
      entries: [
        {
          entryNumber: '0000020',
          lines: [{ lineItemIdentifier: '001', overrides: [{ warningCode: '27D', overrideCode: '49' }] }],
        },
      ],
    })
  , 'Overrides the warning surfaced by 020/021; warning code comes from the live CL response (27D placeholder pending that query).'),

  aeScenario('023', 'Steel License', {
    rates: { '99030571': NT52_125, '7222110006': 'Free' },
    mutate: (p, params) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'KR';
      line.countryOfExport = 'KR';
      line.descriptions = ['STAINLESS STEEL BARS'];
      line.foreignPortOfLading = '58023'; // Busan (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'KRSELSTE579SEL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030571', valueDollars: 0 }, // NT52 KR 12.5%
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
    rates: { '99034110': '40%', '99030549': NT52_125, '6403599045': '10%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'JP';
      line.countryOfExport = 'JP';
      line.descriptions = ['LEATHER FOOTWEAR'];
      line.foreignPortOfLading = '58886'; // Tokyo (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'JPTYOSHO913TYO' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // 9903.41.10 additional duty rides first; the value/quantity report on
      // the ch.64 base line and the 40% computes on that base value.
      line.tariffs = [
        { htsNumber: '99034110', valueDollars: 0, uomCode1: 'X' },
        { htsNumber: '99030549', valueDollars: 0 }, // NT52 JP 12.5%
        { htsNumber: '6403599045', valueDollars: 12290, uomCode1: 'PRS', quantity1Hundredths: 260000 },
      ];
    },
  }),

  aeScenario('025', 'Full Bill Data for Rail AMS Shipment', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    mutate: (p) => {
      // Rail MOT: no foreign port of lading (F429 is vessel-only).
      const line = p.entrySummary.lines[0];
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
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

  aeScenario('027', 'USMCA Apparel (TRQ)', {
    // NT52: XQ = Mexico TPL origin ⇒ the USMCA-qualifying subdivision (H)
    // row 9903.05.94 at 0% (mirrors the US-goods 9903.05.86 treatment) —
    // NEEDS LIVE VERIFICATION: the duty-bearing MX row 9903.05.55 (10%)
    // would apply if CERT refuses the subdivision claim.
    rates: { '99030594': 'Free', '98235202': 'Free', '6203315020': '17.5%' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '02';
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'XQ';
      line.countryOfExport = 'MX';
      line.foreignPortOfLading = '20199'; // Veracruz (Schedule K)
      // S+ (USMCA textile TPL) is claimed against the 9823.52.02 TRQ
      // provision; in-quota preferential rate pinned to Free (the Special
      // column prints S, not S+).
      line.spiClaimCode = 'S+';
      line.descriptions = ['MENS WOOL TROUSERS'];
      line.parties = [
        { type: 'M', identifier: 'MXMEXAPP159MEX' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '98235202', valueDollars: 0, uomCode1: 'X' },
        { htsNumber: '99030594', valueDollars: 0 }, // NT52 USMCA-MX subdivision (H), 0%
        { htsNumber: '6203315020', valueDollars: 2500, uomCode1: 'DOZ', quantity1Hundredths: 2000, dutyCents: 0 },
      ];
      line.textileCategoryCode = '447';
    },
    notes: 'Package: UC response arrives only after end-of-day TRQ processing (~8pm). XQ = Canada/Mexico TPL origin convention.',
  }),

  aeScenario('028', 'State of Destination with Multiple Lines', {
    rates: {
      '99030531': NT52_125,
      '1205100090': { general: '0.58¢/kg', special: 'Free (A+,AU,BH,CL,CO,D,E, IL,JO,KR,MA,OM,P,PA,PE,S, SG)' },
      '3306900000': 'Free',
      '3702100060': { general: '3.7%', special: 'Free (A*,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' },
    },
    mutate: (p) => {
      const ior = p.entrySummary.importerOfRecord.number;
      // Wire carries ONE header state: with multiple destination states the
      // 7501 block-5 rule reports the state of greatest aggregate value —
      // line 3 (WA, $15,000).
      p.entrySummary.usStateOfDestination = 'WA';
      const base = p.entrySummary.lines[0];
      p.entrySummary.lines = [
        {
          ...base,
          descriptions: ['RAPESEED, LOW ERUCIC ACID'],
          parties: [{ type: 'M', identifier: 'CNSHERAP321SHA' }, { type: 'S', identifier: ior }],
          tariffs: [{ htsNumber: '1205100090', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 100000000 }],
        },
        {
          ...base,
          descriptions: ['ORAL HYGIENE PREPARATIONS'],
          parties: [{ type: 'M', identifier: 'CNSHEORA654SHA' }, { type: 'S', identifier: ior }],
          tariffs: [{ htsNumber: '3306900000', valueDollars: 5000, uomCode1: 'NO', quantity1Hundredths: 100000 }],
        },
        {
          ...base,
          descriptions: ['INSTANT PRINT FILM'],
          parties: [{ type: 'M', identifier: 'CNSHEFLM987SHA' }, { type: 'S', identifier: ior }],
          tariffs: [{ htsNumber: '3702100060', valueDollars: 15000, uomCode1: 'NO', quantity1Hundredths: 200000 }],
        },
      ];
      for (const l of p.entrySummary.lines) {
        l.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
        l.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...l.tariffs]; // NT52 CN 12.5%
      }
    },
    notes: 'Source data: line states MT/NY/WA — header reports WA (greatest aggregate value, 7501 block 5).',
  }),

  aeScenario('029', 'Charges Amount', {
    rates: { '99030581': NT52_100, '3001900110': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'GB';
      line.countryOfExport = 'GB';
      line.chargesDollars = 200;
      line.descriptions = ['HEPARIN AND ITS SALTS'];
      line.foreignPortOfLading = '41323'; // Felixstowe (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'GBLONHEP531LON' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030581', valueDollars: 0 }, // NT52 GB 10%
        { htsNumber: '3001900110', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 10000 },
      ];
    },
  }),

  aeScenario('030', 'HTS Number/Date Restriction', {
    rates: { '99030530': NT52_125, '0809402000': 'Free' },
    mutate: (p, params) => {
      const cy = params.currentYear;
      // Package: importation + estimated entry = current date. 0809.40.20
      // (fresh apricots) is valid for entry only Jan 1 – May 31; ACE
      // enforces the date window server-side at cert time.
      p.entrySummary.dates = { estimatedEntry: `${cy}0820`, importation: `${cy}0820`, estimatedArrival: `${cy}0819` };
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CL';
      line.countryOfExport = 'CL';
      line.dateOfExportation = `${cy}0801`;
      line.descriptions = ['APRICOTS, FRESH'];
      line.foreignPortOfLading = '33797'; // Valparaiso (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'CLSCLAPR864SCL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030530', valueDollars: 0 }, // NT52 CL 12.5%
        { htsNumber: '0809402000', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 500000 },
      ];
    },
    notes: 'ACE enforces the Jan 1 – May 31 entry-date window for this HTS; at cert time the rep confirms expected disposition for an out-of-window date.',
  }),

  aeRejectScenario('031', 'Restricted Country', {
    rates: { '6402191541': '5.1%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      // Cuba origin: comprehensively embargoed (31 CFR 515) — our system
      // must refuse the transmission client-side.
      line.countryOfOrigin = 'CU';
      line.countryOfExport = 'MX';
      line.descriptions = ['SPORTS FOOTWEAR'];
      line.tariffs = [
        { htsNumber: '6402191541', valueDollars: 10000, uomCode1: 'PRS', quantity1Hundredths: 100000 },
      ];
    },
    notes: 'Intentionally invalid: embargoed country of origin (OFAC).',
  }),

  aeScenario('032', 'Knife Sets', {
    rates: {
      '99030539': NT52_100, // NT52 EU (DE)
      '8211100000': 'Free', // set provision: rate is the highest-rate article's — components pinned below
      '8211929045': '0.4¢ each + 6.1%',
      '8211930035': '3¢ each + 5.4%',
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'DE';
      line.countryOfExport = 'DE';
      line.descriptions = ['KNIFE SETS, 5-PIECE'];
      line.foreignPortOfLading = '42876'; // Hamburg (Schedule K, Apr 2026 revision)
      line.parties = [
        { type: 'M', identifier: 'DESOLKNI275SOL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // 4,000 sets: 16,000 knives @ $1 (8211.92.90) + 4,000 @ $2
      // (8211.93.00). The 8211.10 set provision duties the WHOLE set at the
      // highest-rate article's rate — 8211.93 (3¢ each + 5.4% ≈ 6.9% AVE
      // beats 8211.92's ≈ 6.5%). That rate applied per component:
      //   8211.92: 5.4%×$16,000 + 3¢×16,000 pcs = $864.00+$480.00 = $1,344.00
      //   8211.93: 5.4%×$8,000  + 3¢×4,000 pcs  = $432.00+$120.00 =   $552.00
      line.tariffs = [
        { htsNumber: '99030539', valueDollars: 0 }, // NT52 EU 10%
        { htsNumber: '8211100000', valueDollars: 0, uomCode1: 'X', dutyCents: 0 },
        { htsNumber: '8211929045', valueDollars: 16000, uomCode1: 'NO', quantity1Hundredths: 1600000, dutyCents: 134400 },
        { htsNumber: '8211930035', valueDollars: 8000, uomCode1: 'NO', quantity1Hundredths: 400000, dutyCents: 55200 },
      ];
    },
    notes: 'Set duty pinned at the highest-rate article (8211.93.00: 3¢ each + 5.4%) applied to each component — confirm interpretation with client rep.',
  }),

  aeScenario('033', 'Multiple Bonds', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
      // Continuous basic + additional STB (allowable configuration 3,
      // ESF-157), surety 054 per the package.
      p.entrySummary.bonds = [
        { bondTypeCode: '8', designationTypeCode: 'B', suretyCompanyCode: '054' },
        { bondTypeCode: '9', designationTypeCode: 'A', suretyCompanyCode: '054', stbAmountDollars: 25000 },
      ];
    },
  }),

  aeScenario('034', 'Personal Shipment', {
    rates: { '99030543': NT52_125, '7419803000': '3%' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '11';
      p.entrySummary.indicators = { ...p.entrySummary.indicators, shipmentUsageTypeCode: 'P' };
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'HK';
      line.countryOfExport = 'HK';
      line.relatedPartyIndicator = undefined;
      line.descriptions = ['COPPER HOUSEHOLD ARTICLES'];
      line.foreignPortOfLading = '58201'; // Hong Kong (Schedule K)
      line.parties = [];
      line.tariffs = [
        { htsNumber: '99030543', valueDollars: 0 }, // NT52 HK 12.5%
        { htsNumber: '7419803000', valueDollars: 3000, uomCode1: 'NO', quantity1Hundredths: 5000 },
      ];
    },
  }),

  aeScenario('035', 'Civil Aircraft', {
    rates: {
      '8302496055': { general: '5.7%', special: 'Free (A*,AU,BH,C,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' },
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'GL';
      line.countryOfExport = 'GL';
      line.spiClaimCode = 'C'; // Agreement on Trade in Civil Aircraft
      line.descriptions = ['CIVIL AIRCRAFT MOUNTINGS AND FITTINGS'];
      line.parties = [
        { type: 'M', identifier: 'GLGOHAIR428GOH' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '8302496055', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 10000 },
      ];
    },
  }),

  aeScenario('036', 'Commercial Samples', {
    rates: { '99030549': NT52_125, '6205202016': '19.7%' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '11';
      p.entrySummary.indicators = { ...p.entrySummary.indicators, shipmentUsageTypeCode: 'X' };
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'JP';
      line.countryOfExport = 'JP';
      line.relatedPartyIndicator = undefined;
      line.descriptions = ['MENS COTTON SHIRTS - SAMPLES'];
      line.foreignPortOfLading = '58886'; // Tokyo (Schedule K)
      line.parties = [];
      line.tariffs = [
        { htsNumber: '99030549', valueDollars: 0 }, // NT52 JP 12.5%
        { htsNumber: '6205202016', valueDollars: 225, uomCode1: 'DOZ', quantity1Hundredths: 200 },
      ];
      line.textileCategoryCode = '340';
    },
  }),

  aeScenario('037', 'Watches', {
    // 9101.11.80 (USITC 2026-aug-06): 87¢ each + 6.25% on the case and
    // strap, band or bracelet + 5.3% on the battery. One line, one
    // 50-record per constituent tariff; the package's complete-watch
    // quantity (59,600) is reported on EVERY tariff number, values as
    // given. Compound constituent rates are outside the parser (cf. 041/
    // 089), so the duties are pinned per constituent:
    //   .8010 movements: 87¢ × 59,600      = $51,852.00
    //   .8020 cases:     6.25% × $601,690  = $37,605.63
    //   .8030 straps:    6.25% × $790,840  = $49,427.50
    //   .8040 batteries: 5.3%  × $500,612  = $26,532.44
    // NT52 CH 9903.05.74 (12.5%) computes on the combined constituent value
    // ($3,383,342). Export CH is landlocked — no Schedule K port; the
    // foreign port of lading stays unset (flagged for the client rep).
    rates: { '99030574': NT52_125 },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CH';
      line.countryOfExport = 'CH';
      line.descriptions = ['WRIST WATCHES, PRECIOUS METAL CASE, MECHANICAL DISPLAY'];
      line.parties = [
        { type: 'M', identifier: 'CHGENWAT552GEN' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030574', valueDollars: 0 }, // NT52 CH 12.5%
        { htsNumber: '9101118010', valueDollars: 1490200, uomCode1: 'NO', quantity1Hundredths: 5960000, dutyCents: 5185200 },
        { htsNumber: '9101118020', valueDollars: 601690, uomCode1: 'NO', quantity1Hundredths: 5960000, dutyCents: 3760563 },
        { htsNumber: '9101118030', valueDollars: 790840, uomCode1: 'NO', quantity1Hundredths: 5960000, dutyCents: 4942750 },
        { htsNumber: '9101118040', valueDollars: 500612, uomCode1: 'NO', quantity1Hundredths: 5960000, dutyCents: 2653244 },
      ];
    },
    notes: 'Constituent duties pinned from the 9101.11.80 compound rate (USITC 2026-aug-06); suffix↔constituent mapping per CSMS #50019756 — confirm with rep. Origin CH assumed (package silent).',
  }),

  aeScenario('038', 'Morocco Free Trade Agreement', {
    rates: {
      '99030556': NT52_125,
      '4203300000': { general: '2.7%', special: 'Free (A,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' },
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'MA';
      line.countryOfExport = 'MA';
      line.spiClaimCode = 'MA';
      line.descriptions = ['LEATHER BELTS'];
      line.foreignPortOfLading = '71401'; // Casablanca (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'MACASBEL713CAS' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030556', valueDollars: 0 }, // NT52 MA 12.5%
        { htsNumber: '4203300000', valueDollars: 10000, uomCode1: 'DOZ', quantity1Hundredths: 5000 },
      ];
    },
  }),

  aeScenario('039', 'Quantity and Unit of Measure Reporting on GRI (1) Sets', {
    // 8206.00.00 (GRI 1 set heading): 'The rate of duty applicable to that
    // article in the set subject to the highest rate of duty' — here the
    // only listed component, slip joint pliers 8203.20.40 (12%, USITC
    // 2026-aug-06). One line, set provision + component on separate
    // 50-records. The title's point is the quantity/UOM pairing: the set
    // provision reports the number of SETS (PCS, its USITC stat unit),
    // the component its own unit (DOZ). Package gives no values —
    // standing $10,000 rides the dutiable component; 600 one-pliers sets
    // = 50 dozen pliers. Component duty engine-computed (12% × $10,000 =
    // $1,200.00); set-provision line pinned $0.
    rates: { '99030531': NT52_125, '8203204000': '12%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.descriptions = ['HAND TOOL SETS, PLIERS COMPONENT HIGHEST-RATE'];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'CNSHETOO654SHA' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // NT52 first: 8206 is the substantive set heading, not a 98/99 marker.
      line.tariffs = [
        { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
        { htsNumber: '8206000000', valueDollars: 0, uomCode1: 'PCS', quantity1Hundredths: 60000, dutyCents: 0 },
        { htsNumber: '8203204000', valueDollars: 10000, uomCode1: 'DOZ', quantity1Hundredths: 5000 },
      ];
    },
    notes: 'Set duty at the highest-rate component (8203.20.40, 12%) — the only component the package lists. Value on the component line, set quantity in PCS — confirm value placement with rep.',
  }),

  aeScenario('040', 'U.S. Insular Possession', {
    rates: { '7101223000': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'GU';
      line.countryOfExport = 'GU';
      // SPI Y (insular possessions, general note 3(a)(iv)) — statutory.
      line.spiClaimCode = 'Y';
      line.descriptions = ['CULTURED PEARLS, WORKED'];
      line.parties = [
        { type: 'M', identifier: 'GUHAGPEA842HAG' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '7101223000', valueDollars: 10000, uomCode1: 'GM', quantity1Hundredths: 100000 },
      ];
    },
  }),

  aeScenario('041', 'Mail MOT', {
    rates: { '99030531': NT52_125, '9106100000': '36\u00a2 each + 5.6% + 2\u00a2/jewel' },
    mutate: (p) => {
      p.entrySummary.motCode = '50';
      // Mail: no carrier/manifest data.
      p.entrySummary.cargo = undefined;
      p.entrySummary.manifests = undefined;
      const line = p.entrySummary.lines[0];
      line.descriptions = ['TIME REGISTERS'];
      // Compound watch-style rate pinned by hand (the '\u00a2 each'/'\u00a2 per
      // jewel' forms are outside the parser; no jewels on time registers):
      // 36\u00a2\u00d7120 = $43.20 + 5.6%\u00d7$1,189 = $66.584 \u2192 $109.78 total.
      // Mail MOT: no foreign port of lading (F429 is vessel-only).
      line.tariffs = [
        { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
        { htsNumber: '9106100000', valueDollars: 1189, uomCode1: 'NO', quantity1Hundredths: 12000, dutyCents: 10978 },
      ];
    },
    notes: 'MOT 50 + duty due triggers the 496 dutiable-mail fee automatically (engine). Rate pinned: 36\u00a2 each + 5.6% (no jewels).',
  }),

  aeScenario('042', 'Country of Export - US', {
    // Export country US: Schedule K lists FOREIGN ports only — the foreign
    // port of lading stays unset (flagged for the client rep).
    rates: { '99030571': NT52_125, '6704190000': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'KR';
      line.countryOfExport = 'US'; // U.S. goods returned via export country US
      line.descriptions = ['WIGS OF SYNTHETIC TEXTILE MATERIALS'];
      line.parties = [
        { type: 'M', identifier: 'KRSELWIG217SEL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030571', valueDollars: 0 }, // NT52 KR (origin) 12.5%
        { htsNumber: '6704190000', valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 100000 },
      ];
    },
  }),

  aeScenario('043', 'ADD/CVD & Quota', {
    rates: {
      // 9903.85.37 (Sec 232 aluminum): overlay wording pinned — confirm the
      // exact provision text with the client rep at cert time.
      '99038537': 'The duty provided in the applicable subheading + 25%',
      '99030539': NT52_100, // NT52 EU (ES)
      '7606123096': '3%',
    },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '07';
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'ES';
      line.countryOfExport = 'ES';
      line.descriptions = ['ALUMINUM ALLOY SHEET'];
      line.foreignPortOfLading = '47094'; // Valencia (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'ESMADALU365MAD' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99038537', valueDollars: 0, uomCode1: 'X' },
        { htsNumber: '99030539', valueDollars: 0 }, // NT52 EU 10%
        { htsNumber: '7606123096', valueDollars: 68707, uomCode1: 'KG', quantity1Hundredths: 2192600 },
      ];
      // AD deposit rate comes from the AD case query at cert time (scenario
      // 063); dry-run pins a zero deposit.
      line.adCvdCases = [
        { caseNumber: 'A470820000', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'A', dutyCents: 0 },
      ];
    },
    notes: 'AD deposit rate arrives from the AD query (scenario 063) at cert; pinned 0 for the dry run.',
  }),

  aeScenario('044', 'Special Program Claim Code W', {
    rates: { '0210992000': { general: '2.3%', special: 'Free (A,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' } },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'VC';
      line.countryOfExport = 'VC';
      // SPI W (CBERA beneficiary meat provision) is statutory — not printed
      // in the Special column; preference pinned to Free.
      line.spiClaimCode = 'W';
      line.descriptions = ['DRIED MEAT PRODUCTS'];
      line.parties = [
        { type: 'M', identifier: 'VCKINMEA754KIN' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '0210992000', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 1000500, dutyCents: 0 },
      ];
    },
    notes: 'SPI W statutory, duty pinned to Free \u2014 confirm program letter treatment with client rep.',
  }),

  aeScenario('045', 'Currency Conversion', {
    rates: { '99030539': NT52_100, '3103190000': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'IT';
      line.countryOfExport = 'IT';
      line.descriptions = ['SUPERPHOSPHATE FERTILIZERS'];
      line.foreignPortOfLading = '47527'; // Genoa (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'ITMILFER426MIL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // \u20ac5,000 converted at the CBP-certified quarterly rate; dry-run pins
      // 1.08 USD/EUR \u2192 $5,400 (cert run uses the actual quarterly rate).
      line.tariffs = [
        { htsNumber: '99030539', valueDollars: 0 }, // NT52 EU 10% (IT)
        { htsNumber: '3103190000', valueDollars: 5400, uomCode1: 'T', quantity1Hundredths: 10000 },
      ];
    },
    notes: 'Foreign-currency value: \u20ac5,000 \u00d7 CBP quarterly rate. Dry-run pinned at 1.08; substitute the certified rate at cert time.',
  }),

  aeScenario('046', 'Multiple Countries', {
    rates: { '99030576': NT52_100, '99030571': NT52_125, '3103110000': 'Free' },
    mutate: (p) => {
      const ior = p.entrySummary.importerOfRecord.number;
      const base = p.entrySummary.lines[0];
      p.entrySummary.lines = [
        {
          ...base,
          countryOfOrigin: 'TW',
          countryOfExport: 'TW',
          descriptions: ['SUPERPHOSPHATES 35%+ P2O5'],
          foreignPortOfLading: '58309', // Kaohsiung (Schedule K)
          parties: [{ type: 'M', identifier: 'TWTPEFER538TPE' }, { type: 'S', identifier: ior }],
          tariffs: [
            { htsNumber: '99030576', valueDollars: 0 }, // NT52 TW 10%
            { htsNumber: '3103110000', valueDollars: 10000, uomCode1: 'T', quantity1Hundredths: 1000 },
          ],
        },
        {
          ...base,
          countryOfOrigin: 'KR',
          countryOfExport: 'KR',
          descriptions: ['SUPERPHOSPHATES 35%+ P2O5'],
          foreignPortOfLading: '58023', // Busan (Schedule K)
          parties: [{ type: 'M', identifier: 'KRSELFER649SEL' }, { type: 'S', identifier: ior }],
          tariffs: [
            { htsNumber: '99030571', valueDollars: 0 }, // NT52 KR 12.5%
            { htsNumber: '3103110000', valueDollars: 10000, uomCode1: 'T', quantity1Hundredths: 1000 },
          ],
        },
      ];
    },
  }),

  aeScenario('047', 'Warehouse Entry', {
    rates: { '99030531': NT52_125, '6601990000': '8.2%' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '21';
      const line = p.entrySummary.lines[0];
      line.descriptions = ['UMBRELLAS'];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [
        { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
        { htsNumber: '6601990000', valueDollars: 50000, uomCode1: 'DOZ', quantity1Hundredths: 120000 },
      ];
    },
  }),

  aeScenario('048', 'Watch Assemblies', {
    // 9802.00.40 'Repairs or alterations made pursuant to a warranty':
    // 'A duty upon the value of the repairs or alterations (see U.S. note
    // 3 of this subchapter)' (USITC 2026-aug-06). The dutiable value is
    // the $3,406 repair value, reported on the 9802.00.4040 50-record;
    // the 9102.11.10 constituent values ($1,852/$2,619/$1,345/$204) ride
    // duty-free, quantity 1,000 on ALL tariff numbers per the package.
    // Article rate (9102.11.10): 44¢ each + 6% on the case + 14% on the
    // strap, band or bracelet + 5.3% on the battery. Repairs touched only
    // the movements, whose constituent piece is the specific 44¢ each:
    //   44¢ × 1,000 watches = $440.00 (pinned).
    // NT52 CH (origin) rides after the 9802 provision marker; it computes on
    // the combined value of the other tariffs ($9,426) — whether NT52 should
    // instead apply only to the repair value under 9802 needs rep
    // confirmation (flagged).
    rates: { '99030574': NT52_125 },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CH';
      line.countryOfExport = 'GL';
      line.descriptions = ['WRIST WATCHES REPAIRED IN GREENLAND, MOVEMENTS ONLY'];
      line.foreignPortOfLading = '10125'; // Godthaab/Nuuk, Greenland (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'GLGOHWAT219GOH' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '9802004040', valueDollars: 3406, uomCode1: 'NO', quantity1Hundredths: 100000, dutyCents: 44000 },
        { htsNumber: '99030574', valueDollars: 0 }, // NT52 CH 12.5%
        { htsNumber: '9102111010', valueDollars: 1852, uomCode1: 'NO', quantity1Hundredths: 100000, dutyCents: 0 },
        { htsNumber: '9102111020', valueDollars: 2619, uomCode1: 'NO', quantity1Hundredths: 100000, dutyCents: 0 },
        { htsNumber: '9102111030', valueDollars: 1345, uomCode1: 'NO', quantity1Hundredths: 100000, dutyCents: 0 },
        { htsNumber: '9102111040', valueDollars: 204, uomCode1: 'NO', quantity1Hundredths: 100000, dutyCents: 0 },
      ];
    },
    notes: 'Repair-provision duty pinned: 44¢ each × 1,000 on the $3,406 repair value (movements constituent of 9102.11.10) — treatment of the specific piece under 9802 needs rep confirmation. Origin CH assumed (package silent); export country GL.',
  }),

  aeScenario('049', 'Ruling Details', {
    rates: { '99030549': NT52_125, '8536490055': '2.7%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'JP';
      line.countryOfExport = 'JP';
      line.descriptions = ['ELECTROMECHANICAL RELAYS'];
      line.foreignPortOfLading = '58886'; // Tokyo (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'JPMATELE288OSA' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.ruling = { typeCode: 'C', number: '832264' };
      line.tariffs = [
        { htsNumber: '99030549', valueDollars: 0 }, // NT52 JP 12.5%
        { htsNumber: '8536490055', valueDollars: 17100, uomCode1: 'NO', quantity1Hundredths: 900000 },
      ];
    },
    notes: 'PGA disclaimer FC0 rides the PG-record message set (workstream D \u2014 spec download pending); dry-run transmits the ruling core without the PG grouping.',
  }),

  appScenario('050', 'Entry Summary Query', 'EQ', (params) => {
    // Package: EES criteria, from 30 days prior to today \u2014 derived from the
    // applicability date so dry-run goldens stay stable.
    const cy = params.currentYear.slice(2);
    return buildEntrySummaryQuery({
      returnDetail: true,
      criteria: {
        type: 'EES',
        fromDateTime: `0721${cy}120000AM`,
        toDateTime: `0820${cy}115959PM`,
        entrySummaries: true,
      },
    });
  }),

  aeScenario('051', 'African Growth and Opportunity Act (AGOA)', {
    rates: {
      '99030569': NT52_125,
      '4113903000': { general: '3.3%', special: 'Free (A+,AU,BH,CL,CO,D,E,IL, JO,KR,MA, OM,P,PA,PE,S,SG)' },
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'ZA';
      line.countryOfExport = 'ZA';
      line.spiClaimCode = 'D'; // AGOA
      line.descriptions = ['LEATHER OF GOATS, WITHOUT HAIR'];
      line.foreignPortOfLading = '79113'; // Durban (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'ZAJNBLEA318JNB' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030569', valueDollars: 0 }, // NT52 ZA 12.5%
        { htsNumber: '4113903000', valueDollars: 10000, uomCode1: 'M2', quantity1Hundredths: 50000 },
      ];
    },
  }),

  aeScenario('052', 'B-Record Filer Authentication', {
    rates: { '8507600030': '3.41%' },
    // The package overrides ONLY the block-control fields; the enclosed
    // 10–90 records stay a fully valid summary. The entry number therefore
    // keeps our REAL filer code (params.filerCode → 10-record) — the
    // reject ACE returns must come from B-record filer/port
    // authentication, not from the entry data. The Y-record mirrors the
    // B-record per the batch spec, so it carries 888/8888 too.
    block: { port: '8888', filerCode: '888' },
    mutate: () => {},
    notes: 'CBP-side reject test: ACE must refuse the block on B-record authentication (filer 888, port 8888); the transmission itself goes out intact with valid 10–90 records.',
  }),

  aeScenario('053', 'B-Record Application Type/Filer Authentication', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    // Fully valid block: B-record carries our own filer code and
    // application identifier AE (what buildBatch always emits) — the
    // scenario verifies the positive half of B-record authentication.
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
    },
    notes: 'Package instruction: contact the assigned client rep IMMEDIATELY PRIOR to transmitting this scenario. Standard envelope — B-record filer = our filer code, application identifier AE.',
  }),

  aeScenario('054', 'Korea Free Trade Agreement', {
    rates: {
      '99030571': NT52_125,
      '4409106500': { general: '4.9%', special: 'Free (A+,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)' },
    },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'KR';
      line.countryOfExport = 'KR';
      line.spiClaimCode = 'KR';
      line.descriptions = ['CONIFEROUS WOOD MOLDINGS'];
      line.foreignPortOfLading = '58023'; // Busan (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'KRSELWOO471SEL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030571', valueDollars: 0 }, // NT52 KR 12.5%
        { htsNumber: '4409106500', valueDollars: 10000, uomCode1: 'M3', quantity1Hundredths: 4000 },
      ];
    },
  }),

  aeScenario('055', 'Haiti Earned Import Allowance Program', {
    rates: { '98206225': 'Free', '6109901007': '32%' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '02';
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'HT';
      line.countryOfExport = 'HT';
      line.descriptions = ['KNIT T-SHIRTS, MAN-MADE FIBERS'];
      line.parties = [
        { type: 'M', identifier: 'HTPAPTEX593PAP' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // 9820.62.25 Haiti EIAP provision + apparel line; in-program = Free
      // (pinned). 52-Record type 13 = Haiti Earned Import Allowance.
      line.tariffs = [
        { htsNumber: '98206225', valueDollars: 0, uomCode1: 'X' },
        { htsNumber: '6109901007', valueDollars: 309, uomCode1: 'DOZ', quantity1Hundredths: 500, dutyCents: 0 },
      ];
      line.license = { typeCode: '13', number: 'H623AD329' };
      line.visaNumber = '123456';
      line.textileCategoryCode = '638';
    },
    notes: 'EIAP certificate as 52-rec type 13; in-program preference pinned to Free.',
  }),

  aeScenario('056', 'Informal Entry \u2014 Commercial Sales Sample', {
    rates: { '99030529': NT52_100, '98110060': 'Free' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '11';
      p.entrySummary.indicators = { ...p.entrySummary.indicators, shipmentUsageTypeCode: 'X' };
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CA';
      line.countryOfExport = 'CA';
      line.relatedPartyIndicator = undefined;
      line.descriptions = ['SAMPLES FOR SOLICITING ORDERS'];
      line.foreignPortOfLading = '12493'; // Vancouver, BC (Schedule K)
      line.parties = [];
      // 9811.00.60: sample of negligible value \u2014 $1. The 9811 provision is
      // itself 98xx, so the NT52 number follows it.
      line.tariffs = [
        { htsNumber: '98110060', valueDollars: 1, uomCode1: 'NO', quantity1Hundredths: 100 },
        { htsNumber: '99030529', valueDollars: 0 }, // NT52 CA 10%
      ];
    },
  }),

  aeScenario('057', 'Consolidated Release Details', {
    rates: { '99030529': NT52_100, '8514908000': 'Free' },
    mutate: (p, params) => {
      p.entrySummary.indicators = { ...p.entrySummary.indicators, consolidatedSummary: true };
      p.entrySummary.releases = [
        { filerCode: params.filerCode, entryNumber: '00100501' },
        { filerCode: params.filerCode, entryNumber: '00100502' },
        { filerCode: params.filerCode, entryNumber: '00100503' },
      ];
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CA';
      line.countryOfExport = 'CA';
      line.descriptions = ['INDUSTRIAL FURNACE PARTS'];
      line.foreignPortOfLading = '12493'; // Vancouver, BC (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'CATORFUR815TOR' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030529', valueDollars: 0 }, // NT52 CA 10%
        { htsNumber: '8514908000', valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 1000000 },
      ];
    },
  }),

  aeScenario('058', 'Reporting the Commercial Description', {
    rates: { '99030529': NT52_100, '3918101020': '5.3%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CA';
      line.countryOfExport = 'CA';
      line.descriptions = ['VINYL FLOOR TILE - MARBLE SIMULATED, 12X12'];
      line.foreignPortOfLading = '12493'; // Vancouver, BC (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'CATORVIN926TOR' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030529', valueDollars: 0 }, // NT52 CA 10%
        { htsNumber: '3918101020', valueDollars: 10000, uomCode1: 'M2', quantity1Hundredths: 100000 },
      ];
    },
  }),

  aeScenario('059', 'Prototypes', {
    rates: { '98178501': 'Free', '99030549': NT52_125, '8703330145': '2.5%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'JP';
      line.countryOfExport = 'JP';
      line.descriptions = ['AUTOMOBILE PROTOTYPE'];
      line.foreignPortOfLading = '58886'; // Tokyo (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'JPTYOAUT137TYO' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // 9817.85.01 prototype provision governs \u2014 the ch.87 line rides at
      // the provision's Free rate (pinned). NT52 JP computes 12.5% on the
      // $500,000 prototype value ($62,500) \u2014 whether the 9817 prototype
      // provision shields NT52 needs rep confirmation (flagged).
      line.tariffs = [
        { htsNumber: '98178501', valueDollars: 0, uomCode1: 'X' },
        { htsNumber: '99030549', valueDollars: 0 }, // NT52 JP 12.5%
        { htsNumber: '8703330145', valueDollars: 500000, uomCode1: 'NO', quantity1Hundredths: 100, dutyCents: 0 },
      ];
    },
    notes: 'Prototype provision 9817.85.01: base line duty pinned Free.',
  }),

  aeScenario('060', 'Flag for Future Reconciliation', {
    rates: { '99030581': NT52_100, '8414513000': '4.7%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'GB';
      line.countryOfExport = 'GB';
      line.descriptions = ['CEILING FANS'];
      line.foreignPortOfLading = '41323'; // Felixstowe (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'GBLONFAN204LON' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030581', valueDollars: 0 }, // NT52 GB 10%
        { htsNumber: '8414513000', valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 50000 },
      ];
      // Value reconciliation flag: conventional recon issue code 001
      // (note aa) \u2014 requires the continuous bond the baseline carries.
      p.entrySummary.indicators = { ...p.entrySummary.indicators, reconciliationIssueCode: '001' };
    },
    notes: 'Value recon flagged via reconciliation issue code 001 \u2014 confirm code with client rep.',
  }),

  aeScenario('061', 'Cargo Release Certification', {
    rates: { '99030571': NT52_125, '9106908500': '15\u00a2 each + 2.3% + 0.8\u00a2/jewel' },
    mutate: (p) => {
      p.entrySummary.cargoReleaseCertification = true;
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'KR';
      line.countryOfExport = 'KR';
      line.descriptions = ['TIME SWITCHES'];
      line.foreignPortOfLading = '58023'; // Busan (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'KRSELTIM682SEL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // Compound watch-style rate pinned (no jewels): 15\u00a2\u00d7500 = $75.00 +
      // 2.3%\u00d7$10,000 = $230.00 \u2192 $305.00.
      line.tariffs = [
        { htsNumber: '99030571', valueDollars: 0 }, // NT52 KR 12.5%
        { htsNumber: '9106908500', valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 50000, dutyCents: 30500 },
      ];
    },
    notes: 'Certify-for-release on the Add; AMS bill assumed on file (SE16/SE20 only for non-AMS, ESF-45).',
  }),

  appScenario('063', 'AD/CVD Case Information Query \u2014 HTS Number', 'AD', () =>
    buildAdCvdCaseQuery({ type: 'criteria', companyCaseStatus: 'A', htsNumber: '7210703000' })
  ),

  appScenario('064', 'AD/CVD Case Information Query \u2014 Date Since Last Update', 'AD', (params) => {
    // Two days prior to transmission, derived from the applicability date.
    const d = params.applicabilityDate;
    const dayMinus2 = String(Number(d.slice(6, 8)) - 2).padStart(2, '0');
    return buildAdCvdCaseQuery({
      type: 'criteria',
      companyCaseStatus: 'A',
      dateSinceLastUpdate: `${d.slice(4, 6)}${dayMinus2}${d.slice(2, 4)}`,
    });
  }),

  aeScenario('065', 'Deferred Tax', {
    rates: { '99030539': NT52_100, '2208202000': 'Free' },
    mutate: (p) => {
      p.entrySummary.indicators = { ...p.entrySummary.indicators, deferredTaxPaymentCode: '2' };
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'FR';
      line.countryOfExport = 'FR';
      line.descriptions = ['GRAPE BRANDY, PIKE-VALUED'];
      line.foreignPortOfLading = '42737'; // Le Havre (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'FRCOGBRA759COG' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // IRC distilled-spirits tax pinned: $13.50/proof gallon \u00d7 324 PFL =
      // $4,374.00, accounting class 016, EFT deferral (code 2).
      line.tariffs = [
        { htsNumber: '99030539', valueDollars: 0 }, // NT52 EU 10% (FR)
        { htsNumber: '2208202000', valueDollars: 5022, uomCode1: 'PFL', quantity1Hundredths: 32400 },
      ];
      line.irTax = { classCode: '016', amountCents: 437400 };
    },
    notes: 'IR tax on a DAILY statement (monthly would be barred by note y); EFT deferral code 2.',
  }),

  appScenario('066', 'Quota Query', 'QA', () =>
    buildQuotaQuery([{ typeCode: 'R', queryId: '0202305085', countryOfOrigin: 'NZ' }])
  ),

  // \u2500\u2500 Type-03 AD/CVD block (067\u2013073): deposit rates arrive from the AD
  // query at cert time \u2014 dry-run pins zero deposits; the 88-record emits on
  // case presence.
  aeScenario('067', 'Related Cases', {
    rates: { '99030539': NT52_100, '1902192020': 'Free' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '03';
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'IT';
      line.countryOfExport = 'IT';
      line.descriptions = ['DRIED PASTA'];
      line.foreignPortOfLading = '47527'; // Genoa (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'ITROMPAS284ROM' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030539', valueDollars: 0 }, // NT52 EU 10% (IT)
        { htsNumber: '1902192020', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 500000 },
      ];
      line.adCvdCases = [
        { caseNumber: 'A475818029', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'A', dutyCents: 0 },
        { caseNumber: 'C475819011', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'A', dutyCents: 0 },
      ];
    },
  }),

  aeScenario('068', 'Case Status', {
    rates: { '99030531': NT52_125, '1902192020': 'Free' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '03';
      const line = p.entrySummary.lines[0];
      line.descriptions = ['STEEL WIRE ROD'];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [
        { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
        { htsNumber: '1902192020', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 500000 },
      ];
      line.adCvdCases = [
        { caseNumber: 'A427109040', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'A', dutyCents: 0 },
      ];
    },
    notes: 'Package gives only the case number; commodity/HTS reuse the 067 pasta line \u2014 confirm with rep.',
  }),

  aeScenario('069', 'HTS Number and Case Number', {
    rates: { '99030531': NT52_125, '3912390000': '4.2%' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '03';
      const line = p.entrySummary.lines[0];
      line.descriptions = ['CELLULOSE ETHERS'];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [
        { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
        { htsNumber: '3912390000', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 200000 },
      ];
      line.adCvdCases = [
        { caseNumber: 'A405803001', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'A', dutyCents: 0 },
      ];
    },
  }),

  aeScenario('070', 'Case with Ad Valorem Rate', {
    rates: { '99030531': NT52_125, '1902192020': 'Free' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '03';
      const line = p.entrySummary.lines[0];
      line.descriptions = ['CASED PENCILS'];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [
        { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
        { htsNumber: '1902192020', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 500000 },
      ];
      // Rate qualifier S = specific (per package title/qualifier pairing).
      line.adCvdCases = [
        { caseNumber: 'A570967000', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'S', quantityTenThousandths: 5000000, dutyCents: 0 },
      ];
    },
  }),

  aeScenario('071', 'Case with Cash Deposit', {
    rates: { '99030531': NT52_125, '1902192020': 'Free' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '03';
      const line = p.entrySummary.lines[0];
      line.descriptions = ['PORCELAIN-ON-STEEL COOKWARE'];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [
        { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
        { htsNumber: '1902192020', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 500000 },
      ];
      line.adCvdCases = [
        { caseNumber: 'A588602001', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'A', dutyCents: 0 },
      ];
    },
  }),

  aeScenario('072', 'Case with Differing Values', {
    rates: { '99030539': NT52_100, '1902192030': 'Free' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '03';
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'IT';
      line.countryOfExport = 'IT';
      line.descriptions = ['DRIED EGG PASTA'];
      line.foreignPortOfLading = '47527'; // Genoa (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'ITROMPAS284ROM' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030539', valueDollars: 0 }, // NT52 EU 10% (IT)
        { htsNumber: '1902192030', valueDollars: 20000, uomCode1: 'KG', quantity1Hundredths: 32000 },
      ];
      // The AD case covers a $15,000 subset of the $20,000 line (53-record
      // Value of Goods differs from the 50-record value).
      line.adCvdCases = [
        { caseNumber: 'A475818001', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'A', valueOfGoodsDollars: 15000, dutyCents: 0 },
        { caseNumber: 'C475819001', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'A', valueOfGoodsDollars: 15000, dutyCents: 0 },
      ];
    },
  }),

  aeScenario('073', 'Case and Deposit Rate', {
    rates: { '99030531': NT52_125, '1902192020': 'Free' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '03';
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CN';
      line.countryOfExport = 'CN';
      line.descriptions = ['WOODEN BEDROOM FURNITURE'];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [
        { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
        { htsNumber: '1902192020', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 500000 },
      ];
      line.adCvdCases = [
        { caseNumber: 'A570001002', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'A', dutyCents: 0 },
      ];
    },
  }),

  aeScenario('074', 'FTZ Withdrawal with Privilege Date', {
    // NT52 applied mechanically — but the privileged-foreign status fixes
    // rates as of 05/13/2020, which PREDATES the NT52 regime; whether the
    // adjustment belongs on a P-status withdrawal needs rep confirmation.
    rates: { '99030531': NT52_125, '8536410060': '2.7%' },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '06';
      p.entrySummary.foreignTradeZoneId = '124';
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CN';
      line.countryOfExport = 'CN';
      line.descriptions = ['ELECTRICAL RELAYS'];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'CNSHEREL491SHA' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // Privileged foreign status: rates fixed as of the privilege date.
      line.ftz = { statusCode: 'P', privilegedFilingDate: '20200513', quantity: 5000 };
      line.tariffs = [
        { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
        { htsNumber: '8536410060', valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 500000 },
      ];
    },
    notes: 'FTZ id 124 is a dry-run placeholder \u2014 rep supplies the zone. Privilege date 05/13/2020 fixes the rate era.',
  }),

  // \u2500\u2500 PSC scenarios (075\u2013078): Replace of an accepted summary; statement
  // fields are banned in a PSC (ESF-184) so the baseline payment is removed.
  aeScenario('075', 'PSC with ES Header Change', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    action: 'R',
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
      p.entrySummary.payment = undefined;
      p.entrySummary.indicators = { ...p.entrySummary.indicators, postSummaryCorrection: true };
      p.entrySummary.psc = {
        headerReasonCodes: ['H10', 'H12'],
        explanationLines: ['CONSIGNEE AND STATE OF DESTINATION CORRECTED PER IMPORTER RECORDS.'],
      };
      p.entrySummary.usStateOfDestination = 'RI';
    },
    notes: 'Consignee number: client rep will supply (flows from CertParams).',
  }),

  aeScenario('076', 'PSC with ES Line Change', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    action: 'R',
    mutate: (p) => {
      p.entrySummary.payment = undefined;
      p.entrySummary.indicators = { ...p.entrySummary.indicators, postSummaryCorrection: true };
      p.entrySummary.psc = {
        headerReasonCodes: ['H99'],
        explanationLines: ['LINE COUNTRY OF ORIGIN AND MANUFACTURER CORRECTED.'],
      };
      const line = p.entrySummary.lines[0];
      line.pscReasonCodes = ['L07', 'L19'];
      line.countryOfOrigin = 'CN';
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
      line.parties = [
        { type: 'M', identifier: 'CNCAWBAT7057SHE' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
    },
  }),

  aeScenario('077', 'PSC with Entry Type Change', {
    rates: { '99030539': NT52_100, '1902192020': 'Free' },
    action: 'R',
    mutate: (p) => {
      p.entrySummary.payment = undefined;
      p.entrySummary.entryTypeCode = '03';
      p.entrySummary.indicators = { ...p.entrySummary.indicators, postSummaryCorrection: true };
      p.entrySummary.psc = {
        headerReasonCodes: ['H01'],
        explanationLines: ['ENTRY TYPE CORRECTED TO 03: MERCHANDISE SUBJECT TO AD/CVD CASES.'],
      };
      const line = p.entrySummary.lines[0];
      line.pscReasonCodes = ['L03', 'L04', 'L07', 'L29'];
      line.countryOfOrigin = 'IT';
      line.countryOfExport = 'IT';
      line.descriptions = ['DRIED PASTA'];
      line.foreignPortOfLading = '47527'; // Genoa (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'ITROMPAS284ROM' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030539', valueDollars: 0 }, // NT52 EU 10% (IT)
        { htsNumber: '1902192020', valueDollars: 17367, uomCode1: 'KG', quantity1Hundredths: 436600 },
      ];
      line.adCvdCases = [
        { caseNumber: 'A475818001', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'A', dutyCents: 0 },
        { caseNumber: 'C475819000', bondCashClaimCode: 'C', depositRateHundredths: 0, rateTypeQualifier: 'A', dutyCents: 0 },
      ];
    },
  }),

  aeScenario('078', "PSC for Another Filer's ES", {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    action: 'R',
    mutate: (p) => {
      p.entrySummary.payment = undefined;
      p.entrySummary.indicators = { ...p.entrySummary.indicators, postSummaryCorrection: true };
      p.entrySummary.psc = {
        headerReasonCodes: ['H10'],
        explanationLines: ['PSC FILED FOR ANOTHER FILERS SUMMARY; CONSIGNEE CORRECTED.'],
      };
      const line = p.entrySummary.lines[0];
      line.pscReasonCodes = ['L07', 'L19'];
      line.countryOfOrigin = 'CN';
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
      line.parties = [
        { type: 'M', identifier: 'CNCAWBAT7057SHE' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
    },
    notes: 'Entry number / IOR / consignee: rep-supplied at cert (another filer\u2019s accepted summary \u2014 ownership transfers per note gg).',
  }),

  aeScenario('079', 'Temporary Import under Bond (TIB)', {
    rates: {
      '98130020': 'Free', // 'Free, under bond' \u2014 provision text pinned
      '99030543': NT52_125, // NT52 HK \u2014 computes on the $81,408 line value; whether the TIB bond shields NT52 needs rep confirmation
      '7113195090': 'Free', // TIB: no duty collected under the bond
    },
    mutate: (p) => {
      p.entrySummary.entryTypeCode = '23';
      p.entrySummary.motCode = '40';
      p.entrySummary.cargo = { carrierCode: '*F', conveyanceName: 'FLIGHT 220' };
      p.entrySummary.manifests = [
        { manifestedQuantity: 10, uomCode: 'CTNS', bills: [{ type: 'M', identifier: '87654321' }] },
      ];
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'HK';
      line.countryOfExport = 'HK';
      line.descriptions = ['GOLD JEWELRY FOR EXHIBITION'];
      line.parties = [
        { type: 'M', identifier: 'HKHKGJEW368HKG' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      // Air MOT: no foreign port of lading (F429 is vessel-only).
      line.tariffs = [
        { htsNumber: '98130020', valueDollars: 0, uomCode1: 'X' },
        { htsNumber: '99030543', valueDollars: 0 }, // NT52 HK 12.5%
        { htsNumber: '7113195090', valueDollars: 81408, uomCode1: 'G', quantity1Hundredths: 226695 },
      ];
    },
  }),

  appScenario('080', 'TIB Extension', 'TE', (params) =>
    buildTibExtension({
      action: 'extend',
      districtPortOfEntrySummary: params.districtPortOfEntry,
      filerCode: params.filerCode,
      entryNumber: '0000079', // the scenario-079 TIB entry
    })
  , 'Extends the scenario-079 TIB summary (same entry sequence).'),

  aeScenario('081', 'In-Bond', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    mutate: (p, params) => {
      const line = p.entrySummary.lines[0];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
      p.entrySummary.dates = { ...p.entrySummary.dates, inBond: `${params.currentYear}0816` };
      // Paperless in-bond (VXXNNNNNNNN) \u21d2 the bill of lading is required.
      p.entrySummary.manifests = [
        {
          manifestedQuantity: 287,
          uomCode: 'CTN',
          bills: [
            { type: 'I', identifier: 'V1111124247' },
            { type: 'M', issuerCode: 'MAEU', identifier: '123456789012' },
          ],
        },
      ];
      p.entrySummary.cargo = { ...p.entrySummary.cargo, districtPortOfUnlading: '3001' };
    },
  }),

  aeScenario('082', 'PMS Statement Designation', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    mutate: (p, params) => {
      const line = p.entrySummary.lines[0];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
      const cy = params.currentYear;
      // Package: print date ~10 days out, statement month = next month.
      // Dry-run pins Sep 1 (a Tuesday \u2014 weekends are barred by note y).
      p.entrySummary.payment = {
        typeCode: '6',
        preliminaryStatementPrintDate: `${cy}0901`,
        periodicStatementMonth: '09',
      };
    },
  }),

  aeScenario('083', 'FDA Entry', {
    rates: { '99030531': NT52_125, '8516710020': '3.7%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'CN';
      line.countryOfExport = 'CN';
      line.descriptions = ['ELECTRIC COFFEE MAKERS'];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'TWNICSAN435TAI' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
        { htsNumber: '8516710020', valueDollars: 737953, uomCode1: 'NO', quantity1Hundredths: 5546800 },
      ];
    },
    postMap: (input, params) => {
      // FDA food-contact article set per SG ch.10 (FOO/CCW): OI + PG01 +
      // PG02 'P' (FDP 52AOJ51) + PG06 country of production + PG10 name +
      // PG19/20/21 role trios (MF/DEQ/FD1/DP) + PG26 quantities + PG30.
      input.lines![0].pga = {
        commercialDescription: 'ELECTRIC DRIP COFFEE MAKERS, HOUSEHOLD',
        sets: [
          {
            kind: 'data',
            agencyCode: 'FDA',
            programCode: 'FOO',
            processingCode: 'CCW',
            intendedUseCode: '130.029',
            product: { codes: [{ qualifier: 'FDP', number: '52AOJ51' }] },
            sources: [{ typeCode: '39', countryCode: 'CN' }],
            productName: 'COFFEE MAKER',
            entities: [
              {
                // FDA actual manufacturer (CSMS 00-0824); the Appendix-PGA
                // entity-id qualifier for a MID is pending confirmation.
                roleCode: 'MF',
                identificationCode: 'MID',
                number: 'TWNICSAN435TAI',
                name: 'NICSAN APPLIANCE WORKS',
                address1: '435 INDUSTRIAL RD',
                city: 'TAICHUNG',
                country: 'TW',
              },
              {
                roleCode: 'DEQ',
                name: 'NICSAN APPLIANCE WORKS',
                address1: '435 INDUSTRIAL RD',
                city: 'TAICHUNG',
                country: 'TW',
              },
              {
                roleCode: 'FD1',
                name: 'SIGMA TECHNOLOGY PARTNERS LLC',
                address1: '100 MARKET ST',
                city: 'LOS ANGELES',
                stateProvince: 'CA',
                country: 'US',
                zip: '90001',
                contacts: [
                  { qualifier: 'FD1', name: 'IMRAN SIDDIQUE', emailOrFax: 'ISIDDIQUE@SIGMATECHLLC.COM' },
                ],
              },
              {
                roleCode: 'DP',
                name: 'SIGMA TECHNOLOGY PARTNERS LLC',
                address1: '100 MARKET ST',
                city: 'LOS ANGELES',
                stateProvince: 'CA',
                country: 'US',
                zip: '90001',
              },
            ],
            quantities: [
              { qualifier: 1, quantityHundredths: 27734, uom: 'CS' },
              { qualifier: 2, quantityHundredths: 20000, uom: 'PCS' },
            ],
            arrival: { status: 'A', dateMMDDCCYY: `0820${params.currentYear}`, timeHHMM: '0900' },
          },
        ],
      };
    },
    notes: 'FDA FOO/CCW set per SG ch.10. Entity-id qualifier for the MID + FD1 address details: confirm with rep.',
  }),

  aeScenario('084', 'NAFTA/USMCA Net Cost', {
    // NT52: XC = Canadian USMCA origin ⇒ the USMCA-qualifying subdivision
    // (G) row 9903.05.93 at 0% (mirrors the US-goods 9903.05.86 treatment)
    // — NEEDS LIVE VERIFICATION: the duty-bearing CA row 9903.05.29 (10%)
    // would apply if CERT refuses the subdivision claim.
    rates: { '99030593': 'Free', '1004100000': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'XC';
      line.countryOfExport = 'CA';
      line.spiClaimCode = 'S';
      line.naftaNetCostIndicator = 'Y';
      line.descriptions = ['SEED OATS'];
      line.foreignPortOfLading = '12493'; // Vancouver, BC (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'CAWPGOAT173WPG' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030593', valueDollars: 0 }, // NT52 USMCA-CA subdivision (G), 0%
        { htsNumber: '1004100000', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 8500000 },
      ];
    },
    notes: 'XC = Canadian USMCA origin convention; net-cost RVC indicator Y.',
  }),

  aeScenario('085', 'DOT Form Data (HS-7)', {
    rates: { '99030539': NT52_100, '8703210130': '2.5%' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'DE';
      line.countryOfExport = 'DE';
      line.descriptions = ['SNOWMOBILE'];
      line.foreignPortOfLading = '42876'; // Hamburg (Schedule K, Apr 2026 revision)
      line.parties = [
        { type: 'M', identifier: 'DEMUNSNO347MUN' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030539', valueDollars: 0 }, // NT52 EU 10% (DE)
        { htsNumber: '8703210130', valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 100 },
      ];
    },
    postMap: (input, params) => {
      // NHTSA Box-8 set per the supplemental guide's own OFF-vehicle sample
      // (p.65-66): NHT/OFF, PG02 P, PG07 make/model/VIN (AKG), PG10
      // OFFTYP/OFF1 + V06 model year (the package's 'clarification code V'
      // family), IM + CI entities, PG22 946 box 8 + 871 substantiating
      // statement, both NH1-certified.
      const signed = `0820${params.currentYear}`;
      input.lines![0].pga = {
        commercialDescription: 'SNOWMOBILE, NOT FOR ON-ROAD USE',
        sets: [
          {
            kind: 'data',
            agencyCode: 'NHT',
            programCode: 'OFF',
            product: { codes: [] }, // bare PG02 'P' (NHTSA Note 6: always P)
            item: {
              tradeName: 'ABC',
              model: 'UTV-001',
              numberQualifier: 'AKG',
              number: 'TEST-VIN-NUMBER',
            },
            characteristics: [
              { categoryTypeCode: 'OFFTYP', categoryCode: 'OFF1' },
              { commodityQualifierCode: 'V06', characteristicQualifier: '2008' },
            ],
            entities: [
              {
                roleCode: 'IM',
                name: params.importerName,
                address1: '100 MARKET ST',
                city: 'LOS ANGELES',
                stateProvince: 'CA',
                country: 'US',
                zip: '90001',
                contacts: [{ qualifier: 'IM', name: 'IMRAN SIDDIQUE', emailOrFax: 'ISIDDIQUE@SIGMATECHLLC.COM' }],
              },
              {
                roleCode: 'CI',
                name: 'IMRAN SIDDIQUE',
                contacts: [{ qualifier: 'CI', name: 'IMRAN SIDDIQUE', telephone: '2135550100' }],
              },
            ],
            conformance: [
              {
                importersSubstantiatingDocument: 'Y',
                documentIdentifier: '946',
                conformanceDeclaration: '8',
                entityRoleCode: 'CI',
                declarationCode: 'NH1',
                declarationCertification: 'Y',
                dateOfSignature: signed,
              },
              {
                importersSubstantiatingDocument: 'Y',
                documentIdentifier: '871',
                entityRoleCode: 'CI',
                declarationCode: 'NH1',
                declarationCertification: 'Y',
                dateOfSignature: signed,
              },
            ],
          },
        ],
      };
    },
    notes: "Package's 'HS-7 Clarification Code V' maps to the PG10 V-qualifier family (V06 = model year CCYY), not a PG22 code — NHTSA guide Notes 16-19/38. Box 8 via PG22 946; 871 substantiating statement attached.",
  }),

  aeScenario('086', 'PGA Form Disclaimers', {
    rates: { '99030543': NT52_125, '8527910500': 'Free' },
    mutate: (p) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'HK';
      line.countryOfExport = 'HK';
      line.descriptions = ['RADIO BROADCAST RECEIVERS'];
      line.foreignPortOfLading = '58201'; // Hong Kong (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'HKHKGRAD529HKG' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030543', valueDollars: 0 }, // NT52 HK 12.5%
        { htsNumber: '8527910500', valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 50000 },
      ];
    },
    postMap: (input) => {
      // Legacy FC0 (FCC) / FD0 (FDA) disclaim records are replaced by the
      // PG01 position-80 disclaimer (MS p.13/19): one OI + PG01-only set per
      // disclaimed agency. FDA accepts only codes A or F; when disclaiming,
      // FDA program/processing positions carry 'FDA' (SG p.171).
      input.lines![0].pga = {
        commercialDescription: 'RADIO BROADCAST RECEIVERS, HOUSEHOLD',
        sets: [
          { kind: 'disclaimer', agencyCode: 'FCC', programCode: 'RAD', disclaimerCode: 'A' },
          { kind: 'disclaimer', agencyCode: 'FDA', programCode: 'FDA', processingCode: 'FDA', disclaimerCode: 'A' },
        ],
      };
    },
    notes: 'FCC program code RAD is an Appendix-PGA placeholder \u2014 confirm with rep; FDA disclaim per SG p.171.',
  }),

  aeScenario('087', 'Multiple Bills of Lading', {
    rates: { '99030531': NT52_125, '8507600030': '3.41%' },
    mutate: (p, params) => {
      const line = p.entrySummary.lines[0];
      line.foreignPortOfLading = '57035'; // Shanghai (Schedule K)
      line.tariffs = [{ htsNumber: '99030531', valueDollars: 0 }, ...line.tariffs]; // NT52 CN 12.5%
      p.entrySummary.dates = { ...p.entrySummary.dates, inBond: `${params.currentYear}0816` };
      p.entrySummary.cargo = { ...p.entrySummary.cargo, districtPortOfUnlading: '3001' };
      // Two manifest groupings share the movement/master/house; each carries
      // its own sub-house bill and manifested quantity.
      const shared = [
        { type: 'I' as const, identifier: '111271845' },
        { type: 'M' as const, issuerCode: 'MAEU', identifier: '9786543' },
        { type: 'H' as const, issuerCode: 'DMAL', identifier: '15075' },
      ];
      p.entrySummary.manifests = [
        { manifestedQuantity: 5, uomCode: 'CTNS', bills: [...shared, { type: 'S', identifier: 'H273' }] },
        { manifestedQuantity: 10, uomCode: 'CTNS', bills: [...shared, { type: 'S', identifier: 'J878' }] },
      ];
    },
  }),

  aeScenario('088', 'Aluminum Licensing', {
    rates: { '99030571': NT52_125, '7601103000': '2.6%' },
    mutate: (p, params) => {
      const line = p.entrySummary.lines[0];
      line.countryOfOrigin = 'KR';
      line.countryOfExport = 'KR';
      line.descriptions = ['UNWROUGHT ALUMINUM, 99.8% PURE'];
      line.foreignPortOfLading = '58023'; // Busan (Schedule K)
      line.parties = [
        { type: 'M', identifier: 'KRSELALU906SEL' },
        { type: 'S', identifier: p.entrySummary.importerOfRecord.number },
      ];
      line.tariffs = [
        { htsNumber: '99030571', valueDollars: 0 }, // NT52 KR 12.5%
        { htsNumber: '7601103000', valueDollars: 10000, uomCode1: 'KG', quantity1Hundredths: 400000 },
      ];
      // 52-Record type 28 = Aluminum Import License (chapter change log #79/
      // license table). CERT format AALUMmmdd from the import date.
      const d = params.applicabilityDate;
      line.license = { typeCode: '28', number: `AALUM${d.slice(4, 8)}` };
    },
  }),

  aeScenario('089', 'Watches \u2014 Components with Multiple Countries of Origin', {
    rates: {
      '9102114510': 'Free', '9102114520': 'Free', '9102114530': 'Free', '9102114540': 'Free',
      '99038815': 'The duty provided in the applicable subheading + 7.5%',
      '99030574': NT52_125, // NT52 CH lines
      '99030531': NT52_125, // NT52 CN strap line — stacked with 301 9903.88.15; NEEDS LIVE VERIFICATION
    },
    mutate: (p) => {
      const ior = p.entrySummary.importerOfRecord.number;
      const base = p.entrySummary.lines[0];
      // 9102.11.45 constituent rate: 40\u00a2 each + 8.5% case + 2.8% strap +
      // 5.3% battery. Package gives no values/quantities \u2014 $10k per line
      // (standing rule), 1,000 watches. Pinned per constituent (suffix
      // mapping per CSMS #50019756 \u2014 CONFIRM WITH REP):
      //   .4510 movements: 40\u00a2\u00d71,000       = $400.00
      //   .4520 cases:     8.5%\u00d7$10,000     = $850.00
      //   .4530 straps CN: 2.8%\u00d7$10,000     = $280.00 (+301 7.5% on 9903 line)
      //   .4540 batteries: 5.3%\u00d7$10,000     = $530.00
      const mk = (hts: string, dutyCents: number, coo: string, desc: string) => ({
        ...base,
        countryOfOrigin: coo,
        countryOfExport: 'CH',
        descriptions: [desc],
        parties: [
          { type: 'M' as const, identifier: 'CHGENWAT552GEN' },
          { type: 'S' as const, identifier: ior },
        ],
        // NT52 CH first (the CN strap line overrides its tariffs below).
        tariffs: [
          { htsNumber: '99030574', valueDollars: 0 }, // NT52 CH 12.5%
          { htsNumber: hts, valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 100000, dutyCents },
        ],
      });
      p.entrySummary.lines = [
        mk('9102114510', 40000, 'CH', 'WATCH MOVEMENTS'),
        mk('9102114520', 85000, 'CH', 'WATCH CASES'),
        {
          ...mk('9102114530', 28000, 'CN', 'WATCH STRAPS'),
          // 301 + NT52 stacked ahead of the substantive (mirrors 001's
          // accepted marker → adjustment → substantive order).
          tariffs: [
            { htsNumber: '99038815', valueDollars: 0, uomCode1: 'X' },
            { htsNumber: '99030531', valueDollars: 0 }, // NT52 CN 12.5%
            { htsNumber: '9102114530', valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 100000, dutyCents: 28000 },
          ],
        },
        mk('9102114540', 53000, 'CH', 'WATCH BATTERIES'),
      ];
    },
    notes: 'Constituent duties pinned from the 9102.11.45 compound rate; CN strap line carries 301 List-4A (9903.88.15 +7.5%). Confirm suffix\u2194constituent mapping with rep (CSMS #50019756).',
  }),
];

export const SCENARIO_INDEX: Map<string, Scenario> = new Map(SCENARIOS.map((s) => [s.id, s]));
export type { Scenario } from './aeBase.js';
export { DRY_RUN_PARAMS, type CertParams } from './params.js';
