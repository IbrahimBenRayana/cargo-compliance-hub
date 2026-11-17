/**
 * Native manifest query (docs/specs/native-manifest-query.md): ask CBP what
 * it has on file for a bill through our own engine (CQ), and settle the
 * manifest_queries row from CBP's reply (C1).
 *
 *   1. startNativeManifestQuery: transmitNative stores the wire, tagged in
 *      the B-record user data, then sends it.
 *   2. manifestQueryHandler (inbound dispatcher): the reply carrying that
 *      tag is parsed into the stored answer and the asker is notified.
 *   3. awaitManifestAnswer: pulls the queue for a while after sending; no
 *      reply marks the query timed out. A late reply still completes it.
 *
 * CQ is not yet proven on our CBP profile, so MANIFEST_QUERY_NATIVE gates
 * who gets this path (usesNativeManifestQuery).
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import { buildManifestQuery, type ManifestQueryRequest } from '../../abi-engine/apps/manifestQuery/builder.js';
import { buildBatch } from '../../abi-engine/envelope/batch.js';
import { notify } from '../notifications.js';
import { seesRollout } from '../rollout.js';
import type { InboundHandler } from './dispatcher.js';
import { SIGMA_FILER_CODE, loadOrgCbpConfig } from './filerIdentity.js';
import { manifestAnswerFromWire } from './manifestQueryAnswer.js';
import { transmitNative, type NativeTransmitResult } from './nativeTransmit.js';
import { requireCbpSender } from './sender.js';
import { cbpTransport, cbpTrafficConfig } from './transport.js';

const ENTITY_TYPE = 'manifest_query';
const ANSWER_WAIT_MS = 60_000;

/** Native when the org files natively (the default) and the rollout reaches this person. */
export async function usesNativeManifestQuery(user: { orgId: string; isPlatformAdmin: boolean }): Promise<boolean> {
  if (!seesRollout(env.MANIFEST_QUERY_NATIVE, user.isPlatformAdmin)) return false;
  const cbpConfig = await loadOrgCbpConfig(user.orgId);
  return (cbpConfig?.gateway ?? 'NATIVE') === 'NATIVE';
}

/** A production server not connected to CBP must say so, never pretend. */
export function cbpConnected(): boolean {
  return !(cbpTrafficConfig.transport === 'mock' && env.NODE_ENV === 'production');
}

/** Bill queries are not tied to an entry filer, so they go out under our own code. */
export function startNativeManifestQuery(opts: {
  queryId: string;
  orgId: string;
  bolNumber: string;
  request: ManifestQueryRequest;
}): Promise<NativeTransmitResult> {
  const transactionLines = buildManifestQuery([opts.request]);
  const sender = requireCbpSender();
  return transmitNative({
    transport: cbpTransport,
    orgId: opts.orgId,
    environment: cbpTrafficConfig.transport === 'mock' ? 'MOCK' : cbpTrafficConfig.environment === 'PROD' ? 'PROD' : 'CERT',
    application: 'CQ',
    entityType: ENTITY_TYPE,
    entityId: opts.queryId,
    filerCode: SIGMA_FILER_CODE,
    reference: opts.bolNumber.slice(0, 35),
    buildWire: (userDataTag) =>
      buildBatch({
        sender,
        appId: 'CQ',
        blocks: [{ port: sender.siteCode, filerCode: SIGMA_FILER_CODE, userData: userDataTag, transactionLines }],
      }),
  });
}

async function notifyAsker(query: { id: string; orgId: string; userId: string; bolNumber: string }, failure?: string): Promise<void> {
  await notify({
    kind: failure ? 'manifest_query_failed' : 'manifest_query_complete',
    audience: { orgId: query.orgId, userIds: [query.userId] },
    title: failure ? 'Manifest Query Failed' : 'Manifest Query Ready',
    message: failure ? `Couldn't fetch results for ${query.bolNumber}: ${failure}` : `Results for ${query.bolNumber} are available.`,
    linkUrl: `/manifest-query?id=${query.id}`,
    metadata: { bolNumber: query.bolNumber, queryId: query.id, ...(failure && { error: failure }) },
  });
}

/** Dispatcher handler: CBP's reply to one of our tagged CQ transmissions. */
export const manifestQueryHandler: InboundHandler = async (row) => {
  if (!row.userDataTag?.startsWith('MCL')) return null;
  const tx = await prisma.cbpTransmission.findUnique({ where: { userDataTag: row.userDataTag } });
  if (!tx || tx.entityType !== ENTITY_TYPE || !tx.entityId) return null;
  const query = await prisma.manifestQuery.findUnique({ where: { id: tx.entityId } });
  if (!query) return null;

  const answer = manifestAnswerFromWire(row.lines, {
    bolNumber: query.bolNumber,
    bolType: query.bolType === 'AWBNUMBER' ? 'AWBNUMBER' : 'BOLNUMBER',
  });
  await prisma.cbpTransmission.update({
    where: { id: tx.id },
    data: { status: answer.status === 'completed' ? 'ACCEPTED' : 'REJECTED', respondedAt: new Date() },
  });
  // First reply wins; one that arrives after the wait gave up still counts.
  if (query.status === 'pending' || query.status === 'timeout') {
    await prisma.manifestQuery.update({
      where: { id: query.id },
      data:
        answer.status === 'completed'
          ? { status: 'completed', response: answer.response as unknown as Prisma.InputJsonValue, errorMessage: null, completedAt: new Date() }
          : { status: 'failed', errorMessage: answer.errorMessage },
    });
    await notifyAsker(query, answer.status === 'failed' ? answer.errorMessage : undefined);
  }
  return {
    entityType: ENTITY_TYPE,
    entityId: query.id,
    transmissionId: tx.id,
    parsed: answer.status === 'completed' ? answer.response.native : { errorMessage: answer.errorMessage },
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pull the queue until the query is settled or the wait runs out, then mark
 * it timed out. Takes the queue reader as an argument because the inbound
 * job imports this module's handler.
 */
export async function awaitManifestAnswer(
  queryId: string,
  pull: (opts: { timeoutMs: number }) => Promise<unknown>,
  waitMs = ANSWER_WAIT_MS,
): Promise<void> {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    try {
      await pull({ timeoutMs: 2000 });
    } catch (err) {
      logger.warn({ err, queryId }, 'Manifest query: reading CBP responses failed');
    }
    const query = await prisma.manifestQuery.findUnique({ where: { id: queryId }, select: { status: true } });
    if (!query || query.status !== 'pending') return;
    await sleep(1000);
  }
  const errorMessage = `No response from CBP after ${Math.round(waitMs / 1000)} seconds.`;
  const timedOut = await prisma.manifestQuery.updateMany({ where: { id: queryId, status: 'pending' }, data: { status: 'timeout', errorMessage } });
  if (timedOut.count === 0) return;
  const query = await prisma.manifestQuery.findUnique({ where: { id: queryId } });
  if (query) await notifyAsker(query, 'no response from CBP yet. Check again later.');
}
