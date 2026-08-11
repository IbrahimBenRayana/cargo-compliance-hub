/**
 * In-Bond (7512) detail page — filing summary, wire preview and the
 * lifecycle event timeline (arrive / export / transfer / divert).
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowLeftRight, CalendarClock, ChevronDown,
  ChevronRight, Loader2, MapPin, Pencil, Plus, ShieldCheck, Terminal, Trash2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useBuildInbond,
  useDeleteInbond,
  useInbondFiling,
  useRecordInbondEvent,
} from '@/hooks/useInbond';
import type {
  InbondEntryType,
  InbondEvent,
  InbondEventAction,
  InbondFiling,
  InbondIssue,
} from '@/api/client';
import {
  INBOND_ENTRY_TYPE_MAP,
  INBOND_EVENT_ACTION_MAP,
  eventActionsForEntryType,
} from '@/data/inbondEnums';
import { InbondStatusPill, InbondTypeBadge } from '@/pages/InbondListPage';
import { WirePreview } from '@/components/inbond/WirePreview';

const EDITABLE_STATUSES = new Set(['DRAFT', 'READY']);

function LabeledValue({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('text-sm', mono && 'font-mono')}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

function eventLabel(action: InbondEventAction): string {
  const meta = INBOND_EVENT_ACTION_MAP[action];
  if (!meta) return action;
  return meta.scope ? `${meta.label} — ${meta.scope}` : meta.label;
}

// ─── Event timeline entry ────────────────────────────────────

function EventRow({ event, isLast }: { event: InbondEvent; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = INBOND_EVENT_ACTION_MAP[event.action];
  const payload = event.payload ?? {};
  const dotClass =
    meta?.group === 'arrive'
      ? 'bg-emerald-500'
      : meta?.group === 'export'
        ? 'bg-emerald-500'
        : meta?.group === 'transfer'
          ? 'bg-amber-500'
          : 'bg-indigo-500';

  const contextBits: string[] = [];
  if (typeof payload.port === 'string') contextBits.push(`port ${payload.port}`);
  if (typeof payload.firmsCode === 'string') contextBits.push(`FIRMS ${payload.firmsCode}`);
  if (typeof payload.billIssuerCode === 'string' && typeof payload.billNumber === 'string') {
    contextBits.push(`bill ${payload.billIssuerCode}${payload.billNumber}`);
  }
  if (typeof payload.containerNumber === 'string') contextBits.push(`container ${payload.containerNumber}`);
  if (typeof payload.inBondCarrierCode === 'string') contextBits.push(`to carrier ${payload.inBondCarrierCode}`);
  if (typeof payload.cityName === 'string') {
    contextBits.push(`${payload.cityName}${typeof payload.stateCode === 'string' ? `, ${payload.stateCode}` : ''}`);
  }

  return (
    <div className="flex gap-3">
      {/* Timeline gutter */}
      <div className="flex flex-col items-center">
        <span className={cn('h-2.5 w-2.5 rounded-full mt-1.5 shrink-0', dotClass)} />
        {!isLast && <span className="w-px flex-1 bg-border mt-1" />}
      </div>
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">{eventLabel(event.action)}</p>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {event.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Occurred {format(new Date(event.occurredAt), 'MMM d, yyyy HH:mm')}
          {contextBits.length > 0 && <> · {contextBits.join(' · ')}</>}
        </p>
        {event.wireText && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Wire preview
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2">
                <WirePreview text={event.wireText} maxHeight={160} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

// ─── Record-event dialog ─────────────────────────────────────

interface EventForm {
  action: InbondEventAction | '';
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  port: string;
  firmsCode: string;
  billIssuerCode: string;
  billNumber: string;
  containerNumber: string;
  inBondCarrierCode: string;
  bondedCarrierId: string;
  cityName: string;
  stateCode: string;
}

const EMPTY_EVENT_FORM: EventForm = {
  action: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: format(new Date(), 'HH:mm'),
  port: '',
  firmsCode: '',
  billIssuerCode: '',
  billNumber: '',
  containerNumber: '',
  inBondCarrierCode: '',
  bondedCarrierId: '',
  cityName: '',
  stateCode: '',
};

function RecordEventDialog({
  filing,
  open,
  onOpenChange,
}: {
  filing: InbondFiling;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<EventForm>(EMPTY_EVENT_FORM);
  const [issues, setIssues] = useState<InbondIssue[] | null>(null);
  const recordEvent = useRecordInbondEvent();

  const actions = eventActionsForEntryType(filing.entryType);
  const meta = form.action ? INBOND_EVENT_ACTION_MAP[form.action] : undefined;

  const isArrive = meta?.group === 'arrive';
  const isDivert = meta?.group === 'divert';
  const isTransfer = meta?.group === 'transfer';
  const needsBill = form.action === '2' || form.action === '3' || form.action === '6' || form.action === '7';
  const needsContainer = form.action === '3' || form.action === '7';

  const set = (patch: Partial<EventForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setIssues(null);
  };

  const reset = () => {
    setForm({ ...EMPTY_EVENT_FORM, date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });
    setIssues(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!form.action || !form.date) {
      toast.error('Choose an action and the date it occurred');
      return;
    }
    setIssues(null);
    const occurred = new Date(`${form.date}T${form.time || '00:00'}`);
    const payload: Record<string, unknown> = {};
    if (isArrive || isDivert) payload.port = form.port || undefined;
    if (isArrive) payload.firmsCode = form.firmsCode || undefined;
    if (needsBill) {
      payload.billIssuerCode = form.billIssuerCode || undefined;
      payload.billNumber = form.billNumber || undefined;
    }
    if (needsContainer) payload.containerNumber = form.containerNumber || undefined;
    if (isTransfer) {
      payload.inBondCarrierCode = form.inBondCarrierCode || undefined;
      payload.bondedCarrierId = form.bondedCarrierId || undefined;
      payload.cityName = form.cityName || undefined;
      payload.stateCode = form.stateCode || undefined;
    }
    if (isDivert) payload.bondedCarrierId = form.bondedCarrierId || undefined;

    try {
      await recordEvent.mutateAsync({
        id: filing.id,
        body: {
          action: form.action,
          occurredAt: occurred.toISOString(),
          payload,
        },
      });
      toast.success('Event recorded');
      handleOpenChange(false);
    } catch (err: any) {
      const engineIssues: InbondIssue[] | undefined = err?.body?.issues;
      if (err?.status === 422 && Array.isArray(engineIssues)) {
        setIssues(engineIssues);
      } else if (err?.status === 429) {
        toast.error('Please wait a moment before trying again');
      } else {
        toast.error(err?.body?.error || err?.message || 'Failed to record event');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record lifecycle event</DialogTitle>
          <DialogDescription>
            Report what physically happened to the cargo — CBP expects each in-bond to be
            closed out with the right event for its movement type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Action<span className="text-destructive ml-0.5">*</span>
            </Label>
            <Select
              value={form.action}
              onValueChange={(v) => set({ action: v as InbondEventAction })}
            >
              <SelectTrigger>
                <SelectValue placeholder="What happened?" />
              </SelectTrigger>
              <SelectContent>
                {actions.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.scope ? `${a.label} — entire ${a.scope === 'in-bond' ? 'in-bond' : a.scope}` : a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {filing.entryType === '61' && 'An IT (61) only needs an arrival at the destination port.'}
              {filing.entryType === '62' && 'A T&E (62) needs an arrival at the export port, then an export.'}
              {filing.entryType === '63' && 'An IE (63) only needs an export.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Date occurred<span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Time</Label>
              <Input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
            </div>
          </div>

          {(isArrive || isDivert) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {isDivert ? 'New destination port' : 'Port of arrival'}
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                className="font-mono"
                placeholder="e.g. 2704"
                maxLength={4}
                value={form.port}
                onChange={(e) => set({ port: e.target.value.replace(/[^0-9]/g, '') })}
              />
              <p className="text-[11px] text-muted-foreground">
                {isDivert
                  ? 'The 4-digit Schedule D code of the port the cargo is now moving to.'
                  : 'The 4-digit Schedule D code of the port where the cargo arrived.'}
              </p>
            </div>
          )}

          {isArrive && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                FIRMS code<span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                className="font-mono uppercase"
                placeholder="e.g. E123"
                value={form.firmsCode}
                onChange={(e) => set({ firmsCode: e.target.value.toUpperCase() })}
              />
              <p className="text-[11px] text-muted-foreground">
                The CBP facility code of the arrival location (not needed for air).
              </p>
            </div>
          )}

          {needsBill && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Bill issuer<span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  className="font-mono uppercase"
                  placeholder="SCAC"
                  value={form.billIssuerCode}
                  onChange={(e) => set({ billIssuerCode: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Bill number<span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  className="font-mono"
                  placeholder="Bill number"
                  value={form.billNumber}
                  onChange={(e) => set({ billNumber: e.target.value })}
                />
              </div>
            </div>
          )}

          {needsContainer && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Container number<span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                className="font-mono uppercase"
                placeholder="e.g. MSKU1234567"
                value={form.containerNumber}
                onChange={(e) => set({ containerNumber: e.target.value.toUpperCase() })}
              />
            </div>
          )}

          {isTransfer && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    New carrier (SCAC)<span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <Input
                    className="font-mono uppercase"
                    placeholder="e.g. MAEU"
                    maxLength={4}
                    value={form.inBondCarrierCode}
                    onChange={(e) => set({ inBondCarrierCode: e.target.value.toUpperCase() })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    The 4-letter code of the carrier assuming liability.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Bonded carrier ID<span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <Input
                    className="font-mono"
                    placeholder="IRS / CBP number"
                    value={form.bondedCarrierId}
                    onChange={(e) => set({ bondedCarrierId: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    City<span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <Input
                    placeholder="Where the transfer occurs"
                    value={form.cityName}
                    onChange={(e) => set({ cityName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    State<span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <Input
                    className="uppercase"
                    placeholder="e.g. CA"
                    maxLength={2}
                    value={form.stateCode}
                    onChange={(e) => set({ stateCode: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            </>
          )}

          {isDivert && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Bonded carrier ID<span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                className="font-mono"
                placeholder="IRS / CBP number"
                value={form.bondedCarrierId}
                onChange={(e) => set({ bondedCarrierId: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                The bonded carrier liable for the movement to the new port.
              </p>
            </div>
          )}

          {issues && issues.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>The event is not valid for this in-bond</AlertTitle>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={recordEvent.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={recordEvent.isPending || !form.action}>
            {recordEvent.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording…
              </>
            ) : (
              'Record event'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ───────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-60 w-full" />
    </div>
  );
}

export default function InbondDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useInbondFiling(id);
  const buildMut = useBuildInbond();
  const deleteMut = useDeleteInbond();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [wireOpen, setWireOpen] = useState(false);
  const [buildIssues, setBuildIssues] = useState<InbondIssue[] | null>(null);

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data?.filing) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link to="/inbond">
            <ArrowLeft className="h-4 w-4" />
            Back to in-bond movements
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load filing</AlertTitle>
          <AlertDescription>
            {(error as any)?.message ?? 'The requested in-bond filing could not be loaded.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const filing = data.filing;
  const payload = filing.payload ?? {};
  const events = filing.events ?? [];
  const typeMeta = INBOND_ENTRY_TYPE_MAP[filing.entryType as InbondEntryType];
  const editable = EDITABLE_STATUSES.has(filing.status);
  const isDraft = filing.status === 'DRAFT';

  const handleBuild = async () => {
    setBuildIssues(null);
    try {
      await buildMut.mutateAsync(filing.id);
      toast.success('Filing validated — queued as Ready for transmission');
    } catch (err: any) {
      const engineIssues: InbondIssue[] | undefined = err?.body?.issues;
      if (err?.status === 422 && Array.isArray(engineIssues)) {
        setBuildIssues(engineIssues);
        toast.error('The filing has validation issues');
      } else if (err?.status === 429) {
        toast.error('Please wait a moment before trying again');
      } else {
        toast.error(err?.body?.error || err?.message || 'Validation failed');
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync(filing.id);
      toast.success('In-bond filing deleted');
      navigate('/inbond');
    } catch (err: any) {
      if (err?.status === 429) {
        toast.error('Please wait a moment before trying again');
      } else {
        toast.error(err?.body?.error || err?.message || 'Failed to delete filing');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Back link */}
      <div className="opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
          <Link to="/inbond">
            <ArrowLeft className="h-4 w-4" />
            Back to in-bond movements
          </Link>
        </Button>
      </div>

      {/* Header + action bar */}
      <div
        className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 opacity-0 animate-fade-in-up"
        style={{ animationFillMode: 'forwards', animationDelay: '20ms' }}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
            <ArrowLeftRight className="h-5 w-5 text-teal-500" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight">
                {filing.inbondNumber ? `In-Bond #${filing.inbondNumber}` : 'Draft In-Bond'}
              </h1>
              <InbondTypeBadge entryType={filing.entryType} />
              <InbondStatusPill status={filing.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Created {formatDistanceToNow(new Date(filing.createdAt), { addSuffix: true })}
              {filing.updatedAt !== filing.createdAt &&
                ` · updated ${formatDistanceToNow(new Date(filing.updatedAt), { addSuffix: true })}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {editable && (
            <>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => navigate(`/inbond/${filing.id}/edit`)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </>
          )}
          {isDraft && (
            <Button className="gap-1.5" onClick={handleBuild} disabled={buildMut.isPending}>
              {buildMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validating…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Validate &amp; build
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Build issues */}
      {buildIssues && buildIssues.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {buildIssues.length} issue{buildIssues.length === 1 ? '' : 's'} to fix before this
            filing can transmit
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1.5">
              {buildIssues.map((issue, i) => (
                <li key={i} className="text-xs flex gap-2">
                  <code className="font-mono shrink-0 bg-destructive/10 px-1 py-0.5 rounded">
                    {issue.field}
                  </code>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
            {editable && (
              <Button
                variant="link"
                size="sm"
                className="px-0 mt-1 text-destructive"
                onClick={() => navigate(`/inbond/${filing.id}/edit`)}
              >
                Fix in the wizard
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Lifecycle explainer strip */}
      {typeMeta && (
        <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 text-xs text-teal-700 dark:text-teal-300 px-3 py-2.5 flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">
              {typeMeta.code} ({typeMeta.value}) lifecycle:
            </span>{' '}
            {typeMeta.lifecycle}
          </span>
        </div>
      )}

      {/* Summary grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Movement</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <LabeledValue label="Type" value={typeMeta ? `${typeMeta.value} · ${typeMeta.label}` : filing.entryType} />
            <LabeledValue label="In-Bond Number" value={filing.inbondNumber} mono />
            <LabeledValue label="Carrier (SCAC)" value={filing.carrierCode} mono />
            <LabeledValue label="Bonded Carrier ID" value={payload.bondedCarrierId} mono />
            <LabeledValue label="US Destination Port" value={filing.portOfDestination} mono />
            {filing.entryType !== '61' && (
              <LabeledValue label="Foreign Destination" value={payload.portOfForeignDestination} mono />
            )}
            <LabeledValue
              label="Value"
              value={payload.valueDollars != null ? `$${payload.valueDollars.toLocaleString()}` : null}
            />
            <LabeledValue label="FTZ Withdrawal" value={payload.ftzWithdrawal ? 'Yes' : 'No'} />
            <LabeledValue label="BTA Indicator" value={payload.btaIndicator} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bills of lading</CardTitle>
            <CardDescription>{(payload.bills ?? []).length} bill{(payload.bills ?? []).length === 1 ? '' : 's'} on this in-bond</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(payload.bills ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No bills added yet.</p>
            )}
            {(payload.bills ?? []).map((bill, i) => {
              const containerCount = bill.details?.containers?.length ?? 0;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <span className="font-mono text-xs truncate">
                    {(bill.issuerCode ?? '')}{bill.billNumber ?? '—'}
                    {bill.houseBillNumber ? ` / ${bill.houseBillNumber}` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {bill.details
                      ? `Full details · ${containerCount} ctr${containerCount === 1 ? '' : 's'}`
                      : 'On file'}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Wire preview */}
      {filing.wireText && (
        <Card>
          <Collapsible open={wireOpen} onOpenChange={setWireOpen}>
            <CollapsibleTrigger asChild>
              <button type="button" className="w-full text-left hover:bg-muted/40 transition-colors">
                <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    {wireOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-muted-foreground" />
                        CBP wire preview
                      </CardTitle>
                      <CardDescription className="text-xs">
                        The exact CATAIR records that will be transmitted
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <WirePreview text={filing.wireText} />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Lifecycle timeline */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              Lifecycle
            </CardTitle>
            <CardDescription className="text-xs">
              Arrivals, exports, liability transfers and diversions recorded against this in-bond
            </CardDescription>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowEventDialog(true)}>
            <Plus className="h-4 w-4" />
            Record event
          </Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2 text-center">
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No events recorded yet.</p>
              <p className="text-xs text-muted-foreground max-w-md">
                {typeMeta
                  ? typeMeta.lifecycle
                  : 'Record what happens to the cargo as it moves.'}
              </p>
              <Button variant="link" size="sm" onClick={() => setShowEventDialog(true)}>
                Record the first event
              </Button>
            </div>
          ) : (
            <div className="pt-1">
              {events.map((event, i) => (
                <EventRow key={event.id} event={event} isLast={i === events.length - 1} />
              ))}
            </div>
          )}
          <Separator className="my-3" />
          <p className="text-[11px] text-muted-foreground">
            Events queue alongside the filing and transmit to CBP once the direct ABI
            connection is live.
          </p>
        </CardContent>
      </Card>

      {/* Record event dialog */}
      <RecordEventDialog
        filing={filing}
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
      />

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete in-bond filing?</AlertDialogTitle>
            <AlertDialogDescription>
              This filing and any recorded events will be permanently removed. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
