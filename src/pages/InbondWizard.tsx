/**
 * In-Bond (7512) Wizard — create / edit in-bond movement drafts.
 *
 * Routes:
 *   /inbond/new       — new draft
 *   /inbond/:id/edit  — edit an existing DRAFT / READY filing
 *
 * State flow:
 *   - The wizard keeps an `InbondPayloadDraft` in local state that maps 1:1
 *     onto the abi-engine's InbondAddInput (minus `kind`).
 *   - Persistence is explicit: the draft is saved (POST / then PATCH /:id)
 *     when the user advances a step, saves, or validates. Any PATCH sends
 *     the filing back to DRAFT server-side until it is rebuilt.
 *   - "Validate & build" saves, then POSTs /:id/build. Engine rejections come
 *     back as structured 422 issues and are rendered above the buttons; on
 *     success the wire preview is shown and the filing is READY.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  FileCheck,
  Loader2,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import type {
  InbondBillDraft,
  InbondContainerDraft,
  InbondEntryType,
  InbondFiling,
  InbondIssue,
  InbondPayloadDraft,
  InbondWeightUnit,
} from '@/api/client';
import { useBuildInbond, useCreateInbond, useInbondFiling, useUpdateInbond } from '@/hooks/useInbond';
import {
  INBOND_ENTRY_TYPES,
  INBOND_MOT_OPTIONS,
  INBOND_WEIGHT_UNITS,
} from '@/data/inbondEnums';
import { InbondStatusPill } from '@/pages/InbondListPage';
import { WirePreview } from '@/components/inbond/WirePreview';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Step definitions ────────────────────────────────────────

const STEPS = [
  { id: 'movement', label: 'Movement', desc: 'Entry type, carrier & ports', icon: ArrowLeftRight },
  { id: 'bills',    label: 'Bills',    desc: 'Bills of lading & cargo',     icon: Package },
  { id: 'review',   label: 'Review',   desc: 'Validate & build the wire',   icon: FileCheck },
] as const;

// ─── Draft helpers ───────────────────────────────────────────

const EDITABLE_STATUSES = new Set(['DRAFT', 'READY']);

function newBill(): InbondBillDraft {
  return { issuerCode: '', billNumber: '' };
}

function newContainer(): InbondContainerDraft {
  return {
    containerNumber: '',
    cargo: [{ commodities: [], descriptions: [{ description: '' }] }],
  };
}

function newBillDetails() {
  return {
    foreignPortOfLading: '',
    manifestUnits: '',
    weightUnit: 'KG' as InbondWeightUnit,
    foreignShipper: {},
    consignee: {},
    containers: [newContainer()],
  };
}

/** MMDDYY (wire) → yyyy-mm-dd (date input). Century pivot: 00-68 → 20xx. */
function mmddyyToIso(v: string | undefined): string {
  if (!v || !/^[0-9]{6}$/.test(v)) return '';
  const yy = Number(v.slice(4, 6));
  const year = yy <= 68 ? 2000 + yy : 1900 + yy;
  return `${year}-${v.slice(0, 2)}-${v.slice(2, 4)}`;
}

/** yyyy-mm-dd (date input) → MMDDYY (wire). */
function isoToMmddyy(v: string): string | undefined {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(v);
  if (!m) return undefined;
  return `${m[2]}${m[3]}${m[1].slice(2)}`;
}

/**
 * Deep-clean before persisting: drop empty strings / null / undefined and
 * empty objects so the engine's required-field checks fire cleanly instead
 * of tripping on blanks the form left behind. Arrays keep their order;
 * `false` and `0` survive.
 */
function deepClean<T>(value: T): T | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const arr = value
      .map((item) => deepClean(item))
      .filter((item) => item !== undefined);
    return arr as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = deepClean(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return (Object.keys(out).length > 0 ? out : undefined) as unknown as T;
  }
  return value;
}

/** Normalize the draft into the exact payload the engine expects. */
function sanitizeForSave(draft: InbondPayloadDraft): InbondPayloadDraft {
  const next: InbondPayloadDraft = JSON.parse(JSON.stringify(draft));
  // The engine reads `carrierCode`; the server's list denormalizer reads
  // `inBondCarrierCode`. Write both, always in sync.
  next.inBondCarrierCode = next.carrierCode;
  // 61 must NOT carry a foreign destination (INB-20).
  if (next.entryType === '61') delete next.portOfForeignDestination;
  // 63 and FTZ moves are BTA-exempt and must report 'N' (QP10 Note 3).
  if (next.entryType === '63' || next.ftzWithdrawal) next.btaIndicator = 'N';
  // BTA is only user-selectable for 62 — default everything else to 'N'.
  if (next.entryType !== '62' && !next.btaIndicator) next.btaIndicator = 'N';
  // Bills that are "on file" must not carry details; details-bearing bills
  // must not carry a partial quantity (INB-27) — the UI enforces this, but
  // strip leftovers from toggling just in case.
  for (const bill of next.bills ?? []) {
    if (bill.details) delete bill.inBondQuantity;
  }
  return (deepClean(next) ?? {}) as InbondPayloadDraft;
}

