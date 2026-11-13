/**
 * Duty calculator: estimate duties, added tariffs and fees for a set of
 * goods. Two ways in: by HTS code, or by description, where each line is
 * classified first. The form is on the left and the estimate stays beside it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AbiDocument, DutyCalcAIResponse, DutyCalcItem, DutyCalcRequest, DutyCalcResponse } from '@/api/client';
import { ComboboxField, DateField, SelectField } from '@/components/abi-wizard/shared';
import { ItemRow } from '@/components/duty-calc/ItemRow';
import { Results, ResultsPlaceholder } from '@/components/duty-calc/Results';
import { ProvenanceChip, SourcePicker } from '@/components/duty-calc/SourcePicker';
import { emptyItem, MAX_ITEMS, type ItemDraft, type Mode } from '@/components/duty-calc/types';
import { AlertCircle, Calculator, Loader2, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { COUNTRIES, CURRENCIES } from '@/data/geo';
import { useAIDutyCalculate, useDutyCalculate } from '@/hooks/useDutyCalculation';
import { abiDocumentToDutyCalc, filingToDutyCalc, type SourceProvenance } from '@/lib/duty-calc-prefill';
import { cn } from '@/lib/utils';
import type { Filing } from '@/types/shipment';

const PAGE = 'mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-12';
const PANEL = 'rounded-xl border border-border/70 bg-card shadow-card';

/** YYYYMMDD (DateField storage) to MM/DD/YYYY (what the calculation takes). */
function yyyymmddToMMDDYYYY(v: string): string {
  if (!v || v.length !== 8) return '';
  return `${v.slice(4, 6)}/${v.slice(6, 8)}/${v.slice(0, 4)}`;
}

/** The calculation's own field names, in the page's words. */
function plainMessage(message: string): string {
  return message.replace(/quantity1/g, 'quantity').replace(/quantity2/g, 'second quantity').replace(/ \(as number\)/g, '');
}

