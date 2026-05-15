import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFiling, useSubmitFiling, useAmendFiling, useCancelFiling, useValidateFiling, useCheckFilingStatus, useDuplicateFiling, useSaveFilingAsTemplate, useFilingDocuments, useUploadDocuments, useDownloadDocument, useDeleteDocument, useExportPdf } from '@/hooks/useFilings';
import { useAbiDocumentsList } from '@/hooks/useAbiDocument';
import { useManifestQueries } from '@/hooks/useManifestQuery';
import { Filing, getPartyName, getFirstCommodity, ShipmentStatus } from '@/types/shipment';
import { StatusBadge } from '@/components/StatusBadge';
import { LifecycleWidget } from '@/components/LifecycleWidget';
import { PlanLimitModal } from '@/components/PlanLimitModal';
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
import { Separator } from '@/components/ui/separator';
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
  Pencil, RotateCcw, ArrowLeft, CheckCircle2, Circle, XCircle, Send, Loader2,
  FileEdit, Ban, Shield, AlertTriangle, Ship, Package, Globe, Anchor,
  Container, Users, FileText, Clock, ChevronRight, Zap, Activity,
  RefreshCw, Radio, Inbox, ArrowDownToLine, Copy, Bookmark, MoreHorizontal,
  Upload, Trash2, Paperclip, Search, FileCheck, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  const [planLimit, setPlanLimit] = useState<{ current: number; limit: number } | null>(null);

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

    // Small delay so user sees the success
    await new Promise(r => setTimeout(r, 600));

    // Steps 2+3: Submit (backend does CC create + CC send in one call)
    setCurrentStep('send_cc');
    updateStep('send_cc', { status: 'running', message: 'Preparing CBP filing document...' });

    try {
      const result = await submitFiling.mutateAsync(filing.id);

      // Filing document created
      updateStep('send_cc', {
        status: 'success',
        message: `Document created — Ref: ${result.ccFilingId || 'assigned'}`,
      });

      await new Promise(r => setTimeout(r, 400));

      // Step 3: Send to CBP (already happened in backend but show result)
      setCurrentStep('send_cbp');
      updateStep('send_cbp', {
        status: 'running',
        message: 'Transmitting to CBP...',
      });

      await new Promise(r => setTimeout(r, 500));

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

      // Plan-limit reached (HTTP 402) — surface upgrade modal
      if (body?.error === 'plan_limit_reached' && body?.usage) {
        setPlanLimit(body.usage);
        updateStep('send_cc', { status: 'idle' });
        updateStep('send_cbp', { status: 'idle' });
        setCurrentStep(null);
        setIsRunning(false);
        return;
      }

      // Determine which step failed
      if (body?.validationErrors) {
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
    { key: 'validate' as PipelineStep, label: 'Validate Fields', desc: 'Check all required fields and formats', icon: Shield },
    { key: 'send_cc' as PipelineStep, label: 'Create Filing', desc: 'Prepare document for CBP submission', icon: Zap },
    { key: 'send_cbp' as PipelineStep, label: 'Send to CBP', desc: 'Transmit filing to U.S. Customs', icon: Send },
  ];

  return (
    <>
    <PlanLimitModal open={planLimit !== null} onClose={() => setPlanLimit(null)} usage={planLimit ?? { current: 0, limit: 0 }} />
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Submission Pipeline</CardTitle>
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
            {isRunning ? 'Processing...' : 'Start Submission'}
          </Button>
        </div>
        <CardDescription>Validate, prepare, and transmit your filing to CBP</CardDescription>
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
              <CardTitle className="text-base font-semibold">CBP Response Status</CardTitle>
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

// ─── Main Component ────────────────────────────────────────

export default function ShipmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: filing, isLoading, isError, refetch } = useFiling(id);
  const amendFiling = useAmendFiling();
  const cancelFiling = useCancelFiling();
  const submitFiling = useSubmitFiling();
  const duplicateFiling = useDuplicateFiling();
  const saveAsTemplate = useSaveFilingAsTemplate();
  const [cancelReason, setCancelReason] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [planLimit, setPlanLimit] = useState<{ current: number; limit: number } | null>(null);
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
  const { data: abiListData } = useAbiDocumentsList({ take: 100 });
  const { data: mqListData } = useManifestQueries({ limit: 50 });
  const uploadDocs = useUploadDocuments();
  const downloadDoc = useDownloadDocument();
  const deleteDoc = useDeleteDocument();
  const exportPdf = useExportPdf();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadDocType, setUploadDocType] = useState('bol');

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1200px] mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !filing) {
    return (
      <div className="text-center py-16">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">Filing not found</p>
        <Button variant="link" asChild className="mt-2"><Link to="/shipments">Back to filings</Link></Button>
      </div>
    );
  }

  const commodity = getFirstCommodity(filing);

  const handleResubmit = async () => {
    try {
      await submitFiling.mutateAsync(filing.id);
      toast.success('Filing resubmitted successfully!');
    } catch (err: any) {
      const body = err.body || err;
      if (body?.error === 'plan_limit_reached' && body?.usage) {
        setPlanLimit(body.usage);
        return;
      }
      if (body?.validationErrors && Array.isArray(body.validationErrors)) {
        const count = body.validationErrors.length;
        toast.error(`Submission failed: ${count} validation error(s). Please review and fix the issues.`, { duration: 8000 });
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

  // Timeline
  const timeline = [
    { label: 'Created', date: filing.createdAt, icon: Circle, done: true },
    { label: 'Submitted', date: filing.submittedAt, icon: Send, done: !!filing.submittedAt },
    ...(filing.status === 'rejected'
      ? [{ label: 'Rejected', date: filing.rejectedAt, icon: XCircle, done: true }]
      : [{ label: 'Accepted', date: filing.acceptedAt, icon: CheckCircle2, done: !!filing.acceptedAt }]),
  ];

  const isISF5 = filing.filingType === 'ISF-5';
  const isf5 = (filing as any).isf5Data ?? {};

  const sections = isISF5 ? [
    { title: 'ISF Filer & Booking Party', icon: Users, items: [
      ['ISF Filer', isf5.ISFFilerName || filing.importerName || ''],
      ['Filer EIN', isf5.ISFFilerNumber || filing.importerNumber || ''],
      ['Booking Party', isf5.bookingPartyName || ''],
      ['Booking Party Country', isf5.bookingPartyCountry || ''],
      ['Bond Holder ID', isf5.bondHolderID || ''],
    ]},
    { title: 'Parties', icon: Users, items: [
      ['Ship-to Party', getPartyName(filing.shipToParty)],
      ['Manufacturer', getPartyName(filing.manufacturer)],
    ]},
    { title: 'Shipment Info', icon: Ship, items: [
      ['Master BOL', filing.masterBol || ''],
      ['House BOL', filing.houseBol || ''],
      ['US Port of Arrival', isf5.USPortOfArrival || filing.foreignPortOfUnlading || ''],
      ['Bond Type', filing.bondType || ''],
      ['Est. Arrival', filing.estimatedArrival ? new Date(filing.estimatedArrival).toLocaleDateString() : ''],
    ]},
    { title: 'Product Info', icon: Package, items: [
      ['HTS Code', commodity.htsCode],
      ['Country of Origin', commodity.countryOfOrigin],
      ['Description', commodity.description],
    ]},
  ] : [
    { title: 'Parties', icon: Users, items: [
      ['Manufacturer', getPartyName(filing.manufacturer)],
      ['Seller', getPartyName(filing.seller)],
      ['Buyer', getPartyName(filing.buyer)],
      ['Ship-to Party', getPartyName(filing.shipToParty)],
      ['Importer', filing.importerName || ''],
      ['Consignee', filing.consigneeName || ''],
    ]},
    { title: 'Shipment Info', icon: Ship, items: [
      ['Master BOL', filing.masterBol || ''],
      ['House BOL', filing.houseBol || ''],
      ['Vessel Name', filing.vesselName || ''],
      ['Voyage Number', filing.voyageNumber || ''],
      ['SCAC Code', filing.scacCode || ''],
      ['Foreign Port', filing.foreignPortOfUnlading || ''],
      ['Place of Delivery', filing.placeOfDelivery || ''],
    ]},
    { title: 'Product Info', icon: Package, items: [
      ['HTS Code', commodity.htsCode],
      ['Country of Origin', commodity.countryOfOrigin],
      ['Description', commodity.description],
    ]},
    { title: 'Logistics', icon: Globe, items: [
      ['Container Stuffing', getPartyName(filing.containerStuffingLocation)],
      ['Consolidator', getPartyName(filing.consolidator)],
      ['Bond Type', filing.bondType || ''],
      ['Est. Departure', filing.estimatedDeparture ? new Date(filing.estimatedDeparture).toLocaleDateString() : ''],
      ['Est. Arrival', filing.estimatedArrival ? new Date(filing.estimatedArrival).toLocaleDateString() : ''],
    ]},
  ];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <PlanLimitModal
        open={planLimit !== null}
        onClose={() => setPlanLimit(null)}
        usage={planLimit ?? { current: 0, limit: 0 }}
      />
      {/* Header */}
      <div className="flex items-center gap-3 opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link to="/shipments"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight">{filing.houseBol || filing.masterBol || filing.id.slice(0, 8)}</h1>
            <StatusBadge status={filing.status as ShipmentStatus} />
            {filing.ccFilingId && (
              <Badge variant="outline" className="text-[10px] font-mono">Ref: {filing.ccFilingId.slice(0, 12)}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filing.filingType} {'\u00b7'} {isISF5 ? (isf5.ISFFilerName || filing.importerName || 'Unknown filer') : (filing.importerName || 'Unknown importer')}
            {filing.createdAt && (
              <> {'\u00b7'} Created {new Date(filing.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {/* AI pre-flight review — surfaces UFLPA/PGA risks + rule-based issues
              + AI suggestions before submit. Available for any in-flight filing. */}
          {aiStatusQuery.data?.enabled
            && (['draft', 'submitted', 'pending_cbp', 'on_hold'] as const).includes(filing.status as any) && (
            <Button
              variant="outline"
              className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10"
              onClick={() => { setCoachMode('draft-review'); setCoachOpen(true); }}
            >
              <Sparkles className="h-4 w-4" /> AI Pre-Flight Review
            </Button>
          )}
          {(filing.status === 'draft' || filing.status === 'rejected') && (
            <Button variant="outline" className="gap-1.5" asChild>
              <Link to={`/shipments/${filing.id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
            </Button>
          )}
          {filing.status === 'rejected' && (
            <Button onClick={handleResubmit} disabled={submitFiling.isPending} className="gap-1.5">
              {submitFiling.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Resubmit
            </Button>
          )}
          {filing.status === 'accepted' && (
            <Button variant="outline" className="gap-1.5" onClick={handleAmend} disabled={amendFiling.isPending}>
              {amendFiling.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileEdit className="h-4 w-4" />}
              Amend
            </Button>
          )}

          {/* Check Manifest — look up cargo status at CBP */}
          {filing.masterBol && (
            <Button variant="outline" className="gap-1.5" asChild>
              <Link to={`/manifest-query?bol=${encodeURIComponent(filing.masterBol)}`}>
                <Search className="h-4 w-4" />
                Check Manifest
              </Link>
            </Button>
          )}

          {/* File Entry Documents — once ISF is accepted, file the
              7501 + 3461 entry. Server prefills IOR, consignee, MBOL,
              carrier, and bond from this filing. */}
          {filing.status === 'accepted' && (
            <Button variant="outline" className="gap-1.5" asChild>
              <Link to={`/abi-documents/new?fromShipment=${filing.id}`}>
                <FileCheck className="h-4 w-4" />
                File Entry Documents
              </Link>
            </Button>
          )}

          {/* More Actions Dropdown — Duplicate, Save Template, Cancel */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
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

      {/* Lifecycle widget — horizontal stage tracker (ISF · Manifest · Entry · Cleared) */}
      <div
        className="opacity-0 animate-fade-in-up motion-reduce:opacity-100 motion-reduce:animate-none"
        style={{ animationDelay: '60ms', animationFillMode: 'forwards' }}
      >
        <LifecycleWidget
          filing={filing}
          abiDocs={(abiListData?.data ?? []) as any}
          manifestQueries={((mqListData as any)?.data ?? []) as any}
        />
      </div>

      {/* Submission Pipeline — only for draft filings */}
      {filing.status === 'draft' && (
        <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
          <SubmissionPipeline filing={filing} onComplete={() => refetch()} />
        </div>
      )}

      {/* CBP Status Checker — for submitted filings awaiting CBP response */}
      {filing.status === 'submitted' && (
        <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
          <CBPStatusChecker filing={filing} onStatusUpdate={() => refetch()} />
        </div>
      )}

      {/* Timeline */}
      <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Timeline</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            {timeline.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                  step.done ? 'bg-muted/60' : 'opacity-50',
                )}>
                  <step.icon className={cn(
                    'h-4 w-4',
                    step.done
                      ? step.label === 'Rejected' ? 'text-red-500' : 'text-emerald-500'
                      : 'text-muted-foreground',
                  )} />
                  <div>
                    <p className="text-sm font-medium">{step.label}</p>
                    {step.date && <p className="text-[10px] text-muted-foreground tabular-nums">{new Date(step.date).toLocaleString()}</p>}
                  </div>
                </div>
                {i < timeline.length - 1 && (
                  <ChevronRight className={cn('h-4 w-4 shrink-0', step.done ? 'text-muted-foreground' : 'text-border')} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
              <Button size="sm" className="gap-1.5" onClick={handleResubmit} disabled={submitFiling.isPending}>
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

      {/* Data sections */}
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section, i) => (
          <Card key={section.title} className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${300 + i * 80}ms`, animationFillMode: 'forwards' }}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <section.icon className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {section.items.map(([label, value]) => (
                <div key={label as string} className="flex justify-between text-sm gap-4">
                  <span className="text-muted-foreground shrink-0">{label as string}</span>
                  <span className="font-medium text-right truncate">
                    {(value as string) || <span className="text-muted-foreground italic text-xs">Not provided</span>}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Commodities */}
      {filing.commodities && filing.commodities.length > 0 && (
        <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '620ms', animationFillMode: 'forwards' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Commodities ({filing.commodities.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filing.commodities.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                <div>
                  <p className="text-sm font-medium">{c.description || 'No description'}</p>
                  <p className="text-xs text-muted-foreground">HTS: {c.htsCode} \u00b7 Origin: {c.countryOfOrigin}</p>
                </div>
                {c.quantity && <span className="text-sm text-muted-foreground tabular-nums">Qty: {c.quantity}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Containers */}
      {filing.containers && filing.containers.length > 0 && (
        <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '700ms', animationFillMode: 'forwards' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Container className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Containers ({filing.containers.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filing.containers.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                <p className="text-sm font-medium font-mono">{c.number}</p>
                <p className="text-xs text-muted-foreground">{c.type} {c.sealNumber ? `\u00b7 Seal: ${c.sealNumber}` : ''}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Documents & Attachments */}
      <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '780ms', animationFillMode: 'forwards' }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Documents {docsData?.data?.length ? `(${docsData.data.length})` : ''}
              </CardTitle>
            </div>
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
        </CardHeader>
        <CardContent>
          {docsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : !docsData?.data?.length ? (
            <div className="text-center py-8">
              <Paperclip className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No documents attached</p>
              <p className="text-xs text-muted-foreground">Upload BOL copies, invoices, or packing lists</p>
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
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {docTypeLabels[doc.documentType] || doc.documentType} · {sizeStr} ·{' '}
                          {doc.uploadedBy?.firstName} {doc.uploadedBy?.lastName} ·{' '}
                          {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        </CardContent>
      </Card>

      {/* Status History */}
      {filing.statusHistory && filing.statusHistory.length > 0 && (
        <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '860ms', animationFillMode: 'forwards' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Status History</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filing.statusHistory.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge status={h.status as ShipmentStatus} />
                  {h.message && <span className="text-muted-foreground text-xs">{h.message}</span>}
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">{new Date(h.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
