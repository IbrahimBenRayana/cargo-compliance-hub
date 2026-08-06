/**
 * CLI: ingest the full USITC HTS into hts_rate_lines.
 *
 *   npm run hts:ingest -- <revision> [firstChapter] [lastChapter]
 *   e.g. npm run hts:ingest -- 2026-rev-15
 *
 * Idempotent per chapter (delete + insert). Run quarterly / on USITC
 * revision announcements; the revision tag records provenance.
 */
import { PrismaClient } from '@prisma/client';
import { ingestChapter } from './usitcHts.js';

async function main(): Promise<void> {
  const [revision, firstArg, lastArg] = process.argv.slice(2);
  if (!revision) {
    console.error('usage: hts:ingest <revision> [firstChapter] [lastChapter]');
    process.exit(1);
  }
  const first = Number(firstArg ?? '1');
  const last = Number(lastArg ?? '99');

  const prisma = new PrismaClient();
  let total = 0;
  try {
    for (let n = first; n <= last; n++) {
      const chapter = String(n).padStart(2, '0');
      try {
        const count = await ingestChapter(prisma.htsRateLine, chapter, revision);
        total += count;
        console.log(`chapter ${chapter}: ${count} lines`);
      } catch (err) {
        // Chapter 77 is reserved/empty; anything else is a real failure.
        if (chapter === '77') continue;
        throw err;
      }
    }
    console.log(`done: ${total} rate lines (${revision})`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
