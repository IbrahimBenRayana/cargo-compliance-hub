import { useParams, Link, useNavigate } from 'react-router-dom';
import { CbpTimeline } from '@/components/CbpTimeline';
import { IsfRejectedChangesBanner } from '@/components/IsfRejectedChangesBanner';
import { TransmitConfirmDialog } from '@/components/TransmitConfirmDialog';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFiling, useSubmitFiling, useAmendFiling, useCancelFiling, useValidateFiling, useCheckFilingStatus, useDuplicateFiling, useSaveFilingAsTemplate, useFilingDocuments, useUploadDocuments, useDownloadDocument, useDeleteDocument, useExportPdf, useConsolidationSiblings } from '@/hooks/useFilings';
import { useAbiDocumentsList } from '@/hooks/useAbiDocument';
import { useManifestQueries } from '@/hooks/useManifestQuery';
import { Filing, getPartyName, getFirstCommodity } from '@/types/shipment';
import { LifecycleWidget } from '@/components/LifecycleWidget';
import { PlanLimitModal } from '@/components/PlanLimitModal';
import { CAPABILITIES, type Capability } from '@/lib/planMeta';
import { useCapabilities } from '@/hooks/useBilling';
import { RejectionDetailsCard } from '@/components/RejectionDetailsCard';
import { RejectionCoachDrawer } from '@/components/compliance/RejectionCoachDrawer';
import { ScoreHistoryCard } from '@/components/compliance/ScoreHistoryCard';
import { complianceApi } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pencil, RotateCcw, ArrowLeft, CheckCircle2, XCircle, Send, Loader2,
  FileEdit, Ban, Shield, AlertTriangle, Ship, Package, Globe, Anchor,
  Container, Users, FileText, Clock, Zap, Activity,
  RefreshCw, Radio, Inbox, ArrowDownToLine, Copy, Bookmark, MoreHorizontal,
  Upload, Trash2, Paperclip, Search, FileCheck, Sparkles, Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FILL } from '@/components/dashboard/tones';
import { useNow } from '@/hooks/useDashboard';
import { VoyageStrip } from '@/components/shipment-detail/VoyageStrip';
import { countryName } from '@/components/shipments/countries';
import { statusOf } from '@/components/shipments/status';
import { StatusPill, StatusTile } from '@/components/shipments/StatusPill';
import { lastListView } from '@/components/shipments/useListState';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ─── Step-by-step submission pipeline ──────────────────────

type PipelineStep = 'validate' | 'send_cc' | 'send_cbp';
type StepStatus = 'idle' | 'running' | 'success' | 'error';

interface StepState {
  status: StepStatus;
  message?: string;
  details?: any;
}

