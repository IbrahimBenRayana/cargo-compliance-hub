import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Renders a rejection (current or historical) from a Filing.rejectionReason
 * string in a calm, scannable format. Handles three input shapes:
 *
 *  1. JSON: { summary, errors: [{ field, fieldLabel, message, fix, severity }, ...] }
 *     — the canonical post-PR#23 shape from server/services/errorTranslator.ts
 *
 *  2. CBP-disposition-code string: "S75 PARTY UNKNOWN, SA7 NO BOND"
 *     — what older filings stored before structured errors landed
 *
 *  3. Plain text: anything else, rendered verbatim
 *
 * Also cleans up "[object Object]" artifacts that leaked into pre-fix
 * legacy data when CC's BOLValidations nested-object shape wasn't unwrapped.
 */

interface ParsedError {
  field?: string;
  fieldLabel?: string;
  message: string;
  fix?: string;
  severity: 'critical' | 'warning' | 'info';
}

const OBJECT_OBJECT = '[object Object]';

const CBP_CODES: Record<string, { message: string; fix: string; severity: ParsedError['severity'] }> = {
  S75: {
    message: 'A party entity (manufacturer, seller, or buyer) is not recognized in the CBP system.',
    fix: 'Verify the party name, address, and country exactly match what is registered with CBP. In the test environment, this is expected with sample data.',
    severity: 'critical',
  },
  S17: {
    message: 'The Importer Number (EIN) is not registered with CBP.',
    fix: 'Enter a valid EIN that is registered with CBP for customs filing. Format: XX-XXXXXXX.',
    severity: 'critical',
  },
  SA7: {
    message: 'No continuous customs bond is on file with CBP for this importer.',
    fix: 'A valid continuous bond must be on file with CBP. Contact your surety company or customs broker.',
    severity: 'critical',
  },
  S18: {
    message: 'The ISF filer is not registered with CBP.',
    fix: 'The ISF filer EIN must be registered with CBP as an authorized filer.',
    severity: 'critical',
  },
  S10: {
    message: 'There is a data discrepancy in the filing.',
    fix: 'Review all fields for accuracy and correct any errors.',
    severity: 'critical',
  },
  S76: {
    message: 'A party entity identifier does not match CBP records.',
    fix: 'Verify party details exactly match CBP registration.',
    severity: 'critical',
  },
};

/** Strip "[object Object]" fragments left over from the pre-PR#19 mapper bug. */
function cleanLegacyArtifacts(s: string | undefined): string | undefined {
  if (!s) return s;
  let cleaned = s
    .replace(/\s*Original error:\s*\[object Object\]\s*\.?/gi, '')
    .replace(/\s*\[object Object\]\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // If after stripping we have nothing, treat as empty.
  if (!cleaned || cleaned === '.' || cleaned === ':' || cleaned === '-') return undefined;
  return cleaned;
}

/** Look up a CBP code and produce a structured error from it. */
function parseCbpCodeFragment(part: string): ParsedError | null {
  const codeMatch = part.match(/^([A-Z][A-Z0-9]{1,3})\s+(.+)/i);
  if (!codeMatch) return null;
  const code = codeMatch[1].toUpperCase();
  const tail = codeMatch[2];
  const known = CBP_CODES[code];
  if (known) {
    const extra = tail.replace(/^[A-Z\s]+/i, '').replace(/^[\s\-:]+/, '').trim();
    return {
      field: code,
      fieldLabel: `CBP code ${code}`,
      message: known.message + (extra ? ` (${extra})` : ''),
      fix: known.fix,
      severity: known.severity,
    };
  }
  if (/ISF\s+REJECTED/i.test(part)) {
    return {
      field: 'ISF',
      fieldLabel: 'ISF status',
      message: 'The ISF filing was rejected by CBP due to the errors listed above.',
      fix: 'Fix all the errors above, then resubmit.',
      severity: 'critical',
    };
  }
  return {
    field: code,
    fieldLabel: `CBP code ${code}`,
    message: tail,
    fix: 'Review and correct the filing based on this CBP response.',
    severity: 'warning',
  };
}

export interface ParsedRejection {
  /** Optional one-line headline rendered above the cards. */
  summary?: string;
  /** Per-field structured errors, ready to render. */
  errors: ParsedError[];
  /** True when the input was unparseable + we're falling back to raw text. */
  fallbackRaw?: string;
}

export function parseRejectionReason(raw: string | null | undefined): ParsedRejection {
  if (!raw) return { errors: [] };

  // Shape 1: JSON envelope { summary, errors: [...] }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      const errors: ParsedError[] = parsed.errors
        .map((e: any): ParsedError => {
          const message =
            cleanLegacyArtifacts(e.message) ??
            cleanLegacyArtifacts(e.originalMessage) ??
            'CBP flagged an issue with this field.';
          const fieldLabel =
            cleanLegacyArtifacts(e.fieldLabel) ??
            cleanLegacyArtifacts(e.field) ??
            'CBP validation';
          const fix = cleanLegacyArtifacts(e.fix);
          const severity: ParsedError['severity'] =
            e.severity === 'critical' || e.severity === 'warning' || e.severity === 'info'
              ? e.severity
              : 'warning';
          return { field: e.field, fieldLabel, message, fix, severity };
        });
      const summary = cleanLegacyArtifacts(parsed.summary);
      return { errors, summary };
    }
  } catch {
    // Not JSON — fall through to other shapes.
  }

  // Shape 2: comma/semicolon-separated string with CBP codes.
  const parts = raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  const codeErrors: ParsedError[] = [];
  for (const part of parts) {
    const parsed = parseCbpCodeFragment(part);
    if (parsed) codeErrors.push(parsed);
  }
  if (codeErrors.length > 0) return { errors: codeErrors };

  // Shape 3: plain text. Clean any [object Object] artifacts and surface as-is.
  const cleaned = cleanLegacyArtifacts(raw);
  if (cleaned) {
    return { errors: [], fallbackRaw: cleaned };
  }
  return {
    errors: [],
    fallbackRaw:
      'This filing was previously rejected by CBP, but the detailed reason wasn\'t captured. Resubmit to get fresh validation feedback.',
  };
}

