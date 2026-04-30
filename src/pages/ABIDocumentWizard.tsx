/**
 * ABI Document Wizard — create / edit CBP Entry Summary 7501 drafts.
 *
 * Routes:
 *   /abi-documents/new                       — new draft
 *   /abi-documents/new?fromManifest=<id>     — new draft, server prefills
 *                                              shipment fields from a
 *                                              completed manifest query
 *   /abi-documents/:id/edit                  — edit existing DRAFT
 *
 * State flow:
 *   - Load or lazy-create the AbiDocument on mount.
 *   - Wizard state is a DeepPartial `ABIDocumentDraft` kept in local state
 *     and flushed to the server via `useAbiDocumentAutosave` (debounced 800ms).
 *   - Deep merges are done inline so each Step component only sends the
 *     top-level slice it owns.
 *   - On terminal step: Save Draft flushes + navigates; Transmit calls
 *     `useSendAbiDocument` after a confirm dialog.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  FileCheck,
  Loader2,
  MapPin,
  Package,
  Receipt,
  Send,
  Ship,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import type {
  ABIDocumentDraft,
  AbiDocument,
} from '@/api/client';
import {
  useAbiDocument,
  useAbiDocumentAutosave,
  useCreateAbiDocument,
  useSendAbiDocument,
} from '@/hooks/useAbiDocument';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

import Step1EntryShipment from '@/components/abi-wizard/Step1EntryShipment';
import Step2ImporterBond from '@/components/abi-wizard/Step2ImporterBond';
import Step3Consignee from '@/components/abi-wizard/Step3Consignee';
import Step4Manifest from '@/components/abi-wizard/Step4Manifest';
import Step5Invoices from '@/components/abi-wizard/Step5Invoices';
import Step6Review, { validateAbiDraft } from '@/components/abi-wizard/Step6Review';
import { STEP_VALIDATORS } from '@/components/abi-wizard/validators';

// ─── Step definitions ────────────────────────────────────────

const STEPS = [
  { id: 'entry',     label: 'Entry',     desc: 'Entry type & shipment info',        icon: Ship },
  { id: 'importer',  label: 'Importer',  desc: 'Importer of record, bond & payment', icon: Building2 },
  { id: 'consignee', label: 'Consignee', desc: 'Entry consignee details',            icon: MapPin },
  { id: 'manifest',  label: 'Manifest',  desc: 'Bill of lading, carrier & ports',    icon: Package },
  { id: 'invoices',  label: 'Invoices',  desc: 'Invoices, items & parties',          icon: Receipt },
  { id: 'review',    label: 'Review',    desc: 'Review & transmit',                  icon: FileCheck },
] as const;

type StepComponent = (p: {
  value: ABIDocumentDraft;
  onChange: (patch: ABIDocumentDraft) => void;
  doc?: AbiDocument;
  errors?: Record<string, string>;
}) => JSX.Element;

const STEP_COMPONENTS: StepComponent[] = [
  Step1EntryShipment,
  Step2ImporterBond,
  Step3Consignee,
  Step4Manifest,
  Step5Invoices,
  Step6Review,
];

// ─── Deep-merge helper for wizard patches ────────────────────
// Top-level keys are shallow-merged; nested objects are recursively merged;
// arrays are REPLACED as the step sends them (steps manage their own array
// state). This matches how the server PATCH route merges.
function mergeDraft(base: ABIDocumentDraft, patch: ABIDocumentDraft): ABIDocumentDraft {
  const out: any = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (Array.isArray(v)) {
      out[k] = v;
    } else if (v && typeof v === 'object' && !Array.isArray((base as any)[k]) && typeof (base as any)[k] === 'object') {
      out[k] = { ...(base as any)[k], ...v };
    } else {
      out[k] = v;
    }
  }
  return out as ABIDocumentDraft;
}

// ─── Main component ─────────────────────────────────────────

export default function ABIDocumentWizard() {
  const { id: paramId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const fromManifest = searchParams.get('fromManifest') ?? undefined;
  const fromShipment = searchParams.get('fromShipment') ?? undefined;
  const navigate = useNavigate();

  // The document id we are editing. Undefined until created (new flow).
  const [docId, setDocId] = useState<string | undefined>(paramId);
  const isEdit = Boolean(paramId);

  const [step, setStep] = useState(0);

  // Local wizard state — merged into the server payload via autosave.
  const [draft, setDraft] = useState<ABIDocumentDraft>({ entryType: '01' });

  // ── Server state
  const query = useAbiDocument(docId);
  const doc = query.data?.data;
  const createMut = useCreateAbiDocument();
  const sendMut = useSendAbiDocument();
  const autosave = useAbiDocumentAutosave(docId);

  // ── Seed local draft once the document loads
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (doc && !hydratedRef.current) {
      setDraft(doc.payload ?? { entryType: '01' });
      hydratedRef.current = true;
    }
  }, [doc]);

  // ── Route guard: never edit a non-DRAFT document via the wizard
  useEffect(() => {
    if (doc && doc.status !== 'DRAFT') {
      navigate(`/abi-documents/${doc.id}`, { replace: true });
    }
  }, [doc, navigate]);

  // ── Stable onChange that merges + autosaves.
  // New-flow: if we don't have an id yet, lazy-create on first change.
  const creatingRef = useRef(false);
  const onChange = useCallback(
    (patch: ABIDocumentDraft) => {
      setDraft((prev) => {
        const next = mergeDraft(prev, patch);

        if (docId) {
          autosave.save(patch);
        } else if (!creatingRef.current) {
          creatingRef.current = true;
          createMut
            .mutateAsync({
              payload: next,
              ...(fromManifest ? { manifestQueryId: fromManifest } : {}),
              ...(fromShipment ? { filingId: fromShipment } : {}),
            })
            .then((res) => {
              const newId = res.data.id;
              setDocId(newId);
              // Seed draft from the server record so any prefill from
              // manifestQueryId becomes visible.
              if (res.data.payload) setDraft(res.data.payload);
              navigate(`/abi-documents/${newId}/edit`, { replace: true });
            })
            .catch((err: any) => {
              creatingRef.current = false;
              toast.error(err?.message ?? 'Failed to create draft');
            });
        }

        return next;
      });
    },
    [docId, autosave, createMut, fromManifest, fromShipment, navigate],
  );

  // ── Transmit
  const validation = useMemo(() => validateAbiDraft(draft), [draft]);

  // Per-step error map. Recomputes on every draft change so the user
  // sees inline issues in real time as they type.
  const stepErrors = useMemo(
    () => STEP_VALIDATORS[step]?.(draft) ?? {},
    [draft, step],
  );
  const stepErrorCount = Object.keys(stepErrors).length;
  const canAdvance = stepErrorCount === 0;
  const [transmitOpen, setTransmitOpen] = useState(false);

  const handleTransmit = async () => {
    if (!docId) return;
    // Flush pending autosave first so the server has the latest payload.
    autosave.flush();
    try {
      await sendMut.mutateAsync(docId);
      toast.success('Filing transmitted to CBP. Tracking status…');
      navigate(`/abi-documents/${docId}`);
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to transmit filing';
      toast.error(msg);
    } finally {
      setTransmitOpen(false);
    }
  };

  const handleSaveDraft = () => {
    autosave.flush();
    if (docId) navigate(`/abi-documents/${docId}`);
    else navigate('/abi-documents');
  };

  // ── Stepper interactions
  const StepComponent = STEP_COMPONENTS[step];
  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  // ── Loading skeleton (edit-mode only while the existing draft loads)
  if (isEdit && query.isLoading && !doc) {
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
              <p className="font-semibold">Could not load draft</p>
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
          <Link to="/abi-documents" aria-label="Back to list">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">
              {isEdit ? 'Edit Entry Summary' : 'New Entry Summary'}
            </h1>
            {autosave.isSaving ? (
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

      {/* Manifest-query prefill banner */}
      {doc?.manifestQueryId && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 text-xs text-blue-700 dark:text-blue-300 px-3 py-2 flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />
          <span>
            Shipment data was pre-populated from a Manifest Query. Double-check MBOL,
            HBOL, carrier code and port of unlading in step 4.
          </span>
        </div>
      )}

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
          <p className="text-xs text-muted-foreground mt-1 text-center">
            {progress}% complete
          </p>
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
          <StepComponent value={draft} onChange={onChange} doc={doc} errors={stepErrors} />
        </CardContent>
      </Card>

      {/* Nav bar */}
      <div className="flex items-center justify-between pb-6">
        <Button variant="outline" onClick={goBack} disabled={step === 0} size="lg">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <div className="flex items-center gap-2">
          {step < STEPS.length - 1 ? (
            <>
              {!canAdvance && (
                <span className="text-xs text-amber-600 dark:text-amber-400 hidden sm:inline">
                  Fix {stepErrorCount} {stepErrorCount === 1 ? 'issue' : 'issues'} above to continue
                </span>
              )}
              <Button variant="outline" size="lg" onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <Button onClick={goNext} size="lg" disabled={!canAdvance}>
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="lg" onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <AlertDialog open={transmitOpen} onOpenChange={setTransmitOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="lg"
                    disabled={!validation.valid || !docId || sendMut.isPending}
                    className="min-w-[200px]"
                  >
                    {sendMut.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Transmitting…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" /> Transmit to CBP
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Transmit Entry Summary to CBP?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This filing will be submitted to U.S. Customs and Border Protection
                      via CustomsCity. Once transmitted, the document cannot be deleted —
                      only amended via a replacement filing. Confirm the summary before
                      continuing.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleTransmit}>
                      Transmit now
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
