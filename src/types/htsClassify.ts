/** Reply of POST /integrations/hts-classify and /compliance/classify-hts (native classifier). */
export type HtsConfidence = 'high' | 'medium' | 'low';

export interface HtsSuggestion {
  code: string;
  /** Full path: heading > subheading > ... > line. */
  description: string;
  confidence: HtsConfidence | null;
  score: number | null;
  reason?: string;
  generalRate: string;
  units: string[];
  warnings?: string[];
}

export interface HtsClassifyResult {
  status: 'ok' | 'needs_detail' | 'keyword_only' | 'no_match';
  message?: string;
  questions?: string[];
  didYouMean?: string[];
  suggestions: HtsSuggestion[];
  dutySpreadWarning?: string;
  dutyNote: string;
  notice: string;
  revision: string;
  /** Answered from the organization's result for the same description (last 24 h); free. */
  repeat?: boolean;
  /** What is left of the classifier allowance. */
  usage?: HtsUsage;
}

export interface HtsUsage {
  user: { used: number; limit: number; period: 'day'; resetsAt: string };
  organization: { used: number; limit: number; period: 'month'; resetsAt: string };
}
