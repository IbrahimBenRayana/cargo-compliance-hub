/**
 * Native ISF transmission (native go-live 3.3): add, replace or delete an
 * ISF through our own certified engine.
 *
 *   1. lifecycle allows the action (isfLifecycle)
 *   2. filer identity: ADD resolves SIGMA (S7P) or the client's code;
 *      REPLACE / DELETE reuse the code CBP accepted the ISF under
 *   3. map + build with the honest mapper; missing data -> 422 with fields
 *   4. atomic claim (pendingAction) so concurrent submits cannot both send
 *   5. transmitNative: row first, then send; FAILED rolls back, UNKNOWN
 *      stays awaiting CBP, SENT waits for CBP's response (isfVerdicts)
 */
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { mapFilingToIsfInput, type PlatformIsfFiling } from '../../abi-engine/isf/fromFiling.js';
import { buildIsf } from '../../abi-engine/isf/builder.js';
import { buildBatch } from '../../abi-engine/envelope/batch.js';
import { RecordCodecError } from '../../abi-engine/records/codec.js';
import { notifyFilingSubmitted } from '../notifications.js';
import { canStartIsfAction, isfStateOnStart, isfStateOnSendFailed, type IsfAction } from './isfLifecycle.js';
import { loadOrgCbpConfig, resolveIsfFiler } from './filerIdentity.js';
import { transmitNative } from './nativeTransmit.js';
import { cbpTransport, cbpTrafficConfig } from './transport.js';
import { requireCbpSender } from './sender.js';

const ACTION_CODE: Record<IsfAction, 'A' | 'R' | 'D'> = { ADD: 'A', REPLACE: 'R', DELETE: 'D' };

export interface IsfTransmitOutcome {
  httpStatus: number;
  body: Record<string, unknown>;
}

export async function transmitIsfNative(opts: {
  filingId: string;
  orgId: string;
  userId: string;
  action: IsfAction;
}): Promise<IsfTransmitOutcome> {
  // A production server not connected to CBP must say so, never pretend.
  if (cbpTrafficConfig.transport === 'mock' && env.NODE_ENV === 'production') {
    return { httpStatus: 503, body: { error: 'This server is not connected to CBP yet.', code: 'CBP_NOT_CONNECTED' } };
  }

  const filing = await prisma.filing.findFirst({ where: { id: opts.filingId, orgId: opts.orgId } });
  if (!filing) return { httpStatus: 404, body: { error: 'Filing not found' } };

  const allowed = canStartIsfAction(filing, opts.action);
  if (!allowed.ok) return { httpStatus: 409, body: { error: allowed.reason, code: 'ISF_ACTION_NOT_ALLOWED' } };

  let filerCode: string;
  if (opts.action === 'ADD') {
    const decision = resolveIsfFiler(await loadOrgCbpConfig(opts.orgId), filing.isfFilerMode);
    if (!decision.ok) return { httpStatus: 409, body: { error: decision.message, code: decision.code } };
    filerCode = decision.filerCode;
  } else {
    if (!filing.isfFilerCode || !filing.cbpTransactionId) {
      return { httpStatus: 409, body: { error: 'This ISF has no CBP transaction on file to amend or delete.', code: 'ISF_NOT_ON_FILE' } };
    }
    filerCode = filing.isfFilerCode;
  }

  let transactionLines: string[];
  try {
    const input = mapFilingToIsfInput(filing as unknown as PlatformIsfFiling, {
      action: ACTION_CODE[opts.action],
      isfTransactionNumber: filing.cbpTransactionId ?? undefined,
    });
    transactionLines = buildIsf(input);
  } catch (err) {
    if (err instanceof RecordCodecError) {
      return {
        httpStatus: 422,
        body: { error: 'This ISF is missing required information.', code: 'ISF_DATA_INCOMPLETE', issues: err.issues },
      };
    }
    throw err;
  }

  const sender = requireCbpSender();
  const started = isfStateOnStart(filing, opts.action);
  const claimed = await prisma.filing.updateMany({
    where: { id: filing.id, pendingAction: null, status: filing.status },
    data: { status: started.status, pendingAction: started.pendingAction, ...(opts.action === 'ADD' && { submittedAt: new Date() }) },
  });
  if (claimed.count === 0) {
    return { httpStatus: 409, body: { error: 'This ISF is already being transmitted.', code: 'ISF_ALREADY_PENDING' } };
  }

  const result = await transmitNative({
    transport: cbpTransport,
    orgId: opts.orgId,
    environment: cbpTrafficConfig.transport === 'mock' ? 'MOCK' : cbpTrafficConfig.environment === 'PROD' ? 'PROD' : 'CERT',
    application: 'SF',
    action: ACTION_CODE[opts.action],
    entityType: 'filing',
    entityId: filing.id,
    filerCode,
    isfTransactionNumber: filing.cbpTransactionId ?? undefined,
    buildWire: (userDataTag) =>
      buildBatch({
        sender,
        appId: 'SF',
        blocks: [{ port: sender.siteCode, filerCode, userData: userDataTag, transactionLines }],
      }),
  });

  if (result.status === 'FAILED') {
    const back = isfStateOnSendFailed(started);
    await prisma.filing.update({
      where: { id: filing.id },
      data: { status: back.status, pendingAction: back.pendingAction, lastTransmissionId: result.id },
    });
    return { httpStatus: 502, body: { error: 'The ISF could not be sent to CBP. Nothing was transmitted; you can try again.', detail: result.lastError } };
  }

  await prisma.filing.update({ where: { id: filing.id }, data: { lastTransmissionId: result.id } });
  await prisma.filingStatusHistory.create({
    data: {
      filingId: filing.id,
      status: started.status,
      message: `ISF ${opts.action.toLowerCase()} transmitted to CBP under filer ${filerCode}` +
        (result.status === 'UNKNOWN' ? ' (outcome unknown; awaiting CBP)' : ''),
      changedById: opts.userId,
    },
  });
  if (opts.action === 'ADD') {
    await notifyFilingSubmitted(opts.orgId, opts.userId, filing.id, filing.houseBol || filing.masterBol || '');
  }
  return {
    httpStatus: 202,
    body: { transmissionId: result.id, outcome: result.status, filerCode, status: started.status, pendingAction: started.pendingAction },
  };
}
