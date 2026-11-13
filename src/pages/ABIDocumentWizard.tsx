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
import { StepProgress } from '@/components/wizard/StepProgress';

import { abiDocumentsApi } from '@/api/client';
import type {
  ABIDocumentDraft,
  AbiDocument,
} from '@/api/client';
import {
  useAbiDocument,
  useAbiDocumentAutosave,
  useCreateAbiDocument,
  useDutyEstimate,
  useSendAbiDocument,
} from '@/hooks/useAbiDocument';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { isEntryEditable, isNativeResendable, isOnFileAtCbp } from '@/lib/entryLifecycle';

// ─── Step definitions ────────────────────────────────────────

const STEPS = [
  { id: 'entry',     label: 'Entry',     desc: 'Entry type and shipment',        icon: Ship },
  { id: 'importer',  label: 'Importer',  desc: 'Importer of record, bond and payment', icon: Building2 },
  { id: 'consignee', label: 'Consignee', desc: 'Who the goods are for',            icon: MapPin },
  { id: 'manifest',  label: 'Manifest',  desc: 'Bills of lading, carrier and ports',    icon: Package },
  { id: 'invoices',  label: 'Invoices',  desc: 'Invoices, line items and parties',          icon: Receipt },
  { id: 'review',    label: 'Review',    desc: 'Check everything, then send to CBP',                  icon: FileCheck },
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
  // Shares the Review card's query cache — no extra fetch; only enabled on
  // the terminal step so earlier steps never trigger pricing.
  const dutyEstimate = useDutyEstimate(docId, step === STEPS.length - 1);
  const estimatedTotalCents =
    dutyEstimate.data?.estimable === true ? dutyEstimate.data.totals.totalCents : null;
  const autosave = useAbiDocumentAutosave(docId);

  // ── Seed local draft once the document loads
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (doc && !hydratedRef.current) {
      setDraft(doc.payload ?? { entryType: '01' });
      hydratedRef.current = true;
    }
  }, [doc]);

  // ── Route guard: only drafts, native entries CBP rejected, and native
  // entries CBP holds (for a replacement) are editable here.
  useEffect(() => {
    if (doc && !isEntryEditable(doc)) {
      navigate(`/abi-documents/${doc.id}`, { replace: true });
    }
  }, [doc, navigate]);
  const replacing = !!doc && isOnFileAtCbp(doc);
  const resending = !!doc && isNativeResendable(doc);
  const [replacePending, setReplacePending] = useState(false);

  // ── Stable onChange that merges + autosaves.
  // New-flow: if we don't have an id yet, lazy-create on first change.
  const creatingRef = useRef(false);
  // Edits made while the draft is being created. The new id swaps the route
  // (/new -> /:id/edit), which remounts the wizard from the server copy, so
  // these must reach the server first or they are lost (ENT-01: a drawn
  // entry number vanished, burning a number from the block).
  const pendingCreateRef = useRef<ABIDocumentDraft>({});
  // The current id, read at call time: a slow callback (the entry-number
  // draw) may hold an onChange from before the draft existed.
  const docIdRef = useRef(docId);
  useEffect(() => { docIdRef.current = docId; }, [docId]);
  const onChange = useCallback(
    (patch: ABIDocumentDraft) => {
      setDraft((prev) => {
        const next = mergeDraft(prev, patch);

        if (docIdRef.current) {
          autosave.save(patch);
        } else if (creatingRef.current) {
          pendingCreateRef.current = mergeDraft(pendingCreateRef.current, patch);
        } else {
          creatingRef.current = true;
          createMut
            .mutateAsync({
              payload: next,
              ...(fromManifest ? { manifestQueryId: fromManifest } : {}),
              ...(fromShipment ? { filingId: fromShipment } : {}),
            })
            .then(async (res) => {
              const newId = res.data.id;
              // Save what changed meanwhile (looping: more may arrive while saving).
              while (Object.keys(pendingCreateRef.current).length > 0) {
                const pending = pendingCreateRef.current;
                pendingCreateRef.current = {};
                try {
                  await abiDocumentsApi.update(newId, { payload: pending });
                } catch {
                  toast.error('Some of your latest changes were not saved. Check this step before continuing.');
                  break;
                }
              }
              // This wizard created the draft, so what is on screen is newer
              // than any later fetch: skip hydration, and lay the server's
              // prefill (manifestQueryId / filingId) under local edits.
              hydratedRef.current = true;
              docIdRef.current = newId;
              creatingRef.current = false;
              setDocId(newId);
              if (res.data.payload) setDraft((prev) => mergeDraft(res.data.payload as ABIDocumentDraft, prev));
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

  // Per-step error map. We compute it on every draft change so the
  // Next button can gate on it, but we only *show* the errors to the
  // user after they've tried to advance past this step — opening a
  // brand-new step shouldn't shout "Required" at every empty field.
  const stepErrors = useMemo(
    () => STEP_VALIDATORS[step]?.(draft) ?? {},
    [draft, step],
  );
  const stepErrorCount = Object.keys(stepErrors).length;
  const canAdvance = stepErrorCount === 0;
  // Per-step "have they tried Next yet?" gate. Index = step number.
  // Reset when the underlying filing changes (docId).
  const [errorsShownForStep, setErrorsShownForStep] = useState<Record<number, boolean>>({});
  useEffect(() => { setErrorsShownForStep({}); }, [docId]);
  const showErrorsForCurrentStep = errorsShownForStep[step] === true;
  const visibleStepErrors = showErrorsForCurrentStep ? stepErrors : {};
  const [transmitOpen, setTransmitOpen] = useState(false);

  const handleTransmit = async () => {
    if (!docId) return;
    // CBP builds from the saved entry: every edit must be on the server
    // before the send starts (audit FPR-01).
    try {
      await autosave.flush();
    } catch {
      toast.error('Your latest changes are not saved yet, so nothing was sent. Check your connection and try again.');
      setTransmitOpen(false);
      return;
    }
    try {
      if (replacing) {
        setReplacePending(true);
        await abiDocumentsApi.cbpAction(docId, 'REPLACE');
        toast.success('Replacement sent to CBP.');
      } else {
        await sendMut.mutateAsync(docId);
        toast.success('Filing transmitted to CBP. Tracking status…');
      }
      navigate(`/abi-documents/${docId}`);
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to transmit filing';
      toast.error(msg);
    } finally {
      setReplacePending(false);
      setTransmitOpen(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await autosave.flush();
    } catch {
      toast.error('Your latest changes could not be saved. Check your connection and try again.');
      return;
    }
    if (docId) navigate(`/abi-documents/${docId}`);
    else navigate('/abi-documents');
  };

  // ── Stepper interactions
  const StepComponent = STEP_COMPONENTS[step];
  // Click handler for Next: if the step is valid, advance. If not, reveal
  // the inline errors for the current step (and stay put) so the user
  // sees what's missing — the older "disabled until valid" pattern just
  // left them staring at a greyed-out button with no guidance.
  const goNext = async () => {
    if (canAdvance) {
      const next = Math.min(step + 1, STEPS.length - 1);
      // Entering Review: save first so the estimate and preflight (which
      // read the SAVED entry) reflect what the user just typed.
      if (next === STEPS.length - 1) {
        try {
          await autosave.flush();
        } catch {
          toast.error('Your latest changes could not be saved. The review may not reflect them until they are.');
        }
      }
      setStep(next);
    } else {
      setErrorsShownForStep((prev) => ({ ...prev, [step]: true }));
    }
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 pb-10">
      <header>
        <Link to="/abi-documents" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />Entry documents
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">{isEdit ? 'Edit entry summary' : 'New entry summary'}</h1>
          {autosave.isSaving ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" /> Saving…
            </span>
          ) : autosave.error ? (
            <button type="button" onClick={() => autosave.flush().catch(() => undefined)} className="inline-flex items-center gap-1.5 rounded-md bg-urgent-tint px-2 py-0.5 text-[12.5px] font-medium text-urgent">
              <AlertCircle className="h-3 w-3" aria-hidden />Not saved, retry
            </button>
          ) : docId ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-done">
              <Check className="h-3 w-3" aria-hidden />Saved
            </span>
          ) : null}
        </div>
      </header>

      {doc?.manifestQueryId && (
        <p className="flex items-start gap-2 rounded-xl bg-info-tint px-4 py-3 text-[13px]">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
          Shipment data was filled in from a manifest query. Check the master bill, house bill, carrier code and port of unlading in step 4.
        </p>
      )}

      <section aria-labelledby="step-title" className="min-w-0 rounded-xl border border-border/70 bg-card shadow-card">
        <StepProgress steps={STEPS} current={step} onSelect={setStep} />
        <div className="border-b border-border/70 px-5 pb-4 pt-5 sm:px-6">
          <p className="text-[12.5px] tabular-nums text-muted-foreground md:hidden">Step {step + 1} of {STEPS.length}</p>
          <h2 id="step-title" className="text-[20px] font-semibold leading-7 tracking-[-0.01em]">{STEPS[step].label}</h2>
          <p className="text-[13.5px] text-muted-foreground">{STEPS[step].desc}</p>
        </div>
        <div className="px-5 py-6 sm:px-6">
          <StepComponent value={draft} onChange={onChange} doc={doc} errors={visibleStepErrors} />
        </div>

      {/* Nav bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-5 py-4 sm:px-6">
        <Button variant="outline" onClick={goBack} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {step < STEPS.length - 1 ? (
            <>
              {showErrorsForCurrentStep && !canAdvance && (
                <span className="hidden text-[12.5px] text-soon sm:inline">
                  Fix {stepErrorCount} {stepErrorCount === 1 ? 'issue' : 'issues'} above to continue
                </span>
              )}
              <Button variant="outline" onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <Button onClick={goNext}>
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <AlertDialog open={transmitOpen} onOpenChange={setTransmitOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                   
                    disabled={!validation.valid || !docId || sendMut.isPending || replacePending || autosave.isSaving}
                    className="min-w-[200px]"
                  >
                    {sendMut.isPending || replacePending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Transmitting…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        {replacing ? 'Send replacement to CBP' : resending ? 'Send again to CBP' : 'Transmit to CBP'}
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      {replacing ? 'Send a replacement to CBP?' : 'Transmit Entry Summary to CBP?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This filing will be submitted to U.S. Customs and Border Protection.
                      {estimatedTotalCents !== null && (
                        <>
                          {' '}Estimated duties &amp; fees:{' '}
                          <strong>
                            {(estimatedTotalCents / 100).toLocaleString('en-US', {
                              style: 'currency',
                              currency: 'USD',
                            })}
                          </strong>
                          .
                        </>
                      )}{' '}
                      {replacing
                        ? 'CBP replaces the entry summary it holds with this version. If CBP rejects the replacement, the version on file stays.'
                        : 'Once CBP accepts it, the entry can be corrected only by sending a replacement. Confirm the summary before continuing.'}
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
      </section>
    </div>
  );
}
