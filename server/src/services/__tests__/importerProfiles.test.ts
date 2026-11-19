import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: { importerProfile: { findUnique: vi.fn(), upsert: vi.fn() } },
}));
vi.mock('../../config/database.js', () => ({ prisma }));

import { profileFromIor, rememberImporter, savedAttestation } from '../importerProfiles.js';

const ana = { id: 'u-1', email: 'ana@broker.test' };
const ben = { id: 'u-2', email: 'ben@broker.test' };
const usIor = {
  number: '123456789', name: 'ACME', usImporterOfRecord: true,
  usIorAttestedById: 'u-1', usIorAttestedByEmail: 'ana@broker.test', usIorAttestedAt: '2026-11-16T10:00:00.000Z',
};
const t = new Date('2026-11-17T09:00:00Z');

beforeEach(() => vi.clearAllMocks());

describe('profileFromIor', () => {
  it('takes a U.S. declarer from the attestation stamp and canonicalizes the number', () => {
    expect(profileFromIor(usIor, ben, t)).toMatchObject({
      iorNumber: '12-3456789', iorNumberType: 'EI', usIorStatus: 'US', declaredById: 'u-1',
      declaredAt: new Date('2026-11-16T10:00:00.000Z'),
    });
  });

  it('skips an unattested U.S. answer, a missing answer, or an invalid number', () => {
    expect(profileFromIor({ number: '12-3456789', usImporterOfRecord: true }, ana)).toBeNull();
    expect(profileFromIor({ number: '12-3456789' }, ana)).toBeNull();
    expect(profileFromIor({ number: 'ACME', usImporterOfRecord: false }, ana)).toBeNull();
  });

  it('records the saving user as declarer of a foreign answer', () => {
    expect(profileFromIor({ number: '261303-12345', usImporterOfRecord: false, ctpatStatus: 'NONE' }, ben, t)).toMatchObject({
      iorNumberType: 'ANI', usIorStatus: 'FOREIGN', ctpatStatus: 'NONE', declaredById: 'u-2', declaredAt: t,
    });
  });
});

describe('rememberImporter', () => {
  it('creates a profile for a new importer', async () => {
    prisma.importerProfile.findUnique.mockResolvedValue(null);
    await rememberImporter('o1', usIor, ben);
    expect(prisma.importerProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ orgId: 'o1', iorNumber: '12-3456789', usIorStatus: 'US', ctpatStatus: 'UNKNOWN', declaredById: 'u-1' }),
    }));
  });

  it('does not write when nothing changed (autosave runs on every keystroke)', async () => {
    prisma.importerProfile.findUnique.mockResolvedValue({
      usIorStatus: 'FOREIGN', ctpatStatus: 'NONE', name: 'ACME', declaredById: 'u-1', declaredByEmail: 'a', declaredAt: new Date(0),
    });
    await rememberImporter('o1', { number: '12-3456789', name: 'ACME', usImporterOfRecord: false, ctpatStatus: 'NONE' }, ben);
    expect(prisma.importerProfile.upsert).not.toHaveBeenCalled();
  });

  it('keeps the original foreign declarer when only the CTPAT answer changes', async () => {
    const declaredAt = new Date(0);
    prisma.importerProfile.findUnique.mockResolvedValue({
      usIorStatus: 'FOREIGN', ctpatStatus: 'UNKNOWN', name: 'ACME', declaredById: 'u-1', declaredByEmail: 'a', declaredAt,
    });
    await rememberImporter('o1', { number: '12-3456789', usImporterOfRecord: false, ctpatStatus: 'VALIDATED' }, ben);
    expect(prisma.importerProfile.upsert.mock.calls[0][0].update).toMatchObject({ ctpatStatus: 'VALIDATED', declaredById: 'u-1', declaredAt });
  });

  it('re-declares when the answer flips', async () => {
    prisma.importerProfile.findUnique.mockResolvedValue({
      usIorStatus: 'FOREIGN', ctpatStatus: 'NONE', name: 'ACME', declaredById: 'u-2', declaredByEmail: 'b', declaredAt: new Date(0),
    });
    await rememberImporter('o1', usIor, ben);
    expect(prisma.importerProfile.upsert.mock.calls[0][0].update).toMatchObject({ usIorStatus: 'US', declaredById: 'u-1' });
  });
});

describe('savedAttestation', () => {
  it('returns the saved U.S. declarer, nothing for foreign or unknown importers', async () => {
    prisma.importerProfile.findUnique.mockResolvedValueOnce({
      usIorStatus: 'US', declaredById: 'u-1', declaredByEmail: 'ana@broker.test', declaredAt: new Date('2026-11-16T10:00:00Z'),
    });
    expect(await savedAttestation('o1', '12-3456789')).toEqual({
      usIorAttestedById: 'u-1', usIorAttestedByEmail: 'ana@broker.test', usIorAttestedAt: '2026-11-16T10:00:00.000Z',
    });
    prisma.importerProfile.findUnique.mockResolvedValueOnce({ usIorStatus: 'FOREIGN' });
    expect(await savedAttestation('o1', '12-3456789')).toBeUndefined();
    expect(await savedAttestation('o1', 'bad')).toBeUndefined();
  });
});
