/**
 * Entry-number block service — atomic draw + check-digit validation.
 *
 * The draw's single-statement UPDATE…RETURNING is what makes concurrent
 * draws safe (Postgres row lock); here we mock $queryRaw and lock the
 * branch behavior + formatting. The check digits asserted below are
 * engine-computed vectors (abi-engine/ae/checkDigit.ts, AE Table 1).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    entryNumberBlock: { count: vi.fn(), findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock('../../config/database.js', () => ({ prisma }));

import {
  drawEntryNumber,
  validateEntryNumber,
  EntryNumberDrawError,
} from '../entryNumberBlocks.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('drawEntryNumber', () => {
  it('draws the next sequence and appends the AE Table 1 check digit', async () => {
    // Block SP7 0000001–0001000, next was 1 → drawn 1, engine digit 4.
    prisma.$queryRaw.mockResolvedValue([
      { id: 'blk-1', filer_code: 'SP7', drawn: 1, range_end: 1000 },
    ]);

    const result = await drawEntryNumber('org-1');

    expect(result).toMatchObject({
      blockId: 'blk-1',
      filerCode: 'SP7',
      sequence: '0000001',
      checkDigit: 4,
      entryNumber: 'SP7-0000001-4',
    });
  });

  it('zero-pads the sequence to 7 digits', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 'blk-1', filer_code: '8CG', drawn: 12345, range_end: 99999 },
    ]);
    const result = await drawEntryNumber('org-1');
    expect(result.sequence).toBe('0012345');
    expect(result.entryNumber).toBe('8CG-0012345-4');
  });

  it('reports how many numbers remain in the block after the draw', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 'blk-1', filer_code: 'ABC', drawn: 1234567, range_end: 1234570 },
    ]);
    const result = await drawEntryNumber('org-1');
    expect(result.entryNumber).toBe('ABC-1234567-6');
    expect(result.remaining).toBe(3); // 1234568..1234570
  });

  it('throws no_blocks when the org has no active blocks at all', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.entryNumberBlock.count.mockResolvedValue(0);

    await expect(drawEntryNumber('org-1')).rejects.toMatchObject({
      code: 'no_blocks',
    });
    expect(prisma.entryNumberBlock.count).toHaveBeenCalledWith({
      where: { orgId: 'org-1', active: true },
    });
  });

  it('throws exhausted when active blocks exist but none has numbers left', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.entryNumberBlock.count.mockResolvedValue(2);

    await expect(drawEntryNumber('org-1')).rejects.toMatchObject({
      code: 'exhausted',
    });
  });

  it('wraps both failures in EntryNumberDrawError', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.entryNumberBlock.count.mockResolvedValue(0);
    await expect(drawEntryNumber('org-1')).rejects.toBeInstanceOf(EntryNumberDrawError);
  });
});

describe('validateEntryNumber', () => {
  it('accepts a correct hyphenated number and returns its canonical form', () => {
    expect(validateEntryNumber('SP7-0000001-4')).toEqual({
      valid: true,
      canonical: 'SP7-0000001-4',
    });
  });

  it('accepts the flat 11-char form and canonicalises it', () => {
    expect(validateEntryNumber('abc12345676')).toEqual({
      valid: true,
      canonical: 'ABC-1234567-6',
    });
  });

  it('rejects a wrong check digit and says which digit was expected', () => {
    const result = validateEntryNumber('ABC-1234567-9');
    expect(result.valid).toBe(false);
    expect(result.expectedCheckDigit).toBe(6);
    expect(result.message).toMatch(/check digit/i);
  });

  it('rejects malformed shapes without computing a digit', () => {
    for (const bad of ['12345', 'ABCD-1234567-6', 'AB-1234567-6', 'ABC-123-4']) {
      const result = validateEntryNumber(bad);
      expect(result.valid).toBe(false);
      expect(result.expectedCheckDigit).toBeUndefined();
    }
  });
});