function isLongForm(draft: InbondPayloadDraft): boolean {
  return draft.ftzWithdrawal === true || (draft.bills ?? []).some((b) => b.details !== undefined);
}

// ─── Small form primitives ───────────────────────────────────

function Field({
  label,
  helper,
  required,
  className,
  children,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {helper && <p className="text-[11px] text-muted-foreground leading-snug">{helper}</p>}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <Input
      type="number"
      min={1}
      step={1}
      inputMode="numeric"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') onChange(undefined);
        else {
          const n = Math.floor(Number(raw));
          onChange(Number.isFinite(n) ? n : undefined);
        }
      }}
    />
  );
}

// ─── Main component ─────────────────────────────────────────

export default function InbondWizard() {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [docId, setDocId] = useState<string | undefined>(paramId);
  const isEdit = Boolean(paramId);

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<InbondPayloadDraft>({
    entryType: '61',
    bills: [newBill()],
  });

  // Build results (review step).
  const [issues, setIssues] = useState<InbondIssue[] | null>(null);
  const [wireText, setWireText] = useState<string | null>(null);
  const [builtStatus, setBuiltStatus] = useState<InbondFiling['status'] | null>(null);

  const query = useInbondFiling(docId);
  const filing = query.data?.filing;
  const createMut = useCreateInbond();
  const updateMut = useUpdateInbond();
  const buildMut = useBuildInbond();
  const isSaving = createMut.isPending || updateMut.isPending;

  // Seed local draft once the filing loads (edit mode).
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (filing && !hydratedRef.current) {
      const payload = filing.payload ?? {};
      setDraft({
        bills: [newBill()],
        ...payload,
        entryType: filing.entryType,
      });
      if (filing.wireText && filing.status === 'READY') {
        setWireText(filing.wireText);
        setBuiltStatus('READY');
      }
      hydratedRef.current = true;
    }
  }, [filing]);

  // Route guard: only DRAFT / READY filings are editable.
  useEffect(() => {
    if (filing && !EDITABLE_STATUSES.has(filing.status)) {
      navigate(`/inbond/${filing.id}`, { replace: true });
    }
  }, [filing, navigate]);

  /** Immutable deep update via clone-and-mutate; also invalidates build output. */
  const patch = (fn: (d: InbondPayloadDraft) => void) => {
    setDraft((prev) => {
      const next: InbondPayloadDraft = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
    // Any edit invalidates a previous build (the server resets to DRAFT on PATCH).
    setIssues(null);
    setWireText(null);
    setBuiltStatus(null);
  };

  /** Persist the current draft. Creates on first save, PATCHes afterwards. */
  const persist = async (): Promise<string> => {
    const entryType = (draft.entryType ?? '61') as InbondEntryType;
    const payload = sanitizeForSave(draft);
    if (!docId) {
      const res = await createMut.mutateAsync({ entryType, payload });
      setDocId(res.filing.id);
      navigate(`/inbond/${res.filing.id}/edit`, { replace: true });
      return res.filing.id;
    }
    await updateMut.mutateAsync({ id: docId, entryType, payload });
    return docId;
  };

  const goNext = async () => {
    try {
      await persist();
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } catch (err: any) {
      toast.error(err?.body?.error || err?.message || 'Failed to save draft');
    }
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSaveDraft = async () => {
    try {
      const id = await persist();
      toast.success('Draft saved');
      navigate(`/inbond/${id}`);
    } catch (err: any) {
      toast.error(err?.body?.error || err?.message || 'Failed to save draft');
    }
  };

  const handleValidateAndBuild = async () => {
    setIssues(null);
    try {
      const id = await persist();
      const res = await buildMut.mutateAsync(id);
      setWireText(res.wireLines.join('\n'));
      setBuiltStatus(res.filing.status);
      toast.success('Filing validated — queued as Ready for transmission');
    } catch (err: any) {
      const engineIssues: InbondIssue[] | undefined = err?.body?.issues;
      if (err?.status === 422 && Array.isArray(engineIssues)) {
        setIssues(engineIssues);
        toast.error('The filing has validation issues — see the list below');
      } else if (err?.status === 429) {
        toast.error('Please wait a moment before trying again');
      } else {
        toast.error(err?.body?.error || err?.message || 'Validation failed');
      }
    }
  };

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  // ── Loading / error states (edit mode) ──
  if (isEdit && query.isLoading && !filing) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isEdit && query.isError) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Card>
          <CardContent className="p-6 flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Could not load filing</p>
              <p className="text-sm text-muted-foreground">
                {(query.error as any)?.message ?? 'Unknown error'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/inbond" aria-label="Back to list">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">
              {isEdit ? 'Edit In-Bond' : 'New In-Bond'}
            </h1>
            {isSaving ? (
              <Badge variant="outline" className="gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </Badge>
            ) : docId ? (
              <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                <Check className="h-3 w-3" /> Saved
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length} — {STEPS[step].desc}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="text-lg font-bold text-primary">{progress}%</p>
          </div>
          <div className="w-20">
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-card border rounded-xl p-3">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.id} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => {
                    if (i <= step) setStep(i);
                  }}
                  disabled={i > step}
                  className={cn(
                    'flex items-center gap-2 transition-all rounded-lg px-2 py-1.5 text-left min-w-0',
                    isActive && 'bg-primary/10',
                    isDone && 'cursor-pointer hover:bg-muted',
                    i > step && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <span
                    className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all',
                      isDone
                        ? 'bg-primary text-primary-foreground'
                        : isActive
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium truncate hidden lg:block',
                      isActive && 'text-primary',
                    )}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 mx-1 rounded-full min-w-2',
                      isDone ? 'bg-primary' : 'bg-border',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="sm:hidden mt-2">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1 text-center">{progress}% complete</p>
        </div>
      </div>

      {/* Step content */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = STEPS[step].icon;
              return <Icon className="h-5 w-5 text-primary" />;
            })()}
            <CardTitle className="text-lg">{STEPS[step].label}</CardTitle>
          </div>
          <CardDescription>{STEPS[step].desc}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {step === 0 && <MovementStep draft={draft} patch={patch} />}
          {step === 1 && <BillsStep draft={draft} patch={patch} />}
          {step === 2 && (
            <ReviewStep
              draft={draft}
              issues={issues}
              wireText={wireText}
              builtStatus={builtStatus}
            />
          )}
        </CardContent>
      </Card>

      {/* Nav bar */}
      <div className="flex items-center justify-between pb-6">
        <Button variant="outline" onClick={goBack} disabled={step === 0} size="lg">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="lg" onClick={handleSaveDraft} disabled={isSaving}>
            Save draft
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext} size="lg" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={handleValidateAndBuild}
              disabled={isSaving || buildMut.isPending}
              className="min-w-[180px]"
            >
              {buildMut.isPending || isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" /> Validate &amp; build
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Movement ───────────────────────────────────────

function MovementStep({
  draft,
  patch,
}: {
  draft: InbondPayloadDraft;
  patch: (fn: (d: InbondPayloadDraft) => void) => void;
}) {
  const entryType = (draft.entryType ?? '61') as InbondEntryType;
  const isFtz = draft.ftzWithdrawal === true;

  return (
    <div className="space-y-6">
      {/* Entry type — rich radio cards */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Movement type<span className="text-destructive ml-0.5">*</span>
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" role="radiogroup" aria-label="Movement type">
          {INBOND_ENTRY_TYPES.map((t) => {
            const selected = entryType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => patch((d) => { d.entryType = t.value; })}
                className={cn(
                  'rounded-xl border p-4 text-left transition-all space-y-1.5',
                  selected
                    ? 'border-primary ring-2 ring-primary/25 bg-primary/5'
                    : 'hover:border-primary/40 hover:bg-muted/40',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {t.value} · {t.code}
                  </span>
                  <span
                    className={cn(
                      'h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      selected ? 'border-primary' : 'border-muted-foreground/40',
                    )}
                  >
                    {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                </div>
                <p className="text-xs font-medium">{t.label}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{t.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="In-bond number"
          helper="Optional 9-digit number from your bond range. The last digit is a check digit — it is validated when you build the filing."
        >
          <Input
            className="font-mono"
            placeholder="e.g. 123456786"
            maxLength={9}
            value={draft.inBondNumber ?? ''}
            onChange={(e) =>
              patch((d) => { d.inBondNumber = e.target.value.replace(/[^0-9]/g, ''); })
            }
          />
        </Field>

        <Field
          label="Value (USD)"
          required
          helper="Total value of the merchandise in whole dollars. $20 per kilo may be used when the value is unknown."
        >
          <NumberInput
            value={draft.valueDollars}
            onChange={(v) => patch((d) => { d.valueDollars = v; })}
            placeholder="e.g. 25000"
          />
        </Field>

        <Field
          label="In-bond carrier (SCAC)"
          required
          helper={
            isFtz
              ? 'For FTZ/warehouse withdrawals, enter the FIRMS code of the zone or warehouse instead of a SCAC.'
              : 'The 4-letter carrier code of the bonded carrier moving the goods.'
          }
        >
          <Input
            className="font-mono uppercase"
            placeholder={isFtz ? 'FIRMS code' : 'e.g. MAEU'}
            maxLength={4}
            value={draft.carrierCode ?? ''}
            onChange={(e) => patch((d) => { d.carrierCode = e.target.value.toUpperCase(); })}
          />
        </Field>

        <Field
          label="Bonded carrier ID"
          required
          helper="The bonded carrier's IRS, CBP-assigned or SSN number — the party liable for the merchandise while it moves."
        >
          <Input
            className="font-mono"
            placeholder="e.g. 12-3456789"
            value={draft.bondedCarrierId ?? ''}
            onChange={(e) => patch((d) => { d.bondedCarrierId = e.target.value; })}
          />
        </Field>

        <Field
          label="US port of destination"
          required
          helper={
            entryType === '61'
              ? 'The 4-digit Schedule D code of the port where the in-bond terminates and entry will be filed.'
              : entryType === '62'
                ? 'The 4-digit Schedule D code of the US port the cargo will be exported from.'
                : 'The 4-digit Schedule D code of the port where the cargo currently sits.'
          }
        >
          <Input
            className="font-mono"
            placeholder="e.g. 2704"
            maxLength={4}
            value={draft.usPortOfDestination ?? ''}
            onChange={(e) =>
              patch((d) => { d.usPortOfDestination = e.target.value.replace(/[^0-9]/g, ''); })
            }
          />
        </Field>

        {(entryType === '62' || entryType === '63') && (
          <Field
            label="Foreign destination"
            required
            helper="The 5-digit Schedule K code of the foreign port the cargo is ultimately bound for."
          >
            <Input
              className="font-mono"
              placeholder="e.g. 57035"
              maxLength={5}
              value={draft.portOfForeignDestination ?? ''}
              onChange={(e) =>
                patch((d) => { d.portOfForeignDestination = e.target.value.replace(/[^0-9]/g, ''); })
              }
            />
          </Field>
        )}
      </div>

      <Separator />

      {/* FTZ + BTA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border p-3.5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium">FTZ / warehouse withdrawal</Label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Turn on when the goods are leaving a Foreign Trade Zone or bonded warehouse.
              Full bill details and the facility's FIRMS code are then required.
            </p>
          </div>
          <Switch
            checked={isFtz}
            onCheckedChange={(checked) =>
              patch((d) => {
                d.ftzWithdrawal = checked || undefined;
                if (checked) {
                  d.btaIndicator = 'N';
                  // FTZ withdrawals are always QP-Long: every bill needs
                  // full details, and partial quantities don't apply.
                  for (const bill of d.bills ?? []) {
                    if (!bill.details) bill.details = newBillDetails();
                    delete bill.inBondQuantity;
                    delete bill.previousInBondNumber;
                  }
                }
              })
            }
          />
        </div>

        {entryType === '62' && !isFtz ? (
          <Field
            label="BTA / FDA prior notice given?"
            required
            helper="Bioterrorism Act indicator — 'Yes' if FDA prior notice was submitted for food articles on this movement."
          >
            <Select
              value={draft.btaIndicator ?? ''}
              onValueChange={(v) => patch((d) => { d.btaIndicator = v as 'Y' | 'N'; })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Y">Yes — prior notice submitted</SelectItem>
                <SelectItem value="N">No — not subject to BTA</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <div className="rounded-lg border border-dashed p-3.5 space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">BTA indicator</Label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {entryType === '63'
                ? "Immediate Exportation (IE) movements are exempt from BTA reporting — the indicator is set to 'N' automatically."
                : isFtz
                  ? "FTZ and bonded-warehouse withdrawals are exempt from BTA reporting — the indicator is set to 'N' automatically."
                  : "Not applicable for this movement type — set to 'N' automatically."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 2: Bills ──────────────────────────────────────────

function BillsStep({
  draft,
  patch,
}: {
  draft: InbondPayloadDraft;
  patch: (fn: (d: InbondPayloadDraft) => void) => void;
}) {
  const bills = draft.bills ?? [];
  const isFtz = draft.ftzWithdrawal === true;
  const longForm = isLongForm(draft);
  const entryType = (draft.entryType ?? '61') as InbondEntryType;
  const isAir = draft.conveyance?.importMotCode === '40';

  return (
    <div className="space-y-5">
      {isFtz && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            FTZ / warehouse withdrawals require full bill details for every bill — the
            "already on file" short form is not available for this movement.
          </AlertDescription>
        </Alert>
      )}

      {/* Conveyance — shown once, whenever any bill carries full details */}
      {longForm && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Importing conveyance</CardTitle>
            <CardDescription className="text-xs">
              How the cargo arrived. Required because at least one bill provides full
              details{isFtz ? ' (FTZ withdrawal)' : ''}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Importing carrier"
              required
              helper={
                isFtz
                  ? 'For FTZ withdrawals: the FIRMS code of the zone/warehouse (must match the in-bond carrier field).'
                  : 'The 4-letter carrier code (SCAC) — or ICAO/IATA code for air — of the carrier that brought the goods in.'
              }
            >
              <Input
                className="font-mono uppercase"
                placeholder={isFtz ? 'FIRMS code' : 'e.g. MAEU'}
                value={draft.conveyance?.importingCarrierCode ?? ''}
                onChange={(e) =>
                  patch((d) => {
                    d.conveyance = { ...d.conveyance, importingCarrierCode: e.target.value.toUpperCase() };
                  })
                }
              />
            </Field>

            <Field
              label="Mode of transport"
              required
              helper={isFtz ? 'FTZ / warehouse withdrawals must use 30 — Truck.' : 'How the goods physically arrived in the US.'}
            >
              <Select
                value={draft.conveyance?.importMotCode ?? ''}
                onValueChange={(v) =>
                  patch((d) => { d.conveyance = { ...d.conveyance, importMotCode: v }; })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {INBOND_MOT_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Port of arrival"
              required
              helper="The 4-digit Schedule D code of the US port where the cargo was unladen."
            >
              <Input
                className="font-mono"
                placeholder="e.g. 2704"
                maxLength={4}
                value={draft.conveyance?.portOfArrival ?? ''}
                onChange={(e) =>
                  patch((d) => {
                    d.conveyance = { ...d.conveyance, portOfArrival: e.target.value.replace(/[^0-9]/g, '') };
                  })
                }
              />
            </Field>

            <Field
              label="Estimated arrival date"
              helper={isFtz ? 'Not required for FTZ withdrawals.' : 'When the conveyance arrived (or is expected to arrive).'}
            >
              <Input
                type="date"
                value={mmddyyToIso(draft.conveyance?.estimatedDateOfArrival)}
                onChange={(e) =>
                  patch((d) => {
                    d.conveyance = {
                      ...d.conveyance,
                      estimatedDateOfArrival: isoToMmddyy(e.target.value),
                    };
                  })
                }
              />
            </Field>

            {isFtz && (
              <Field
                label="FTZ / warehouse FIRMS code"
                required
                helper="The CBP facility code (FIRMS) of the zone or bonded warehouse the goods are being withdrawn from. Must match both carrier fields."
              >
                <Input
                  className="font-mono uppercase"
                  placeholder="e.g. E123"
                  value={draft.conveyance?.ftzFirmsCode ?? ''}
                  onChange={(e) =>
                    patch((d) => {
                      d.conveyance = { ...d.conveyance, ftzFirmsCode: e.target.value.toUpperCase() };
                    })
                  }
                />
              </Field>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bills */}
      {bills.map((bill, i) => (
        <BillCard
          key={i}
          index={i}
          bill={bill}
          entryType={entryType}
          isFtz={isFtz}
          isAir={isAir}
          canRemove={bills.length > 1}
          patch={patch}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        className="gap-1.5"
        onClick={() =>
          patch((d) => {
            d.bills = [...(d.bills ?? []), isFtz ? { ...newBill(), details: newBillDetails() } : newBill()];
          })
        }
      >
        <Plus className="h-4 w-4" />
        Add bill
      </Button>
    </div>
  );
}

function BillCard({
  index,
  bill,
  entryType,
  isFtz,
  isAir,
  canRemove,
  patch,
}: {
  index: number;
  bill: InbondBillDraft;
  entryType: InbondEntryType;
  isFtz: boolean;
  isAir: boolean;
  canRemove: boolean;
  patch: (fn: (d: InbondPayloadDraft) => void) => void;
}) {
  // Short form = the bill already exists in ACE; long form = we provide it.
  const onFile = bill.details === undefined && !isFtz;

  const patchBill = (fn: (b: InbondBillDraft) => void) =>
    patch((d) => {
      const target = d.bills?.[index];
      if (target) fn(target);
    });

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">Bill of lading {index + 1}</CardTitle>
          <CardDescription className="text-xs">
            {onFile ? 'Referencing a bill already on file with CBP' : 'Providing full bill details'}
          </CardDescription>
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            aria-label={`Remove bill ${index + 1}`}
            onClick={() => patch((d) => { d.bills = (d.bills ?? []).filter((_, j) => j !== index); })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Bill issuer code"
            required
            helper="The 4-letter carrier code (SCAC) that issued the bill — or the 3-character airline prefix for air waybills."
          >
            <Input
              className="font-mono uppercase"
              placeholder="e.g. MAEU"
              value={bill.issuerCode ?? ''}
              onChange={(e) => patchBill((b) => { b.issuerCode = e.target.value.toUpperCase(); })}
            />
          </Field>

          <Field
            label="Bill number"
            required
            helper="The bill of lading number — for air, the 8-digit air waybill serial."
          >
            <Input
              className="font-mono"
              placeholder="e.g. 123456789"
              value={bill.billNumber ?? ''}
              onChange={(e) => patchBill((b) => { b.billNumber = e.target.value; })}
            />
          </Field>

          <Field
            label="House bill number"
            helper="Air shipments only — required when the bill above is a master air waybill."
          >
            <Input
              className="font-mono"
              placeholder="Air only"
              value={bill.houseBillNumber ?? ''}
              onChange={(e) => patchBill((b) => { b.houseBillNumber = e.target.value; })}
            />
          </Field>

          <Field
            label="Previous in-bond number"
            helper={
              isFtz
                ? 'Must be blank for FTZ / warehouse withdrawals.'
                : 'For subsequent moves: the in-bond number the cargo is currently traveling under.'
            }
          >
            <Input
              className="font-mono"
              placeholder="Optional"
              maxLength={9}
              disabled={isFtz}
              value={bill.previousInBondNumber ?? ''}
              onChange={(e) =>
                patchBill((b) => { b.previousInBondNumber = e.target.value.replace(/[^0-9]/g, ''); })
              }
            />
          </Field>

          {onFile && (
            <Field
              label="Partial quantity"
              helper={
                isAir
                  ? 'Not permitted for air — the full bill quantity always moves.'
                  : 'Only when moving less than the full bill quantity of the bill on file. Leave blank to move everything.'
              }
            >
              <NumberInput
                value={bill.inBondQuantity}
                onChange={(v) => patchBill((b) => { b.inBondQuantity = v; })}
                placeholder="Leave blank for full quantity"
              />
            </Field>
          )}
        </div>

        {/* Short vs long form */}
        {!isFtz && (
          <div className="rounded-lg border p-3.5 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Bill already on file with CBP</Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Keep this on when the carrier has already transmitted the bill to ACE —
                CBP matches your in-bond to it. Turn it off to provide the full bill
                details (shipper, consignee, containers and cargo) yourself.
              </p>
            </div>
            <Switch
              checked={onFile}
              onCheckedChange={(checked) =>
                patchBill((b) => {
                  if (checked) delete b.details;
                  else {
                    b.details = newBillDetails();
                    delete b.inBondQuantity;
                  }
                })
              }
            />
          </div>
        )}

        {bill.details && (
          <BillDetailsSection index={index} bill={bill} entryType={entryType} isFtz={isFtz} patch={patch} />
        )}
      </CardContent>
    </Card>
  );
}

function BillDetailsSection({
  index,
  bill,
  entryType,
  isFtz,
  patch,
}: {
  index: number;
  bill: InbondBillDraft;
  entryType: InbondEntryType;
  isFtz: boolean;
  patch: (fn: (d: InbondPayloadDraft) => void) => void;
}) {
  const details = bill.details!;
  const containers = details.containers ?? [];
  const htsMandatory = entryType === '62' || entryType === '63';

  const patchDetails = (fn: (dd: NonNullable<InbondBillDraft['details']>) => void) =>
    patch((d) => {
      const target = d.bills?.[index]?.details;
      if (target) fn(target);
    });

  return (
    <div className="space-y-4 rounded-lg border border-dashed p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Full bill details
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Foreign port of lading"
          required
          helper={
            isFtz
              ? "Use '99999' for FTZ / warehouse withdrawals."
              : 'The 5-digit Schedule K code of the foreign port where the cargo was loaded.'
          }
        >
          <Input
            className="font-mono"
            placeholder={isFtz ? '99999' : 'e.g. 57035'}
            maxLength={5}
            value={details.foreignPortOfLading ?? ''}
            onChange={(e) =>
              patchDetails((dd) => { dd.foreignPortOfLading = e.target.value.replace(/[^0-9]/g, ''); })
            }
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Manifest quantity"
            required
            helper="Total pieces on the bill — must equal the sum of all container piece counts below."
          >
            <NumberInput
              value={details.manifestQuantity}
              onChange={(v) => patchDetails((dd) => { dd.manifestQuantity = v; })}
              placeholder="e.g. 500"
            />
          </Field>
          <Field label="Unit" required helper="Packaging unit code, e.g. CTN for cartons, PCS for pieces.">
            <Input
              className="font-mono uppercase"
              placeholder="e.g. CTN"
              value={details.manifestUnits ?? ''}
              onChange={(e) => patchDetails((dd) => { dd.manifestUnits = e.target.value.toUpperCase(); })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gross weight" required helper="Whole number, no decimals.">
            <NumberInput
              value={details.weight}
              onChange={(v) => patchDetails((dd) => { dd.weight = v; })}
              placeholder="e.g. 12000"
            />
          </Field>
          <Field label="Weight unit" required>
            <Select
              value={details.weightUnit ?? ''}
              onValueChange={(v) => patchDetails((dd) => { dd.weightUnit = v as InbondWeightUnit; })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {INBOND_WEIGHT_UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['foreignShipper', 'consignee'] as const).map((partyKey) => {
          const party = details[partyKey] ?? {};
          const label = partyKey === 'foreignShipper' ? 'Foreign shipper' : 'Consignee';
          return (
            <div key={partyKey} className="space-y-3 rounded-lg border p-3.5">
              <p className="text-xs font-semibold">{label}</p>
              <Field label="Name" required>
                <Input
                  value={party.name ?? ''}
                  placeholder="Company name"
                  onChange={(e) =>
                    patchDetails((dd) => { dd[partyKey] = { ...dd[partyKey], name: e.target.value }; })
                  }
                />
              </Field>
              <Field label="Address line 1" required>
                <Input
                  value={party.addressLine1 ?? ''}
                  placeholder="Street address"
                  onChange={(e) =>
                    patchDetails((dd) => { dd[partyKey] = { ...dd[partyKey], addressLine1: e.target.value }; })
                  }
                />
              </Field>
              <Field label="Address line 2" helper="City, region, postal code, country.">
                <Input
                  value={party.addressLine2 ?? ''}
                  placeholder="Optional"
                  onChange={(e) =>
                    patchDetails((dd) => { dd[partyKey] = { ...dd[partyKey], addressLine2: e.target.value }; })
                  }
                />
              </Field>
            </div>
          );
        })}
      </div>

      {/* Containers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Containers &amp; cargo</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() =>
              patchDetails((dd) => { dd.containers = [...(dd.containers ?? []), newContainer()]; })
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add container
          </Button>
        </div>

        {containers.map((container, c) => (
          <ContainerCard
            key={c}
            billIndex={index}
            containerIndex={c}
            container={container}
            htsMandatory={htsMandatory}
            canRemove={containers.length > 1}
            patch={patch}
          />
        ))}
      </div>
    </div>
  );
}

function ContainerCard({
  billIndex,
  containerIndex,
  container,
  htsMandatory,
  canRemove,
  patch,
}: {
  billIndex: number;
  containerIndex: number;
  container: InbondContainerDraft;
  htsMandatory: boolean;
  canRemove: boolean;
  patch: (fn: (d: InbondPayloadDraft) => void) => void;
}) {
  const group = container.cargo?.[0] ?? {};
  const commodities = group.commodities ?? [];
  const description = group.descriptions?.[0] ?? {};

  const patchContainer = (fn: (c: InbondContainerDraft) => void) =>
    patch((d) => {
      const target = d.bills?.[billIndex]?.details?.containers?.[containerIndex];
      if (target) fn(target);
    });

  const patchGroup = (fn: (g: NonNullable<InbondContainerDraft['cargo']>[number]) => void) =>
    patchContainer((c) => {
      if (!c.cargo?.length) c.cargo = [{ commodities: [], descriptions: [{}] }];
      fn(c.cargo[0]);
    });

  return (
    <div className="rounded-lg border p-3.5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          <Field
            label="Container number"
            required
            helper="Exactly as it appears on the container — or 'NC' for non-containerized freight."
          >
            <Input
              className="font-mono uppercase"
              placeholder="e.g. MSKU1234567"
              value={container.containerNumber ?? ''}
              onChange={(e) =>
                patchContainer((c) => { c.containerNumber = e.target.value.toUpperCase(); })
              }
            />
          </Field>
          <Field label="Seal 1" helper="Seal number, if sealed.">
            <Input
              className="font-mono"
              placeholder="Optional"
              value={container.sealNumber1 ?? ''}
              onChange={(e) => patchContainer((c) => { c.sealNumber1 = e.target.value; })}
            />
          </Field>
          <Field label="Seal 2">
            <Input
              className="font-mono"
              placeholder="Optional"
              value={container.sealNumber2 ?? ''}
              onChange={(e) => patchContainer((c) => { c.sealNumber2 = e.target.value; })}
            />
          </Field>
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
            aria-label="Remove container"
            onClick={() =>
              patch((d) => {
                const dd = d.bills?.[billIndex]?.details;
                if (dd) dd.containers = (dd.containers ?? []).filter((_, j) => j !== containerIndex);
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Cargo description */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
        <Field label="Cargo description" required helper="Plain-language description of the goods in this container.">
          <Input
            placeholder="e.g. Cotton T-shirts"
            value={description.description ?? ''}
            onChange={(e) =>
              patchGroup((g) => {
                if (!g.descriptions?.length) g.descriptions = [{}];
                g.descriptions[0].description = e.target.value;
              })
            }
          />
        </Field>
        <Field label="Piece count" required helper="Pieces in this container.">
          <NumberInput
            value={description.pieceCount}
            onChange={(v) =>
              patchGroup((g) => {
                if (!g.descriptions?.length) g.descriptions = [{}];
                g.descriptions[0].pieceCount = v;
              })
            }
            placeholder="e.g. 500"
          />
        </Field>
      </div>

      {/* Commodities */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Commodities (HTS)
            {htsMandatory && <span className="text-destructive ml-0.5">*</span>}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-xs"
            onClick={() =>
              patchGroup((g) => {
                g.commodities = [...(g.commodities ?? []), { htsNumber: '', weightUnit: 'KG' }];
              })
            }
          >
            <Plus className="h-3 w-3" />
            Add commodity
          </Button>
        </div>
        {htsMandatory && commodities.length === 0 && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            At least one HTS commodity line is required for T&amp;E and IE movements.
          </p>
        )}
        {commodities.map((commodity, k) => (
          <div key={k} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_130px_36px] gap-2 items-end">
            <Field label="HTS number" helper={k === 0 ? '6 to 10 digits.' : undefined}>
              <Input
                className="font-mono"
                placeholder="e.g. 610910"
                maxLength={10}
                value={commodity.htsNumber ?? ''}
                onChange={(e) =>
                  patchGroup((g) => {
                    if (g.commodities?.[k]) g.commodities[k].htsNumber = e.target.value.replace(/[^0-9]/g, '');
                  })
                }
              />
            </Field>
            <Field label="Value (USD)" helper={k === 0 ? 'Whole dollars.' : undefined}>
              <NumberInput
                value={commodity.valueDollars}
                onChange={(v) =>
                  patchGroup((g) => {
                    if (g.commodities?.[k]) g.commodities[k].valueDollars = v;
                  })
                }
                placeholder="e.g. 8000"
              />
            </Field>
            <Field label="Net weight" helper={k === 0 ? 'Whole number.' : undefined}>
              <NumberInput
                value={commodity.weight}
                onChange={(v) =>
                  patchGroup((g) => {
                    if (g.commodities?.[k]) g.commodities[k].weight = v;
                  })
                }
                placeholder="e.g. 900"
              />
            </Field>
            <Field label="Unit">
              <Select
                value={commodity.weightUnit ?? ''}
                onValueChange={(v) =>
                  patchGroup((g) => {
                    if (g.commodities?.[k]) g.commodities[k].weightUnit = v as InbondWeightUnit;
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unit" />
                </SelectTrigger>
                <SelectContent>
                  {INBOND_WEIGHT_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive hover:text-destructive"
              aria-label="Remove commodity"
              onClick={() =>
                patchGroup((g) => {
                  g.commodities = (g.commodities ?? []).filter((_, j) => j !== k);
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: Review ─────────────────────────────────────────

function SummaryRow({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-sm', mono && 'font-mono')}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

function ReviewStep({
  draft,
  issues,
  wireText,
  builtStatus,
}: {
  draft: InbondPayloadDraft;
  issues: InbondIssue[] | null;
  wireText: string | null;
  builtStatus: InbondFiling['status'] | null;
}) {
  const entryType = (draft.entryType ?? '61') as InbondEntryType;
  const typeMeta = INBOND_ENTRY_TYPES.find((t) => t.value === entryType);
  const bills = draft.bills ?? [];

  return (
    <div className="space-y-5">
      {/* Movement summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <SummaryRow
          label="Movement"
          value={typeMeta ? `${typeMeta.value} · ${typeMeta.code} — ${typeMeta.label}` : entryType}
        />
        <SummaryRow label="In-bond number" value={draft.inBondNumber || undefined} mono />
        <SummaryRow label="Carrier (SCAC)" value={draft.carrierCode || undefined} mono />
        <SummaryRow label="Bonded carrier ID" value={draft.bondedCarrierId || undefined} mono />
        <SummaryRow label="US destination port" value={draft.usPortOfDestination || undefined} mono />
        {entryType !== '61' && (
          <SummaryRow label="Foreign destination" value={draft.portOfForeignDestination || undefined} mono />
        )}
        <SummaryRow
          label="Value"
          value={draft.valueDollars != null ? `$${draft.valueDollars.toLocaleString()}` : undefined}
        />
        <SummaryRow label="FTZ withdrawal" value={draft.ftzWithdrawal ? 'Yes' : 'No'} />
        <SummaryRow label="BTA indicator" value={draft.btaIndicator} />
      </div>

      <Separator />

      {/* Bills summary */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bills ({bills.length})
        </p>
        {bills.map((bill, i) => {
          const containerCount = bill.details?.containers?.length ?? 0;
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs truncate">
                {(bill.issuerCode || '????')}{bill.billNumber || '—'}
                {bill.houseBillNumber ? ` / ${bill.houseBillNumber}` : ''}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {bill.details
                  ? `Full details · ${containerCount} container${containerCount === 1 ? '' : 's'}`
                  : 'On file with CBP'}
              </span>
            </div>
          );
        })}
        {bills.length === 0 && (
          <p className="text-sm text-muted-foreground">No bills added — go back to the Bills step.</p>
        )}
      </div>

      {/* Engine issues — anchored above the action buttons */}
      {issues && issues.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {issues.length} issue{issues.length === 1 ? '' : 's'} to fix before this filing can transmit
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1.5">
              {issues.map((issue, i) => (
                <li key={i} className="text-xs flex gap-2">
                  <code className="font-mono shrink-0 bg-destructive/10 px-1 py-0.5 rounded">
                    {issue.field}
                  </code>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Wire preview on successful build */}
      {wireText && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              CBP wire preview
            </p>
            {builtStatus && <InbondStatusPill status={builtStatus} />}
          </div>
          <WirePreview text={wireText} />
          <p className="text-[11px] text-muted-foreground">
            This filing is validated and queued. It will transmit automatically once the
            direct ABI connection to CBP is live.
          </p>
        </div>
      )}

      {!wireText && (!issues || issues.length === 0) && (
        <p className="text-xs text-muted-foreground">
          "Validate &amp; build" runs the filing through the CATAIR engine — you'll either
          get a list of issues to fix or the exact wire that will be sent to CBP.
        </p>
      )}
    </div>
  );
}
