import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const filing = await p.filing.findFirst({ where: { masterBol: 'MAEU2026040702' } });
  if (filing == null) {
    console.log('Filing not found');
    return;
  }
  console.log('Found filing:', filing.id, 'status:', filing.status, 'houseBol:', filing.houseBol);

  // Clean up related records
  await p.submissionLog.deleteMany({ where: { filingId: filing.id } });
  await p.filingStatusHistory.deleteMany({ where: { filingId: filing.id } });
  await p.notification.deleteMany({ where: { filingId: filing.id } });

  // Reset to draft + add house BOL
  await p.filing.update({
    where: { id: filing.id },
    data: {
      status: 'draft',
      rejectedAt: null,
      rejectionReason: null,
      submittedAt: null,
      ccFilingId: null,
      houseBol: 'MAEU2026040702H1',
    },
  });

  console.log('✅ Reset to draft + added houseBol: MAEU2026040702H1');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
