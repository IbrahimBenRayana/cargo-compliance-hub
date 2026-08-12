/**
 * CLI: reset + reseed the staging DEMO organization with polished,
 * realistic-but-fake data in successful states, so client demos never
 * open on an empty screen or a failed filing.
 *
 *   node dist/scripts/seedDemoData.js [--org-email demo@mycargolens.com] [--force]
 *
 * Idempotent: every run WIPES the demo org's transactional data (filings,
 * ABI documents, in-bonds + events, tracked shipments, submission logs,
 * notifications, templates, manifest queries, filing documents) and
 * reseeds it fresh. Users, the organization row, its subscription and
 * chat history are never touched.
 *
 * Safety: the org is located via the owner email and must look demo-ish
 * (org name or email contains "demo") unless --force is passed — this
 * script must never nuke a real client org.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  buildInbond,
  buildInbondEvent,
  formatInbondNumber,
  formatEntryNumber,
  type InbondAddInput,
  type InbondEventInput,
} from '../abi-engine/index.js';

const prisma = new PrismaClient();

// ─── CLI args ──────────────────────────────────────────────

function parseArgs(argv: string[]): { orgEmail: string; force: boolean } {
  let orgEmail = 'demo@mycargolens.com';
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--org-email') {
      const v = argv[++i];
      if (!v) {
        console.error('usage: seedDemoData [--org-email <email>] [--force]');
        process.exit(1);
      }
      orgEmail = v;
    } else if (a === '--force') {
      force = true;
    } else {
      console.error(`unknown argument: ${a}`);
      console.error('usage: seedDemoData [--org-email <email>] [--force]');
      process.exit(1);
    }
  }
  return { orgEmail, force };
}

// ─── Date helpers ──────────────────────────────────────────

const NOW = new Date();

/** A timestamp `days` days ago at the given hour (UTC-ish, demo data). */
function ago(days: number, hour = 10, minute = 15): Date {
  const t = new Date(NOW.getTime() - days * 86_400_000);
  t.setHours(hour, minute, 0, 0);
  return t;
}

