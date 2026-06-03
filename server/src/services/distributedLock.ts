/**
 * Cross-replica advisory lock for cron jobs.
 *
 * The in-process re-entrancy flags scattered through backgroundJobs.ts only
 * guarantee a single concurrent run *per process*. The moment we scale past
 * one replica every cron schedule fires N times — every replica polls CC,
 * every replica drains email, every replica reaps SENDING docs.
 *
 * Postgres advisory locks fix this with no schema changes: `pg_try_advisory_lock`
 * is process-scoped (session-scoped, actually), returns true if it got the lock
 * and false if another session already holds it. We grab a lock keyed off the
 * job name, run the job, release. Replicas that miss the lock log and skip —
 * exactly the behaviour the in-process flag already had for re-entrancy, now
 * extended across the whole cluster.
 *
 * Lock keys are int8 — derived from a stable string-hash of the job name so
 * adding a job doesn't require allocating a new magic number.
 */

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';

/** djb2 string hash → int32. Keeps keys stable across deploys. */
function hashKey(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  return h;
}

/**
 * Run `fn` only if this replica wins the advisory lock for `name`.
 * Returns `true` if the job ran, `false` if it was skipped (another holder).
 *
 * The lock is held for the duration of the connection used — Prisma's
 * `$queryRaw` borrows a connection from the pool for that single statement
 * and returns it. To hold the lock across the job we wrap in a
 * transaction-scoped `pg_try_advisory_xact_lock`, which Postgres releases
 * automatically when the transaction ends (success OR error).
 */
export async function withAdvisoryLock(
  name: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  const key = hashKey(name);
  let acquired = false;
  try {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${key}::int) AS locked
      `;
      if (!rows[0]?.locked) {
        logger.debug({ job: name }, '[Lock] another replica holds the lock — skipping');
        return;
      }
      acquired = true;
      await fn();
    }, { timeout: 10 * 60 * 1000 }); // 10 min — covers the longest job (status poll over a large filing list)
  } catch (err: any) {
    logger.error({ err: err?.message, job: name }, '[Lock] job execution failed');
    throw err;
  }
  return acquired;
}
