/**
 * AE scenario helper: baseline payload + the standard pipeline every AE
 * certification scenario runs through —
 *   payload v2 → duty engine → mapper → client-side validation → builder
 *   → batch envelope with "SCENARIO nnn" in the B-record (pos 60).
 *
 * Baseline follows the package's standing instructions: $10,000 line
 * values unless the scenario says otherwise, statement payment, and the
 * scenario number in BOTH the B-record user data and the Broker Reference
 * Number (the package allows either; we send both).
 */
import type { AbiPayloadV2 } from '../payload/schemaV2.js';
import { parseAbiPayloadV2 } from '../payload/schemaV2.js';
import { enrichWithDuty, StaticRateSource, type HtsRate } from '../duty/engine.js';
import { toAeEntrySummaryInput } from '../payload/toAeInput.js';
import { buildEntrySummary } from '../ae/builder.js';
import { validateEntrySummary, type ValidationIssue } from '../validate/entrySummary.js';
import { buildBatch, scenarioTag } from '../envelope/batch.js';
import { RecordCodecError } from '../records/codec.js';
import { type CertParams, entrySequenceFor, brokerReferenceFor } from './params.js';

export type ScenarioKind = 'transmit' | 'reject';

export interface Scenario {
  id: string;
  title: string;
  /** Application the transmission uses (AE, CW, CJ, AD, QA, TE, EQ …). */
  application: string;
  kind: ScenarioKind;
  /**
   * transmit: resolves to the full wire lines (A/B … Y/Z). reject: resolves
   * to the client-side rejection issues — captured as evidence.
   */
  run: (params: CertParams) => Promise<string[] | ValidationIssue[]>;
  /** Values the client rep must supply / open questions for the rep. */
  notes?: string;
}

/**
 * Companion-application scenario (CW/CJ/AD/QA/EQ …): the callback builds
 * the transaction lines with the app's own builder; the helper wraps them
 * in the batch envelope with the scenario tag.
 */
export function appScenario(
  id: string,
  title: string,
  appId: string,
  buildTransaction: (params: CertParams) => string[],
  notes?: string
): Scenario {
  return {
    id,
    title,
    application: appId,
    kind: 'transmit',
    notes,
    run: async (params: CertParams): Promise<string[]> =>
      buildBatch({
        sender: params.sender,
        appId,
        blocks: [
          {
            port: params.districtPortOfEntry,
            filerCode: params.filerCode,
            userData: scenarioTag(id),
            transactionLines: buildTransaction(params),
          },
        ],
      }),
  };
}

/** Baseline type-01 consumption entry, parameterized per scenario. */
export function baseAePayload(params: CertParams, scenarioId: string): AbiPayloadV2 {
  return {
    schemaVersion: 2,
    entrySummary: {
      filerCode: params.filerCode,
      entryNumber: entrySequenceFor(scenarioId),
      districtPortOfEntry: params.districtPortOfEntry,
      brokerReferenceNumber: brokerReferenceFor(scenarioId),
      entryTypeCode: '01',
      motCode: '11',
      dates: {
        estimatedEntry: `${params.currentYear}0820`,
        importation: `${params.currentYear}0815`,
        estimatedArrival: `${params.currentYear}0814`,
      },
      importerOfRecord: { number: params.importerOfRecordNumber, name: params.importerName },
      consigneeNumber: params.consigneeNumber,
      usStateOfDestination: 'CA',
      bonds: [{ bondTypeCode: '8', designationTypeCode: 'B', suretyCompanyCode: params.suretyCompanyCode }],
      // Standing instruction: summaries are scheduled for payment on a statement.
      payment: { typeCode: '2', preliminaryStatementPrintDate: `${params.currentYear}0901` },
      cargo: { carrierCode: 'MAEU', districtPortOfUnlading: '3001', conveyanceName: 'EVER GIVEN' },
      manifests: [
        {
          manifestedQuantity: 100,
          uomCode: 'CTNS',
          bills: [{ type: 'M', issuerCode: 'MAEU', identifier: '123456789012' }],
        },
      ],
      lines: [
        {
          countryOfOrigin: 'CN',
          countryOfExport: 'CN',
          dateOfExportation: `${params.currentYear}0801`,
          relatedPartyIndicator: 'N',
          chargesDollars: 500,
          grossWeightKg: 1200,
          descriptions: ['LITHIUM ION BATTERY PACKS'],
          parties: [
            { type: 'M', identifier: 'CNSHEBAT123SHA' },
            { type: 'S', identifier: params.importerOfRecordNumber },
          ],
          // Package default: $10,000 line value.
          // 8507.60.00.30 per CERT's own HTS file (8/25 HA query: 0020 does not
          // exist there; 0010=EV, 0030=storage li-ion, 0090=other; units NO KG —
          // TWO reporting units required).
          tariffs: [{ htsNumber: '8507600030', valueDollars: 10000, uomCode1: 'NO', quantity1Hundredths: 50000, uomCode2: 'KG', quantity2Hundredths: 125000 }],
        },
      ],
    },
  };
}

