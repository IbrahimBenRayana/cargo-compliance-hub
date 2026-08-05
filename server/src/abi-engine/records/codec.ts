/**
 * CATAIR fixed-width record codec.
 *
 * ABI transmissions are sequences of 80-character records. Every record type
 * is described declaratively as a RecordDef (field name, 1-based position
 * range, data class, designation) transcribed from the CATAIR chapters in
 * docs/abi-engine/specs/. The writer and parser below are the ONLY code that
 * deals with character positions — transaction builders work with named
 * fields and never do string math.
 *
 * Data classes are CBP's, from the Record Layout Key (Batch & Block Control,
 * B&B-7):
 *   S    space only
 *   A    alphabetic A–Z (uppercase only)
 *   N    numeric 0–9
 *   SN   "(S)N" — optional leading spaces then right-justified numerals
 *   AN   A–Z, 0–9, space
 *   D    known date, MMDDYY
 *   X    special data — A–Z, 0–9, space, standard-keyboard specials
 */

export const RECORD_LENGTH = 80;

export type FieldClass = 'S' | 'A' | 'N' | 'SN' | 'AN' | 'D' | 'X';

/** M = mandatory, C = conditional, O = optional (CBP designations). */
export type Designation = 'M' | 'C' | 'O';

export interface FieldDef {
  /** camelCase key used in value maps. Fillers use name 'filler'. */
  name: string;
  /** 1-based inclusive start position within the 80-char record. */
  start: number;
  /** 1-based inclusive end position. */
  end: number;
  class: FieldClass;
  designation: Designation;
  /** Fixed value (control identifiers, constants). Implies designation M. */
  constant?: string;
  /** 'left' (default for A/AN/X/D) or 'right' (default for N/SN). */
  justify?: 'left' | 'right';
}

export interface RecordDef {
  /** Control identifier, e.g. 'A', 'B', 'X1', '10'. */
  id: string;
  name: string;
  fields: FieldDef[];
}

export interface CodecIssue {
  record: string;
  field: string;
  message: string;
}

export class RecordCodecError extends Error {
  constructor(public readonly issues: CodecIssue[]) {
    super(issues.map((i) => `${i.record}.${i.field}: ${i.message}`).join('; '));
    this.name = 'RecordCodecError';
  }
}

const CLASS_PATTERNS: Record<FieldClass, RegExp> = {
  S: /^ *$/,
  A: /^[A-Z]+$/,
  N: /^[0-9]+$/,
  SN: /^ *[0-9]+$/,
  AN: /^[A-Z0-9 ]+$/,
  D: /^(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{2}$/,
  // Standard-keyboard specials per the Record Layout Key.
  X: /^[A-Z0-9 !@#$%^&*()\-_=+[{\]}\\|;:'",<.>/?`~¢]+$/,
};

function width(f: FieldDef): number {
  return f.end - f.start + 1;
}

function defaultJustify(cls: FieldClass): 'left' | 'right' {
  return cls === 'N' || cls === 'SN' ? 'right' : 'left';
}

/** Sanity-check a RecordDef: fields in-bounds, non-overlapping, gap-free. */
export function assertRecordDef(def: RecordDef): void {
  let cursor = 1;
  for (const f of def.fields) {
    if (f.start !== cursor) {
      throw new Error(`${def.name}: field ${f.name} starts at ${f.start}, expected ${cursor}`);
    }
    if (f.end < f.start || f.end > RECORD_LENGTH) {
      throw new Error(`${def.name}: field ${f.name} has invalid range ${f.start}-${f.end}`);
    }
    cursor = f.end + 1;
  }
  if (cursor !== RECORD_LENGTH + 1) {
    throw new Error(`${def.name}: fields cover positions 1-${cursor - 1}, expected 1-${RECORD_LENGTH}`);
  }
}

/**
 * Render one 80-character record from named values.
 *
 * - Constants and fillers need not be provided.
 * - Mandatory fields must be present and non-empty.
 * - Conditional/optional fields default to space fill.
 * - Every provided value is validated against the field's data class; this
 *   is the certification requirement that OUR software rejects invalid data
 *   before transmission, enforced at the lowest layer.
 */
export function writeRecord(def: RecordDef, values: Record<string, string | undefined> = {}): string {
  const issues: CodecIssue[] = [];
  const chars = new Array<string>(RECORD_LENGTH).fill(' ');

  for (const f of def.fields) {
    const w = width(f);
    let raw = f.constant ?? values[f.name] ?? '';
    raw = raw.toUpperCase();

    if (f.class === 'S' || (raw === '' && f.designation !== 'M')) {
      if (raw !== '' && f.class === 'S') {
        issues.push({ record: def.name, field: f.name, message: 'filler must be space' });
      }
      continue; // already space-filled
    }
    if (raw === '' && f.designation === 'M') {
      issues.push({ record: def.name, field: f.name, message: 'mandatory field missing' });
      continue;
    }
    if (raw.length > w) {
      issues.push({ record: def.name, field: f.name, message: `value '${raw}' exceeds width ${w}` });
      continue;
    }
    if (!CLASS_PATTERNS[f.class].test(raw)) {
      issues.push({ record: def.name, field: f.name, message: `value '${raw}' violates class ${f.class}` });
      continue;
    }

    const justify = f.justify ?? defaultJustify(f.class);
    const padded = justify === 'left' ? raw.padEnd(w, ' ') : raw.padStart(w, ' ');
    for (let i = 0; i < w; i++) chars[f.start - 1 + i] = padded[i];
  }

  if (issues.length > 0) throw new RecordCodecError(issues);
  return chars.join('');
}

export interface ParsedRecord {
  def: RecordDef;
  raw: string;
  /** Field values, trimmed per class (never includes fillers). */
  values: Record<string, string>;
}

/** Parse one record line against a def. Lines shorter than 80 are padded. */
export function parseRecord(def: RecordDef, line: string): ParsedRecord {
  const raw = line.padEnd(RECORD_LENGTH, ' ');
  const values: Record<string, string> = {};
  for (const f of def.fields) {
    if (f.class === 'S' || f.name === 'filler') continue;
    const slice = raw.slice(f.start - 1, f.end);
    const trimmed = f.class === 'N' || f.class === 'SN' ? slice.trim() : slice.trimEnd();
    if (trimmed !== '') values[f.name] = trimmed;
  }
  return { def, raw, values };
}

/** Pad/validate an arbitrary transaction line to 80 chars (class X). */
export function normalizeTransactionLine(line: string, context: string): string {
  if (line.length > RECORD_LENGTH) {
    throw new RecordCodecError([
      { record: context, field: 'line', message: `record longer than ${RECORD_LENGTH} chars: '${line.slice(0, 20)}…'` },
    ]);
  }
  return line.padEnd(RECORD_LENGTH, ' ');
}
