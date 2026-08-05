/**
 * CustomsCity duty-calculation wire types.
 *
 * Extracted from services/customscity.ts (Phase 0.4 split — see
 * docs/abi-engine/MIGRATION_PLAN.md).
 */

// ── Duty Calculation Types ──────────────────────────────────────
// Inputs and outputs for both CC duty endpoints:
//   POST /api/duty-calculation-tool      (HTS-based, deterministic)
//   POST /api/duty-calculation-tool-ai   (description-based, AI classifies)
// The AI variant returns the same calculation shape PLUS an
// `aiRecommendations[]` array with classification reasoning.

export interface CCDutyCalcItemInput {
  hts?: string;                          // optional in AI mode
  description: string;
  totalValue: number;
  quantity1?: number | null;
  quantity2?: number | null;
  spi?: string;                          // Special Programs Indicator (e.g. "MX" for USMCA)
  aluminumPercentage?: number;
  steelPercentage?: number;
  copperPercentage?: number;
  isCottonExempt?: boolean;
  isAutoPartExempt?: boolean;
  kitchenPartNotComplete?: boolean;
  isInformationalMaterialExempt?: boolean;
}

export interface CCDutyCalcPayload {
  items: CCDutyCalcItemInput[];
  entryType: 'formal' | 'informal';      // CC's vocabulary; maps to ABI 01/11
  modeOfTransportation: 'air' | 'ocean' | 'truck' | 'rail';
  estimatedEntryDate: string;            // CC accepts MM/DD/YYYY in payloads
  countryOfOrigin: string;               // ISO 3166-1 alpha-2
  currency: string;                      // ISO 4217 (USD, EUR, etc.)
}

export interface CCDutyCalcSubheading {
  hts: string;
  name: string;
  duty: number;
  section?: string;                      // AI mode only: 'section301', 'fentanylCN', 'reciprocal', etc.
}

export interface CCDutyCalcItemResult {
  classification: { name: string; hts: string };
  description: string;
  quantity1: number | null;
  quantity1UOM: string | null;
  quantity2: number | null;
  quantity2UOM: string | null;
  quantity3?: number | null;
  quantity3UOM?: string | null;
  specificDutyRate?: number;             // AI mode only
  adValoremDutyRate?: number;            // AI mode only
  otherDutyRate?: number;                // AI mode only
  totalDutiable: number;
  charges: number;
  duty: number;
  userFee: number;
  irTax: number;
  adcvdAmount: number;
  subheadingDuties: number;
  subheadings: CCDutyCalcSubheading[];
  pgaFlags?: any[];                      // AI mode may include PGA hints
  aluminumPercentage?: number;
  steelPercentage?: number;
  copperPercentage?: number;
  isCottonExempt?: boolean;
  isAutoPartExempt?: boolean;
  kitchenPartNotComplete?: boolean;
  isInformationalMaterialExempt?: boolean;
}

/** Shared summary fields. The standard endpoint sends `totalDutiesTaxes`;
 *  the AI endpoint sends `totalDuties` / `totalDutiesFees` /
 *  `totalDutyPercentage` instead. Both observed live; field optionality
 *  reflects that variance. */
export interface CCDutyCalcSummary {
  totalValue?: number;
  totalDutiableValue: number;
  ddp: number;
  totalDutiesTaxes?: number;          // standard endpoint
  totalDuties?: number;               // AI endpoint
  totalDutiesFees?: number;           // AI endpoint
  totalDutyPercentage?: number;       // AI endpoint (e.g. 77.8 = 77.8%)
  totalUserFee?: number;              // AI endpoint
}

export interface CCDutyCalcDutiesBreakdown {
  totalChargesAmount: number;
  totalDuties: number;
  processingFee: number;
  totalUserFee: number;
  totalIrTax: number;
  totaladcvdAmount: number;
}

export interface CCDutyCalcResponse {
  items: CCDutyCalcItemResult[];
  entryType: string;
  countryOfOrigin: string;
  countryOfOriginName: string;
  modeOfTransportation: string;
  estimatedEntryDate: string;
  currency: string;
  entryFee: { entryProcessingFee: number; portProcessingFee: number };
  summary: CCDutyCalcSummary;
  /** AI endpoint sometimes returns null here — UI must guard. */
  dutiesBreakdown: CCDutyCalcDutiesBreakdown | null;
  ddpBreakdown: {
    ddpIncluded: boolean;
    ddp: number;
    shipping: number;
    insurance: number;
  };
}

export interface CCDutyCalcAIRecommendation {
  itemIndex: number;
  originalDescription: string;
  selectedHts: string;
  explanation: string;
  specializedExplanation: string;        // GRI reasoning
  recommendations: Array<{
    hts: string;
    description: string;
    type: number;
    score: number;
    naturalized_description: string;
    participating_agencies: any[];
    construction: {
      components: Array<{ type: string; number: string; description: string }>;
      indent_hierarchy: Array<{ level: number; htsno: string; description: string }>;
    };
  }>;
}

export interface CCDutyCalcAIResponse extends CCDutyCalcResponse {
  aiRecommendations: CCDutyCalcAIRecommendation[];
}

