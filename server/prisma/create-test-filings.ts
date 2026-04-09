/**
 * Creates two draft filings for manual testing:
 *   1. ISF-5 — carrier-filed, with complete isf5Data
 *   2. ISF-10+2 — importer-filed, with all 10 required party fields
 *
 * Run:  cd server && npx tsx prisma/create-test-filings.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_ID  = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

async function main() {
  // ───────────────────────────────────────────────────────
  // 1.  ISF-5 Draft — Samsung LCD Panels from South Korea
  // ───────────────────────────────────────────────────────
  const isf5 = await prisma.filing.create({
    data: {
      orgId:       ORG_ID,
      createdById: USER_ID,
      filingType:  'ISF-5',
      status:      'draft',

      importerName:   'Pacific Cargo Lines LLC',
      importerNumber: '30-1234567',           // EIN for ISF filer (carrier)

      masterBol:    'KMTU2026040701',
      houseBol:     'KMTU2026040701H1',
      scacCode:     'KMTU',
      vesselName:   'HMM Algeciras',
      voyageNumber: 'VY-2026-155',

      // 4-digit is stored but the mapper derives 5-digit for CC
      foreignPortOfUnlading: '57078',         // 5-digit Schedule D: Busan, KR
      placeOfDelivery:       '2704',          // 4-digit CBP: Los Angeles

      estimatedDeparture: new Date('2026-04-12'),
      estimatedArrival:   new Date('2026-04-28'),
      filingDeadline:     new Date('2026-04-11'),

      bondType: 'continuous',

      manufacturer: {
        name:     'Samsung Display Co Ltd',
        address1: '1 Samsung-ro',
        city:     'Asan',
        state:    'CN',
        zip:      '31454',
        country:  'KR',
      },

      shipToParty: {
        name:     'West Coast Electronics Depot',
        address1: '500 Terminal Island Fwy',
        city:     'Long Beach',
        state:    'CA',
        zip:      '90802',
        country:  'US',
      },

      commodities: [
        {
          htsCode:        '854140',              // 6-digit HTS: LCD panels
          countryOfOrigin: 'KR',
          description:    'LCD display panels 55 inch',
          quantity:       2000,
          quantityUOM:    'PCS',
          weight:         { value: 12000, unit: 'K' },
        },
      ],

      containers: [
        { number: 'KMTU9876543', type: '40HC', sealNumber: 'SEAL-KR-001' },
      ],

      // ISF-5 specific data
      isf5Data: {
        // ISF Filer (carrier)
        ISFFilerName:                    'Pacific Cargo Lines LLC',
        ISFFilerLastName:                'Pacific Cargo Lines LLC',
        ISFFilerIDCodeQualifier:         '24',
        ISFFilerNumber:                  '30-1234567',
        ISFFilerPassportIssuanceCountry: '',
        ISFFilerDateOfBirth:             '19900101',

        // US Port of Arrival — 4-digit CBP code
        USPortOfArrival: '2704',                   // Los Angeles/Long Beach

        // Bond
        bondActivityCode: '03',
        bondType:         '8',                     // Continuous
        bondHolderID:     '30-1234567',

        // Shipment type
        ISFShipmentTypeCode: '01',
        entryTypeCode:       '00',

        // Booking Party — DUNS-format (9 digits)
        bookingPartyIdentifierCode: '1',
        bookingPartyTaxID:          '123456789',   // 9-digit DUNS
        bookingPartyName:           'Samsung Display Co Ltd',
        bookingPartyAddress1:       '1 Samsung-ro',
        bookingPartyAddress2:       'Tangjeong-myeon',
        bookingPartyCity:           'Asan',
        bookingPartyStateOrProvince:'CN',
        bookingPartyPostalCode:     '31454',
        bookingPartyCountry:        'KR',
        bookingPartyDateOfBirth:    '19900101',

        // Place of delivery (5-digit)
        placeOfDelivery:       '27040',
        foreignPortOfUnlading: '57078',
        estimateDateOfArrival: '20260428',
      },
    },
  });

  console.log(`✅ ISF-5 Draft created:  ${isf5.id}`);
  console.log(`   BOL: ${isf5.masterBol}  |  Vessel: ${isf5.vesselName}`);

  // ───────────────────────────────────────────────────────
  // 2.  ISF-10+2 Draft — Furniture from Vietnam
  // ───────────────────────────────────────────────────────
  const isf10 = await prisma.filing.create({
    data: {
      orgId:       ORG_ID,
      createdById: USER_ID,
      filingType:  'ISF-10',
      status:      'draft',

      importerName:   'US Imports Inc',
      importerNumber: '12-3456789',              // EIN

      consigneeName:   'US Imports Inc',
      consigneeNumber: '12-3456789',
      consigneeAddress: {
        address1: '789 Import Blvd',
        address2: 'Suite 100',
        city:     'Los Angeles',
        state:    'CA',
        zip:      '90012',
        country:  'US',
      },

      manufacturer: {
        name:     'Binh Duong Furniture JSC',
        address1: 'Lot C12, VSIP Industrial Park',
        city:     'Binh Duong',
        state:    'BD',
        zip:      '820000',
        country:  'VN',
      },

      seller: {
        name:     'Vietnam Home Exports Co Ltd',
        address1: '88 Le Loi Street',
        city:     'Ho Chi Minh City',
        state:    'SG',
        zip:      '700000',
        country:  'VN',
      },

      buyer: {
        name:     'US Imports Inc',
        address1: '789 Import Blvd',
        address2: 'Suite 100',
        city:     'Los Angeles',
        state:    'CA',
        zip:      '90012',
        country:  'US',
      },

      shipToParty: {
        name:     'US Imports Warehouse',
        address1: '100 Warehouse Road',
        city:     'Long Beach',
        state:    'CA',
        zip:      '90802',
        country:  'US',
      },

      containerStuffingLocation: {
        name:     'Cat Lai International Terminal',
        address1: 'Nguyen Thi Dinh Road',
        city:     'Ho Chi Minh City',
        state:    'SG',
        zip:      '700000',
        country:  'VN',
      },

      consolidator: {
        name:     'Maersk Vietnam Logistics',
        address1: '35 Nguyen Hue Blvd',
        city:     'Ho Chi Minh City',
        state:    'SG',
        zip:      '700000',
        country:  'VN',
      },

      masterBol:    'MAEU2026040702',
      scacCode:     'MAEU',
      vesselName:   'Maersk Eindhoven',
      voyageNumber: 'VY-2026-203',

      foreignPortOfUnlading: '55899',            // 5-digit Schedule D: Ho Chi Minh City
      placeOfDelivery:       '2704',             // 4-digit CBP: Los Angeles

      estimatedDeparture: new Date('2026-04-10'),
      estimatedArrival:   new Date('2026-04-30'),
      filingDeadline:     new Date('2026-04-09'),

      bondType: 'continuous',

      commodities: [
        {
          htsCode:         '940161',              // 6-digit HTS: Upholstered seats
          countryOfOrigin: 'VN',
          description:     'Upholstered wooden dining chairs',
          quantity:        500,
          quantityUOM:     'PCS',
          weight:          { value: 4000, unit: 'K' },
        },
        {
          htsCode:         '940350',              // 6-digit HTS: Wooden bedroom furniture
          countryOfOrigin: 'VN',
          description:     'Wooden bedroom dressers',
          quantity:        200,
          quantityUOM:     'PCS',
          weight:          { value: 6000, unit: 'K' },
        },
      ],

      containers: [
        { number: 'MAEU1122334', type: '40HC', sealNumber: 'SEAL-VN-101' },
        { number: 'MAEU1122335', type: '40HC', sealNumber: 'SEAL-VN-102' },
      ],
    },
  });

  console.log(`✅ ISF-10 Draft created: ${isf10.id}`);
  console.log(`   BOL: ${isf10.masterBol}  |  Vessel: ${isf10.vesselName}`);
  console.log('');
  console.log('🎉 Both drafts ready — go to Shipments and submit them!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
