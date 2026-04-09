import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'US Imports Inc.',
      iorNumber: 'IOR-2026-0001',
      ccEnvironment: 'sandbox',
      onboardingCompleted: true,
    },
  });

  // Create demo user (password: "password123")
  const passwordHash = await bcrypt.hash('password123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@mycargolens.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      orgId: org.id,
      email: 'demo@mycargolens.com',
      passwordHash,
      firstName: 'Ibrahim',
      lastName: 'Ben Rayana',
      role: 'owner',
      emailVerified: true,
    },
  });

  // Create sample filings
  const filings = [
    {
      orgId: org.id,
      createdById: user.id,
      filingType: 'ISF-10',
      status: 'draft',
      importerName: 'US Imports Inc.',
      importerNumber: 'IOR-2026-0001',
      consigneeName: 'US Imports Warehouse',
      consigneeNumber: 'CON-12345',
      manufacturer: { name: 'Shenzhen Electronics Co.', address1: '123 Tech Park', city: 'Shenzhen', country: 'CN' },
      seller: { name: 'Global Trade Ltd.', address1: '456 Commerce Ave', city: 'Hong Kong', country: 'HK' },
      buyer: { name: 'US Imports Inc.', address1: '789 Import Blvd', city: 'Los Angeles', state: 'CA', zip: '90012', country: 'US' },
      shipToParty: { name: 'US Imports Warehouse', address1: '100 Warehouse Rd', city: 'Long Beach', state: 'CA', zip: '90802', country: 'US' },
      containerStuffingLocation: { name: 'Shenzhen Port Terminal', address1: 'Yantian District', city: 'Shenzhen', country: 'CN' },
      consolidator: { name: 'Pacific Consolidators', address1: '55 Port Road', city: 'Hong Kong', country: 'HK' },
      masterBol: 'MAEU1234567',
      scacCode: 'MAEU',
      vesselName: 'MSC Carolina',
      voyageNumber: 'VY-2026-045',
      foreignPortOfUnlading: 'CNSZX',
      placeOfDelivery: 'USLAX',
      estimatedDeparture: new Date('2026-04-05'),
      estimatedArrival: new Date('2026-04-25'),
      filingDeadline: new Date('2026-04-04'),
      bondType: 'continuous',
      commodities: [
        { htsCode: '8471.30.0100', countryOfOrigin: 'CN', description: 'Laptop computers', quantity: 500, weight: { value: 2500, unit: 'KG' }, value: { amount: 250000, currency: 'USD' } },
      ],
      containers: [
        { number: 'MSKU1234567', type: '40HC', sealNumber: 'SEAL001' },
      ],
    },
    {
      orgId: org.id,
      createdById: user.id,
      filingType: 'ISF-10',
      status: 'submitted',
      importerName: 'US Imports Inc.',
      importerNumber: 'IOR-2026-0001',
      manufacturer: { name: 'Toyota Motor Corp', address1: '1 Toyota-cho', city: 'Toyota City', country: 'JP' },
      seller: { name: 'Japan Auto Exports', address1: '2-1 Marunouchi', city: 'Tokyo', country: 'JP' },
      buyer: { name: 'US Imports Inc.', address1: '789 Import Blvd', city: 'Los Angeles', state: 'CA', zip: '90012', country: 'US' },
      shipToParty: { name: 'LA Auto Distribution', address1: '500 Auto Row', city: 'Torrance', state: 'CA', country: 'US' },
      containerStuffingLocation: { name: 'Yokohama Port', address1: 'Naka-ku', city: 'Yokohama', country: 'JP' },
      consolidator: { name: 'NYK Logistics', address1: '3-2 Marunouchi', city: 'Tokyo', country: 'JP' },
      masterBol: 'NYKU7654321',
      scacCode: 'NYKU',
      vesselName: 'NYK Olympus',
      voyageNumber: 'VY-2026-112',
      foreignPortOfUnlading: 'JPYOK',
      placeOfDelivery: 'USLAX',
      estimatedDeparture: new Date('2026-03-28'),
      estimatedArrival: new Date('2026-04-15'),
      filingDeadline: new Date('2026-03-27'),
      submittedAt: new Date('2026-03-26'),
      bondType: 'continuous',
      commodities: [
        { htsCode: '8703.23.0000', countryOfOrigin: 'JP', description: 'Passenger vehicles', quantity: 100, weight: { value: 150000, unit: 'KG' }, value: { amount: 2500000, currency: 'USD' } },
      ],
      containers: [
        { number: 'NYKU2345678', type: '40HC', sealNumber: 'SEAL002' },
        { number: 'NYKU2345679', type: '40HC', sealNumber: 'SEAL003' },
      ],
    },
    {
      orgId: org.id,
      createdById: user.id,
      filingType: 'ISF-10',
      status: 'accepted',
      importerName: 'US Imports Inc.',
      importerNumber: 'IOR-2026-0001',
      manufacturer: { name: 'Vietnam Textile Co.', address1: '10 Industrial Zone', city: 'Ho Chi Minh City', country: 'VN' },
      seller: { name: 'ASEAN Garments Ltd.', address1: '20 Trade St', city: 'Ho Chi Minh City', country: 'VN' },
      buyer: { name: 'US Imports Inc.', address1: '789 Import Blvd', city: 'Los Angeles', state: 'CA', country: 'US' },
      shipToParty: { name: 'East Coast Warehouse', address1: '300 Harbor Dr', city: 'Newark', state: 'NJ', country: 'US' },
      containerStuffingLocation: { name: 'Cat Lai Port', address1: 'Thu Duc District', city: 'Ho Chi Minh City', country: 'VN' },
      consolidator: { name: 'Maersk Logistics', address1: '15 Port Blvd', city: 'Ho Chi Minh City', country: 'VN' },
      masterBol: 'MAEU9876543',
      scacCode: 'MAEU',
      vesselName: 'Maersk Sealand',
      voyageNumber: 'VY-2026-078',
      foreignPortOfUnlading: 'VNSGN',
      placeOfDelivery: 'USEWR',
      estimatedDeparture: new Date('2026-03-15'),
      estimatedArrival: new Date('2026-04-10'),
      filingDeadline: new Date('2026-03-14'),
      submittedAt: new Date('2026-03-13'),
      acceptedAt: new Date('2026-03-13'),
      bondType: 'single',
      commodities: [
        { htsCode: '6204.62.4000', countryOfOrigin: 'VN', description: 'Cotton trousers, women\'s', quantity: 5000, weight: { value: 3000, unit: 'KG' }, value: { amount: 75000, currency: 'USD' } },
        { htsCode: '6205.20.2065', countryOfOrigin: 'VN', description: 'Cotton shirts, men\'s', quantity: 3000, weight: { value: 1500, unit: 'KG' }, value: { amount: 45000, currency: 'USD' } },
      ],
      containers: [
        { number: 'MAEU5432100', type: '20GP', sealNumber: 'SEAL010' },
      ],
    },
    {
      orgId: org.id,
      createdById: user.id,
      filingType: 'ISF-10',
      status: 'rejected',
      importerName: 'US Imports Inc.',
      importerNumber: 'IOR-2026-0001',
      manufacturer: { name: 'Guangzhou Furniture', address1: '88 Craft Rd', city: 'Guangzhou', country: 'CN' },
      seller: { name: 'China Home Exports', address1: '99 Trade Ave', city: 'Guangzhou', country: 'CN' },
      buyer: { name: 'US Imports Inc.', address1: '789 Import Blvd', city: 'Los Angeles', state: 'CA', country: 'US' },
      shipToParty: { name: 'US Imports Warehouse', address1: '100 Warehouse Rd', city: 'Long Beach', state: 'CA', country: 'US' },
      containerStuffingLocation: { name: 'Nansha Port', address1: 'Nansha District', city: 'Guangzhou', country: 'CN' },
      consolidator: { name: 'Cosco Logistics', address1: '5 Shipping Rd', city: 'Guangzhou', country: 'CN' },
      masterBol: 'COSU1111111',
      scacCode: 'COSU',
      vesselName: 'COSCO Galaxy',
      voyageNumber: 'VY-2026-033',
      foreignPortOfUnlading: 'CNGZH',
      placeOfDelivery: 'USLAX',
      estimatedDeparture: new Date('2026-03-20'),
      estimatedArrival: new Date('2026-04-08'),
      filingDeadline: new Date('2026-03-19'),
      submittedAt: new Date('2026-03-18'),
      rejectedAt: new Date('2026-03-18'),
      rejectionReason: 'Invalid HTS code format: 9401.XX does not exist in the Harmonized Tariff Schedule',
      bondType: 'continuous',
      commodities: [
        { htsCode: '9401.XX', countryOfOrigin: 'CN', description: 'Wooden furniture sets', quantity: 200, weight: { value: 8000, unit: 'KG' }, value: { amount: 120000, currency: 'USD' } },
      ],
      containers: [
        { number: 'COSU3333333', type: '40HC', sealNumber: 'SEAL020' },
      ],
    },
    {
      orgId: org.id,
      createdById: user.id,
      filingType: 'ISF-5',
      status: 'draft',
      importerName: 'US Imports Inc.',
      masterBol: 'HLCU5555555',
      scacCode: 'HLCU',
      vesselName: 'Hapag Explorer',
      voyageNumber: 'VY-2026-090',
      foreignPortOfUnlading: 'DEHAM',
      placeOfDelivery: 'USNYC',
      estimatedDeparture: new Date('2026-04-10'),
      estimatedArrival: new Date('2026-04-22'),
      filingDeadline: new Date('2026-04-09'),
      commodities: [
        { htsCode: '8429.52.1000', countryOfOrigin: 'DE', description: 'Hydraulic excavators', quantity: 5 },
      ],
      containers: [
        { number: 'HLCU7777777', type: '40OT', sealNumber: 'SEAL030' },
      ],
    },
  ];

  for (const filingData of filings) {
    await prisma.filing.create({ data: filingData });
  }

  console.log(`✅ Created ${filings.length} sample filings`);
  console.log('✅ Seed complete!');
  console.log('');
  console.log('📧 Demo login: demo@mycargolens.com / password123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