function toNumberOrUndef(s: string): number | undefined {
  if (s === '' || s === undefined || s === null) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div role="radiogroup" aria-label="How to classify the goods" className="flex rounded-lg bg-muted p-0.5">
      {([['standard', 'I have HTS codes'], ['ai', 'Classify from descriptions']] as const).map(([value, label]) => (
        <button
          key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => onChange(value)}
          className={cn(
            'flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
            mode === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground can-hover:hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────

export default function DutyCalculatorPage() {
  const [mode, setMode] = useState<Mode>('standard');

  // Shipment metadata
  const [countryOfOrigin, setCountryOfOrigin] = useState<string>('CN');
  const [modeOfTransportation, setModeOfTransportation] =
    useState<DutyCalcRequest['modeOfTransportation']>('ocean');
  const [entryType, setEntryType] =
    useState<DutyCalcRequest['entryType']>('formal');
  const [currency, setCurrency] = useState<string>('USD');
  // YYYYMMDD storage to leverage DateField
  const [estimatedEntryDateYYYYMMDD, setEstimatedEntryDateYYYYMMDD] =
    useState<string>(() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    });

  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);

  // Pre-fill provenance. When set, a banner above the form shows the
  // source and small ✨ chips appear next to each pre-filled field.
  // Editing a field clears its specific chip — the field is now
  // user-owned. Adding/removing items wipes all item-level chips since
  // the indices shift and chips can't be trusted any more.
  const [source, setSource] = useState<SourceProvenance | null>(null);
  const [filledFields, setFilledFields] = useState<Set<string>>(() => new Set());

  /** Returns the current source if `key` was pre-filled and not yet edited. */
  const provenanceFor = (key: string): SourceProvenance | null => {
    if (!source) return null;
    return filledFields.has(key) ? source : null;
  };

  function applyPrefill(prefill: ReturnType<typeof filingToDutyCalc>['prefill'], provenance: SourceProvenance) {
    if (prefill.countryOfOrigin) setCountryOfOrigin(prefill.countryOfOrigin);
    if (prefill.modeOfTransportation) setModeOfTransportation(prefill.modeOfTransportation);
    if (prefill.currency) setCurrency(prefill.currency);
    if (prefill.items && prefill.items.length > 0) {
      setItems(prefill.items.map(p => ({ ...p })));
    }
    setFilledFields(new Set(prefill.filledFields));
    setSource(provenance);
    // Clear any prior result so the user explicitly clicks Calculate
    // after reviewing the new inputs (compliance-trust principle).
    setResultMode(null);
    standardCalc.reset();
    aiCalc.reset();
    const sourceType = provenance.kind === 'abi' ? 'CBP Entry' : 'ISF Filing';
    toast.success('Pre-filled', {
      description: `Source: ${sourceType} ${provenance.label}. Review and edit any field before calculating.`,
    });
  }

  function applyFilingPrefill(filing: Filing) {
    const { prefill, provenance } = filingToDutyCalc(filing);
    applyPrefill(prefill, provenance);
  }

  function applyAbiPrefill(doc: AbiDocument) {
    const { prefill, provenance } = abiDocumentToDutyCalc(doc);
    applyPrefill(prefill, provenance);
  }

  function clearPrefill() {
    setSource(null);
    setFilledFields(new Set());
  }

  /** Drop a single field's chip when the user edits it. */
  function markFieldEdited(key: string) {
    if (filledFields.size === 0 || !filledFields.has(key)) return;
    setFilledFields(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  /** Drop all item-level chips. Used on add/remove (indices shift). */
  function clearAllItemChips() {
    if (filledFields.size === 0) return;
    setFilledFields(prev => {
      const next = new Set<string>();
      for (const k of prev) if (!k.startsWith('item.')) next.add(k);
      return next;
    });
  }

  const standardCalc = useDutyCalculate();
  const aiCalc = useAIDutyCalculate();
  const isPending = standardCalc.isPending || aiCalc.isPending;

  // Switching modes invalidates the previous (different-shape) result.
  const [resultMode, setResultMode] = useState<Mode | null>(null);
  const result: DutyCalcResponse | DutyCalcAIResponse | undefined =
    resultMode === 'standard'
      ? standardCalc.data?.data
      : resultMode === 'ai'
        ? aiCalc.data?.data
        : undefined;

  const handleModeChange = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    setResultMode(null);
    standardCalc.reset();
    aiCalc.reset();
  };

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
    // Drop the chip + clear any server error on every key the user just touched.
    for (const k of Object.keys(patch)) {
      markFieldEdited(`item.${index}.${k}`);
      clearServerError(`item.${index}.${k}`);
    }
  };

  const addItem = () => {
    if (items.length >= MAX_ITEMS) {
      toast.error(`A calculation takes up to ${MAX_ITEMS} lines.`);
      return;
    }
    setItems((prev) => [...prev, emptyItem()]);
    clearAllItemChips();
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    clearAllItemChips();
  };

  // ─── Validation & submit ──────────────────────────────────
  // Per-field error map. Top-level keys: 'countryOfOrigin', 'modeOfTransportation',
  // 'entryType', 'currency', 'entryDate'. Item keys: `item.${index}.${fieldName}`.
  // Returns ALL errors (not just the first), so the form can highlight every
  // problem at once rather than making the user fix-then-resubmit-then-fix.
  const validationErrors = useMemo<Record<string, string>>(() => {
    const errs: Record<string, string> = {};
    if (!countryOfOrigin) errs.countryOfOrigin = 'Country of origin is required';
    if (!modeOfTransportation) errs.modeOfTransportation = 'Mode of transportation is required';
    if (!entryType) errs.entryType = 'Entry type is required';
    if (!currency) errs.currency = 'Currency is required';
    if (!estimatedEntryDateYYYYMMDD || estimatedEntryDateYYYYMMDD.length !== 8) {
      errs.entryDate = 'Estimated entry date is required';
    }
    if (!items.length) {
      errs['items'] = 'At least one item is required';
    } else {
      items.forEach((it, i) => {
        if (!it.description.trim()) errs[`item.${i}.description`] = 'Description is required';
        if (mode === 'standard' && !it.hts.trim()) {
          errs[`item.${i}.hts`] = 'HTS code is required';
        } else if (mode === 'standard' && it.hts.trim()) {
          // HTS_FORMAT regex: 6-10 digits, optional dots between groups.
          const stripped = it.hts.replace(/\./g, '');
          if (!/^\d{6,10}$/.test(stripped)) {
            errs[`item.${i}.hts`] = 'HTS code must be 6 to 10 digits (dots optional)';
          }
        }
        const v = Number(it.totalValue);
        if (it.totalValue === '' || !Number.isFinite(v)) {
          errs[`item.${i}.totalValue`] = 'Value is required';
        } else if (v <= 0) {
          errs[`item.${i}.totalValue`] = 'Value must be greater than 0';
        }
        // Quantity sanity: if filled, must be a non-negative number.
        if (it.quantity1 !== '' && (!Number.isFinite(Number(it.quantity1)) || Number(it.quantity1) < 0)) {
          errs[`item.${i}.quantity1`] = 'Must be a non-negative number';
        }
        if (it.quantity2 !== '' && (!Number.isFinite(Number(it.quantity2)) || Number(it.quantity2) < 0)) {
          errs[`item.${i}.quantity2`] = 'Must be a non-negative number';
        }
      });
    }
    return errs;
  }, [
    countryOfOrigin,
    modeOfTransportation,
    entryType,
    currency,
    estimatedEntryDateYYYYMMDD,
    items,
    mode,
  ]);

  // Server-side errors merged in after a 400 response. Cleared per-field
  // when the user touches that field, or wholesale on resubmit.
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  // Holds the page's "have you actually tried to Calculate yet?" gate so
  // we don't shout "Required" at every empty field the moment the page
  // mounts. Validation still runs in the background (so the toast on
  // submit knows what's missing), but field-level error pills + the
  // "N issues to fix" footer only render once the user has clicked
  // Calculate at least once. Reset by switching modes (Standard ↔ AI).
  const [submitAttempted, setSubmitAttempted] = useState(false);
  useEffect(() => { setSubmitAttempted(false); }, [mode]);

  function clearServerError(key: string) {
    if (!(key in serverErrors)) return;
    setServerErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  /** Build the per-item error subset that ItemCard expects (keyed by ItemDraft field).
   *  Reads visibleErrors (submit-gated) so item rows render clean on first open. */
  function itemErrorsAt(index: number): Partial<Record<keyof ItemDraft, string>> {
    const out: Partial<Record<keyof ItemDraft, string>> = {};
    const prefix = `item.${index}.`;
    for (const [k, v] of Object.entries(visibleErrors)) {
      if (k.startsWith(prefix)) {
        const field = k.slice(prefix.length) as keyof ItemDraft;
        out[field] = v;
      }
    }
    return out;
  }

  // Effective error map = client-side + server-side (latter wins). The
  // server only tells us about the issues the client missed, so any
  // overlap is the same field anyway.
  const allErrors = useMemo<Record<string, string>>(() => ({ ...validationErrors, ...serverErrors }),
    [validationErrors, serverErrors]);

  // Errors actually rendered in the UI. Client-side validation is
  // gated on submitAttempted so a freshly opened form stays clean —
  // server errors always show because they only arrive after a real
  // submit anyway.
  const visibleErrors = useMemo<Record<string, string>>(() => ({
    ...(submitAttempted ? validationErrors : {}),
    ...serverErrors,
  }), [submitAttempted, validationErrors, serverErrors]);

  const errorCount = Object.keys(allErrors).length;
  const hasErrors = errorCount > 0;
  const visibleErrorCount = Object.keys(visibleErrors).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    // The list above the button names each one; no toast on top of it.
    if (hasErrors) {
      return;
    }
    // Clear any stale server errors from a previous submit.
    setServerErrors({});

    const payloadItems: DutyCalcItem[] = items.map((it) => {
      const base: DutyCalcItem = {
        description: it.description.trim(),
        totalValue: Number(it.totalValue),
      };
      if (it.hts.trim()) base.hts = it.hts.trim();
      const q1 = toNumberOrUndef(it.quantity1);
      if (q1 !== undefined) base.quantity1 = q1;
      const q2 = toNumberOrUndef(it.quantity2);
      if (q2 !== undefined) base.quantity2 = q2;
      if (it.spi.trim()) base.spi = it.spi.trim();
      const al = toNumberOrUndef(it.aluminumPercentage);
      if (al !== undefined) base.aluminumPercentage = al;
      const st = toNumberOrUndef(it.steelPercentage);
      if (st !== undefined) base.steelPercentage = st;
      const co = toNumberOrUndef(it.copperPercentage);
      if (co !== undefined) base.copperPercentage = co;
      if (it.isCottonExempt) base.isCottonExempt = true;
      if (it.isAutoPartExempt) base.isAutoPartExempt = true;
      if (it.kitchenPartNotComplete) base.kitchenPartNotComplete = true;
      if (it.isInformationalMaterialExempt)
        base.isInformationalMaterialExempt = true;
      return base;
    });

    const body: DutyCalcRequest = {
      items: payloadItems,
      entryType,
      modeOfTransportation,
      estimatedEntryDate: yyyymmddToMMDDYYYY(estimatedEntryDateYYYYMMDD),
      countryOfOrigin,
      currency,
    };

    try {
      if (mode === 'standard') {
        await standardCalc.mutateAsync(body);
        setResultMode('standard');
      } else {
        await aiCalc.mutateAsync(body);
        setResultMode('ai');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Duty calculation failed';
      const body = (err as any)?.body as { issues?: Array<{ path: (string | number)[]; message: string }> } | undefined;

      // 4xx from server with field-level issues — could be Zod (our schema)
      // or CC's downstream validator (mapped server-side into the same
      // issues[] shape). Map each path to a form-field key and surface
      // inline. Toast shows the FIRST specific message so the user knows
      // exactly what to fix without having to scroll.
      if (body?.issues && Array.isArray(body.issues) && body.issues.length > 0) {
        const next: Record<string, string> = {};
        for (const issue of body.issues) {
          const key = pathToKey(issue.path);
          if (key && !next[key]) next[key] = plainMessage(issue.message);
        }
        setServerErrors(next);
        const count = Object.keys(next).length;
        const first = Object.entries(next)[0];
        const firstFieldLabel = first ? humanKey(first[0]) : '';
        toast.error(`${count} ${count === 1 ? 'field' : 'fields'} need attention`, {
          description: first
            ? (count > 1
                ? `${firstFieldLabel}: ${first[1]} (and ${count - 1} more, listed below)`
                : `${firstFieldLabel}: ${first[1]}`)
            : 'Each is marked on its field.',
        });
        return;
      }

      toast.error(msg);
    }
  };

  /** Convert a Zod issue path to our form's field-key shape.
   *  Examples:
   *    ['countryOfOrigin']        → 'countryOfOrigin'
   *    ['items', 0, 'hts']        → 'item.0.hts'
   *    ['items', 2, 'totalValue'] → 'item.2.totalValue'
   *    ['items']                  → 'items'   (top-level array error)
   *  Defensive against a missing or malformed `path` (some upstream
   *  error shapes don't ship one) — returns null so the caller falls
   *  through to a generic toast instead of crashing.
   */
  function pathToKey(path: (string | number)[] | undefined | null): string | null {
    if (!Array.isArray(path) || path.length === 0) return null;
    if (path[0] === 'items' && path.length >= 3 && typeof path[1] === 'number') {
      return `item.${path[1]}.${path[2]}`;
    }
    if (path[0] === 'items' && path.length === 1) return 'items';
    return path.join('.');
  }

  /** Friendly label for a field-key in the error summary. */
  function humanKey(key: string): string {
    if (key.startsWith('item.')) {
      const [, idx, field] = key.split('.');
      const friendly = ({
        hts: 'HTS code', description: 'Description', totalValue: 'Value',
        quantity1: 'Quantity', quantity2: 'Second quantity', spi: 'Special program',
      } as Record<string, string>)[field] ?? field;
      return `Line ${Number(idx) + 1}, ${friendly}`;
    }
    return ({
      countryOfOrigin:      'Country of origin',
      modeOfTransportation: 'Mode of transport',
      entryType:            'Entry type',
      currency:             'Currency',
      entryDate:            'Entry date',
      estimatedEntryDate:   'Entry date',
      items:                'Items',
    } as Record<string, string>)[key] ?? key;
  }

  // The button is at the foot of the form and the estimate starts beside its
  // head (or under it on a phone), so a new estimate is brought into view.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className={PAGE}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">Duty calculator</h1>
          <p className="text-[13px] text-muted-foreground">Estimate duties, added tariffs and fees before you file.</p>
        </div>
        <ModeToggle mode={mode} onChange={handleModeChange} />
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-5">
          <SourcePicker source={source} onPickFiling={applyFilingPrefill} onPickAbiDocument={applyAbiPrefill} onClear={clearPrefill} />

          <section aria-labelledby="shipment-title" className={cn(PANEL, 'p-5')}>
            <h2 id="shipment-title" className="text-[14px] font-semibold">Shipment</h2>
            <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <ComboboxField
                label="Country of origin" required value={countryOfOrigin} options={COUNTRIES} placeholder="Select a country"
                onChange={(v) => { setCountryOfOrigin(v); markFieldEdited('countryOfOrigin'); clearServerError('countryOfOrigin'); }}
                labelExtra={<ProvenanceChip source={provenanceFor('countryOfOrigin')} />} error={visibleErrors.countryOfOrigin}
              />
              <DateField
                label="Estimated entry date" required value={estimatedEntryDateYYYYMMDD}
                onChange={(v) => { setEstimatedEntryDateYYYYMMDD(v); clearServerError('entryDate'); clearServerError('estimatedEntryDate'); }}
                error={visibleErrors.entryDate || visibleErrors.estimatedEntryDate}
              />
              <SelectField
                label="Transport" required value={modeOfTransportation}
                onChange={(v) => { setModeOfTransportation(v as DutyCalcRequest['modeOfTransportation']); markFieldEdited('modeOfTransportation'); clearServerError('modeOfTransportation'); }}
                options={[{ value: 'ocean', label: 'Ocean' }, { value: 'air', label: 'Air' }, { value: 'truck', label: 'Truck' }, { value: 'rail', label: 'Rail' }]}
                labelExtra={<ProvenanceChip source={provenanceFor('modeOfTransportation')} />} error={visibleErrors.modeOfTransportation}
              />
              <SelectField
                label="Entry type" required value={entryType}
                onChange={(v) => { setEntryType(v as DutyCalcRequest['entryType']); clearServerError('entryType'); }}
                options={[{ value: 'formal', label: 'Formal' }, { value: 'informal', label: 'Informal' }]} error={visibleErrors.entryType}
              />
              <SelectField
                label="Currency" required value={currency} options={CURRENCIES}
                onChange={(v) => { setCurrency(v); markFieldEdited('currency'); clearServerError('currency'); }}
                labelExtra={<ProvenanceChip source={provenanceFor('currency')} />} error={visibleErrors.currency}
              />
            </div>
          </section>

          <section aria-labelledby="goods-title" className={PANEL}>
            <div className="flex items-start justify-between gap-3 px-5 py-3.5">
              <div>
                <h2 id="goods-title" className="text-[14px] font-semibold">Goods <span className="font-normal tabular-nums text-muted-foreground">{items.length}</span></h2>
                <p className="text-[13px] text-muted-foreground">
                  {mode === 'standard' ? 'One line per HTS code.' : 'Describe each line. It is classified first, then the duty is worked out.'}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={items.length >= MAX_ITEMS}><Plus aria-hidden />Add a line</Button>
            </div>
            <ul className="divide-y divide-border/60 border-t border-border/70">
              {items.map((item, idx) => (
                <ItemRow
                  key={idx} index={idx} mode={mode} item={item}
                  onChange={(patch) => updateItem(idx, patch)}
                  onRemove={items.length > 1 ? () => removeItem(idx) : undefined}
                  provenanceFor={(key) => provenanceFor(`item.${idx}.${key}`)}
                  errors={itemErrorsAt(idx)}
                />
              ))}
            </ul>
          </section>

          {visibleErrorCount > 0 && (
            <div role="alert" className="rounded-xl bg-urgent-tint px-5 py-3.5">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-urgent">
                <AlertCircle className="h-4 w-4" aria-hidden />
                {visibleErrorCount === 1 ? '1 field to fix' : `${visibleErrorCount} fields to fix`} before this can be calculated
              </p>
              <ul className="mt-1.5 space-y-0.5 pl-6 text-[13px]">
                {Object.entries(visibleErrors).slice(0, 6).map(([key, msg]) => (
                  <li key={key}><span className="font-medium">{humanKey(key)}:</span> {msg}</li>
                ))}
                {visibleErrorCount > 6 && <li className="text-foreground/70">And {visibleErrorCount - 6} more, each marked on its field.</li>}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-2.5 shadow-card">
            <p className="text-[13px] tabular-nums text-muted-foreground">
              {items.length === 1 ? '1 line' : `${items.length} lines`}, {COUNTRIES.find((c) => c.value === countryOfOrigin)?.label ?? 'no country yet'}
            </p>
            <Button type="submit" disabled={isPending} className="h-10">
              {isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Calculator aria-hidden />}
              {isPending ? 'Calculating' : 'Calculate duties'}
            </Button>
          </div>
        </form>

        <div ref={resultRef} aria-live="polite" className="flex min-w-0 scroll-mt-20 flex-col gap-5">
          {result ? <Results result={result} /> : <ResultsPlaceholder mode={mode} />}
        </div>
      </div>
    </div>
  );
}