function SubmissionPipeline({ filing, onComplete }: { filing: Filing; onComplete: () => void }) {
  const validateFiling = useValidateFiling();
  const submitFiling = useSubmitFiling();

  const [steps, setSteps] = useState<Record<PipelineStep, StepState>>({
    validate: { status: 'idle' },
    send_cc: { status: 'idle' },
    send_cbp: { status: 'idle' },
  });
  const [currentStep, setCurrentStep] = useState<PipelineStep | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Upgrade modal: null = closed. `capability` set = 403 feature_not_in_plan;
  // undefined capability = 402 subscription_required (no active plan).
  const [upgradePrompt, setUpgradePrompt] = useState<{ capability?: Capability } | null>(null);

  const updateStep = (step: PipelineStep, state: Partial<StepState>) => {
    setSteps(prev => ({ ...prev, [step]: { ...prev[step], ...state } }));
  };

  const runPipeline = async () => {
    setIsRunning(true);

    // Reset
    setSteps({
      validate: { status: 'idle' },
      send_cc: { status: 'idle' },
      send_cbp: { status: 'idle' },
    });

    // Step 1: Validate
    setCurrentStep('validate');
    updateStep('validate', { status: 'running', message: 'Checking all fields...' });

    try {
      const result = await validateFiling.mutateAsync(filing.id);
      if (!result.valid) {
        const criticals = result.errors.filter((e: any) => e.severity === 'critical');
        updateStep('validate', {
          status: 'error',
          message: `${result.criticalCount} critical error(s), ${result.warningCount} warning(s)`,
          details: result.errors,
        });
        setCurrentStep(null);
        setIsRunning(false);
        return;
      }
      updateStep('validate', {
        status: 'success',
        message: `Score: ${result.score}/100 \u2014 ${result.warningCount} warning(s), ${result.infoCount} info`,
        details: result.errors,
      });
    } catch (err: any) {
      updateStep('validate', { status: 'error', message: err.message || 'Validation failed', details: err.body });
      setCurrentStep(null);
      setIsRunning(false);
      return;
    }

    // Validated: confirm who files it and where before anything is sent.
    setCurrentStep(null);
    setIsRunning(false);
    setConfirmOpen(true);
  };

  const transmit = async () => {
    setConfirmOpen(false);
    setIsRunning(true);
    setCurrentStep('send_cc');
    updateStep('send_cc', { status: 'running', message: 'Preparing CBP filing document...' });

    try {
      const result = await submitFiling.mutateAsync(filing.id);

      // Native: our engine transmitted it; CBP's answer arrives in the CBP activity card.
      if (result.native) {
        updateStep('send_cc', { status: 'success', message: 'Filing built and checked' });
        updateStep('send_cbp', {
          status: 'success',
          message: result.native.outcome === 'UNKNOWN'
            ? 'Sent; the outcome is not yet confirmed, waiting for CBP'
            : `Sent to CBP under filer ${result.native.filerCode}. CBP usually answers within a few minutes.`,
        });
        toast.success('Sent to CBP');
        onComplete();
        setCurrentStep(null);
        setIsRunning(false);
        return;
      }

      // CustomsCity fallback: filing document created
      updateStep('send_cc', {
        status: 'success',
        message: `Document created — Ref: ${result.ccFilingId || 'assigned'}`,
      });

      setCurrentStep('send_cbp');
      updateStep('send_cbp', {
        status: 'success',
        message: result.sendResponse?.success
          ? `Sent! ${result.sendResponse['Documents sent'] || 1} document(s) transmitted to CBP`
          : 'Filing queued for CBP transmission',
        details: result.sendResponse,
      });

      toast.success('Filing submitted to CBP successfully!');
      onComplete();
    } catch (err: any) {
      const body = err.body || err;

      // Plan gated (HTTP 402 subscription_required / 403 feature_not_in_plan) —
      // surface the upgrade modal in the matching mode.
      if (body?.code === 'subscription_required' || body?.code === 'feature_not_in_plan') {
        setUpgradePrompt(
          body.code === 'feature_not_in_plan'
            ? { capability: (body?.capability as Capability) ?? CAPABILITIES.ISF_FILING }
            : {},
        );
        updateStep('send_cc', { status: 'idle' });
        updateStep('send_cbp', { status: 'idle' });
        setCurrentStep(null);
        setIsRunning(false);
        return;
      }

      // Native refusals carry the missing fields or the reason in CBP-rule terms.
      if (body?.code === 'ISF_DATA_INCOMPLETE' && Array.isArray(body.issues)) {
        updateStep('send_cc', {
          status: 'error',
          message: 'Required ISF information is missing',
          details: body.issues.map((i: { field: string; message: string }) => ({ field: i.field, message: i.message, severity: 'critical' })),
        });
        updateStep('send_cbp', { status: 'idle' });
      } else if (body?.validationErrors) {
        // CC validation failed (document creation rejected)
        updateStep('send_cc', {
          status: 'error',
          message: 'Filing was rejected by CBP',
          details: body.validationErrors,
        });
        updateStep('send_cbp', { status: 'idle' });
      } else if (body?.apiResponse) {
        // CC API error on create
        updateStep('send_cc', {
          status: 'error',
          message: body.error || 'Filing submission error',
          details: body.apiResponse,
        });
        updateStep('send_cbp', { status: 'idle' });
      } else {
        // Could be send failure or general error
        updateStep('send_cc', {
          status: steps.send_cc.status === 'running' ? 'error' : steps.send_cc.status,
          message: steps.send_cc.status === 'running' ? (body?.error || 'Failed') : steps.send_cc.message,
        });
        if (steps.send_cc.status === 'success') {
          updateStep('send_cbp', {
            status: 'error',
            message: body?.error || 'Failed to send to CBP',
            details: body,
          });
        }
      }
      toast.error(body?.error || 'Submission failed');
    }

    setCurrentStep(null);
    setIsRunning(false);
  };

  const stepConfig = [
    { key: 'validate' as PipelineStep, label: 'Validate fields', desc: 'Check every required field and format', icon: Shield },
    { key: 'send_cc' as PipelineStep, label: 'Create filing', desc: 'Prepare the document for CBP', icon: Zap },
    { key: 'send_cbp' as PipelineStep, label: 'Send to CBP', desc: 'Send the ISF to US Customs', icon: Send },
  ];

  return (
    <>
    <PlanLimitModal open={upgradePrompt !== null} onClose={() => setUpgradePrompt(null)} capability={upgradePrompt?.capability} />
    <TransmitConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      filing={filing}
      actionLabel="Send this ISF to CBP"
      onConfirm={transmit}
      pending={submitFiling.isPending}
    />
    <Card className="rounded-xl border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-[14px] font-semibold">Submission pipeline</CardTitle>
          </div>
          <Button
            onClick={runPipeline}
            disabled={isRunning}
            className="gap-2"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isRunning ? 'Working…' : 'Start submission'}
          </Button>
        </div>
        <CardDescription>Check, prepare and send this ISF to CBP.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {stepConfig.map((cfg, i) => {
          const state = steps[cfg.key];
          const isCurrent = currentStep === cfg.key;

          return (
            <div key={cfg.key}>
              <div className={cn(
                'rounded-xl p-4 transition-all duration-300',
                isCurrent && 'bg-primary/5 ring-1 ring-primary/20',
                state.status === 'success' && 'bg-emerald-50/50 dark:bg-emerald-950/10',
                state.status === 'error' && 'bg-red-50/50 dark:bg-red-950/10',
              )}>
                <div className="flex items-start gap-3">
                  {/* Step indicator */}
                  <div className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300',
                    state.status === 'idle' && 'bg-muted text-muted-foreground',
                    state.status === 'running' && 'bg-primary text-primary-foreground animate-pulse',
                    state.status === 'success' && 'bg-emerald-500 text-white',
                    state.status === 'error' && 'bg-red-500 text-white',
                  )}>
                    {state.status === 'running' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : state.status === 'success' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : state.status === 'error' ? (
                      <XCircle className="h-5 w-5" />
                    ) : (
                      <cfg.icon className="h-5 w-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{cfg.label}</p>
                      {state.status === 'success' && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">Done</Badge>}
                      {state.status === 'error' && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800">Failed</Badge>}
                      {state.status === 'running' && <Badge variant="outline" className="text-[10px] animate-pulse">Running</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{cfg.desc}</p>

                    {state.message && (
                      <p className={cn(
                        'text-xs mt-2 font-medium',
                        state.status === 'success' && 'text-emerald-600 dark:text-emerald-400',
                        state.status === 'error' && 'text-red-600 dark:text-red-400',
                        state.status === 'running' && 'text-primary',
                      )}>
                        {state.message}
                      </p>
                    )}

                    {/* Show validation errors in detail */}
                    {state.status === 'error' && state.details && Array.isArray(state.details) && (
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                        {state.details.slice(0, 10).map((err: any, j: number) => (
                          <div key={j} className="flex items-start gap-1.5 text-xs">
                            <span className={cn(
                              'shrink-0 px-1 py-0.5 rounded text-[9px] font-bold uppercase',
                              err.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                              err.severity === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                              'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
                            )}>
                              {err.severity || 'error'}
                            </span>
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">{err.field}</span>: {err.message}
                            </span>
                          </div>
                        ))}
                        {state.details.length > 10 && (
                          <p className="text-[10px] text-muted-foreground">...and {state.details.length - 10} more</p>
                        )}
                      </div>
                    )}

                    {/* Show success details for send_cbp */}
                    {state.status === 'success' && cfg.key === 'send_cbp' && state.details && (
                      <div className="mt-2 rounded-lg bg-muted/50 p-2 text-xs font-mono text-muted-foreground">
                        {JSON.stringify(state.details, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Connector line */}
              {i < stepConfig.length - 1 && (
                <div className="flex justify-start ml-5">
                  <div className={cn(
                    'w-0.5 h-4 transition-colors',
                    state.status === 'success' ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border',
                  )} />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
    </>
  );
}

// ─── CBP Status Checker (for submitted filings) ───────────

function CBPStatusChecker({ filing, onStatusUpdate }: { filing: Filing; onStatusUpdate: () => void }) {
  const checkStatus = useCheckFilingStatus();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [statusResult, setStatusResult] = useState<any>(null);
  const [autoPolling, setAutoPolling] = useState(true);

  const handleCheck = useCallback(async () => {
    try {
      const result = await checkStatus.mutateAsync(filing.id);
      setStatusResult(result);
      setLastChecked(new Date());

      if (result.statusChanged) {
        toast.success(
          result.newStatus === 'accepted'
            ? '🎉 Filing has been ACCEPTED by CBP!'
            : result.newStatus === 'rejected'
            ? 'Filing was REJECTED by CBP'
            : `Filing status updated to: ${result.newStatus}`,
          { duration: 6000 }
        );
        onStatusUpdate();
        setAutoPolling(false); // Stop polling once status changes
      }
    } catch (err: any) {
      toast.error(err.body?.error || 'Failed to check status');
    }
  }, [filing.id, checkStatus, onStatusUpdate]);

  // Auto-poll every 30 seconds for submitted filings
  useEffect(() => {
    if (!autoPolling || filing.status !== 'submitted') return;

    // Initial check after 2 seconds
    const initialTimer = setTimeout(handleCheck, 2000);

    // Then poll every 30 seconds
    const interval = setInterval(handleCheck, 30_000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [autoPolling, filing.status, filing.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const messages = statusResult?.messages ?? [];
  const ccStatus = statusResult?.ccStatus;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center',
              autoPolling ? 'bg-primary/10 animate-pulse' : 'bg-muted',
            )}>
              <Radio className={cn('h-4 w-4', autoPolling ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div>
              <CardTitle className="text-[14px] font-semibold">CBP response status</CardTitle>
              <CardDescription className="text-xs">
                {autoPolling
                  ? 'Auto-checking every 30s for CBP response...'
                  : lastChecked
                  ? `Last checked: ${lastChecked.toLocaleTimeString()}`
                  : 'Click to check filing status'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {autoPolling && (
              <Button variant="ghost" size="sm" onClick={() => setAutoPolling(false)} className="text-xs text-muted-foreground">
                Stop polling
              </Button>
            )}
            {!autoPolling && filing.status === 'submitted' && (
              <Button variant="ghost" size="sm" onClick={() => setAutoPolling(true)} className="text-xs text-muted-foreground">
                Auto-poll
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheck}
              disabled={checkStatus.isPending}
              className="gap-1.5"
            >
              {checkStatus.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Check Now
            </Button>
          </div>
        </div>
      </CardHeader>

      {statusResult && (
        <CardContent className="space-y-4">
          {/* CC Document Status */}
          {ccStatus && (
            <div className="rounded-xl bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Document Status</span>
                <Badge className={cn(
                  'text-xs',
                  ccStatus.status === 'ACCEPTED' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
                  ccStatus.status === 'REJECTED' && 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
                  !['ACCEPTED', 'REJECTED'].includes(ccStatus.status) && 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
                )}>
                  {ccStatus.status}
                </Badge>
              </div>
              {ccStatus.lastEvent && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><span className="font-medium text-foreground">Last Event:</span> {ccStatus.lastEvent.codeDescription}</p>
                  <p><span className="font-medium text-foreground">Event Code:</span> {ccStatus.lastEvent.code} — {ccStatus.lastEvent.event}</p>
                  <p><span className="font-medium text-foreground">Event Time:</span> {new Date(ccStatus.lastEvent.createdAt).toLocaleString()}</p>
                </div>
              )}
              {ccStatus.eventSummary && (
                <div className="flex gap-3 text-xs mt-2">
                  {ccStatus.eventSummary.onHold !== undefined && (
                    <span className={ccStatus.eventSummary.onHold ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                      On Hold: {ccStatus.eventSummary.onHold ? 'Yes' : 'No'}
                    </span>
                  )}
                  {ccStatus.eventSummary.released !== undefined && (
                    <span className={ccStatus.eventSummary.released ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                      Released: {ccStatus.eventSummary.released ? 'Yes' : 'No'}
                    </span>
                  )}
                  {ccStatus.eventSummary.amsMatch !== undefined && (
                    <span className={ccStatus.eventSummary.amsMatch ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                      AMS Match: {ccStatus.eventSummary.amsMatch ? 'Yes' : 'No'}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CBP Messages Timeline */}
          {messages.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">CBP Messages ({messages.length})</span>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {messages.map((msg: any, i: number) => (
                  <div key={i} className={cn(
                    'flex items-start gap-3 p-3 rounded-lg text-xs transition-colors',
                    msg.type === 'Sent' ? 'bg-primary/5' : 'bg-muted/50',
                  )}>
                    <div className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                      msg.type === 'Sent' ? 'bg-primary/10 text-primary' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
                    )}>
                      {msg.type === 'Sent' ? <Send className="h-3 w-3" /> : <ArrowDownToLine className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{msg.type} — {msg.messageType}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">{msg.CBPDateTime}</span>
                      </div>
                      <p className="text-muted-foreground mt-0.5">{msg.description}</p>
                      {msg.ISFTransactionNumber && (
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono">ISF Txn: {msg.ISFTransactionNumber}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No data yet */}
          {!ccStatus && messages.length === 0 && (
            <div className="text-center py-6">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No CBP response yet. Status will update automatically.</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Consolidation strip ────────────────────────────────────
// Shown at the top of the detail page when this filing belongs to a
// multi-HBL consolidation. Lists every sibling as a clickable chip + its
// status; the current filing's chip is highlighted in place.
function ConsolidationStrip({
  consolidationId,
  currentId,
  masterBol,
}: {
  consolidationId: string;
  currentId: string;
  masterBol: string | null;
}) {
  const { data, isLoading } = useConsolidationSiblings(consolidationId);
  if (isLoading || !data) return null;
  const siblings = data.filings;
  if (siblings.length < 2) return null;
  return (
    <section aria-label="Consolidation" className="rounded-xl border border-border/70 bg-card px-5 py-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary"><Layers className="h-3.5 w-3.5" aria-hidden /></span>
        <h2 className="text-[14px] font-semibold">
          Consolidation {masterBol && <span className="font-mono text-[13px] font-medium text-muted-foreground">{masterBol}</span>}
        </h2>
        <span className="text-[12.5px] text-muted-foreground">
          {siblings.length} house bills, each its own ISF and billed as one filing
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {siblings.map((s, idx) => {
          const isCurrent = s.id === currentId;
          return (
            <Link
              key={s.id}
              to={`/shipments/${s.id}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] tabular-nums transition-colors duration-150',
                isCurrent ? 'border-primary bg-primary/5 font-semibold' : 'border-border/70 can-hover:hover:bg-muted/50',
              )}
              aria-current={isCurrent ? 'page' : undefined}
            >
              <span className="text-[11.5px] text-muted-foreground">HBL {idx + 1}</span>
              <span className="font-mono">{s.houseBol || s.id.slice(0, 8)}</span>
              <StatusPill status={s.status} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── Main Component ────────────────────────────────────────

const PANEL = 'rounded-xl border border-border/70 bg-card p-5 shadow-card';
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** A section's heading: its icon on the brand tint, its name, and a count when it has one. */
function PanelTitle({ icon: Icon, count, children }: { icon: React.ElementType; count?: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[14px] font-semibold">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" aria-hidden /></span>
      {children}
      {count !== undefined && <span className="rounded-md bg-muted px-1.5 py-px text-[11.5px] font-medium tabular-nums text-muted-foreground">{count}</span>}
    </h2>
  );
}

export default function ShipmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: filing, isLoading, isError, refetch } = useFiling(id);
  const now = useNow();
  const amendFiling = useAmendFiling();
  const cancelFiling = useCancelFiling();
  const submitFiling = useSubmitFiling();
  const duplicateFiling = useDuplicateFiling();
  const saveAsTemplate = useSaveFilingAsTemplate();
  const { can } = useCapabilities();
  const [resubmitConfirmOpen, setResubmitConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  // Upgrade modal: null = closed. `capability` set = 403 feature_not_in_plan;
  // undefined capability = 402 subscription_required (no active plan).
  const [upgradePrompt, setUpgradePrompt] = useState<{ capability?: Capability } | null>(null);
  // Resubmit validation errors → shown in a Dialog with one row per field
  // (audit Phase 8.3). Pre-fix the user only saw "N validation errors" in
  // a toast and had no way to act on them; the full list now lives until
  // they dismiss it.
  const [resubmitErrors, setResubmitErrors] = useState<Array<{ field?: string; message?: string }> | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  // Drawer can render in two modes: rejection (for rejected) or draft-review
  // (for in-flight). One drawer instance + state controls both.
  const [coachMode, setCoachMode] = useState<'rejection' | 'draft-review'>('rejection');
  // Surface the AI Coach button only when the server has AI configured.
  const aiStatusQuery = useQuery({
    queryKey: ['compliance', 'ai-status'],
    queryFn: () => complianceApi.aiStatus(),
    staleTime: 5 * 60_000,
  });

  // Document upload state
  const { data: docsData, isLoading: docsLoading } = useFilingDocuments(id);
  // Lifecycle widget data — fetched lazily; failure of either is fine
  // (the widget falls back to ISF-only state if abis/mqs don't load).
  const { data: abiListData } = useAbiDocumentsList({ take: 100 }, { enabled: can(CAPABILITIES.ABI_ENTRY) });
  const { data: mqListData } = useManifestQueries({ limit: 50 });
  const uploadDocs = useUploadDocuments();
  const downloadDoc = useDownloadDocument();
  const deleteDoc = useDeleteDocument();
  const exportPdf = useExportPdf();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadDocType, setUploadDocType] = useState('bol');

  if (isLoading) {
    // The page's own shape, so nothing jumps when the shipment arrives.
    return (
      <div role="status" aria-busy="true" aria-label="Loading shipment" className="mx-auto flex max-w-[1200px] flex-col gap-5">
        <div className="dash-sk h-4 w-24" />
        <div className="flex items-center gap-4">
          <div className="dash-sk h-11 w-11 rounded-xl" />
          <div className="space-y-2"><div className="dash-sk h-7 w-56" /><div className="dash-sk h-4 w-72" style={{ '--i': 1 } as React.CSSProperties} /></div>
        </div>
        <div className="dash-sk h-36 w-full rounded-xl" style={{ '--i': 2 } as React.CSSProperties} />
        <div className="dash-sk h-40 w-full rounded-xl" style={{ '--i': 3 } as React.CSSProperties} />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="dash-sk h-48 rounded-xl" style={{ '--i': 4 } as React.CSSProperties} />
          <div className="dash-sk h-48 rounded-xl" style={{ '--i': 5 } as React.CSSProperties} />
        </div>
      </div>
    );
  }

  if (isError || !filing) {
    return (
      <div className="py-16 text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
          <FileText className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-3 text-[13px] font-medium">We could not find this shipment.</p>
        <p className="mt-1 text-[13px] text-muted-foreground">It may have been deleted, or it belongs to another account.</p>
        <Button variant="outline" size="sm" asChild className="mt-4"><Link to="/shipments">Shipments</Link></Button>
      </div>
    );
  }

  const commodity = getFirstCommodity(filing);

  const handleResubmit = async () => {
    setResubmitConfirmOpen(false);
    try {
      await submitFiling.mutateAsync(filing.id);
      toast.success('Filing resubmitted successfully!');
    } catch (err: any) {
      const body = err.body || err;
      if (body?.code === 'subscription_required') {
        setUpgradePrompt({});
        return;
      }
      if (body?.code === 'feature_not_in_plan') {
        setUpgradePrompt({ capability: (body?.capability as Capability) ?? CAPABILITIES.ISF_FILING });
        return;
      }
      if (body?.validationErrors && Array.isArray(body.validationErrors)) {
        // Drop the toast-only "N validation errors" message and surface the
        // full list in a Dialog so the user can actually act on each field.
        setResubmitErrors(body.validationErrors);
      } else {
        toast.error(body?.error || 'Resubmission failed');
      }
    }
  };

  const handleAmend = async () => {
    try {
      await amendFiling.mutateAsync({ id: filing.id });
      toast.success('Amendment submitted to CBP');
    } catch (err: any) {
      toast.error(err.body?.error || 'Amendment failed');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelFiling.mutateAsync({ id: filing.id, reason: cancelReason || undefined });
      setCancelReason('');
      toast.success('Filing cancelled');
    } catch (err: any) {
      toast.error(err.body?.error || 'Cancellation failed');
    }
  };

  const handleDuplicate = async () => {
    try {
      const newFiling = await duplicateFiling.mutateAsync(filing.id);
      toast.success('Filing duplicated — opening new draft');
      navigate(`/shipments/${newFiling.id}/edit`);
    } catch (err: any) {
      toast.error(err.body?.error || 'Duplication failed');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    try {
      await saveAsTemplate.mutateAsync({ id: filing.id, name: templateName.trim() });
      toast.success(`Template "${templateName.trim()}" saved!`);
      setTemplateName('');
      setTemplateDialogOpen(false);
    } catch (err: any) {
      toast.error(err.body?.error || 'Failed to save template');
    }
  };

  const isISF5 = filing.filingType === 'ISF-5';
  const isf5 = (filing as any).isf5Data ?? {};

  const sections = isISF5 ? [
    { title: 'ISF filer and booking party', icon: Users, items: [
      ['ISF filer', isf5.ISFFilerName || filing.importerName || ''],
      ['Filer EIN', isf5.ISFFilerNumber || filing.importerNumber || ''],
      ['Booking party', isf5.bookingPartyName || ''],
      ['Booking party country', isf5.bookingPartyCountry || ''],
      ['Bond holder ID', isf5.bondHolderID || ''],
    ]},
    { title: 'Parties', icon: Users, items: [
      ['Ship-to party', getPartyName(filing.shipToParty)],
      ['Manufacturer', getPartyName(filing.manufacturer)],
    ]},
    { title: 'Shipment', icon: Ship, items: [
      ['Master BOL', filing.masterBol || ''],
      ['House BOL', filing.houseBol || ''],
      ['US port of arrival', isf5.USPortOfArrival || filing.foreignPortOfUnlading || ''],
      ['Bond type', filing.bondType || ''],
      ['Est. arrival', filing.estimatedArrival ? longDate(filing.estimatedArrival) : ''],
    ]},
  ] : [
    { title: 'Parties', icon: Users, items: [
      ['Manufacturer', getPartyName(filing.manufacturer)],
      ['Seller', getPartyName(filing.seller)],
      ['Buyer', getPartyName(filing.buyer)],
      ['Ship-to party', getPartyName(filing.shipToParty)],
      ['Importer', filing.importerName || ''],
      ['Consignee', filing.consigneeName || ''],
    ]},
    { title: 'Shipment', icon: Ship, items: [
      ['Master BOL', filing.masterBol || ''],
      ['House BOL', filing.houseBol || ''],
      ['Vessel', filing.vesselName || ''],
      ['Voyage', filing.voyageNumber || ''],
      ['SCAC', filing.scacCode || ''],
      ['Port of unlading', filing.foreignPortOfUnlading || ''],
      ['Place of delivery', filing.placeOfDelivery || ''],
    ]},
    { title: 'Logistics', icon: Globe, items: [
      ['Container stuffing', getPartyName(filing.containerStuffingLocation)],
      ['Consolidator', getPartyName(filing.consolidator)],
      ['Bond type', filing.bondType || ''],
      ['Est. departure', filing.estimatedDeparture ? longDate(filing.estimatedDeparture) : ''],
      ['Est. arrival', filing.estimatedArrival ? longDate(filing.estimatedArrival) : ''],
    ]},
  ];

  return (
    <div className="dash-enter mx-auto flex max-w-[1200px] flex-col gap-5 pb-16">
      <PlanLimitModal
        open={upgradePrompt !== null}
        onClose={() => setUpgradePrompt(null)}
        capability={upgradePrompt?.capability}
      />

      {/* Resubmit validation errors — shown when the server rejects the
          resubmit attempt with a structured validationErrors array. */}
      <Dialog open={resubmitErrors !== null} onOpenChange={(open) => !open && setResubmitErrors(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Resubmission failed — {resubmitErrors?.length ?? 0} validation issue
              {(resubmitErrors?.length ?? 0) === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              CBP requires every field below to be valid before the filing
              can re-transmit. Edit the filing to address each one and try
              resubmit again.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50vh] overflow-y-auto space-y-2 text-sm">
            {resubmitErrors?.map((e, i) => (
              <li key={i} className="flex items-start gap-2 rounded-md border border-border/60 bg-secondary/40 px-3 py-2">
                {e.field && (
                  <span className="font-mono text-xs text-foreground/70 shrink-0">{e.field}</span>
                )}
                <span className="text-foreground/85">{e.message ?? 'Validation failed'}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResubmitErrors(null)}>
              Close
            </Button>
            <Button onClick={() => { setResubmitErrors(null); navigate(`/shipments/${filing.id}/edit`); }}>
              Edit filing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Back to the list as it was last left: same tab, filters, sort and page. */}
      <Link
        to={`/shipments${lastListView()}`}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />Shipments
      </Link>

      <div className="-mt-2 flex flex-wrap items-start gap-x-4 gap-y-3">
        <StatusTile status={filing.status} className="h-11 w-11 rounded-xl [&>svg]:h-5 [&>svg]:w-5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="break-all font-mono text-[24px] font-semibold leading-8 tracking-[-0.01em]">{filing.houseBol || filing.masterBol || filing.id.slice(0, 8)}</h1>
            <StatusPill status={filing.status} />
            {filing.ccFilingId && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">Ref {filing.ccFilingId.slice(0, 12)}</span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {filing.filingType} {'\u00b7'} {isISF5 ? (isf5.ISFFilerName || filing.importerName || 'Unknown filer') : (filing.importerName || 'Unknown importer')}
            {filing.houseBol && filing.masterBol && <> {'\u00b7'} MBL <span className="font-mono">{filing.masterBol}</span></>}
            {filing.createdAt && (
              <> {'\u00b7'} Created {new Date(filing.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            )}
          </p>
        </div>
        {/* Own row on phones; wraps instead of pushing the page sideways. */}
        <div className="flex flex-wrap gap-2 basis-full sm:basis-auto">
          {/* AI pre-flight review — surfaces UFLPA/PGA risks + rule-based issues
              + AI suggestions before submit. Available for any in-flight filing. */}
          {aiStatusQuery.data?.enabled
            && (['draft', 'submitted', 'pending_cbp', 'on_hold'] as const).includes(filing.status as any) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-soon/30 text-soon hover:bg-soon-tint hover:text-soon"
              onClick={() => { setCoachMode('draft-review'); setCoachOpen(true); }}
            >
              <Sparkles className="h-4 w-4" /> AI pre-flight review
            </Button>
          )}
          {(filing.status === 'draft' || filing.status === 'rejected') && (
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to={`/shipments/${filing.id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
            </Button>
          )}
          {filing.status === 'rejected' && (
            <Button size="sm" onClick={() => setResubmitConfirmOpen(true)} disabled={submitFiling.isPending} className="gap-1.5">
              {submitFiling.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Resubmit
            </Button>
          )}
          {filing.status === 'accepted' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={amendFiling.isPending}>
                  {amendFiling.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileEdit className="h-4 w-4" />}
                  Amend
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>File an amendment with CBP?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This sends the ISF to CBP again with your changes. Depending
                    on timing relative to vessel departure, late-amendment
                    penalties may apply. Make sure your changes are final before
                    continuing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep as-is</AlertDialogCancel>
                  <AlertDialogAction onClick={handleAmend}>
                    Send amendment to CBP
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Check Manifest — look up cargo status at CBP */}
          {filing.masterBol && (
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to={`/manifest-query?bol=${encodeURIComponent(filing.masterBol)}`}>
                <Search className="h-4 w-4" />
                Check manifest
              </Link>
            </Button>
          )}

          {/* File Entry Documents — once ISF is accepted, file the
              7501 + 3461 entry. Server prefills IOR, consignee, MBOL,
              carrier, and bond from this filing. */}
          {filing.status === 'accepted' && can(CAPABILITIES.ABI_ENTRY) && (
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to={`/abi-documents/new?fromShipment=${filing.id}`}>
                <FileCheck className="h-4 w-4" />
                File entry documents
              </Link>
            </Button>
          )}

          {/* More Actions Dropdown — Duplicate, Save Template, Cancel */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={handleDuplicate} disabled={duplicateFiling.isPending}>
                <Copy className="h-4 w-4 mr-2" />
                {duplicateFiling.isPending ? 'Duplicating...' : 'Duplicate as New Draft'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/shipments/new?fromFiling=${filing.id}`)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Use as starting point
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setTemplateName(filing.importerName ? `${filing.importerName} — ${filing.filingType}` : `Template — ${filing.filingType}`); setTemplateDialogOpen(true); }}>
                <Bookmark className="h-4 w-4 mr-2" />
                Save as Template
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={exportPdf.isPending}
                onClick={() => {
                  exportPdf.mutate(filing.id, {
                    onSuccess: () => toast.success('PDF downloaded'),
                    onError: () => toast.error('PDF export failed'),
                  });
                }}
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                {exportPdf.isPending ? 'Generating PDF...' : 'Download PDF Report'}
              </DropdownMenuItem>
              {(filing.status === 'draft' || filing.status === 'submitted' || filing.status === 'accepted') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => document.getElementById('cancel-dialog-trigger')?.click()}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Cancel Filing
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hidden Cancel AlertDialog trigger */}
          {(filing.status === 'draft' || filing.status === 'submitted' || filing.status === 'accepted') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button id="cancel-dialog-trigger" className="hidden" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this filing?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will send a cancellation request to CBP. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  placeholder="Reason for cancellation (optional)"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="mt-2"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Filing</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Confirm Cancellation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Save as Template Dialog */}
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Save as Template</DialogTitle>
                <DialogDescription>
                  Save the parties, ports, HTS codes, and other reusable data from this filing as a template.
                  BOL numbers, voyage, dates, and containers will not be saved.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. China → LA — Electronics"
                    className="mt-1.5"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Bookmark className="h-3.5 w-3.5" />
                  <span>Type: {filing.filingType} · Importer: {filing.importerName || 'N/A'}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveTemplate} disabled={!templateName.trim() || saveAsTemplate.isPending} className="gap-1.5">
                  {saveAsTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
                  Save Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <VoyageStrip filing={filing} now={now} />

      {/* Consolidation strip — only when this filing is part of a multi-HBL
          consolidation. Chips jump to siblings; current filing's chip is
          highlighted. The list is fetched from the lightweight sibling
          endpoint so this page works even if siblings live off the current
          ShipmentsList page (pagination boundary). */}
      {filing.consolidationId && (
        <ConsolidationStrip
          consolidationId={filing.consolidationId}
          currentId={filing.id}
          masterBol={filing.masterBol ?? null}
        />
      )}

      {/* Where the shipment stands: ISF, Manifest, Entry filed, Entry accepted */}
      <LifecycleWidget
        filing={filing}
        abiDocs={(abiListData?.data ?? []) as any}
        manifestQueries={((mqListData as any)?.data ?? []) as any}
      />

      {/* CBP rejected the last changes: what's shown is not what CBP has (BUG-015) */}
      {filing.lastTransmissionId && <IsfRejectedChangesBanner filingId={filing.id} />}

      {/* Submission Pipeline — only for draft filings */}
      {filing.status === 'draft' && <SubmissionPipeline filing={filing} onComplete={() => refetch()} />}

      {/* CBP Status Checker — for submitted filings awaiting CBP response */}
      {filing.status === 'submitted' && !filing.lastTransmissionId && <CBPStatusChecker filing={filing} onStatusUpdate={() => refetch()} />}

      {/* Native CBP activity: what was sent and CBP's answer, live while pending */}
      {filing.lastTransmissionId && <CbpTimeline filingId={filing.id} />}

      <TransmitConfirmDialog
        open={resubmitConfirmOpen}
        onOpenChange={setResubmitConfirmOpen}
        filing={filing}
        actionLabel="Resubmit this ISF to CBP"
        onConfirm={handleResubmit}
        pending={submitFiling.isPending}
      />

      {/* Compliance score trajectory — status-band derived from FilingStatusHistory */}
      <ScoreHistoryCard filingId={filing.id} />

      {/* Rejection details — extracted to RejectionDetailsCard for reuse + legacy [object Object] cleanup */}
      {filing.status === 'rejected' && filing.rejectionReason && (
        <RejectionDetailsCard
          reason={filing.rejectionReason}
          variant="current"
          actions={
            <>
              {aiStatusQuery.data?.enabled && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10"
                  onClick={() => { setCoachMode('rejection'); setCoachOpen(true); }}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Ask AI Coach
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to={`/shipments/${filing.id}/edit`}><Pencil className="h-3.5 w-3.5" /> Edit & Fix</Link>
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setResubmitConfirmOpen(true)} disabled={submitFiling.isPending}>
                {submitFiling.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Resubmit
              </Button>
            </>
          }
        />
      )}

      {/* AI Coach drawer — streaming OpenAI response. Renders in either
          "rejection" mode (explains a rejection) or "draft-review" mode
          (pre-flights an in-flight filing). One drawer instance + state. */}
      <RejectionCoachDrawer
        open={coachOpen}
        onOpenChange={setCoachOpen}
        mode={coachMode}
        filingId={filing.id}
      />


      {/* Historical rejection — only meaningful while the filing is still
          in flight (user is mid-recovery: editing a draft, awaiting CBP on
          a resubmit, on hold). For terminal-success states (accepted) the
          rejection history is noise and contradicts the green status badge,
          so we hide it. Backend also nulls rejectionReason on accept now
          (see routes/filings.ts + backgroundJobs.ts), so this also guards
          against legacy filings whose data wasn't cleaned up. */}
      {(['draft', 'submitted', 'pending_cbp', 'on_hold'] as const).includes(filing.status as any)
        && filing.rejectionReason && (
        <RejectionDetailsCard reason={filing.rejectionReason} variant="previous" />
      )}

      {/* What was filed: parties, shipment and goods */}
      <div className="grid gap-5 md:grid-cols-2">
        {sections.map((section, i) => {
          // An odd panel out takes the whole row, its facts in two columns, so no gap is left beside it.
          const wide = sections.length % 2 === 1 && i === sections.length - 1;
          return (
            <section key={section.title} aria-label={section.title} className={cn(PANEL, wide && 'md:col-span-2')}>
              <PanelTitle icon={section.icon}>{section.title}</PanelTitle>
              <dl className={cn('mt-3', wide ? 'grid md:grid-cols-2 md:gap-x-10' : 'divide-y divide-border/60')}>
                {section.items.map(([label, value]) => (
                  <div key={label as string} className={cn('flex justify-between gap-4 py-2 text-[13px]', wide ? 'border-b border-border/60' : 'first:pt-0 last:pb-0')}>
                    <dt className="shrink-0 text-muted-foreground">{label as string}</dt>
                    <dd className="min-w-0 truncate text-right font-medium" title={(value as string) || undefined}>
                      {(value as string) || <span className="font-normal text-muted-foreground">Not provided</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>

      {filing.commodities && filing.commodities.length > 0 && (
        <section aria-label="Goods" className={PANEL}>
          <PanelTitle icon={Package} count={filing.commodities.length}>Goods</PanelTitle>
          <div className="-mx-5 mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-muted-foreground">
                  <th scope="col" className="px-5 pb-2 font-medium">Description</th>
                  <th scope="col" className="px-3 pb-2 font-medium">HTS</th>
                  <th scope="col" className="px-3 pb-2 font-medium">Origin</th>
                  <th scope="col" className="px-5 pb-2 text-right font-medium">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {filing.commodities.map((c: any, i: number) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-5 py-2.5 font-medium">{c.description || <span className="font-normal text-muted-foreground">No description</span>}</td>
                    <td className="px-3 py-2.5"><span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[12px] text-primary">{c.htsCode || 'None'}</span></td>
                    <td className="px-3 py-2.5">{c.countryOfOrigin ? countryName(c.countryOfOrigin) : <span className="text-muted-foreground">Not set</span>}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{c.quantity ?? <span className="text-muted-foreground">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {filing.containers && filing.containers.length > 0 && (
        <section aria-label="Containers" className={PANEL}>
          <PanelTitle icon={Container} count={filing.containers.length}>Containers</PanelTitle>
          <ul className="mt-3 flex flex-wrap gap-2">
            {filing.containers.map((c: any, i: number) => (
              <li key={i} className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                <p className="font-mono text-[13px] font-medium">{c.number}</p>
                <p className="text-[12px] text-muted-foreground">{[c.type, c.sealNumber && `Seal ${c.sealNumber}`].filter(Boolean).join(' \u00b7 ') || 'No type'}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
      {/* Documents */}
      <section aria-label="Documents" className={PANEL}>
          <div className="flex items-center justify-between gap-3">
            <PanelTitle icon={Paperclip} count={docsData?.data?.length || undefined}>Documents</PanelTitle>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 h-8">
                  <Upload className="h-3.5 w-3.5" /> Upload
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Document</DialogTitle>
                  <DialogDescription>
                    Attach BOL copies, commercial invoices, packing lists, or other documents.
                    Max 10 MB per file. Up to 5 files at once.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Document Type</Label>
                    <Select value={uploadDocType} onValueChange={setUploadDocType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bol">Bill of Lading</SelectItem>
                        <SelectItem value="commercial_invoice">Commercial Invoice</SelectItem>
                        <SelectItem value="packing_list">Packing List</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Files</Label>
                    <Input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                      onChange={e => {
                        const files = Array.from(e.target.files || []);
                        setUploadFiles(files);
                      }}
                    />
                    {uploadFiles.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {uploadFiles.length} file(s) selected ({(uploadFiles.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setUploadDialogOpen(false); setUploadFiles([]); }}>Cancel</Button>
                  <Button
                    disabled={uploadFiles.length === 0 || uploadDocs.isPending}
                    onClick={async () => {
                      try {
                        await uploadDocs.mutateAsync({ filingId: filing.id, files: uploadFiles, documentType: uploadDocType });
                        toast.success(`${uploadFiles.length} file(s) uploaded`);
                        setUploadFiles([]);
                        setUploadDialogOpen(false);
                      } catch (err: any) {
                        toast.error(err.body?.error || err.message || 'Upload failed');
                      }
                    }}
                  >
                    {uploadDocs.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Upload
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        <div className="mt-3">
          {docsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : !docsData?.data?.length ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <p className="text-[13px] font-medium">No documents yet.</p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">Upload the bill of lading, invoice or packing list.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docsData.data.map((doc: any) => {
                const docTypeLabels: Record<string, string> = {
                  bol: 'Bill of Lading',
                  commercial_invoice: 'Commercial Invoice',
                  packing_list: 'Packing List',
                  other: 'Other',
                };
                const sizeKb = (doc.fileSizeBytes / 1024).toFixed(0);
                const sizeMb = (doc.fileSizeBytes / 1024 / 1024).toFixed(1);
                const sizeStr = doc.fileSizeBytes > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

                return (
                  <div key={doc.id} className="group flex items-center justify-between rounded-lg border border-border/60 p-3 transition-colors duration-150 can-hover:hover:bg-muted/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{doc.fileName}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {docTypeLabels[doc.documentType] || doc.documentType} · {sizeStr} ·{' '}
                          {doc.uploadedBy?.firstName} {doc.uploadedBy?.lastName} ·{' '}
                          {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:focus-within:opacity-100">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        title="Download"
                        disabled={downloadDoc.isPending}
                        onClick={() => downloadDoc.mutate({ filingId: filing.id, docId: doc.id })}
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete document?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{doc.fileName}" will be permanently deleted. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={async () => {
                                try {
                                  await deleteDoc.mutateAsync({ filingId: filing.id, docId: doc.id });
                                  toast.success('Document deleted');
                                } catch {
                                  toast.error('Failed to delete document');
                                }
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Status history: every change, newest first, in the status colours */}
      {filing.statusHistory && filing.statusHistory.length > 0 && (
        <section aria-label="Status history" className={PANEL}>
          <PanelTitle icon={Activity}>Status history</PanelTitle>
          <ol className="mt-3">
            {filing.statusHistory.map((h: any, i: number) => (
              <li key={h.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < filing.statusHistory!.length - 1 && <span aria-hidden className="absolute bottom-0 left-[5px] top-4 w-px bg-border" />}
                <span aria-hidden className={cn('relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-2 ring-card', FILL[statusOf(h.status).tone])} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <StatusPill status={h.status} />
                    <time dateTime={h.createdAt} className="ml-auto text-[12px] tabular-nums text-muted-foreground">{new Date(h.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                  </div>
                  {h.message && <p className="mt-1 text-[12.5px] text-muted-foreground">{h.message}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      </div>
    </div>
  );
}
