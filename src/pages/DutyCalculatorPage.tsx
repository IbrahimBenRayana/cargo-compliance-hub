/**
 * Duty Calculator — Phase 1.
 *
 * Standalone /duty-calculator page. Two modes:
 *   • Standard (HTS) — POST /api/v1/duty-calculation, deterministic
 *   • AI-assisted   — POST /api/v1/duty-calculation/ai, AI classifies
 *
 * Layout follows the unified list-page hero pattern (tag strip + 32px
 * headline + amber primary), with a left-column input form and a
 * right-column results panel that materialises after a successful call.
 */
import { useMemo, useState } from 'react';
import {
  Calculator,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Hash,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import {
  COUNTRIES,
  CURRENCIES,
  ComboboxField,
  DateField,
  SelectField,
  TextField,
  yyyymmddToISO,
} from '@/components/abi-wizard/shared';

import { useAIDutyCalculate, useDutyCalculate } from '@/hooks/useDutyCalculation';
import type {
  DutyCalcAIResponse,
  DutyCalcItem,
  DutyCalcItemResult,
  DutyCalcRequest,
  DutyCalcResponse,
  DutyCalcSubheading,
} from '@/api/client';
import { filingToDutyCalc, abiDocumentToDutyCalc, type SourceProvenance } from '@/lib/duty-calc-prefill';
import { SourcePicker, ProvenanceChip } from '@/components/duty-calc/SourcePicker';
import type { Filing } from '@/types/shipment';
import type { AbiDocument } from '@/api/client';

// ─── Mode + form types ─────────────────────────────────────
type Mode = 'standard' | 'ai';

const MAX_ITEMS = 50;

interface ItemDraft {
  hts: string;
  description: string;
  totalValue: string;
  quantity1: string;
  quantity2: string;
  spi: string;
  aluminumPercentage: string;
  steelPercentage: string;
  copperPercentage: string;
  isCottonExempt: boolean;
  isAutoPartExempt: boolean;
  kitchenPartNotComplete: boolean;
  isInformationalMaterialExempt: boolean;
}

const emptyItem = (): ItemDraft => ({
  hts: '',
  description: '',
  totalValue: '',
  quantity1: '',
  quantity2: '',
  spi: '',
  aluminumPercentage: '',
  steelPercentage: '',
  copperPercentage: '',
  isCottonExempt: false,
  isAutoPartExempt: false,
  kitchenPartNotComplete: false,
  isInformationalMaterialExempt: false,
});

// ─── Helpers ───────────────────────────────────────────────

/** YYYYMMDD (DateField storage) → MM/DD/YYYY (CC payload). */
function yyyymmddToMMDDYYYY(v: string): string {
  if (!v || v.length !== 8) return '';
  const yyyy = v.slice(0, 4);
  const mm = v.slice(4, 6);
  const dd = v.slice(6, 8);
  return `${mm}/${dd}/${yyyy}`;
}

function toNumberOrUndef(s: string): number | undefined {
  if (s === '' || s === undefined || s === null) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function fmtUSD(n: number | undefined | null, currency = 'USD') {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function fmtPct(n: number | undefined | null) {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(2)}%`;
}

/** Subheading section → tile severity tint. */
function subheadingTint(section?: string): string {
  switch (section) {
    case 'section301':
      return 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900/50';
    case 'reciprocal':
      return 'bg-violet-50 dark:bg-violet-950/30 text-violet-900 dark:text-violet-200 border-violet-200 dark:border-violet-900/50';
    case 'fentanylCN':
      return 'bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-900/50';
    case 'steel':
    case 'aluminum':
      return 'bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-slate-200 border-slate-300 dark:border-slate-700';
    default:
      return 'bg-muted/40 text-foreground/80 border-border';
  }
}

function sectionLabel(section?: string): string | null {
  if (!section) return null;
  const map: Record<string, string> = {
    section301: 'Section 301',
    reciprocal: 'Reciprocal',
    fentanylCN: 'IEEPA / Fentanyl',
    steel: 'Steel',
    aluminum: 'Aluminum',
  };
  return map[section] ?? section;
}

// ─── Mode toggle (segmented control) ───────────────────────

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const opts: { value: Mode; label: string; icon?: React.ReactNode }[] = [
    { value: 'standard', label: 'Standard (HTS)', icon: <Hash className="h-3.5 w-3.5" /> },
    { value: 'ai', label: 'AI-assisted', icon: <Sparkles className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="inline-flex items-center rounded-lg border bg-muted/30 p-0.5 text-xs">
      {opts.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all',
              active
                ? 'bg-background shadow-sm text-foreground ring-1 ring-amber-500/30'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={active}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Item card ──────────────────────────────────────────────

function ItemCard({
  index,
  mode,
  item,
  onChange,
  onRemove,
  canRemove,
  provenanceFor,
  errors,
}: {
  index: number;
  mode: Mode;
  item: ItemDraft;
  onChange: (patch: Partial<ItemDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
  /** Returns the source object (or null) for `item.${index}.${key}`. */
  provenanceFor?: (key: string) => SourceProvenance | null;
  /** Per-field error map keyed by ItemDraft field name (e.g., 'hts', 'totalValue'). */
  errors?: Partial<Record<keyof ItemDraft, string>>;
}) {
  return (
    <div className="rounded-lg border bg-muted/10 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">
          Item {index + 1}
        </Badge>
        {canRemove && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive h-7 px-2"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove item {index + 1}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This item will be deleted from the calculation request.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {mode === 'standard' && (
          <TextField
            label="HTS Number"
            required
            value={item.hts}
            onChange={(v) => onChange({ hts: v })}
            placeholder="7320.20.1000 or 7320201000"
            hint="10-digit HTS code. Dots are optional."
            labelExtra={<ProvenanceChip source={provenanceFor?.('hts') ?? null} />}
            error={errors?.hts}
          />
        )}
        <TextField
          label="Description"
          required
          value={item.description}
          onChange={(v) => onChange({ description: v })}
          placeholder={
            mode === 'ai'
              ? 'e.g. Stainless steel kitchen sink, single bowl, brushed finish'
              : 'Goods description'
          }
          maxLength={300}
          hint={
            mode === 'ai'
              ? 'The richer the description, the better the AI classification.'
              : undefined
          }
          labelExtra={<ProvenanceChip source={provenanceFor?.('description') ?? null} />}
          error={errors?.description}
        />
        <TextField
          label="Total Value"
          required
          type="number"
          value={item.totalValue}
          onChange={(v) => onChange({ totalValue: v })}
          placeholder="0.00"
          hint="Customs value of the merchandise in the currency selected above."
          labelExtra={<ProvenanceChip source={provenanceFor?.('totalValue') ?? null} />}
          error={errors?.totalValue}
        />
        <TextField
          label="SPI Code"
          value={item.spi}
          onChange={(v) => onChange({ spi: v.toUpperCase() })}
          placeholder="MX, JP, KR…"
          maxLength={4}
          hint="Special Programs Indicator (e.g. MX for USMCA). Optional."
          error={errors?.spi}
        />
        <TextField
          label="Quantity 1 (HTS primary unit)"
          type="number"
          value={item.quantity1}
          onChange={(v) => onChange({ quantity1: v })}
          placeholder="e.g. 1500"
          hint={
            'Reportable quantity in the HTS primary unit of measure. ' +
            'The unit (kilograms, meters, pieces, dozens, etc.) is set by the HTS line itself — ' +
            'check the HTS chapter for the required UOM. Leave blank if unknown; CC will use 0.'
          }
          labelExtra={<ProvenanceChip source={provenanceFor?.('quantity1') ?? null} />}
          error={errors?.quantity1}
        />
        <TextField
          label="Quantity 2 (HTS secondary unit, if any)"
          type="number"
          value={item.quantity2}
          onChange={(v) => onChange({ quantity2: v })}
          placeholder="e.g. 12"
          hint={
            'Some HTS lines require a SECOND reportable unit alongside Q1 (e.g. kg + pieces). ' +
            'Most HTS codes do not — leave blank when not applicable. ' +
            'If your HTS line shows two unit columns, the second one goes here.'
          }
          error={errors?.quantity2}
        />
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="trade-compliance" className="border rounded-md">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium text-muted-foreground hover:no-underline">
            Trade compliance (materials & exemptions)
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-4 pt-1 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TextField
                label="Aluminum %"
                type="number"
                value={item.aluminumPercentage}
                onChange={(v) => onChange({ aluminumPercentage: v })}
                placeholder="0"
              />
              <TextField
                label="Steel %"
                type="number"
                value={item.steelPercentage}
                onChange={(v) => onChange({ steelPercentage: v })}
                placeholder="0"
              />
              <TextField
                label="Copper %"
                type="number"
                value={item.copperPercentage}
                onChange={(v) => onChange({ copperPercentage: v })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Exemptions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  ['isCottonExempt', 'Cotton fee exempt'],
                  ['isAutoPartExempt', 'Auto parts exempt'],
                  ['kitchenPartNotComplete', 'Kitchen part not complete'],
                  ['isInformationalMaterialExempt', 'Informational materials exempt'],
                ].map(([k, label]) => {
                  const key = k as keyof ItemDraft;
                  const checked = Boolean(item[key]);
                  return (
                    <label
                      key={k}
                      className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-2.5 py-1.5 hover:bg-muted/30"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded accent-amber-500"
                        checked={checked}
                        onChange={(e) =>
                          onChange({ [key]: e.target.checked } as Partial<ItemDraft>)
                        }
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// ─── Results sub-components ─────────────────────────────────

function HeroStat({
  total,
  effectivePct,
  currency,
}: {
  total: number | undefined;
  effectivePct: number | undefined;
  currency: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border ring-1 ring-amber-500/15 px-6 py-7',
        'bg-gradient-to-br from-amber-500/[0.06] via-card to-card',
      )}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Total estimated duties
        </p>
      </div>
      <p className="text-[40px] leading-none font-semibold tabular-nums tracking-[-0.02em] text-gradient-stage-manifest">
        {fmtUSD(total, currency)}
      </p>
      <p className="mt-3 text-[12px] text-muted-foreground">
        Effective rate{' '}
        <span className="font-semibold text-foreground">{fmtPct(effectivePct)}</span>
      </p>
    </div>
  );
}

function SubheadingsTable({ rows }: { rows: DutyCalcSubheading[] }) {
  if (!rows.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No additional subheadings (Chapter 99 add-ons).
      </p>
    );
  }
  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left font-medium px-3 py-2">HTS</th>
            <th className="text-left font-medium px-3 py-2">Name</th>
            <th className="text-left font-medium px-3 py-2">Section</th>
            <th className="text-right font-medium px-3 py-2">Duty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const tint = subheadingTint(r.section);
            const label = sectionLabel(r.section);
            return (
              <tr key={`${r.hts}-${i}`} className="border-t">
                <td className="px-3 py-2 font-mono">{r.hts}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">
                  {label ? (
                    <span
                      className={cn(
                        'inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium',
                        tint,
                      )}
                    >
                      {label}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {fmtUSD(r.duty)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ItemBreakdownCard({
  index,
  result,
  currency,
}: {
  index: number;
  result: DutyCalcItemResult;
  currency: string;
}) {
  const itemTotal =
    (result.duty || 0) +
    (result.subheadingDuties || 0) +
    (result.userFee || 0) +
    (result.irTax || 0) +
    (result.adcvdAmount || 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm">
              Item {index + 1}
              <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                {result.classification.hts}
              </span>
            </CardTitle>
            <CardDescription className="mt-0.5">
              {result.classification.name || result.description}
            </CardDescription>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Item duty
            </p>
            <p className="text-base font-semibold font-mono">
              {fmtUSD(itemTotal, currency)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { label: 'Dutiable', value: fmtUSD(result.totalDutiable, currency) },
            { label: 'Base duty', value: fmtUSD(result.duty, currency) },
            { label: 'Subheadings', value: fmtUSD(result.subheadingDuties, currency) },
            { label: 'User fee', value: fmtUSD(result.userFee, currency) },
          ].map((c) => (
            <div key={c.label} className="bg-muted/40 rounded-lg p-2.5 space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {c.label}
              </p>
              <p className="text-[13px] font-medium font-mono">{c.value}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Subheadings (Chapter 99 add-ons)
          </p>
          <SubheadingsTable rows={result.subheadings || []} />
        </div>
      </CardContent>
    </Card>
  );
}

function FeesCard({
  entryFee,
  currency,
}: {
  entryFee: { entryProcessingFee: number; portProcessingFee: number };
  currency: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Processing fees</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-muted/40 rounded-lg p-3 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Entry processing
          </p>
          <p className="text-base font-medium font-mono">
            {fmtUSD(entryFee?.entryProcessingFee, currency)}
          </p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Port processing
          </p>
          <p className="text-base font-medium font-mono">
            {fmtUSD(entryFee?.portProcessingFee, currency)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AIRecommendationsCard({ data }: { data: DutyCalcAIResponse }) {
  if (!data.aiRecommendations?.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" /> AI Classification
        </CardTitle>
        <CardDescription>
          GRI reasoning and ranked HTS alternatives chosen for each item.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.aiRecommendations.map((rec) => {
          const top = rec.recommendations?.[0];
          return (
            <div key={rec.itemIndex} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Item {rec.itemIndex + 1}
                  </p>
                  <p className="font-mono text-base font-semibold mt-1">
                    {rec.selectedHts}
                  </p>
                  {top?.naturalized_description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {top.naturalized_description}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Original: {rec.originalDescription.slice(0, 40)}
                  {rec.originalDescription.length > 40 ? '…' : ''}
                </Badge>
              </div>

              {rec.explanation && (
                <p className="text-xs text-foreground/90">{rec.explanation}</p>
              )}

              {rec.specializedExplanation && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="gri" className="border-none">
                    <AccordionTrigger className="py-1 text-xs font-medium text-muted-foreground hover:no-underline">
                      Show GRI reasoning
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-foreground/80 whitespace-pre-wrap">
                      {rec.specializedExplanation}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              {rec.recommendations?.length > 1 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Alternatives
                  </p>
                  <div className="space-y-2">
                    {rec.recommendations.slice(1, 5).map((alt, i) => (
                      <div
                        key={`${alt.hts}-${i}`}
                        className="rounded-md border bg-muted/20 p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold">
                            {alt.hts}
                          </span>
                          <span className="text-muted-foreground">
                            score {alt.score.toFixed(2)}
                          </span>
                        </div>
                        {alt.naturalized_description && (
                          <p className="mt-1 text-foreground/80">
                            {alt.naturalized_description}
                          </p>
                        )}
                        {alt.construction?.indent_hierarchy?.length ? (
                          <p className="mt-1.5 text-[11px] text-muted-foreground inline-flex flex-wrap items-center gap-1">
                            {alt.construction.indent_hierarchy.map((h, j) => (
                              <span
                                key={`${h.htsno}-${j}`}
                                className="inline-flex items-center gap-1"
                              >
                                {j > 0 && (
                                  <ChevronRight className="h-3 w-3 opacity-50" />
                                )}
                                <span className="font-mono">{h.htsno}</span>
                                <span className="text-muted-foreground/80">
                                  {h.description}
                                </span>
                              </span>
                            ))}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ResultsPanel({
  result,
  mode,
}: {
  result: DutyCalcResponse | DutyCalcAIResponse;
  mode: Mode;
}) {
  const summary = result.summary || ({} as DutyCalcResponse['summary']);
  const currency = result.currency || 'USD';

  // Total duties — AI uses totalDuties / totalDutiesFees, standard uses totalDutiesTaxes.
  const totalDuties =
    summary.totalDuties ??
    summary.totalDutiesFees ??
    summary.totalDutiesTaxes ??
    result.dutiesBreakdown?.totalDuties ??
    undefined;

  // Effective rate — AI sends totalDutyPercentage; otherwise compute.
  const effectivePct =
    summary.totalDutyPercentage ??
    (totalDuties !== undefined && summary.totalDutiableValue
      ? (totalDuties / summary.totalDutiableValue) * 100
      : undefined);

  const aiData = mode === 'ai' ? (result as DutyCalcAIResponse) : null;

  return (
    <div className="space-y-4">
      <HeroStat
        total={totalDuties}
        effectivePct={effectivePct}
        currency={currency}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          {[
            { label: 'Total value', value: fmtUSD(summary.totalValue, currency) },
            { label: 'Dutiable value', value: fmtUSD(summary.totalDutiableValue, currency) },
            { label: 'DDP', value: fmtUSD(summary.ddp, currency) },
            { label: 'User fee', value: fmtUSD(summary.totalUserFee ?? result.dutiesBreakdown?.totalUserFee, currency) },
            { label: 'Country', value: result.countryOfOriginName || result.countryOfOrigin || '—' },
            { label: 'Mode', value: result.modeOfTransportation || '—' },
          ].map((c) => (
            <div key={c.label} className="bg-muted/40 rounded-lg p-2.5 space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {c.label}
              </p>
              <p className="text-[13px] font-medium font-mono truncate" title={String(c.value)}>
                {c.value}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70 shrink-0">
            Per-item breakdown
          </p>
          <span className="h-px flex-1 bg-gradient-to-r from-border/60 via-border/30 to-transparent" />
        </div>
        {(result.items || []).map((it, i) => (
          <ItemBreakdownCard key={i} index={i} result={it} currency={currency} />
        ))}
      </div>

      {result.entryFee && (
        <FeesCard entryFee={result.entryFee} currency={currency} />
      )}

      {aiData && <AIRecommendationsCard data={aiData} />}
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/10 px-6 py-16 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
        <Calculator className="h-6 w-6 text-amber-500" />
      </div>
      <p className="text-sm font-medium">No calculation yet</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
        Fill out the shipment metadata and at least one item, then click
        <span className="font-medium"> Calculate duties </span>
        to estimate Section 301 / steel / reciprocal tariffs and processing fees.
      </p>
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
      toast.error(`Maximum ${MAX_ITEMS} items per calculation`);
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
          errs[`item.${i}.hts`] = 'HTS code is required in Standard mode';
        } else if (mode === 'standard' && it.hts.trim()) {
          // HTS_FORMAT regex: 6-10 digits, optional dots between groups.
          const stripped = it.hts.replace(/\./g, '');
          if (!/^\d{6,10}$/.test(stripped)) {
            errs[`item.${i}.hts`] = 'HTS must be 6–10 digits (dots optional)';
          }
        }
        const v = Number(it.totalValue);
        if (it.totalValue === '' || !Number.isFinite(v)) {
          errs[`item.${i}.totalValue`] = 'Total value is required';
        } else if (v <= 0) {
          errs[`item.${i}.totalValue`] = 'Total value must be greater than 0';
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

  function clearServerError(key: string) {
    if (!(key in serverErrors)) return;
    setServerErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  /** Build the per-item error subset that ItemCard expects (keyed by ItemDraft field). */
  function itemErrorsAt(index: number): Partial<Record<keyof ItemDraft, string>> {
    const out: Partial<Record<keyof ItemDraft, string>> = {};
    const prefix = `item.${index}.`;
    for (const [k, v] of Object.entries(allErrors)) {
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

  const errorCount = Object.keys(allErrors).length;
  const hasErrors = errorCount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors) {
      const first = Object.values(allErrors)[0];
      toast.error(`${errorCount} ${errorCount === 1 ? 'field needs' : 'fields need'} attention`, {
        description: first,
      });
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
      toast.success('Duty calculation complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Duty calculation failed';
      const body = (err as any)?.body as { issues?: Array<{ path: (string | number)[]; message: string }> } | undefined;

      // 400 from server with Zod issues — map each path to a form field
      // key and surface inline. Every issue gets a pin on a specific field.
      if (body?.issues && Array.isArray(body.issues) && body.issues.length > 0) {
        const next: Record<string, string> = {};
        for (const issue of body.issues) {
          const key = pathToKey(issue.path);
          if (key && !next[key]) next[key] = issue.message;
        }
        setServerErrors(next);
        const count = Object.keys(next).length;
        toast.error(`Server rejected ${count} ${count === 1 ? 'field' : 'fields'}`, {
          description: 'Scroll down — each issue is highlighted in red.',
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
   */
  function pathToKey(path: (string | number)[]): string | null {
    if (path.length === 0) return null;
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
        hts: 'HTS', description: 'Description', totalValue: 'Total value',
        quantity1: 'Quantity 1', quantity2: 'Quantity 2', spi: 'SPI',
      } as Record<string, string>)[field] ?? field;
      return `Item ${Number(idx) + 1} · ${friendly}`;
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

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Hero */}
      <header
        className="space-y-4 animate-fade-in-up motion-reduce:animate-none"
        style={{ animationFillMode: 'forwards' }}
      >
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70 shrink-0 inline-flex items-center gap-2">
            <span
              className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500/60"
              aria-hidden
            />
            Lookups · Duty
          </p>
          <span className="h-px flex-1 bg-gradient-to-r from-border/60 via-border/30 to-transparent" />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] text-foreground inline-flex items-center gap-3">
              <Calculator
                className="h-7 w-7 text-amber-500 shrink-0"
                strokeWidth={2}
              />
              Duty Calculator
            </h1>
            <p className="text-[14px] text-muted-foreground mt-2">
              Estimate U.S. customs duties, fees, and Section 301 / steel /
              reciprocal tariffs.
            </p>
          </div>
          <ModeToggle mode={mode} onChange={handleModeChange} />
        </div>
      </header>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
        {/* ── Input form ── */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 animate-fade-in-up motion-reduce:animate-none"
          style={{ animationDelay: '40ms', animationFillMode: 'forwards' }}
        >
          {/* Source picker — pre-fill from an existing ISF filing.
              Optional shortcut; the form below works fine without it. */}
          <SourcePicker
            source={source}
            onPickFiling={applyFilingPrefill}
            onPickAbiDocument={applyAbiPrefill}
            onClear={clearPrefill}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Shipment metadata</CardTitle>
              <CardDescription>
                Required for both calculator modes.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ComboboxField
                label="Country of Origin"
                required
                value={countryOfOrigin}
                onChange={(v) => {
                  setCountryOfOrigin(v);
                  markFieldEdited('countryOfOrigin');
                  clearServerError('countryOfOrigin');
                }}
                options={COUNTRIES}
                placeholder="Select country…"
                labelExtra={<ProvenanceChip source={provenanceFor('countryOfOrigin')} />}
                error={allErrors.countryOfOrigin}
              />
              <SelectField
                label="Mode of Transportation"
                required
                value={modeOfTransportation}
                onChange={(v) => {
                  setModeOfTransportation(v as DutyCalcRequest['modeOfTransportation']);
                  markFieldEdited('modeOfTransportation');
                  clearServerError('modeOfTransportation');
                }}
                options={[
                  { value: 'ocean', label: 'Ocean' },
                  { value: 'air', label: 'Air' },
                  { value: 'truck', label: 'Truck' },
                  { value: 'rail', label: 'Rail' },
                ]}
                labelExtra={<ProvenanceChip source={provenanceFor('modeOfTransportation')} />}
                error={allErrors.modeOfTransportation}
              />
              <SelectField
                label="Entry Type"
                required
                value={entryType}
                onChange={(v) => {
                  setEntryType(v as DutyCalcRequest['entryType']);
                  clearServerError('entryType');
                }}
                options={[
                  { value: 'formal', label: 'Formal' },
                  { value: 'informal', label: 'Informal' },
                ]}
                error={allErrors.entryType}
              />
              <SelectField
                label="Currency"
                required
                value={currency}
                onChange={(v) => { setCurrency(v); markFieldEdited('currency'); clearServerError('currency'); }}
                options={CURRENCIES}
                labelExtra={<ProvenanceChip source={provenanceFor('currency')} />}
                error={allErrors.currency}
              />
              <DateField
                label="Estimated Entry Date"
                required
                value={estimatedEntryDateYYYYMMDD}
                onChange={(v) => { setEstimatedEntryDateYYYYMMDD(v); clearServerError('entryDate'); clearServerError('estimatedEntryDate'); }}
                hint={`UI: ${yyyymmddToISO(estimatedEntryDateYYYYMMDD) || '—'}`}
                error={allErrors.entryDate || allErrors.estimatedEntryDate}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Items ({items.length})
                  </CardTitle>
                  <CardDescription>
                    {mode === 'standard'
                      ? 'HTS code is required for each item.'
                      : 'AI will classify each item from its description.'}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  disabled={items.length >= MAX_ITEMS}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, idx) => (
                <ItemCard
                  key={idx}
                  index={idx}
                  mode={mode}
                  item={item}
                  onChange={(patch) => updateItem(idx, patch)}
                  onRemove={() => removeItem(idx)}
                  canRemove={items.length > 1}
                  provenanceFor={(key) => provenanceFor(`item.${idx}.${key}`)}
                  errors={itemErrorsAt(idx)}
                />
              ))}
            </CardContent>
          </Card>

          {hasErrors && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-3 py-2.5">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 text-[12.5px] font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorCount} {errorCount === 1 ? 'issue' : 'issues'} to fix before calculating
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[12px] text-amber-900/85 dark:text-amber-200/85 leading-snug pl-5 list-disc">
                {Object.entries(allErrors).slice(0, 6).map(([key, msg]) => (
                  <li key={key}>
                    <span className="font-mono text-[11px] text-amber-900/70 dark:text-amber-200/70 mr-1">
                      {humanKey(key)}
                    </span>
                    {msg}
                  </li>
                ))}
                {errorCount > 6 && (
                  <li className="text-amber-900/70 dark:text-amber-200/70 italic">
                    + {errorCount - 6} more — each highlighted in red below
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="sticky bottom-0 -mx-1 px-1 pb-1">
            <Separator className="mb-3" />
            <Button
              type="submit"
              disabled={isPending || hasErrors}
              className="w-full sm:w-auto gap-2 bg-amber-500 hover:bg-amber-600 text-amber-950 font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Calculating…
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4" /> Calculate duties
                </>
              )}
            </Button>
          </div>
        </form>

        {/* ── Results panel ── */}
        <div
          className="space-y-4 animate-fade-in-up motion-reduce:animate-none"
          style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}
        >
          {result ? (
            <ResultsPanel result={result} mode={resultMode ?? mode} />
          ) : (
            <EmptyResults />
          )}
        </div>
      </div>
    </div>
  );
}
