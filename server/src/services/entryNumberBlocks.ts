/**
 * Entry-number blocks — the filer's pre-issued number ranges, drawn
 * atomically so two concurrent filings can never be assigned the same
 * entry number.
 *
 * The draw is a single UPDATE … RETURNING with a FOR UPDATE subselect:
 * Postgres serialises concurrent draws on the block row, and READ
 * COMMITTED re-evaluates the WHERE after the lock wait, so an exhausted
 * block can't be over-drawn. Blocks are consumed oldest-first; when one
 * runs out the next active block takes over automatically.
 *
 * Check digits come from the certification engine (AE Table 1) — the
 * same code path a native transmit validates against.
 */
import { prisma } from '../config/database.js';
import { computeEntryCheckDigit } from '../abi-engine/ae/checkDigit.js';

export interface DrawnEntryNumber {
  /** Canonical hyphenated form, e.g. 'SP7-0000001-4'. */
  entryNumber: string;
  filerCode: string;
  /** Zero-padded 7-digit sequence. */
  sequence: string;
  checkDigit: number;
  blockId: string;
  /** Numbers still available in this block after the draw. */
  remaining: number;
}

export class EntryNumberDrawError extends Error {
  constructor(
    message: string,
    public readonly code: 'no_blocks' | 'exhausted'
  ) {
    super(message);
    this.name = 'EntryNumberDrawError';
  }
}

interface DrawRow {
  id: string;
  filer_code: string;
  drawn: number;
  range_end: number;
}

/**
 * Atomically draw the next entry number for the org. Oldest active block
 * with capacity wins; the row lock makes concurrent draws sequential.
 */
export async function drawEntryNumber(orgId: string): Promise<DrawnEntryNumber> {
  const rows = await prisma.$queryRaw<DrawRow[]>`
    UPDATE entry_number_blocks
    SET next_sequence = next_sequence + 1, updated_at = now()
    WHERE id = (
      SELECT id FROM entry_number_blocks
      WHERE org_id = ${orgId}::uuid AND active = true AND next_sequence <= range_end
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE
    )
    RETURNING id, filer_code, next_sequence - 1 AS drawn, range_end
  `;

  if (rows.length === 0) {
    const activeBlocks = await prisma.entryNumberBlock.count({
      where: { orgId, active: true },
    });
    if (activeBlocks === 0) {
      throw new EntryNumberDrawError(
        'No entry number blocks configured. Add your filer-assigned block in Settings before drawing.',
        'no_blocks'
      );
    }
    throw new EntryNumberDrawError(
      'All active entry number blocks are exhausted. Add a new block in Settings.',
      'exhausted'
    );
  }

  const row = rows[0];
  const filerCode = row.filer_code.toUpperCase();
  const sequence = String(row.drawn).padStart(7, '0');
  const checkDigit = computeEntryCheckDigit(filerCode, sequence);

  return {
    entryNumber: `${filerCode}-${sequence}-${checkDigit}`,
    filerCode,
    sequence,
    checkDigit,
    blockId: row.id,
    remaining: row.range_end - row.drawn,
  };
}

export interface EntryNumberValidation {
  valid: boolean;
  /** Canonical hyphenated form when valid. */
  canonical?: string;
  /** Set when the shape parsed but the check digit was wrong. */
  expectedCheckDigit?: number;
  message?: string;
}

/**
 * Validate a hand-typed entry number: shape (3 filer chars + 7-digit
 * sequence + check digit, hyphens optional) and AE Table 1 check digit.
 */
export function validateEntryNumber(raw: string): EntryNumberValidation {
  const flat = raw.replace(/-/g, '').toUpperCase().trim();
  const match = flat.match(/^([A-Z0-9]{3})(\d{7})(\d)$/);
  if (!match) {
    return {
      valid: false,
      message:
        'Entry number must be 3 filer characters + 7-digit sequence + check digit (e.g. SP7-1234567-8).',
    };
  }
  const [, filerCode, sequence, digit] = match;
  const expected = computeEntryCheckDigit(filerCode, sequence);
  if (Number(digit) !== expected) {
    return {
      valid: false,
      expectedCheckDigit: expected,
      message: `Check digit should be ${expected} for ${filerCode}-${sequence} (got ${digit}).`,
    };
  }
  return { valid: true, canonical: `${filerCode}-${sequence}-${expected}` };
}
