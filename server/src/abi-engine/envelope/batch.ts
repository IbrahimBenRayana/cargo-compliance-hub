/**
 * ABI batch assembly and response parsing (Batch & Block Control, V23).
 *
 * Structure (input and output):
 *   A-Record          batch header — sender identity + application id
 *     B-Record        block header — processing port/filer + app id
 *       <transaction records>  (defined by the application chapters)
 *     Y-Record        block trailer
 *     ... more blocks
 *   Z-Record          batch trailer
 *
 * Enforced spec rules: one application type per batch; the B-record app id
 * must match the A-record; each block encloses ≥1 transaction record; Z
 * mirrors A. The certification scenario tag ("SCENARIO nnn") rides in the
 * B-record user-data field, which starts at position 60 — exactly as the
 * CBP test instructions require.
 */
import {
  writeRecord,
  parseRecord,
  normalizeTransactionLine,
  RecordCodecError,
  type CodecIssue,
  type ParsedRecord,
} from '../records/codec.js';
import { INPUT_A, INPUT_B, INPUT_Y, INPUT_Z, OUTPUT_B, OUTPUT_X0, OUTPUT_X1, OUTPUT_Y } from './recordDefs.js';
import { CONDITION_CODES } from './conditionCodes.js';

// ── Building ───────────────────────────────────────────────

export interface SenderIdentity {
  /** CBP-assigned data-processing site code (by convention, nearest US port). */
  siteCode: string;
  /** CBP-assigned transmitter id code. */
  idCode: string;
  /** Pre-established communication password. */
  password: string;
  /** Optional pre-established office/sub-location code. */
  officeCode?: string;
}

export interface BlockInput {
  /** Processing district/port code (4) — where transactions are processed. */
  port: string;
  /** Processing filer code (3) — our CBP-assigned filer code. */
  filerCode: string;
  officeCode?: string;
  preparer?: { port: string; filerCode: string; officeCode?: string };
  /**
   * B-record user-data text (pos 60–80, max 21 chars). Certification runs
   * put the scenario tag here — see scenarioTag().
   */
  userData?: string;
  /** Transaction records (each ≤80 chars; padded). Must be non-empty. */
  transactionLines: string[];
}

export interface BatchInput {
  sender: SenderIdentity;
  /** Application identifier code, e.g. 'AE', 'CW', 'EQ'. One per batch. */
  appId: string;
  /** MMDDYY. Optional per spec; echoed back by ACE. */
  transmissionDate?: string;
  /** A-record user-data text (pos 60–80). */
  userData?: string;
  blocks: BlockInput[];
}

/** Format the certification scenario tag for the B-record user data. */
export function scenarioTag(scenarioNumber: string | number): string {
  const nnn = String(scenarioNumber).padStart(3, '0');
  return `SCENARIO ${nnn}`;
}

/** Assemble a full ABI batch. Returns 80-char record lines, in order. */
export function buildBatch(input: BatchInput): string[] {
  const issues: CodecIssue[] = [];
  if (input.blocks.length === 0) {
    issues.push({ record: 'Batch', field: 'blocks', message: 'a batch must enclose at least one block' });
  }
  for (const [i, block] of input.blocks.entries()) {
    if (block.transactionLines.length === 0) {
      issues.push({
        record: 'Batch',
        field: `blocks[${i}]`,
        message: 'a block must enclose at least one transaction record',
      });
    }
  }
  if (issues.length > 0) throw new RecordCodecError(issues);

  const lines: string[] = [];
  lines.push(
    writeRecord(INPUT_A, {
      siteCode: input.sender.siteCode,
      idCode: input.sender.idCode,
      password: input.sender.password,
      transmissionDate: input.transmissionDate,
      appId: input.appId,
      officeCode: input.sender.officeCode,
      userData: input.userData,
    })
  );

  for (const block of input.blocks) {
    lines.push(
      writeRecord(INPUT_B, {
        port: block.port,
        filerCode: block.filerCode,
        appId: input.appId, // spec: every block app id must match the A-record
        officeCode: block.officeCode,
        preparerPort: block.preparer?.port,
        preparerFilerCode: block.preparer?.filerCode,
        preparerOfficeCode: block.preparer?.officeCode,
        preparerIndicator: block.preparer ? '1' : undefined,
        userData: block.userData,
      })
    );
    for (const t of block.transactionLines) {
      lines.push(normalizeTransactionLine(t, 'TransactionRecord'));
    }
    lines.push(
      writeRecord(INPUT_Y, {
        port: block.port,
        filerCode: block.filerCode,
        appId: input.appId,
        officeCode: block.officeCode,
      })
    );
  }

  lines.push(
    writeRecord(INPUT_Z, {
      siteCode: input.sender.siteCode,
      idCode: input.sender.idCode,
      transmissionDate: input.transmissionDate,
      officeCode: input.sender.officeCode,
    })
  );

  return lines;
}