/** A timestamp `days` days in the FUTURE (ETAs, LFDs). */
function ahead(days: number, hour = 14): Date {
  const t = new Date(NOW.getTime() + days * 86_400_000);
  t.setHours(hour, 0, 0, 0);
  return t;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYYMMDD (AbiDocument denorm date columns + payload dates). */
function yyyymmdd(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** MMDDYY (CustomsCity / CATAIR conveyance dates). */
function mmddyy(d: Date): string {
  return `${pad(d.getMonth() + 1)}${pad(d.getDate())}${String(d.getFullYear()).slice(2)}`;
}

/** YYMMDD (WP event date field — mirrors routes/inbond.ts). */
function yymmdd(d: Date): string {
  const iso = d.toISOString();
  return `${iso.slice(2, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}`;
}

/** HHMM00 (WP event time field — mirrors routes/inbond.ts). */
function hhmm00(d: Date): string {
  const iso = d.toISOString();
  return `${iso.slice(11, 13)}${iso.slice(14, 16)}00`;
}

const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

// ─── Shared fixtures ───────────────────────────────────────

/** PartyInfo shape rendered by ShipmentDetails / getPartyName. */
interface Party {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  zip?: string;
  country: string;
}

const P = {
  shenzhenElectronics: {
    name: 'Shenzhen Bright Circuit Co., Ltd.',
    address1: '88 Keji South Road, Nanshan District',
    city: 'Shenzhen',
    zip: '518057',
    country: 'CN',
  } as Party,
  pacificRim: {
    name: 'Pacific Rim Trading Co.',
    address1: '2200 Harbor Blvd, Suite 410',
    city: 'Long Beach',
    state: 'CA',
    zip: '90810',
    country: 'US',
  } as Party,
  hamburgTextile: {
    name: 'Hamburg Textile GmbH',
    address1: 'Speicherstadt Block D, Am Sandtorkai 32',
    city: 'Hamburg',
    zip: '20457',
    country: 'DE',
  } as Party,
  saigonGarment: {
    name: 'Saigon Garment Partners JSC',
    address1: '14 Nguyen Hue Boulevard, District 1',
    city: 'Ho Chi Minh City',
    country: 'VN',
  } as Party,
  stuttgartAuto: {
    name: 'Stuttgart Auto Components AG',
    address1: 'Porschestrasse 71',
    city: 'Stuttgart',
    zip: '70435',
    country: 'DE',
  } as Party,
  kyotoPrecision: {
    name: 'Kyoto Precision Instruments K.K.',
    address1: '1-2 Kawaramachi, Shimogyo-ku',
    city: 'Kyoto',
    zip: '600-8216',
    country: 'JP',
  } as Party,
  midwestImports: {
    name: 'Midwest Imports LLC',
    address1: '4801 W Roosevelt Rd',
    city: 'Chicago',
    state: 'IL',
    zip: '60644',
    country: 'US',
  } as Party,
  goldenGate: {
    name: 'Golden Gate Logistics Inc.',
    address1: '380 Oyster Point Blvd',
    city: 'South San Francisco',
    state: 'CA',
    zip: '94080',
    country: 'US',
  } as Party,
  yantianCfs: {
    name: 'Yantian Container Freight Station',
    address1: 'Yantian Port Free Trade Zone, Block 9',
    city: 'Shenzhen',
    country: 'CN',
  } as Party,
  atlanticApparel: {
    name: 'Atlantic Apparel Group Inc.',
    address1: '350 Fifth Avenue, Floor 21',
    city: 'New York',
    state: 'NY',
    zip: '10118',
    country: 'US',
  } as Party,
};

// ─── main ──────────────────────────────────────────────────

async function main(): Promise<void> {
  const { orgEmail, force } = parseArgs(process.argv.slice(2));

  console.log(`[seed-demo] locating org by owner email: ${orgEmail}`);
  const user = await prisma.user.findUnique({
    where: { email: orgEmail },
    include: { organization: true },
  });
  if (!user) {
    console.error(`[seed-demo] ABORT: no user found with email '${orgEmail}'.`);
    process.exit(1);
    return;
  }
  const org = user.organization;
  const looksDemo = /demo/i.test(org.name) || /demo/i.test(orgEmail);
  if (!looksDemo && !force) {
    console.error(
      `[seed-demo] ABORT: org '${org.name}' does not look like a demo org ` +
        `(name/email must contain "demo"). Re-run with --force ONLY if you are ` +
        `certain this org's data should be wiped.`
    );
    process.exit(1);
    return;
  }
  console.log(`[seed-demo] target org: '${org.name}' (${org.id}), user: ${user.email}`);

  // ── 1. Wipe transactional data ───────────────────────────
  // Order: children/soft-referencers first. Cascades cover status history,
  // score snapshots, in-bond events, notification deliveries and shipment
  // charges. Users / org / subscription / chat are intentionally untouched.
  console.log('[seed-demo] wiping existing transactional data…');
  const wiped = {
    notifications: (await prisma.notification.deleteMany({ where: { orgId: org.id } })).count,
    submissionLogs: (await prisma.submissionLog.deleteMany({ where: { orgId: org.id } })).count,
    filingDocuments: (
      await prisma.filingDocument.deleteMany({ where: { filing: { orgId: org.id } } })
    ).count,
    abiDocuments: (await prisma.abiDocument.deleteMany({ where: { orgId: org.id } })).count,
    trackedShipments: (await prisma.trackedShipment.deleteMany({ where: { orgId: org.id } })).count,
    manifestQueries: (await prisma.manifestQuery.deleteMany({ where: { orgId: org.id } })).count,
    inbondFilings: (await prisma.inbondFiling.deleteMany({ where: { orgId: org.id } })).count,
    filingTemplates: (await prisma.filingTemplate.deleteMany({ where: { orgId: org.id } })).count,
    filings: (await prisma.filing.deleteMany({ where: { orgId: org.id } })).count,
  };
  console.log(`[seed-demo] wiped: ${JSON.stringify(wiped)}`);

  const orgId = org.id;
  const userId = user.id;

  // ── 2. ISF filings ───────────────────────────────────────
  console.log('[seed-demo] seeding ISF filings…');

  interface IsfSeed {
    key: string;
    status: 'accepted' | 'submitted' | 'pending_cbp' | 'draft';
    filingType?: 'ISF-10' | 'ISF-5';
    createdDaysAgo: number;
    importer: Party;
    manufacturer: Party;
    seller?: Party;
    consolidator?: Party;
    stuffing?: Party;
    masterBol: string;
    houseBol?: string;
    scac: string;
    vessel: string;
    voyage: string;
    foreignPort: string;
    usPort: string;
    commodities: Array<{
      htsCode: string;
      countryOfOrigin: string;
      description: string;
      quantity: number;
      quantityUOM: string;
      weightKg: number;
      valueUsd: number;
    }>;
    containers: Array<{ number: string; type: string; sealNumber?: string }>;
    consolidationId?: string;
    isf5?: boolean;
  }

  const consolidationId = randomUUID();

  const isfSeeds: IsfSeed[] = [
    {
      key: 'isf-electronics',
      status: 'accepted',
      createdDaysAgo: 52,
      importer: P.pacificRim,
      manufacturer: P.shenzhenElectronics,
      stuffing: P.yantianCfs,
      masterBol: 'MAEU789441120',
      houseBol: 'GGLI55021884',
      scac: 'MAEU',
      vessel: 'MAERSK ESSEX',
      voyage: '426E',
      foreignPort: '57078',
      usPort: '2704',
      commodities: [
        { htsCode: '8507.60.0020', countryOfOrigin: 'CN', description: 'Lithium-ion battery packs for portable devices', quantity: 1840, quantityUOM: 'CTN', weightKg: 9200, valueUsd: 184000 },
        { htsCode: '8544.42.9090', countryOfOrigin: 'CN', description: 'USB-C charging cables, insulated', quantity: 620, quantityUOM: 'CTN', weightKg: 3100, valueUsd: 46500 },
      ],
      containers: [
        { number: 'MSKU1204387', type: '40HC', sealNumber: 'ML-CN482210' },
        { number: 'MSKU7719245', type: '40HC', sealNumber: 'ML-CN482211' },
      ],
    },
    {
      key: 'isf-textiles-hamburg',
      status: 'accepted',
      createdDaysAgo: 44,
      importer: P.atlanticApparel,
      manufacturer: P.hamburgTextile,
      masterBol: 'HLCU347720915',
      houseBol: 'HTXG20260601',
      scac: 'HLCU',
      vessel: 'HAMBURG EXPRESS',
      voyage: '079W',
      foreignPort: '42876',
      usPort: '4601',
      commodities: [
        { htsCode: '6110.20.2079', countryOfOrigin: 'DE', description: 'Cotton knit sweaters, men’s', quantity: 940, quantityUOM: 'CTN', weightKg: 7050, valueUsd: 128400 },
      ],
      containers: [{ number: 'HLXU8834412', type: '40GP', sealNumber: 'HL-DE220871' }],
    },
    {
      key: 'isf-garments-hcmc',
      status: 'accepted',
      createdDaysAgo: 37,
      importer: P.atlanticApparel,
      manufacturer: P.saigonGarment,
      masterBol: 'CMDU512208843',
      houseBol: 'SGP26051190',
      scac: 'CMDU',
      vessel: 'CMA CGM MARCO POLO',
      voyage: '0VN3E1',
      foreignPort: '55206',
      usPort: '2709',
      commodities: [
        { htsCode: '6203.42.4511', countryOfOrigin: 'VN', description: 'Men’s cotton trousers', quantity: 1260, quantityUOM: 'CTN', weightKg: 8820, valueUsd: 157500 },
        { htsCode: '6302.60.0020', countryOfOrigin: 'VN', description: 'Cotton terry towels', quantity: 480, quantityUOM: 'CTN', weightKg: 4320, valueUsd: 38400 },
      ],
      containers: [{ number: 'CMAU5561208', type: '40HC', sealNumber: 'CMA-VN90417' }],
    },
    {
      key: 'isf-autoparts',
      status: 'accepted',
      createdDaysAgo: 29,
      importer: P.midwestImports,
      manufacturer: P.stuttgartAuto,
      masterBol: 'HLCU348102277',
      houseBol: 'SAC26070211',
      scac: 'HLCU',
      vessel: 'ATLANTIC SAIL',
      voyage: '112W',
      foreignPort: '42157',
      usPort: '3901',
      commodities: [
        { htsCode: '8708.30.5090', countryOfOrigin: 'DE', description: 'Disc brake calipers for passenger vehicles', quantity: 720, quantityUOM: 'PLT', weightKg: 14400, valueUsd: 216000 },
        { htsCode: '8708.99.8180', countryOfOrigin: 'DE', description: 'Transmission mounting brackets', quantity: 310, quantityUOM: 'CTN', weightKg: 6200, valueUsd: 55800 },
      ],
      containers: [
        { number: 'HLBU2210904', type: '20GP', sealNumber: 'HL-DE310442' },
        { number: 'HLBU9925617', type: '20GP', sealNumber: 'HL-DE310443' },
      ],
    },
    {
      key: 'isf-instruments',
      status: 'accepted',
      createdDaysAgo: 21,
      importer: P.pacificRim,
      manufacturer: P.kyotoPrecision,
      masterBol: 'ONEY448812035',
      houseBol: 'KPI26071808',
      scac: 'ONEY',
      vessel: 'ONE COLUMBA',
      voyage: '058E',
      foreignPort: '58885',
      usPort: '2811',
      commodities: [
        { htsCode: '9027.80.4530', countryOfOrigin: 'JP', description: 'Digital pH meters and calibration kits', quantity: 260, quantityUOM: 'CTN', weightKg: 1560, valueUsd: 98800 },
      ],
      containers: [{ number: 'ONEU6642190', type: '20GP', sealNumber: 'ON-JP110284' }],
    },
    {
      key: 'isf-laptops',
      status: 'accepted',
      createdDaysAgo: 12,
      importer: P.pacificRim,
      manufacturer: P.shenzhenElectronics,
      stuffing: P.yantianCfs,
      masterBol: 'MSCU902288417',
      houseBol: 'GGLI55023090',
      scac: 'MSCU',
      vessel: 'MSC ISABELLA',
      voyage: '431E',
      foreignPort: '57035',
      usPort: '2704',
      commodities: [
        { htsCode: '8471.30.0100', countryOfOrigin: 'CN', description: 'Portable notebook computers, 14-inch', quantity: 890, quantityUOM: 'CTN', weightKg: 6230, valueUsd: 445000 },
      ],
      containers: [{ number: 'MSDU4471822', type: '40HC', sealNumber: 'MSC-CN771205' }],
    },
    // Consolidation group — 3 HBLs under one MBL (N filings share consolidationId)
    {
      key: 'isf-consol-1',
      status: 'accepted',
      createdDaysAgo: 17,
      importer: P.pacificRim,
      manufacturer: P.shenzhenElectronics,
      consolidator: P.goldenGate,
      stuffing: P.yantianCfs,
      masterBol: 'OOLU210577643',
      houseBol: 'GGLI55022411',
      scac: 'OOLU',
      vessel: 'OOCL SPAIN',
      voyage: '203E',
      foreignPort: '57078',
      usPort: '2704',
      consolidationId,
      commodities: [
        { htsCode: '8518.30.2000', countryOfOrigin: 'CN', description: 'Wireless earbud headphones', quantity: 410, quantityUOM: 'CTN', weightKg: 2050, valueUsd: 73800 },
      ],
      containers: [{ number: 'OOLU7742291', type: '40HC', sealNumber: 'OO-CN660112' }],
    },
    {
      key: 'isf-consol-2',
      status: 'accepted',
      createdDaysAgo: 17,
      importer: P.midwestImports,
      manufacturer: P.shenzhenElectronics,
      consolidator: P.goldenGate,
      stuffing: P.yantianCfs,
      masterBol: 'OOLU210577643',
      houseBol: 'GGLI55022412',
      scac: 'OOLU',
      vessel: 'OOCL SPAIN',
      voyage: '203E',
      foreignPort: '57078',
      usPort: '2704',
      consolidationId,
      commodities: [
        { htsCode: '9503.00.0073', countryOfOrigin: 'CN', description: 'Plastic construction toy sets', quantity: 380, quantityUOM: 'CTN', weightKg: 3040, valueUsd: 41800 },
      ],
      containers: [{ number: 'OOLU7742291', type: '40HC', sealNumber: 'OO-CN660112' }],
    },
    {
      key: 'isf-consol-3',
      status: 'accepted',
      createdDaysAgo: 17,
      importer: P.atlanticApparel,
      manufacturer: P.saigonGarment,
      consolidator: P.goldenGate,
      stuffing: P.yantianCfs,
      masterBol: 'OOLU210577643',
      houseBol: 'GGLI55022413',
      scac: 'OOLU',
      vessel: 'OOCL SPAIN',
      voyage: '203E',
      foreignPort: '57078',
      usPort: '2704',
      consolidationId,
      commodities: [
        { htsCode: '6404.11.9020', countryOfOrigin: 'VN', description: 'Athletic footwear, textile uppers', quantity: 300, quantityUOM: 'CTN', weightKg: 2700, valueUsd: 66000 },
      ],
      containers: [{ number: 'OOLU7742291', type: '40HC', sealNumber: 'OO-CN660112' }],
    },
    // ISF-5 (FROB / in-transit)
    {
      key: 'isf5-frob',
      status: 'accepted',
      filingType: 'ISF-5',
      createdDaysAgo: 24,
      importer: P.goldenGate,
      manufacturer: P.kyotoPrecision,
      masterBol: 'EGLV142208864',
      scac: 'EGLV',
      vessel: 'EVER LIBERAL',
      voyage: '0912-044E',
      foreignPort: '58885',
      usPort: '2704',
      isf5: true,
      commodities: [
        { htsCode: '8481.80.9050', countryOfOrigin: 'JP', description: 'Industrial ball valves (FROB, destined MX)', quantity: 120, quantityUOM: 'PLT', weightKg: 9600, valueUsd: 84000 },
      ],
      containers: [{ number: 'EGHU9152208', type: '40GP', sealNumber: 'EG-JP005513' }],
    },
    // In flight
    {
      key: 'isf-submitted-1',
      status: 'submitted',
      createdDaysAgo: 2,
      importer: P.midwestImports,
      manufacturer: P.stuttgartAuto,
      masterBol: 'HLCU349015528',
      houseBol: 'SAC26080102',
      scac: 'HLCU',
      vessel: 'ATLANTIC SAIL',
      voyage: '114W',
      foreignPort: '42157',
      usPort: '3901',
      commodities: [
        { htsCode: '8409.91.5085', countryOfOrigin: 'DE', description: 'Engine cylinder head assemblies', quantity: 240, quantityUOM: 'PLT', weightKg: 12000, valueUsd: 192000 },
      ],
      containers: [{ number: 'HLBU3308871', type: '20GP', sealNumber: 'HL-DE330190' }],
    },
    {
      key: 'isf-pending-1',
      status: 'pending_cbp',
      createdDaysAgo: 1,
      importer: P.atlanticApparel,
      manufacturer: P.saigonGarment,
      masterBol: 'CMDU513307729',
      houseBol: 'SGP26080450',
      scac: 'CMDU',
      vessel: 'CMA CGM JACQUES SAADE',
      voyage: '0VN4W3',
      foreignPort: '55206',
      usPort: '4601',
      commodities: [
        { htsCode: '6109.10.0012', countryOfOrigin: 'VN', description: 'Cotton T-shirts, women’s', quantity: 860, quantityUOM: 'CTN', weightKg: 5160, valueUsd: 77400 },
      ],
      containers: [{ number: 'CMAU7720953', type: '40HC', sealNumber: 'CMA-VN91630' }],
    },
    // Drafts
    {
      key: 'isf-draft-1',
      status: 'draft',
      createdDaysAgo: 1,
      importer: P.pacificRim,
      manufacturer: P.shenzhenElectronics,
      masterBol: 'MAEU790023481',
      houseBol: 'GGLI55023877',
      scac: 'MAEU',
      vessel: 'MAERSK EMDEN',
      voyage: '432E',
      foreignPort: '57078',
      usPort: '2704',
      commodities: [
        { htsCode: '8517.13.0000', countryOfOrigin: 'CN', description: 'Smartphones, 128 GB', quantity: 720, quantityUOM: 'CTN', weightKg: 4320, valueUsd: 540000 },
      ],
      containers: [{ number: 'MSKU8830164', type: '40HC' }],
    },
    {
      key: 'isf-draft-2',
      status: 'draft',
      createdDaysAgo: 0,
      importer: P.midwestImports,
      manufacturer: P.hamburgTextile,
      masterBol: 'HLCU349102260',
      scac: 'HLCU',
      vessel: 'HAMBURG EXPRESS',
      voyage: '081W',
      foreignPort: '42876',
      usPort: '3901',
      commodities: [
        { htsCode: '9401.61.4011', countryOfOrigin: 'DE', description: 'Upholstered wooden-frame chairs', quantity: 96, quantityUOM: 'PLT', weightKg: 7680, valueUsd: 62400 },
      ],
      containers: [],
    },
  ];

  const filingIdByKey = new Map<string, string>();
  const isfStatusCounts: Record<string, number> = {};

  for (const s of isfSeeds) {
    const createdAt = ago(s.createdDaysAgo, 9);
    const submittedAt = s.status !== 'draft' ? ago(s.createdDaysAgo, 11) : null;
    const acceptedAt = s.status === 'accepted' ? ago(Math.max(s.createdDaysAgo - 1, 0), 8) : null;
    const eta = new Date(createdAt.getTime() + 24 * 86_400_000);
    const etd = new Date(createdAt.getTime() + 3 * 86_400_000);
    const deadline = new Date(etd.getTime() - 86_400_000);
    const buyer = s.importer;
    const seller = s.seller ?? s.manufacturer;

    const statusHistory: Array<{ status: string; message: string; createdAt: Date }> = [
      { status: 'draft', message: 'Filing created', createdAt },
    ];
    if (submittedAt) {
      statusHistory.push({ status: 'submitted', message: 'Transmitted to CBP', createdAt: submittedAt });
    }
    if (s.status === 'pending_cbp' && submittedAt) {
      statusHistory.push({ status: 'pending_cbp', message: 'Awaiting CBP disposition', createdAt: submittedAt });
    }
    if (acceptedAt) {
      statusHistory.push({ status: 'accepted', message: 'ISF accepted by CBP (SA7)', createdAt: acceptedAt });
    }

    const filing = await prisma.filing.create({
      data: {
        orgId,
        createdById: userId,
        filingType: s.filingType ?? 'ISF-10',
        status: s.status,
        ccFilingId: s.status !== 'draft' ? `CCF-${s.masterBol.slice(-8)}` : null,
        cbpTransactionId: s.status === 'accepted' ? `CBP26${s.masterBol.slice(-7)}` : null,
        importerName: s.importer.name,
        importerNumber: '95-4821133',
        consigneeName: s.importer.name,
        consigneeNumber: '95-4821133',
        consigneeAddress: json(s.importer),
        manufacturer: json(s.manufacturer),
        seller: json(seller),
        buyer: json(buyer),
        shipToParty: json(s.importer),
        containerStuffingLocation: json(s.stuffing ?? s.manufacturer),
        consolidator: json(s.consolidator ?? s.manufacturer),
        consolidationId: s.consolidationId ?? null,
        masterBol: s.masterBol,
        houseBol: s.houseBol ?? null,
        scacCode: s.scac,
        vesselName: s.vessel,
        voyageNumber: s.voyage,
        foreignPortOfUnlading: s.foreignPort,
        placeOfDelivery: s.usPort,
        estimatedDeparture: etd,
        estimatedArrival: eta,
        filingDeadline: deadline,
        bondType: 'continuous',
        isf5Data: s.isf5
          ? json({
              bookingPartyName: P.goldenGate.name,
              bookingPartyAddress1: P.goldenGate.address1,
              bookingPartyCity: P.goldenGate.city,
              bookingPartyStateOrProvince: P.goldenGate.state,
              bookingPartyPostalCode: P.goldenGate.zip,
              bookingPartyCountry: 'US',
              ISFFilerName: 'MyCargoLens Filing Services',
              ISFFilerIDCodeQualifier: 'EIN',
              ISFFilerNumber: '26-1647511',
              entryTypeCode: '06',
              USPortOfArrival: s.usPort,
              foreignPortOfUnlading: s.foreignPort,
              placeOfDelivery: '20101',
              ISFShipmentTypeCode: '05',
              bondHolderID: '95-4821133',
              bondActivityCode: '16',
            })
          : undefined,
        commodities: json(
          s.commodities.map((c) => ({
            htsCode: c.htsCode,
            countryOfOrigin: c.countryOfOrigin,
            description: c.description,
            quantity: c.quantity,
            quantityUOM: c.quantityUOM,
            weight: { value: c.weightKg, unit: 'K' }, // CC accepts only 'K'/'L'
            value: { amount: c.valueUsd, currency: 'USD' },
          }))
        ),
        containers: json(s.containers),
        submittedAt,
        acceptedAt,
        createdAt,
        updatedAt: acceptedAt ?? submittedAt ?? createdAt,
        statusHistory: {
          create: statusHistory.map((h) => ({
            status: h.status,
            message: h.message,
            changedById: userId,
            createdAt: h.createdAt,
          })),
        },
      },
    });
    filingIdByKey.set(s.key, filing.id);
    isfStatusCounts[s.status] = (isfStatusCounts[s.status] ?? 0) + 1;
  }
  console.log(`[seed-demo] ISF filings: ${isfSeeds.length} (${JSON.stringify(isfStatusCounts)})`);

  // ── 3. ABI entry documents ───────────────────────────────
  console.log('[seed-demo] seeding ABI entry documents…');

  /** Hyphenated canonical form XXX-NNNNNNN-N with a real AE check digit. */
  function entryNo(seq7: string): string {
    const full = formatEntryNumber('MCL', seq7); // 8 chars: seq + check digit
    return `MCL-${full.slice(0, 7)}-${full.slice(7)}`;
  }

  interface AbiSeed {
    key: string;
    status: 'ACCEPTED' | 'SENT' | 'DRAFT';
    daysAgo: number;
    entryType: '01' | '86';
    mot: string; // MODES_OF_TRANSPORT value
    seq7: string;
    filingKey?: string; // link to ISF filing
    mbol: string;
    hbol?: string;
    ior: { number: string; name: string };
    consignee: Party;
    portOfEntry: string;
    state: string;
    scac: string;
    items: Array<{
      sku: string;
      hts: string;
      description: string;
      origin: string;
      valueUsd: number;
      qty: number;
      grossKg: number;
    }>;
  }

  const abiSeeds: AbiSeed[] = [
    {
      key: 'abi-electronics', status: 'ACCEPTED', daysAgo: 45, entryType: '01', mot: '11',
      seq7: '3000101', filingKey: 'isf-electronics',
      mbol: 'MAEU789441120', hbol: 'GGLI55021884',
      ior: { number: '95-4821133', name: P.pacificRim.name }, consignee: P.pacificRim,
      portOfEntry: '2704', state: 'CA', scac: 'MAEU',
      items: [
        { sku: 'BAT-5060', hts: '8507600020', description: 'Lithium-ion battery packs', origin: 'CN', valueUsd: 184000, qty: 1840, grossKg: 9200 },
        { sku: 'CBL-1120', hts: '8544429090', description: 'USB-C charging cables', origin: 'CN', valueUsd: 46500, qty: 620, grossKg: 3100 },
      ],
    },
    {
      key: 'abi-textiles', status: 'ACCEPTED', daysAgo: 38, entryType: '01', mot: '11',
      seq7: '3000102', filingKey: 'isf-textiles-hamburg',
      mbol: 'HLCU347720915', hbol: 'HTXG20260601',
      ior: { number: '13-5590218', name: P.atlanticApparel.name }, consignee: P.atlanticApparel,
      portOfEntry: '4601', state: 'NY', scac: 'HLCU',
      items: [
        { sku: 'SWT-2079', hts: '6110202079', description: 'Cotton knit sweaters', origin: 'DE', valueUsd: 128400, qty: 940, grossKg: 7050 },
      ],
    },
    {
      key: 'abi-garments', status: 'ACCEPTED', daysAgo: 31, entryType: '01', mot: '11',
      seq7: '3000103', filingKey: 'isf-garments-hcmc',
      mbol: 'CMDU512208843', hbol: 'SGP26051190',
      ior: { number: '13-5590218', name: P.atlanticApparel.name }, consignee: P.atlanticApparel,
      portOfEntry: '2709', state: 'CA', scac: 'CMDU',
      items: [
        { sku: 'TRS-4511', hts: '6203424511', description: 'Men’s cotton trousers', origin: 'VN', valueUsd: 157500, qty: 1260, grossKg: 8820 },
        { sku: 'TWL-0020', hts: '6302600020', description: 'Cotton terry towels', origin: 'VN', valueUsd: 38400, qty: 480, grossKg: 4320 },
      ],
    },
    {
      key: 'abi-autoparts', status: 'ACCEPTED', daysAgo: 23, entryType: '01', mot: '11',
      seq7: '3000104', filingKey: 'isf-autoparts',
      mbol: 'HLCU348102277', hbol: 'SAC26070211',
      ior: { number: '36-2277054', name: P.midwestImports.name }, consignee: P.midwestImports,
      portOfEntry: '3901', state: 'IL', scac: 'HLCU',
      items: [
        { sku: 'BRK-5090', hts: '8708305090', description: 'Disc brake calipers', origin: 'DE', valueUsd: 216000, qty: 720, grossKg: 14400 },
        { sku: 'MNT-8180', hts: '8708998180', description: 'Transmission mounting brackets', origin: 'DE', valueUsd: 55800, qty: 310, grossKg: 6200 },
      ],
    },
    {
      key: 'abi-instruments', status: 'ACCEPTED', daysAgo: 15, entryType: '01', mot: '11',
      seq7: '3000105', filingKey: 'isf-instruments',
      mbol: 'ONEY448812035', hbol: 'KPI26071808',
      ior: { number: '95-4821133', name: P.pacificRim.name }, consignee: P.pacificRim,
      portOfEntry: '2811', state: 'WA', scac: 'ONEY',
      items: [
        { sku: 'PHM-4530', hts: '9027804530', description: 'Digital pH meters', origin: 'JP', valueUsd: 98800, qty: 260, grossKg: 1560 },
      ],
    },
    {
      key: 'abi-standalone-furniture', status: 'ACCEPTED', daysAgo: 8, entryType: '01', mot: '11',
      seq7: '3000106',
      mbol: 'MSCU903317742',
      ior: { number: '36-2277054', name: P.midwestImports.name }, consignee: P.midwestImports,
      portOfEntry: '5301', state: 'TX', scac: 'MSCU',
      items: [
        { sku: 'CHR-4011', hts: '9401614011', description: 'Upholstered chairs, wooden frames', origin: 'VN', valueUsd: 87500, qty: 350, grossKg: 10500 },
      ],
    },
    {
      key: 'abi-sent-1', status: 'SENT', daysAgo: 2, entryType: '01', mot: '11',
      seq7: '3000107', filingKey: 'isf-laptops',
      mbol: 'MSCU902288417', hbol: 'GGLI55023090',
      ior: { number: '95-4821133', name: P.pacificRim.name }, consignee: P.pacificRim,
      portOfEntry: '2704', state: 'CA', scac: 'MSCU',
      items: [
        { sku: 'NBK-0100', hts: '8471300100', description: 'Portable notebook computers', origin: 'CN', valueUsd: 445000, qty: 890, grossKg: 6230 },
      ],
    },
    {
      key: 'abi-sent-2', status: 'SENT', daysAgo: 1, entryType: '01', mot: '11',
      seq7: '3000108', filingKey: 'isf-consol-1',
      mbol: 'OOLU210577643', hbol: 'GGLI55022411',
      ior: { number: '95-4821133', name: P.pacificRim.name }, consignee: P.pacificRim,
      portOfEntry: '2704', state: 'CA', scac: 'OOLU',
      items: [
        { sku: 'EAR-2000', hts: '8518302000', description: 'Wireless earbud headphones', origin: 'CN', valueUsd: 73800, qty: 410, grossKg: 2050 },
      ],
    },
    {
      key: 'abi-draft-1', status: 'DRAFT', daysAgo: 1, entryType: '01', mot: '11',
      seq7: '3000109', filingKey: 'isf-consol-2',
      mbol: 'OOLU210577643', hbol: 'GGLI55022412',
      ior: { number: '36-2277054', name: P.midwestImports.name }, consignee: P.midwestImports,
      portOfEntry: '2704', state: 'IL', scac: 'OOLU',
      items: [
        { sku: 'TOY-0073', hts: '9503000073', description: 'Plastic construction toy sets', origin: 'CN', valueUsd: 41800, qty: 380, grossKg: 3040 },
      ],
    },
    {
      key: 'abi-draft-2', status: 'DRAFT', daysAgo: 0, entryType: '86', mot: '31',
      seq7: '3000110',
      mbol: 'GGLI26081201AIR',
      ior: { number: '95-4821133', name: P.pacificRim.name }, consignee: P.pacificRim,
      portOfEntry: '2720', state: 'CA', scac: 'GGLI',
      items: [
        { sku: 'ACC-9021', hts: '3926909989', description: 'Phone cases, de minimis parcels', origin: 'CN', valueUsd: 720, qty: 90, grossKg: 45 },
      ],
    },
  ];

  const abiIdByKey = new Map<string, string>();
  const abiStatusCounts: Record<string, number> = {};

  for (const s of abiSeeds) {
    const createdAt = ago(s.daysAgo, 13);
    const sentAt = s.status !== 'DRAFT' ? ago(s.daysAgo, 14) : null;
    const respondedAt = s.status === 'ACCEPTED' ? ago(Math.max(s.daysAgo - 1, 0), 9) : null;
    const entryDate = yyyymmdd(createdAt);
    const importDate = yyyymmdd(new Date(createdAt.getTime() - 2 * 86_400_000));
    const arrivalDate = importDate;
    const number = entryNo(s.seq7);

    const payload = {
      entryType: s.entryType,
      modeOfTransport: s.mot,
      entryNumber: number,
      dates: { entryDate, importDate, arrivalDate },
      location: { portOfEntry: s.portOfEntry, destinationStateUS: s.state },
      ior: { number: s.ior.number, name: s.ior.name },
      bond: { type: '8', suretyCode: '457', taxId: s.ior.number },
      payment: { typeCode: 2, preliminaryStatementDate: yyyymmdd(new Date(createdAt.getTime() + 8 * 86_400_000)) },
      firms: 'Y773',
      entryConsignee: {
        name: s.consignee.name,
        taxId: s.ior.number,
        address: s.consignee.address1,
        city: s.consignee.city,
        state: s.consignee.state ?? '',
        postalCode: s.consignee.zip ?? '',
        country: 'US',
      },
      manifest: [
        {
          bill: {
            type: s.hbol ? 'H' : 'M',
            mBOL: s.mbol,
            hBOL: s.hbol ?? s.mbol,
            groupBOL: 'N',
          },
          carrier: { code: s.scac },
          ports: { portOfUnlading: s.portOfEntry },
          quantity: String(s.items.reduce((sum, i) => sum + i.qty, 0)),
          quantityUOM: 'CTN',
          invoices: [
            {
              purchaseOrder: `PO-26${s.seq7.slice(3)}`,
              invoiceNumber: `INV-${s.mbol.slice(-6)}`,
              exportDate: yyyymmdd(new Date(createdAt.getTime() - 26 * 86_400_000)),
              relatedParties: 'N',
              countryOfExport: s.items[0].origin,
              currency: 'USD',
              exchangeRate: 1,
              items: s.items.map((i) => ({
                sku: i.sku,
                htsNumber: i.hts,
                description: i.description,
                origin: { country: i.origin },
                values: { currency: 'USD', exchangeRate: 1, totalValueOfGoods: i.valueUsd },
                quantity1: String(i.qty),
                weight: { gross: String(i.grossKg), uom: 'K' },
                parties: [
                  {
                    type: 'manufacturer',
                    name:
                      i.origin === 'CN' ? P.shenzhenElectronics.name
                      : i.origin === 'VN' ? P.saigonGarment.name
                      : i.origin === 'DE' ? P.stuttgartAuto.name
                      : P.kyotoPrecision.name,
                    country: i.origin,
                  },
                ],
              })),
            },
          ],
        },
      ],
    };

    const doc = await prisma.abiDocument.create({
      data: {
        orgId,
        userId,
        status: s.status,
        entrySummaryStatus: s.status === 'ACCEPTED' ? 'ACCEPTED' : null,
        cargoReleaseStatus: s.status === 'ACCEPTED' ? 'ACCEPTED' : null,
        entryType: s.entryType,
        modeOfTransport: s.mot,
        entryNumber: number,
        ccDocumentId: s.status !== 'DRAFT' ? `ccd_${s.seq7}` : null,
        mbolNumber: s.mbol,
        hbolNumber: s.hbol ?? null,
        iorNumber: s.ior.number,
        iorName: s.ior.name,
        consigneeName: s.consignee.name,
        portOfEntry: s.portOfEntry,
        destinationStateUS: s.state,
        entryDate,
        importDate,
        arrivalDate,
        payload: json(payload),
        sentAt,
        respondedAt,
        pollAttempts: s.status === 'ACCEPTED' ? 2 : s.status === 'SENT' ? 1 : 0,
        filingId: s.filingKey ? filingIdByKey.get(s.filingKey) ?? null : null,
        createdAt,
        updatedAt: respondedAt ?? sentAt ?? createdAt,
      },
    });
    abiIdByKey.set(s.key, doc.id);
    abiStatusCounts[s.status] = (abiStatusCounts[s.status] ?? 0) + 1;
  }
  console.log(`[seed-demo] ABI documents: ${abiSeeds.length} (${JSON.stringify(abiStatusCounts)})`);

  // ── 4. In-bond (7512) filings ────────────────────────────
  console.log('[seed-demo] seeding in-bond filings…');

  /**
   * CATAIR class-AN sanitizer: the record codec only admits [A-Z0-9 ] in
   * AN fields, so names/addresses/descriptions must shed punctuation.
   */
  function wire(s: string, max = 32): string {
    return s
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  /** A QP-Long payload that passes buildInbond (stored WITHOUT `kind`). */
  function inbondPayload(opts: {
    entryType: '61' | '62';
    inBondNumber: string;
    carrier: string;
    usPort: string;
    foreignDest?: string;
    valueDollars: number;
    conveyanceName: string;
    voyage: string;
    portOfArrival: string;
    eta: Date;
    billIssuer: string;
    billNumber: string;
    foreignPortOfLading: string;
    shipper: Party;
    consignee: Party;
    container: string;
    seal: string;
    hts: string;
    description: string;
    pieces: number;
    weightKg: number;
  }): Record<string, unknown> {
    const p: Omit<InbondAddInput, 'kind'> = {
      entryType: opts.entryType,
      inBondNumber: opts.inBondNumber,
      carrierCode: opts.carrier,
      usPortOfDestination: opts.usPort,
      ...(opts.foreignDest ? { portOfForeignDestination: opts.foreignDest } : {}),
      valueDollars: opts.valueDollars,
      bondedCarrierId: '95-4821133',
      btaIndicator: opts.entryType === '61' ? 'N' : 'Y',
      conveyance: {
        importingCarrierCode: opts.carrier,
        importMotCode: '10',
        countryCode: 'DK',
        conveyanceName: opts.conveyanceName,
        voyageFlightTripNumber: opts.voyage,
        portOfArrival: opts.portOfArrival,
        estimatedDateOfArrival: mmddyy(opts.eta),
      },
      bills: [
        {
          sequenceNumber: '0001',
          issuerCode: opts.billIssuer,
          billNumber: opts.billNumber,
          secondaryNotifyParties: [`${opts.portOfArrival}MCL01`],
          references: [{ qualifier: 'BM', value: `${opts.billIssuer}${opts.billNumber}` }],
          details: {
            foreignPortOfLading: opts.foreignPortOfLading,
            manifestQuantity: opts.pieces,
            manifestUnits: 'CTNS',
            weight: opts.weightKg,
            weightUnit: 'KG',
            foreignShipper: {
              name: wire(opts.shipper.name),
              addressLine1: wire(opts.shipper.address1),
              addressLine2: wire(`${opts.shipper.city} ${opts.shipper.country}`),
            },
            consignee: {
              name: wire(opts.consignee.name),
              addressLine1: wire(opts.consignee.address1),
              addressLine2: wire(
                `${opts.consignee.city} ${opts.consignee.state ?? ''} ${opts.consignee.zip ?? ''}`
              ),
            },
            containers: [
              {
                containerNumber: opts.container,
                sealNumber1: wire(opts.seal, 15),
                cargo: [
                  {
                    commodities: [
                      { htsNumber: opts.hts, valueDollars: opts.valueDollars, weight: opts.weightKg, weightUnit: 'KG' },
                    ],
                    descriptions: [
                      { pieceCount: opts.pieces, description: wire(opts.description, 40), manifestUnitCode: 'CTN' },
                    ],
                    marksAndNumbers: ['NO MARKS'],
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    return p as unknown as Record<string, unknown>;
  }

  interface InbondEventSeed {
    action: '1' | '5';
    daysAgo: number;
    payload: Record<string, string>;
  }

  interface InbondSeed {
    status: 'DRAFT' | 'READY' | 'ARRIVED' | 'EXPORTED';
    entryType: '61' | '62';
    daysAgo: number;
    payload: Record<string, unknown>;
    build: boolean; // run buildInbond → wireText
    events?: InbondEventSeed[];
  }

  const ib1 = formatInbondNumber('30412001'); // READY 61 IT
  const ib2 = formatInbondNumber('30412002'); // READY 62 T&E
  const ib3 = formatInbondNumber('30412003'); // ARRIVED 61
  const ib4 = formatInbondNumber('30412004'); // EXPORTED 62

  const inbondSeeds: InbondSeed[] = [
    // Drafts — partial payloads, no wire yet
    {
      status: 'DRAFT', entryType: '61', daysAgo: 1, build: false,
      payload: {
        entryType: '61',
        carrierCode: 'MAEU',
        usPortOfDestination: '3901',
        valueDollars: 48000,
        bondedCarrierId: '95-4821133',
        btaIndicator: 'N',
        bills: [{ issuerCode: 'MAEU', billNumber: '790551208' }],
      },
    },
    {
      status: 'DRAFT', entryType: '62', daysAgo: 0, build: false,
      payload: {
        entryType: '62',
        carrierCode: 'HLCU',
        usPortOfDestination: '2704',
        portOfForeignDestination: '20101',
        valueDollars: 15500,
        bondedCarrierId: '95-4821133',
        btaIndicator: 'Y',
        bills: [{ issuerCode: 'HLCU', billNumber: '349200114' }],
      },
    },
    // READY — real engine-built wire text
    {
      status: 'READY', entryType: '61', daysAgo: 3, build: true,
      payload: inbondPayload({
        entryType: '61', inBondNumber: ib1, carrier: 'MAEU',
        usPort: '3901',
        valueDollars: 96000, conveyanceName: 'MAERSK ESSEX', voyage: '427E',
        portOfArrival: '2704', eta: ahead(4),
        billIssuer: 'MAEU', billNumber: '789990233', foreignPortOfLading: '57078',
        shipper: P.shenzhenElectronics, consignee: P.midwestImports,
        container: 'MSKU5521907', seal: 'ML-CN490118',
        hts: '8507600020', description: 'Lithium-ion battery packs',
        pieces: 880, weightKg: 4400,
      }),
    },
    {
      status: 'READY', entryType: '62', daysAgo: 2, build: true,
      payload: inbondPayload({
        entryType: '62', inBondNumber: ib2, carrier: 'HLCU',
        usPort: '2704', foreignDest: '20101',
        valueDollars: 54000, conveyanceName: 'ATLANTIC SAIL', voyage: '115W',
        portOfArrival: '2704', eta: ahead(6),
        billIssuer: 'HLCU', billNumber: '349310226', foreignPortOfLading: '42157',
        shipper: P.stuttgartAuto, consignee: P.goldenGate,
        container: 'HLBU4412095', seal: 'HL-DE341002',
        hts: '8708305090', description: 'Disc brake calipers in transit MX',
        pieces: 240, weightKg: 4800,
      }),
    },
    // ARRIVED — 61 IT with a recorded arrival event
    {
      status: 'ARRIVED', entryType: '61', daysAgo: 12, build: true,
      payload: inbondPayload({
        entryType: '61', inBondNumber: ib3, carrier: 'CMDU',
        usPort: '3901',
        valueDollars: 62500, conveyanceName: 'CMA CGM MARCO POLO', voyage: '031E',
        portOfArrival: '2709', eta: ago(6),
        billIssuer: 'CMDU', billNumber: '512446120', foreignPortOfLading: '55206',
        shipper: P.saigonGarment, consignee: P.midwestImports,
        container: 'CMAU8830471', seal: 'CMA-VN92085',
        hts: '6203424511', description: 'Cotton trousers moving to Chicago',
        pieces: 505, weightKg: 3535,
      }),
      events: [
        { action: '1', daysAgo: 5, payload: { firmsCode: 'F843', port: '3901' } },
      ],
    },
    // EXPORTED — 62 T&E with arrive + export events
    {
      status: 'EXPORTED', entryType: '62', daysAgo: 20, build: true,
      payload: inbondPayload({
        entryType: '62', inBondNumber: ib4, carrier: 'ONEY',
        usPort: '2704', foreignDest: '20101',
        valueDollars: 84000, conveyanceName: 'ONE COLUMBA', voyage: '058E',
        portOfArrival: '2811', eta: ago(15),
        billIssuer: 'ONEY', billNumber: '448902241', foreignPortOfLading: '58885',
        shipper: P.kyotoPrecision, consignee: P.goldenGate,
        container: 'ONEU7130552', seal: 'ON-JP112090',
        hts: '8481809050', description: 'Industrial valves for re-export',
        pieces: 120, weightKg: 9600,
      }),
      events: [
        { action: '1', daysAgo: 13, payload: { firmsCode: 'Y773', port: '2704' } },
        { action: '5', daysAgo: 11, payload: { exportMotCode: '10', exportConveyanceName: 'ONE COLUMBA' } },
      ],
    },
  ];

  const inbondStatusCounts: Record<string, number> = {};
  let inbondEventCount = 0;

  for (const s of inbondSeeds) {
    const createdAt = ago(s.daysAgo, 9, 40);
    const p = s.payload;
    const bills = Array.isArray(p.bills) ? (p.bills as Array<Record<string, unknown>>) : [];
    const firstBill = bills[0] ?? {};

    let wireText: string | null = null;
    if (s.build) {
      const lines = buildInbond({ kind: 'add', ...(p as object) } as InbondAddInput);
      wireText = lines.join('\n');
    }

    const filing = await prisma.inbondFiling.create({
      data: {
        orgId,
        createdById: userId,
        status: s.status,
        entryType: s.entryType,
        inbondNumber: typeof p.inBondNumber === 'string' ? p.inBondNumber : null,
        carrierCode: typeof p.carrierCode === 'string' ? p.carrierCode.slice(0, 4) : null,
        portOfDestination:
          typeof p.usPortOfDestination === 'string' ? p.usPortOfDestination.slice(0, 4) : null,
        primaryBill:
          typeof firstBill.issuerCode === 'string' && typeof firstBill.billNumber === 'string'
            ? `${firstBill.issuerCode}${firstBill.billNumber}`.slice(0, 30)
            : null,
        payload: json(p),
        wireText,
        createdAt,
        updatedAt: createdAt,
      },
    });

    for (const ev of s.events ?? []) {
      const occurredAt = ago(ev.daysAgo, 15, 30);
      const eventInput = {
        action: ev.action,
        entryType: s.entryType,
        date: yymmdd(occurredAt),
        time: hhmm00(occurredAt),
        inBondNumber: typeof p.inBondNumber === 'string' ? p.inBondNumber : undefined,
        ...ev.payload,
      } as unknown as InbondEventInput;
      const evLines = buildInbondEvent(eventInput);
      await prisma.inbondEvent.create({
        data: {
          filingId: filing.id,
          action: ev.action,
          payload: json(ev.payload),
          wireText: evLines.join('\n'),
          status: 'RECORDED',
          occurredAt,
          createdAt: occurredAt,
        },
      });
      inbondEventCount++;
    }
    inbondStatusCounts[s.status] = (inbondStatusCounts[s.status] ?? 0) + 1;
  }
  console.log(
    `[seed-demo] in-bond filings: ${inbondSeeds.length} (${JSON.stringify(inbondStatusCounts)}), events: ${inbondEventCount}`
  );

  // ── 5. Tracked shipments ─────────────────────────────────
  console.log('[seed-demo] seeding tracked shipments…');

  interface TrackSeed {
    key: string;
    requestNumber: string;
    scac: string;
    line: string;
    filingKey?: string;
    pol: { locode: string; name: string };
    pod: { locode: string; name: string };
    dest?: { locode: string; name: string };
    vessel: string;
    voyage: string;
    /** journey stage: onVessel | arrived | available | pickedUp */
    stage: 'onVessel' | 'arrived' | 'available' | 'pickedUp';
    daysAgo: number;
    lfdInDays?: number;
    clearedHold?: boolean;
    containers: Array<{ number: string; type: string; len: number }>;
  }

  const trackSeeds: TrackSeed[] = [
    {
      key: 'trk-1', requestNumber: 'MAEU790023481', scac: 'MAEU', line: 'Maersk',
      filingKey: 'isf-draft-1',
      pol: { locode: 'CNYTN', name: 'Yantian' }, pod: { locode: 'USLAX', name: 'Los Angeles' },
      vessel: 'MAERSK EMDEN', voyage: '432E', stage: 'onVessel', daysAgo: 9,
      containers: [{ number: 'MSKU8830164', type: '40HC', len: 40 }],
    },
    {
      key: 'trk-2', requestNumber: 'MSCU902288417', scac: 'MSCU', line: 'MSC',
      filingKey: 'isf-laptops',
      pol: { locode: 'CNSHA', name: 'Shanghai' }, pod: { locode: 'USLAX', name: 'Los Angeles' },
      vessel: 'MSC ISABELLA', voyage: '431E', stage: 'arrived', daysAgo: 14, lfdInDays: 4,
      containers: [{ number: 'MSDU4471822', type: '40HC', len: 40 }],
    },
    {
      key: 'trk-3', requestNumber: 'OOLU210577643', scac: 'OOLU', line: 'OOCL',
      filingKey: 'isf-consol-1',
      pol: { locode: 'CNYTN', name: 'Yantian' }, pod: { locode: 'USLAX', name: 'Los Angeles' },
      vessel: 'OOCL SPAIN', voyage: '203E', stage: 'available', daysAgo: 17, lfdInDays: 2,
      clearedHold: true,
      containers: [{ number: 'OOLU7742291', type: '40HC', len: 40 }],
    },
    {
      key: 'trk-4', requestNumber: 'HLCU348102277', scac: 'HLCU', line: 'Hapag-Lloyd',
      filingKey: 'isf-autoparts',
      pol: { locode: 'NLRTM', name: 'Rotterdam' }, pod: { locode: 'USNYC', name: 'New York' },
      dest: { locode: 'USCHI', name: 'Chicago' },
      vessel: 'ATLANTIC SAIL', voyage: '112W', stage: 'pickedUp', daysAgo: 26,
      containers: [
        { number: 'HLBU2210904', type: '20GP', len: 20 },
        { number: 'HLBU9925617', type: '20GP', len: 20 },
      ],
    },
    {
      key: 'trk-5', requestNumber: 'CMDU513307729', scac: 'CMDU', line: 'CMA CGM',
      filingKey: 'isf-pending-1',
      pol: { locode: 'VNSGN', name: 'Ho Chi Minh City' }, pod: { locode: 'USNYC', name: 'New York' },
      vessel: 'CMA CGM JACQUES SAADE', voyage: '0VN4W3', stage: 'onVessel', daysAgo: 5,
      containers: [{ number: 'CMAU7720953', type: '40HC', len: 40 }],
    },
    {
      key: 'trk-6', requestNumber: 'ONEY448812035', scac: 'ONEY', line: 'Ocean Network Express',
      filingKey: 'isf-instruments',
      pol: { locode: 'JPYOK', name: 'Yokohama' }, pod: { locode: 'USSEA', name: 'Seattle' },
      vessel: 'ONE COLUMBA', voyage: '058E', stage: 'pickedUp', daysAgo: 19,
      containers: [{ number: 'ONEU6642190', type: '20GP', len: 20 }],
    },
    {
      key: 'trk-7', requestNumber: 'HLCU347720915', scac: 'HLCU', line: 'Hapag-Lloyd',
      filingKey: 'isf-textiles-hamburg',
      pol: { locode: 'DEHAM', name: 'Hamburg' }, pod: { locode: 'USNYC', name: 'New York' },
      vessel: 'HAMBURG EXPRESS', voyage: '079W', stage: 'available', daysAgo: 18, lfdInDays: 5,
      containers: [{ number: 'HLXU8834412', type: '40GP', len: 40 }],
    },
    {
      key: 'trk-8', requestNumber: 'EGLV142208864', scac: 'EGLV', line: 'Evergreen',
      filingKey: 'isf5-frob',
      pol: { locode: 'JPYOK', name: 'Yokohama' }, pod: { locode: 'USLAX', name: 'Los Angeles' },
      vessel: 'EVER LIBERAL', voyage: '0912-044E', stage: 'arrived', daysAgo: 22, lfdInDays: 6,
      containers: [{ number: 'EGHU9152208', type: '40GP', len: 40 }],
    },
  ];

  for (const s of trackSeeds) {
    const createdAt = ago(s.daysAgo, 8);
    const etd = ago(s.daysAgo - 1, 20);
    const atd = s.stage === 'onVessel' ? ago(Math.max(s.daysAgo - 2, 1), 22) : ago(s.daysAgo - 1, 22);
    const podEta = s.stage === 'onVessel' ? ahead(6) : ago(Math.max(s.daysAgo - 10, 1), 6);
    const podAta = s.stage === 'onVessel' ? null : ago(Math.max(s.daysAgo - 10, 1), 7);
    const destAta = s.stage === 'pickedUp' ? ago(Math.max(s.daysAgo - 14, 0), 16) : null;
    const lfd = s.lfdInDays != null ? ahead(s.lfdInDays, 17) : null;
    const lastSynced = ago(0, 6);

    const containerStatus =
      s.stage === 'onVessel' ? 'on_ship'
      : s.stage === 'arrived' ? 'discharged'
      : s.stage === 'available' ? 'available'
      : 'picked_up';

    const t49ShipmentId = `t49-${s.key}`;
    const snapshot = {
      id: t49ShipmentId,
      billOfLadingNumber: s.requestNumber,
      normalizedNumber: s.requestNumber,
      shippingLineScac: s.scac,
      shippingLineName: s.line,
      shippingLineShortName: s.line,
      customerName: null,
      portOfLadingLocode: s.pol.locode,
      portOfLadingName: s.pol.name,
      portOfDischargeLocode: s.pod.locode,
      portOfDischargeName: s.pod.name,
      destinationLocode: s.dest?.locode ?? null,
      destinationName: s.dest?.name ?? null,
      podVesselName: s.vessel,
      podVesselImo: null,
      podVoyageNumber: s.voyage,
      polEtdAt: etd.toISOString(),
      polAtdAt: atd.toISOString(),
      podEtaAt: podEta.toISOString(),
      podOriginalEtaAt: podEta.toISOString(),
      podAtaAt: podAta ? podAta.toISOString() : null,
      destinationEtaAt: s.dest && !destAta ? ahead(3).toISOString() : null,
      destinationAtaAt: destAta ? destAta.toISOString() : null,
      polTimezone: null,
      podTimezone: 'America/Los_Angeles',
      destinationTimezone: null,
      lineTrackingLastSucceededAt: lastSynced.toISOString(),
      lineTrackingStoppedAt: null,
      lineTrackingStoppedReason: null,
      refNumbers: [],
      tags: [],
      containers: s.containers.map((c, i) => ({
        id: `t49-c-${s.key}-${i}`,
        number: c.number,
        equipmentType: 'dry',
        equipmentLength: c.len,
        equipmentHeight: c.type.endsWith('HC') ? 'high_cube' : 'standard',
        sealNumber: null,
        currentStatus: containerStatus,
        availableForPickup: s.stage === 'available' ? true : s.stage === 'pickedUp' ? false : null,
        pickupLfd: lfd ? lfd.toISOString() : null,
        holdsAtPodTerminal: s.clearedHold
          ? [{ name: 'customs', status: 'released', description: 'Customs hold released after entry acceptance' }]
          : [],
        feesAtPodTerminal: [],
        locationAtPodTerminal:
          s.stage === 'available' ? `${s.pod.name} Terminal — Yard block C4` :
          s.stage === 'arrived' ? `${s.pod.name} Terminal` : null,
      })),
    };

    await prisma.trackedShipment.create({
      data: {
        orgId,
        createdById: userId,
        filingId: s.filingKey ? filingIdByKey.get(s.filingKey) ?? null : null,
        t49TrackingRequestId: `t49-req-${s.key}`,
        t49ShipmentId,
        requestType: 'bill_of_lading',
        requestNumber: s.requestNumber,
        scac: s.scac,
        status: 'tracking',
        shippingLineName: s.line,
        portOfLadingName: s.pol.name,
        portOfDischargeName: s.pod.name,
        destinationName: s.dest?.name ?? null,
        podVesselName: s.vessel,
        polEtdAt: etd,
        polAtdAt: atd,
        podEtaAt: podEta,
        podAtaAt: podAta,
        destinationAtaAt: destAta,
        hasHolds: false,
        earliestPickupLfd: lfd,
        shipmentSnapshot: json(snapshot),
        lastSyncedAt: lastSynced,
        createdAt,
        updatedAt: lastSynced,
      },
    });
  }
  console.log(`[seed-demo] tracked shipments: ${trackSeeds.length} (all status=tracking)`);

  // ── 6. Manifest queries ──────────────────────────────────
  console.log('[seed-demo] seeding manifest queries…');

  interface MqSeed {
    bol: string;
    daysAgo: number;
    carrier: string;
    vessel: string;
    port: string;
    arrival: Date;
    houses: Array<{ hbl: string; qty: number; dispositions: string[] }>;
  }

  const mqSeeds: MqSeed[] = [
    {
      bol: 'MAEU789441120', daysAgo: 50, carrier: 'MAEU', vessel: 'MAERSK ESSEX',
      port: '2704', arrival: ago(48),
      houses: [{ hbl: 'GGLI55021884', qty: 2460, dispositions: ['1W', '1C'] }],
    },
    {
      bol: 'OOLU210577643', daysAgo: 16, carrier: 'OOLU', vessel: 'OOCL SPAIN',
      port: '2704', arrival: ago(7),
      houses: [
        { hbl: 'GGLI55022411', qty: 410, dispositions: ['1W', '1C'] },
        { hbl: 'GGLI55022412', qty: 380, dispositions: ['1W'] },
        { hbl: 'GGLI55022413', qty: 300, dispositions: ['1W'] },
      ],
    },
    {
      bol: 'MSCU902288417', daysAgo: 3, carrier: 'MSCU', vessel: 'MSC ISABELLA',
      port: '2704', arrival: ago(4),
      houses: [{ hbl: 'GGLI55023090', qty: 890, dispositions: ['1W'] }],
    },
    {
      bol: 'HLCU349015528', daysAgo: 1, carrier: 'HLCU', vessel: 'ATLANTIC SAIL',
      port: '3901', arrival: ahead(9),
      houses: [{ hbl: 'SAC26080102', qty: 240, dispositions: [] }],
    },
  ];

  for (const s of mqSeeds) {
    const createdAt = ago(s.daysAgo, 12);
    const completedAt = new Date(createdAt.getTime() + 90_000);
    await prisma.manifestQuery.create({
      data: {
        orgId,
        userId,
        bolNumber: s.bol,
        bolType: 'BOLNUMBER',
        ccRequestId: `mq_${s.bol.slice(-8)}`,
        status: 'completed',
        response: json({
          data: {
            response: {
              carrierCode: s.carrier,
              masterBLNumber: s.bol,
              modeOfTransport: 'OCEAN',
              conveyanceName: s.vessel,
              scheduledArrivalDate: mmddyy(s.arrival),
              manifestedPortOfUnlading: s.port,
              houses: s.houses.map((h) => ({
                hawbNumber: h.hbl,
                importingCarrierCode: s.carrier,
                scheduledArrivalDate: mmddyy(s.arrival),
                manifestQty: h.qty,
                manifestedPort: s.port,
                dispositionMsg: h.dispositions.map((code) => ({ dispositionCode: code })),
              })),
            },
          },
        }),
        pollAttempts: 1,
        createdAt,
        completedAt,
        updatedAt: completedAt,
      },
    });
  }
  console.log(`[seed-demo] manifest queries: ${mqSeeds.length} (all status=completed)`);

  // ── 7. Submission logs ───────────────────────────────────
  console.log('[seed-demo] seeding submission logs…');

  interface LogSeed {
    filingKey?: string;
    correlationKey?: string; // abi doc key → correlationId
    method: string;
    url: string;
    daysAgo: number;
    hour: number;
    status: number;
    request: Record<string, unknown>;
    response: Record<string, unknown>;
  }

  const logSeeds: LogSeed[] = [];

  // One ISF submit log per non-draft filing.
  for (const s of isfSeeds) {
    if (s.status === 'draft') continue;
    logSeeds.push({
      filingKey: s.key,
      method: 'POST',
      url: '/api/send',
      daysAgo: s.createdDaysAgo,
      hour: 11,
      status: 200,
      request: {
        documentId: `CCF-${s.masterBol.slice(-8)}`,
        action: 'submit',
        masterBOL: s.masterBol,
        houseBOL: s.houseBol ?? s.masterBol,
      },
      response: {
        status: s.status === 'accepted' ? 'ACCEPTED' : 'SUBMITTED',
        cbpTransactionId: s.status === 'accepted' ? `CBP26${s.masterBol.slice(-7)}` : null,
        disposition: s.status === 'accepted' ? 'SA7 — ISF ACCEPTED' : 'RECEIVED BY CBP',
      },
    });
  }

  // One ABI send log per transmitted entry (+ one status poll for the
  // most recently accepted one, so the GET pattern shows up too).
  for (const s of abiSeeds) {
    if (s.status === 'DRAFT') continue;
    const number = entryNo(s.seq7);
    logSeeds.push({
      filingKey: s.filingKey,
      correlationKey: s.key,
      method: 'POST',
      url: '/api/abi/send',
      daysAgo: s.daysAgo,
      hour: 14,
      status: 200,
      request: { entryNumber: number, action: 'entry-summary-cargo-release', mBOL: s.mbol },
      response: { status: 'SENT', documentId: `ccd_${s.seq7}`, queuedAt: ago(s.daysAgo, 14).toISOString() },
    });
    if (s.key === 'abi-standalone-furniture') {
      logSeeds.push({
        filingKey: s.filingKey,
        correlationKey: s.key,
        method: 'GET',
        url: '/api/abi/documents',
        daysAgo: Math.max(s.daysAgo - 1, 0),
        hour: 9,
        status: 200,
        request: { entryNumber: [number] },
        response: {
          body: [{ entryNumber: number, entrySummaryStatus: 'ACCEPTED', cargoReleaseStatus: 'ACCEPTED' }],
        },
      });
    }
  }

  // Manifest queries.
  mqSeeds.forEach((s) => {
    logSeeds.push({
      method: 'POST',
      url: '/api/manifest-query',
      daysAgo: s.daysAgo,
      hour: 12,
      status: 200,
      request: { bolNumber: s.bol, bolType: 'BOLNUMBER' },
      response: { requestId: `mq_${s.bol.slice(-8)}`, status: 'COMPLETED' },
    });
  });

  for (const l of logSeeds) {
    await prisma.submissionLog.create({
      data: {
        orgId,
        userId,
        filingId: l.filingKey ? filingIdByKey.get(l.filingKey) ?? null : null,
        correlationId: l.correlationKey ? abiIdByKey.get(l.correlationKey) ?? null : null,
        method: l.method,
        url: l.url,
        requestPayload: json(l.request),
        responseStatus: l.status,
        responseBody: json(l.response),
        latencyMs: 240 + ((l.daysAgo * 37) % 900),
        createdAt: ago(l.daysAgo, l.hour, 20),
      },
    });
  }
  console.log(`[seed-demo] submission logs: ${logSeeds.length} (all 2xx)`);

  // ── 8. Notifications ─────────────────────────────────────
  console.log('[seed-demo] seeding notifications…');

  const notifSeeds = [
    {
      type: 'entry_accepted', severity: 'info' as const, daysAgo: 0, hour: 8, isRead: false,
      title: 'Entry accepted by CBP',
      message: `Entry ${entryNo('3000106')} (MSCU903317742) — entry summary and cargo release both ACCEPTED.`,
      abiKey: 'abi-standalone-furniture',
      link: (id: string) => `/abi-documents/${id}`,
      metadata: { entryNumber: entryNo('3000106'), mbolNumber: 'MSCU903317742' },
    },
    {
      type: 'filing_accepted', severity: 'info' as const, daysAgo: 0, hour: 7, isRead: false,
      title: 'ISF accepted',
      message: 'ISF for HBL KPI26071808 (ONE COLUMBA) accepted by CBP — disposition SA7.',
      filingKey: 'isf-instruments',
      link: (id: string) => `/shipments/${id}`,
      metadata: { houseBol: 'KPI26071808', disposition: 'SA7' },
    },
    {
      type: 'manifest_query_complete', severity: 'info' as const, daysAgo: 1, hour: 12, isRead: false,
      title: 'Bill matched at CBP',
      message: 'Manifest query for MSCU902288417 completed — bill on file, cargo arrived at 2704.',
      link: (_id: string) => '/manifest-query',
      metadata: { bolNumber: 'MSCU902288417' },
    },
    {
      type: 'container_available', severity: 'info' as const, daysAgo: 1, hour: 9, isRead: true,
      title: 'Container available for pickup',
      message: 'OOLU7742291 (OOCL SPAIN) is discharged and available at Los Angeles — LFD in 2 days.',
      trackKey: 'trk-3',
      link: (id: string) => `/tracking/${id}`,
      metadata: { containerNumber: 'OOLU7742291', pod: 'Los Angeles' },
    },
    {
      type: 'filing_submitted', severity: 'info' as const, daysAgo: 2, hour: 11, isRead: true,
      title: 'ISF transmitted to CBP',
      message: 'ISF for HBL SAC26080102 (ATLANTIC SAIL 114W) transmitted — awaiting CBP disposition.',
      filingKey: 'isf-submitted-1',
      link: (id: string) => `/shipments/${id}`,
      metadata: { houseBol: 'SAC26080102' },
    },
    {
      type: 'entry_accepted', severity: 'info' as const, daysAgo: 7, hour: 9, isRead: true,
      title: 'Entry accepted by CBP',
      message: `Entry ${entryNo('3000105')} (ONEY448812035) — cargo release ACCEPTED at Seattle.`,
      abiKey: 'abi-instruments',
      link: (id: string) => `/abi-documents/${id}`,
      metadata: { entryNumber: entryNo('3000105') },
    },
    {
      type: 'deadline_warning', severity: 'warning' as const, daysAgo: 0, hour: 6, isRead: false,
      title: 'Last free day approaching',
      message: 'Container OOLU7742291 at Los Angeles reaches its last free day in 2 days — schedule pickup to avoid demurrage.',
      trackKey: 'trk-3',
      link: (id: string) => `/tracking/${id}`,
      metadata: { containerNumber: 'OOLU7742291' },
    },
    {
      type: 'filing_accepted', severity: 'info' as const, daysAgo: 16, hour: 8, isRead: true,
      title: 'Consolidation accepted',
      message: 'All 3 house bills under MBL OOLU210577643 accepted by CBP.',
      filingKey: 'isf-consol-1',
      link: (id: string) => `/shipments/${id}`,
      metadata: { masterBol: 'OOLU210577643', houseBillCount: 3 },
    },
  ];

  // Resolve tracked shipment ids for deep links.
  const trackedRows = await prisma.trackedShipment.findMany({
    where: { orgId },
    select: { id: true, t49ShipmentId: true },
  });
  const trackIdByKey = new Map<string, string>();
  for (const r of trackedRows) {
    if (r.t49ShipmentId?.startsWith('t49-')) trackIdByKey.set(r.t49ShipmentId.slice(4), r.id);
  }

  for (const n of notifSeeds) {
    const filingId = 'filingKey' in n && n.filingKey ? filingIdByKey.get(n.filingKey) ?? null : null;
    const abiDocumentId = 'abiKey' in n && n.abiKey ? abiIdByKey.get(n.abiKey) ?? null : null;
    const trackId = 'trackKey' in n && n.trackKey ? trackIdByKey.get(n.trackKey) ?? null : null;
    const linkTarget = abiDocumentId ?? filingId ?? trackId ?? '';
    const createdAt = ago(n.daysAgo, n.hour, 5);
    await prisma.notification.create({
      data: {
        userId,
        orgId,
        filingId,
        abiDocumentId,
        type: n.type,
        severity: n.severity,
        title: n.title,
        message: n.message,
        linkUrl: n.link(linkTarget),
        metadata: json(n.metadata),
        isRead: n.isRead,
        readAt: n.isRead ? new Date(createdAt.getTime() + 3_600_000) : null,
        createdAt,
      },
    });
  }
  console.log(`[seed-demo] notifications: ${notifSeeds.length} (${notifSeeds.filter((n) => !n.isRead).length} unread)`);

  // ── 9. Filing templates ──────────────────────────────────
  console.log('[seed-demo] seeding filing templates…');

  const templateSeeds = [
    {
      name: 'Electronics from Shenzhen',
      importer: P.pacificRim,
      manufacturer: P.shenzhenElectronics,
      stuffing: P.yantianCfs,
      scac: 'MAEU',
      foreignPort: '57078',
      usPort: '2704',
      commodities: [
        { htsCode: '8507.60.0020', countryOfOrigin: 'CN', description: 'Lithium-ion battery packs' },
        { htsCode: '8544.42.9090', countryOfOrigin: 'CN', description: 'USB-C charging cables' },
      ],
    },
    {
      name: 'Textiles from Ho Chi Minh',
      importer: P.atlanticApparel,
      manufacturer: P.saigonGarment,
      scac: 'CMDU',
      foreignPort: '55206',
      usPort: '4601',
      commodities: [
        { htsCode: '6203.42.4511', countryOfOrigin: 'VN', description: 'Men’s cotton trousers' },
        { htsCode: '6109.10.0012', countryOfOrigin: 'VN', description: 'Cotton T-shirts' },
      ],
    },
    {
      name: 'Auto parts from Stuttgart',
      importer: P.midwestImports,
      manufacturer: P.stuttgartAuto,
      scac: 'HLCU',
      foreignPort: '42157',
      usPort: '3901',
      commodities: [
        { htsCode: '8708.30.5090', countryOfOrigin: 'DE', description: 'Disc brake calipers' },
      ],
    },
  ];

  for (const [i, t] of templateSeeds.entries()) {
    await prisma.filingTemplate.create({
      data: {
        orgId,
        createdById: userId,
        name: t.name,
        filingType: 'ISF-10',
        templateData: json({
          importerName: t.importer.name,
          importerNumber: '95-4821133',
          consigneeName: t.importer.name,
          consigneeNumber: '95-4821133',
          consigneeAddress: t.importer,
          manufacturer: t.manufacturer,
          seller: t.manufacturer,
          buyer: t.importer,
          shipToParty: t.importer,
          containerStuffingLocation: ('stuffing' in t && t.stuffing) || t.manufacturer,
          consolidator: t.manufacturer,
          scacCode: t.scac,
          foreignPortOfUnlading: t.foreignPort,
          placeOfDelivery: t.usPort,
          bondType: 'continuous',
          commodities: t.commodities,
        }),
        createdAt: ago(55 - i * 3, 15),
        updatedAt: ago(55 - i * 3, 15),
      },
    });
  }
  console.log(`[seed-demo] filing templates: ${templateSeeds.length}`);

  // ── Summary ──────────────────────────────────────────────
  console.log('\n[seed-demo] DONE — seeded for org', `'${org.name}':`);
  console.log(`  ISF filings:        ${isfSeeds.length}  ${JSON.stringify(isfStatusCounts)}`);
  console.log(`  ABI documents:      ${abiSeeds.length}  ${JSON.stringify(abiStatusCounts)}`);
  console.log(`  In-bond filings:    ${inbondSeeds.length}  ${JSON.stringify(inbondStatusCounts)} (+${inbondEventCount} events)`);
  console.log(`  Tracked shipments:  ${trackSeeds.length}`);
  console.log(`  Manifest queries:   ${mqSeeds.length}`);
  console.log(`  Submission logs:    ${logSeeds.length}`);
  console.log(`  Notifications:      ${notifSeeds.length}`);
  console.log(`  Filing templates:   ${templateSeeds.length}`);
}

main()
  .catch((err) => {
    console.error('[seed-demo] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
