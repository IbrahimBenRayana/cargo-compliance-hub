/**
 * Exactly-once transmission to CBP (native go-live 1.7; audit ENG-12, BPR-06).
 *
 * 1. Allocate the transmission id and its correlation tag, build the wire
 *    with the tag in the B-record user data (CBP echoes it back), and store
 *    the row as QUEUED before anything is sent.
 * 2. Send. Success -> SENT with the MQ MsgId.
 *    An answer can land before the send returns, so these writes only move a
 *    row that is still QUEUED and never overwrite CBP's verdict.
 * 3. Failure is classified, never retried here:
 *    - FAILED: provably never left (environment guard refusal, bridge
 *      unreachable), so the caller may retry with a new transmission;
 *    - UNKNOWN: it may have reached CBP. A blind retry could file twice, so
 *      the outcome is settled from CBP's response or by a person.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/database.js';
import type { AbiTransport } from '../../abi-engine/transport/contract.js';
import { CbpEnvironmentMismatchError, CbpTransportUnavailableError } from './guardedTransport.js';

/** B-record user data is 21 characters: "MCL" + 18 hex of the transmission id. */
export function correlationTag(transmissionId: string): string {
  return `MCL${transmissionId.replace(/-/g, '').slice(0, 18).toUpperCase()}`;
}

function provablyNotSent(err: unknown): boolean {
  if (err instanceof CbpEnvironmentMismatchError || err instanceof CbpTransportUnavailableError) return true;
  // MqiptTransport: fetch rejected before any request reached the bridge.
  return err instanceof Error && err.message.startsWith('mq-bridge unreachable');
}

export interface NativeTransmitInput {
  /** The id the caller claimed the filing with, so a response can match from the first moment. */
  id?: string;
  transport: Pick<AbiTransport, 'send'>;
  orgId: string | null;
  environment: 'CERT' | 'PROD' | 'MOCK';
  application: string;
  action?: string;
  entityType: string;
  entityId: string;
  filerCode: string;
  entryNumber?: string;
  isfTransactionNumber?: string;
  reference?: string;
  /** Build the complete batch with this tag as the B-record user data. */
  buildWire: (userDataTag: string) => string[];
}

export interface NativeTransmitResult {
  id: string;
  userDataTag: string;
  status: 'SENT' | 'FAILED' | 'UNKNOWN';
  mqMessageId?: string;
  lastError?: string;
}

export async function transmitNative(input: NativeTransmitInput): Promise<NativeTransmitResult> {
  const id = input.id ?? randomUUID();
  const userDataTag = correlationTag(id);
  const lines = input.buildWire(userDataTag);

  await prisma.cbpTransmission.create({
    data: {
      id,
      orgId: input.orgId,
      environment: input.environment,
      application: input.application,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      filerCode: input.filerCode,
      userDataTag,
      entryNumber: input.entryNumber,
      isfTransactionNumber: input.isfTransactionNumber,
      reference: input.reference,
      wireText: lines.join('\n'),
      status: 'QUEUED',
    },
  });

  try {
    const receipt = await input.transport.send(lines, { correlationId: userDataTag });
    const sentAt = new Date();
    const marked = await prisma.cbpTransmission.updateMany({
      where: { id, status: 'QUEUED' },
      data: { status: 'SENT', mqMessageId: receipt.messageId, sentAt },
    });
    if (marked.count === 0) {
      await prisma.cbpTransmission.update({ where: { id }, data: { mqMessageId: receipt.messageId, sentAt } });
    }
    return { id, userDataTag, status: 'SENT', mqMessageId: receipt.messageId };
  } catch (err) {
    const status = provablyNotSent(err) ? 'FAILED' : 'UNKNOWN';
    const lastError = err instanceof Error ? err.message : String(err);
    await prisma.cbpTransmission.updateMany({ where: { id, status: 'QUEUED' }, data: { status, lastError } });
    return { id, userDataTag, status, lastError };
  }
}
