/**
 * Duty estimate service — transmit-time duty & fee preview for entry drafts.
 *
 * Reuses the native ABI pipeline end-to-end instead of re-implementing any
 * fee math: validate the CC-shaped draft body (abiDocumentBodySchema) →
 * migrateV1ToV2 → enrichWithDuty (USITC rates + CATAIR fee rules) → shape
 * the priced payload for the UI. The same chain the Phase-5 shadow run
 * uses (services/abiShadow.ts), so the preview a filer sees on the Review
 * step is byte-for-byte the math the native filing would transmit.
 *
 * Never throws for bad drafts: every failure mode (missing fields, unknown
 * HTS, unmappable values) comes back as `{ estimable: false, issues }` so
 * the wizard can render "can't estimate yet — here's what's missing".
 */
import { RecordCodecError } from '../abi-engine/records/codec.js';
import { migrateV1ToV2 } from '../abi-engine/payload/migrateV1.js';
import { enrichWithDuty, type HtsRateSource } from '../abi-engine/duty/engine.js';
import { abiDocumentBodySchema } from '../schemas/abiDocument.js';
import type { AbiDocumentBody } from './abi/types.js';
import logger from '../config/logger.js';

// ─── Result types ───────────────────────────────────────────────────

export interface DutyEstimateIssue {
  /** Dot-joined path into the draft body (zod path or engine field ref). */
  field: string;
  message: string;
}

export interface DutyEstimateFee {
  /** CBP user-fee class code (499 MPF, 501 HMF, 311 informal, 496 mail…). */
  classCode: string;
  label: string;
  amountCents: number;
}

export interface DutyEstimateLine {
  /** 1-based entry summary line number. */
  lineNumber: number;
  htsNumbers: string[];
  valueDollars: number;
  dutyCents: number;
  mpfCents: number;
  hmfCents: number;
  adCvdCents: number;
}

export interface DutyEstimateTotals {
  dutyCents: number;
  /** 499 total after the fiscal-year min/max clamp. */
  mpfCents: number;
  hmfCents: number;
  /** Every fee class in the 89-record totals, labeled. */
  fees: DutyEstimateFee[];
  adCvdCents: number;
  /** duty + user fees + IR tax + AD/CVD + other revenue. */
  totalCents: number;
}

export type DutyEstimateResult =
  | {
      estimable: true;
      /** YYYYMMDD date the fee eras/rates were selected for. */
      applicabilityDate: string;
      totals: DutyEstimateTotals;
      lines: DutyEstimateLine[];
    }
  | { estimable: false; issues: DutyEstimateIssue[] };

// ─── Fee class labels (Entry Summary usage notes m–r) ───────────────

const FEE_LABELS: Record<string, string> = {
  '499': 'Merchandise Processing Fee',
  '501': 'Harbor Maintenance Fee',
  '311': 'Informal Entry Fee',
  '496': 'Dutiable Mail Fee',
  '500': 'Manual Entry Surcharge',
};

function labelForFeeClass(classCode: string): string {
  return FEE_LABELS[classCode] ?? `Fee class ${classCode}`;
}

function todayYyyymmdd(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
}

function issuesFromError(err: unknown): DutyEstimateIssue[] {
  if (err instanceof RecordCodecError) {
    return err.issues.map((i) => ({ field: i.field, message: i.message }));
  }
  return [{ field: '', message: err instanceof Error ? err.message : String(err) }];
}

// ─── Estimation ─────────────────────────────────────────────────────

export interface DutyEstimateOptions {
  /** Override the applicability date (YYYYMMDD). Defaults to the draft's
   *  entry date, falling back to today (UTC). */
  applicabilityDate?: string;
}

/**
 * Estimate duty + fees for a draft entry body. Total function: returns a
 * discriminated result instead of throwing, whatever the input.
 */
export async function estimateDutyForBody(
  body: unknown,
  rateSource: HtsRateSource,
  options: DutyEstimateOptions = {}
): Promise<DutyEstimateResult> {
  // 1. The draft must be a complete, valid v1 body before it can be priced.
  const parsed = abiDocumentBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      estimable: false,
      issues: parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    };
  }

  const applicabilityDate =
    options.applicabilityDate ?? parsed.data.dates.entryDate ?? todayYyyymmdd();

  // 2. Migrate → price on the native pipeline. Both stages reject bad data
  //    with RecordCodecError rather than degrading silently — surface those
  //    as issues.
  try {
    const v2 = migrateV1ToV2(parsed.data as AbiDocumentBody);
    const priced = await enrichWithDuty(v2, rateSource, { applicabilityDate });
    const es = priced.entrySummary;

    // grandTotals/feeTotals are always set by enrichWithDuty; guard anyway
    // so a future engine change fails loudly here, not with NaNs in the UI.
    const grand = es.grandTotals;
    if (!grand) {
      return {
        estimable: false,
        issues: [{ field: 'entrySummary', message: 'duty engine returned no grand totals' }],
      };
    }

    const fees: DutyEstimateFee[] = (es.feeTotals ?? []).map((f) => ({
      classCode: f.classCode,
      label: labelForFeeClass(f.classCode),
      amountCents: f.amountCents,
    }));
    const feeCents = (classCode: string): number =>
      fees.find((f) => f.classCode === classCode)?.amountCents ?? 0;

    const lines: DutyEstimateLine[] = es.lines.map((line, index) => ({
      lineNumber: index + 1,
      htsNumbers: line.tariffs.map((t) => t.htsNumber),
      valueDollars: line.tariffs.reduce((sum, t) => sum + t.valueDollars, 0),
      dutyCents: line.tariffs.reduce((sum, t) => sum + (t.dutyCents ?? 0), 0),
      mpfCents: (line.fees ?? []).filter((f) => f.classCode === '499').reduce((s, f) => s + f.amountCents, 0),
      hmfCents: (line.fees ?? []).filter((f) => f.classCode === '501').reduce((s, f) => s + f.amountCents, 0),
      adCvdCents: (line.adCvdCases ?? []).reduce((s, c) => s + c.dutyCents, 0),
    }));

    // schemaV2 marks the non-duty grand-total fields optional; the engine
    // always writes them, but default to 0 so the type is honest either way.
    const adCvdCents = (grand.adDutyCents ?? 0) + (grand.cvDutyCents ?? 0);
    return {
      estimable: true,
      applicabilityDate,
      totals: {
        dutyCents: grand.dutyCents,
        mpfCents: feeCents('499'),
        hmfCents: feeCents('501'),
        fees,
        adCvdCents,
        totalCents:
          grand.dutyCents +
          (grand.userFeeCents ?? 0) +
          (grand.irTaxCents ?? 0) +
          adCvdCents +
          (grand.otherRevenueCents ?? 0),
      },
      lines,
    };
  } catch (err) {
    if (!(err instanceof RecordCodecError)) {
      // Genuine bugs still get logged — they just don't 500 the wizard.
      logger.warn({ err }, '[DutyEstimate] non-codec failure while pricing draft');
    }
    return { estimable: false, issues: issuesFromError(err) };
  }
}