// ─── Component ──────────────────────────────────────────────────────

interface RejectionDetailsCardProps {
  reason: string | null | undefined;
  /** Visual variant — `current` is for the active rejection state, `previous`
   *  is for a historical rejection on a now-accepted filing. */
  variant: 'current' | 'previous';
  /** Right-side action buttons (Edit & Fix, Resubmit, etc.). */
  actions?: React.ReactNode;
  /** Optional animation delay in ms so this card can fade in with the page. */
  animationDelayMs?: number;
}

const SEVERITY_STYLES: Record<
  ParsedError['severity'],
  { badge: string; dot: string }
> = {
  critical: {
    badge:
      'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    dot: 'bg-rose-500',
  },
  warning: {
    badge:
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    dot: 'bg-amber-500',
  },
  info: {
    badge:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30',
    dot: 'bg-slate-400',
  },
};

export function RejectionDetailsCard({
  reason,
  variant,
  actions,
  animationDelayMs = 250,
}: RejectionDetailsCardProps) {
  if (!reason) return null;
  const parsed = parseRejectionReason(reason);

  const heading = variant === 'current' ? 'Rejection details' : 'Previous rejection';
  const subhead =
    variant === 'current'
      ? 'CBP returned the following issues. Fix them and resubmit.'
      : 'This filing was previously rejected. Kept for reference — no action needed.';

  return (
    <Card
      className={cn(
        'border-rose-200/70 dark:border-rose-500/20 opacity-0 animate-fade-in-up',
        variant === 'previous' && 'bg-rose-50/30 dark:bg-rose-500/[0.04]',
      )}
      style={{ animationDelay: `${animationDelayMs}ms`, animationFillMode: 'forwards' }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-rose-100 dark:bg-rose-500/15 ring-1 ring-rose-200 dark:ring-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" strokeWidth={2.25} />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-rose-700 dark:text-rose-300">{heading}</CardTitle>
              <p className="text-[11.5px] text-rose-700/70 dark:text-rose-300/70 mt-0.5">{subhead}</p>
            </div>
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {parsed.summary && parsed.errors.length > 0 && (
          <p className="text-[12.5px] text-slate-600 dark:text-slate-400 mb-1">
            {parsed.summary}
          </p>
        )}

        {parsed.errors.length > 0 ? (
          <div className="space-y-2">
            {parsed.errors.map((err, i) => {
              const sev = SEVERITY_STYLES[err.severity];
              return (
                <div
                  key={i}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn('h-1.5 w-1.5 rounded-full', sev.dot)} />
                    <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
                      {err.fieldLabel}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-bold uppercase tracking-[0.06em] ml-auto',
                        sev.badge,
                      )}
                    >
                      {err.severity}
                    </Badge>
                  </div>
                  <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                    {err.message}
                  </p>
                  {err.fix && (
                    <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400 mt-1.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Fix:</span>{' '}
                      {err.fix}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3">
            <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {parsed.fallbackRaw}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