// ── Response parsing ───────────────────────────────────────

export interface ParsedCondition {
  /** Reference from the preceding X0-record, when present. */
  reference?: {
    refType: string; // BLOCK | TRNACT
    occurrence: number;
    referenceText: string;
  };
  severity: string;
  conditionCode: string;
  /** Narrative from the wire, falling back to our condition-code table. */
  narrative: string;
  /** True on the final-disposition record (disposition type 'R'). */
  finalDisposition: boolean;
}

export interface ParsedBlock {
  header: ParsedRecord;
  /** True when ACE generated this block (indicator at pos 80 / all-space body). */
  aceGenerated: boolean;
  /** Raw transaction/response lines (application-specific records). */
  transactionLines: string[];
  trailer?: ParsedRecord;
  imageCount?: number;
}

export interface ParsedBatch {
  header?: ParsedRecord;
  trailer?: ParsedRecord;
  appId?: string;
  blocks: ParsedBlock[];
  conditions: ParsedCondition[];
  /** True when ACE rejected the batch (X1 final disposition / code 999). */
  rejected: boolean;
}

function isAceGeneratedControl(line: string, id: 'B' | 'Y' | 'Z'): boolean {
  const padded = line.padEnd(80, ' ');
  return padded[79] === id;
}

/** Parse a CBP output batch (response or notification) into structure. */
export function parseBatch(lines: string[]): ParsedBatch {
  const batch: ParsedBatch = { blocks: [], conditions: [], rejected: false };
  let currentBlock: ParsedBlock | null = null;
  let currentReference: ParsedCondition['reference'] | undefined;

  for (const line of lines) {
    if (line.trim() === '') continue;
    const id2 = line.slice(0, 2);
    const id1 = line[0];

    if (id2 === 'X0') {
      const rec = parseRecord(OUTPUT_X0, line);
      currentReference = {
        refType: rec.values.refType ?? '',
        occurrence: Number(rec.values.occurrence ?? '0'),
        referenceText: rec.values.referenceText ?? '',
      };
    } else if (id2 === 'X1') {
      const rec = parseRecord(OUTPUT_X1, line);
      const code = rec.values.conditionCode ?? '';
      batch.conditions.push({
        reference: currentReference,
        severity: rec.values.severity ?? '',
        conditionCode: code,
        narrative: rec.values.narrative ?? CONDITION_CODES[code] ?? '',
        finalDisposition: rec.values.dispositionType === 'R',
      });
      if (rec.values.dispositionType === 'R' || code === '999') batch.rejected = true;
    } else if (id1 === 'A') {
      batch.header = parseRecord(INPUT_A, line);
      batch.appId = batch.header.values.appId;
    } else if (id1 === 'B') {
      currentBlock = {
        header: parseRecord(OUTPUT_B, line),
        aceGenerated: isAceGeneratedControl(line, 'B'),
        transactionLines: [],
      };
      batch.blocks.push(currentBlock);
      currentReference = undefined;
    } else if (id1 === 'Y') {
      const rec = parseRecord(OUTPUT_Y, line);
      if (currentBlock) {
        currentBlock.trailer = rec;
        currentBlock.imageCount = rec.values.imageCount ? Number(rec.values.imageCount) : undefined;
        currentBlock = null;
      }
    } else if (id1 === 'Z') {
      batch.trailer = parseRecord(INPUT_Z, line);
      currentBlock = null;
    } else if (currentBlock) {
      currentBlock.transactionLines.push(line.padEnd(80, ' '));
    }
    // Lines outside any block that aren't control records are ignored.
  }

  return batch;
}
