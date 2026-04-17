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

  // ─── Plans ─────────────────────────────────────────────
  // stripePriceId is null until you create prices in Stripe Dashboard and
  // update these values (or re-seed after editing the IDs below).
  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'For evaluators and single-shipment importers',
      stripePriceId: null,
      stripeProductId: null,
      priceCents: 0,
      billingInterval: 'free',
      filingsIncluded: 2,
      maxSeats: 1,
      overageCents: 0,
      features: ['basic_dashboard', 'email_support', 'isf_10_2', 'isf_5'],
      isPublic: true,
      sortOrder: 0,
    },
    {
      id: 'grower_monthly',
      name: 'Grower',
      description: 'For small importers with consistent volume',
      stripePriceId: 'price_1TMtJpREhYOSzfjmVS4eUHBK',
      stripeProductId: 'prod_ULaUWbxxb6S0aq',
      priceCents: 9900,
      billingInterval: 'month',
      filingsIncluded: 15,
      maxSeats: 3,
      overageCents: 800,
      features: ['basic_dashboard', 'email_support', 'chat_support', 'isf_10_2', 'isf_5', 'audit_trail', 'csv_export', 'templates'],
      isPublic: true,
      sortOrder: 1,
    },
    {
      id: 'grower_annual',
      name: 'Grower',
      description: 'For small importers with consistent volume (annual)',
      stripePriceId: 'price_1TMtKfREhYOSzfjmt1CzPkoQ',
      stripeProductId: 'prod_ULaUWbxxb6S0aq',
      priceCents: 94800, // $948/yr = $79/mo
      billingInterval: 'year',
      filingsIncluded: 15,
      maxSeats: 3,
      overageCents: 800,
      features: ['basic_dashboard', 'email_support', 'chat_support', 'isf_10_2', 'isf_5', 'audit_trail', 'csv_export', 'templates'],
      isPublic: true,
      sortOrder: 2,
    },
    {
      id: 'scale_monthly',
      name: 'Scale',
      description: 'For growing teams and 3PLs',
      stripePriceId: 'price_1TMtLQREhYOSzfjmq2MnD5aR',
      stripeProductId: 'prod_ULaWeZKXhlq7QU',
      priceCents: 29900,
      billingInterval: 'month',
      filingsIncluded: 60,
      maxSeats: 10,
      overageCents: 800,
      features: ['everything_in_grower', 'bulk_csv_import', 'api_access', 'priority_support_4h', 'custom_roles'],
      isPublic: true,
      sortOrder: 3,
    },
    {
      id: 'scale_annual',
      name: 'Scale',
      description: 'For growing teams and 3PLs (annual)',
      stripePriceId: 'price_1TMtM4REhYOSzfjmhFup9sxD',
      stripeProductId: 'prod_ULaWeZKXhlq7QU',
      priceCents: 286800, // $2868/yr = $239/mo
      billingInterval: 'year',
      filingsIncluded: 60,
      maxSeats: 10,
      overageCents: 800,
      features: ['everything_in_grower', 'bulk_csv_import', 'api_access', 'priority_support_4h', 'custom_roles'],
      isPublic: true,
      sortOrder: 4,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Unlimited filings, SSO, SLA, dedicated support',
      stripePriceId: null, // negotiated per-contract
      stripeProductId: null,
      priceCents: 0, // custom
      billingInterval: 'year',
      filingsIncluded: 999999,
      maxSeats: 999999,
      overageCents: 0,
      features: ['everything_in_scale', 'sso', 'dedicated_csm', 'uptime_sla', 'custom_integrations', 'soc2_report'],
      isPublic: false, // show "Contact us" in UI, not in the card list
      sortOrder: 5,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }
  console.log(`✓ Seeded ${plans.length} plans`);

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