export interface AeScenarioOptions {
  /** Pinned USITC rates (2026-aug-06 revision) for the scenario's HTS numbers. */
  rates: Record<string, string | HtsRate>;
  /** Scenario-specific payload edits, applied to the baseline. */
  mutate: (payload: AbiPayloadV2, params: CertParams) => void;
  /**
   * Builder-input edits applied AFTER the payload\u2192input mapping — for data
   * the payload schema does not yet model (e.g. PGA message-set groupings).
   */
  postMap?: (input: import('../ae/builder.js').AeEntrySummaryInput, params: CertParams) => void;
  /** Builder action; scenarios 015/017 use D/R. */
  action?: 'A' | 'R' | 'D';
  /**
   * Block-control (B-record, mirrored on the Y-record) overrides.
   * Scenario 052 transmits a deliberately-wrong B-record filer/port while
   * the enclosed 10–90 records stay valid — the reject must come from
   * ACE's B-record authentication, not from our client-side validation.
   */
  block?: { port?: string; filerCode?: string };
  notes?: string;
}

/** Standard AE transmit scenario: build the full wire block, validated. */
export function aeScenario(id: string, title: string, options: AeScenarioOptions): Scenario {
  return {
    id,
    title,
    application: 'AE',
    kind: 'transmit',
    notes: options.notes,
    run: async (params: CertParams): Promise<string[]> => {
      const payload = baseAePayload(params, id);
      options.mutate(payload, params);
      return buildAeWire(payload, params, id, options);
    },
  };
}

/** An intentionally-invalid AE scenario: our system must refuse it. */
export function aeRejectScenario(
  id: string,
  title: string,
  options: AeScenarioOptions
): Scenario {
  return {
    id,
    title,
    application: 'AE',
    kind: 'reject',
    notes: options.notes,
    run: async (params: CertParams): Promise<ValidationIssue[]> => {
      const payload = baseAePayload(params, id);
      options.mutate(payload, params);
      try {
        await buildAeWire(payload, params, id, options);
      } catch (err) {
        if (err instanceof RecordCodecError) {
          return err.issues.map((issue) => ({
            severity: 'F' as const,
            field: `${issue.record}.${issue.field}`,
            message: issue.message,
          }));
        }
        throw err;
      }
      throw new Error(`scenario ${id} was expected to be rejected client-side but built cleanly`);
    },
  };
}

async function buildAeWire(
  payload: AbiPayloadV2,
  params: CertParams,
  id: string,
  options: AeScenarioOptions
): Promise<string[]> {
  const action = options.action ?? 'A';
  const parsed = parseAbiPayloadV2(payload);
  let input;
  if (action === 'D') {
    // Deletes carry no amounts; skip the duty engine (10-record only).
    input = toAeEntrySummaryInput(parsed, action);
  } else {
    const priced = await enrichWithDuty(parsed, new StaticRateSource(options.rates), {
      applicabilityDate: params.applicabilityDate,
    });
    input = toAeEntrySummaryInput(priced, action);
  }
  options.postMap?.(input, params);

  const issues = validateEntrySummary(input);
  if (issues.length > 0) {
    throw new RecordCodecError(
      issues.map((issue) => ({ record: 'ScenarioValidation', field: issue.field, message: issue.message }))
    );
  }

  const transactionLines = buildEntrySummary(input);
  return buildBatch({
    sender: params.sender,
    appId: 'AE',
    blocks: [
      {
        port: options.block?.port ?? params.districtPortOfEntry,
        filerCode: options.block?.filerCode ?? params.filerCode,
        userData: scenarioTag(id),
        transactionLines,
      },
    ],
  });
}

