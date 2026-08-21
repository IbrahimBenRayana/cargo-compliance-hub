import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Loader2, ChevronDown, Copy, Radio, Settings2, AlertTriangle,
  Zap, FileWarning, Save,
} from 'lucide-react';
import { certApi } from '@/api/client';
import type {
  CertParamsInput, CertScenario, CertTransmission, CertTransmissionStatus,
} from '@/api/client';
import { toast } from 'sonner';

// ─── Status presentation ────────────────────────────────────
const STATUS_META: Record<CertTransmissionStatus, { label: string; className: string }> = {
  generated: {
    label: 'Generated',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  transmitted: {
    label: 'Transmitted',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  accepted: {
    label: 'Accepted',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  conditional: {
    label: 'Conditional',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  rejected_clientside: {
    label: 'Client reject',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
};

const ALL_STATUSES: CertTransmissionStatus[] = [
  'generated', 'rejected_clientside', 'transmitted', 'accepted', 'rejected', 'conditional',
];

function StatusBadge({ status }: { status: CertTransmissionStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant="secondary" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>;
}

function formatDateTime(ts: string | null | undefined) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function apiErrorMessage(err: any, fallback: string): string {
  const base: string = err?.body?.error || err?.message || fallback;
  const issues = err?.body?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    const first = issues
      .slice(0, 3)
      .map((i: any) =>
        typeof i === 'string' ? i : [i?.field, i?.message].filter(Boolean).join(': ') || JSON.stringify(i))
      .join('; ');
    return `${base} — ${first}${issues.length > 3 ? ` (+${issues.length - 3} more)` : ''}`;
  }
  return base;
}

// ─── CERT parameters card ──────────────────────────────────
const PARAM_FIELDS: { key: keyof CertParamsInput; label: string; placeholder?: string }[] = [
  { key: 'filerCode', label: 'Filer code', placeholder: 'ZZZ' },
  { key: 'importerOfRecordNumber', label: 'Importer of record #' },
  { key: 'importerName', label: 'Importer name' },
  { key: 'consigneeNumber', label: 'Consignee #' },
  { key: 'suretyCompanyCode', label: 'Surety company code' },
  { key: 'districtPortOfEntry', label: 'District/port of entry', placeholder: '4-digit port' },
  { key: 'currentYear', label: 'Current year', placeholder: 'YYYY' },
  { key: 'applicabilityDate', label: 'Applicability date', placeholder: 'YYYYMMDD' },
  { key: 'senderSiteCode', label: 'Sender site code' },
  { key: 'senderIdCode', label: 'Sender ID code' },
  { key: 'senderPassword', label: 'Sender password' },
];

const EMPTY_PARAMS: CertParamsInput = {
  filerCode: '', importerOfRecordNumber: '', importerName: '', consigneeNumber: '',
  suretyCompanyCode: '', districtPortOfEntry: '', currentYear: '', applicabilityDate: '',
  senderSiteCode: '', senderIdCode: '', senderPassword: '',
};

function ParamsCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CertParamsInput>(EMPTY_PARAMS);

  const { data, isLoading } = useQuery({
    queryKey: ['cert', 'params'],
    queryFn: () => certApi.params(),
  });

  // Sync the form whenever fresh params arrive from the server.
  useEffect(() => {
    if (!data?.params) return;
    const next = { ...EMPTY_PARAMS };
    for (const f of PARAM_FIELDS) next[f.key] = data.params[f.key] ?? '';
    setForm(next);
  }, [data]);

  const save = useMutation({
    mutationFn: (body: CertParamsInput) => certApi.updateParams(body),
    onSuccess: () => {
      toast.success('CERT parameters saved');
      queryClient.invalidateQueries({ queryKey: ['cert', 'params'] });
    },
    onError: (err: any) => toast.error(apiErrorMessage(err, 'Failed to save parameters')),
  });

  const setField = (key: keyof CertParamsInput, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const filerIsPlaceholder = (data?.params?.filerCode ?? '').toUpperCase() === 'ZZZ';

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-lg">CERT parameters</CardTitle>
                {filerIsPlaceholder && (
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    filer code ZZZ — placeholder, awaiting CBP filer code
                  </Badge>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
            <CardDescription>
              Shared inputs every scenario is generated with — filer code, importer, sender credentials.
              {data?.params?.updatedAt && ` Last saved ${formatDateTime(data.params.updatedAt)}.`}
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading parameters…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PARAM_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-2">
                      <Label htmlFor={`cert-param-${f.key}`}>{f.label}</Label>
                      <Input
                        id={`cert-param-${f.key}`}
                        placeholder={f.placeholder}
                        value={form[f.key]}
                        onChange={(e) => setField(f.key, e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
                    {save.isPending
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Save className="mr-2 h-4 w-4" />}
                    Save parameters
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ─── Wire text block with copy ─────────────────────────────
function WireTextBlock({ text, label }: { text: string; label: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error('Copy failed — clipboard unavailable');
    }
  };
  return (
    <div className="relative">
      <Button
        size="sm"
        variant="secondary"
        className="absolute right-2 top-2 h-7 px-2 z-10"
        onClick={handleCopy}
      >
        <Copy className="h-3.5 w-3.5 mr-1" />
        Copy
      </Button>
      <pre className="rounded-md border bg-muted/50 p-3 pr-20 text-xs font-mono whitespace-pre overflow-x-auto max-h-64 overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}

// ─── Transport status + live response drain ────────────────
// The transport is mock (loopback rehearsal) or mqipt (live CBP CERT via
// the mq-bridge sidecar). Transmissions are real filings on mqipt, so the
// kind is surfaced prominently; the drain button pulls waiting response
// batches off the queue for pasting into their transmission.
function TransportCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['cert', 'transport'],
    queryFn: () => certApi.transport(),
    refetchInterval: 60_000,
  });
  const [batches, setBatches] = useState<string[][] | null>(null);
  const receive = useMutation({
    mutationFn: () => certApi.receiveResponses(8000),
    onSuccess: (result) => {
      setBatches(result.batches);
      if (result.batches.length === 0) {
        toast.info('No responses waiting on the queue');
      } else {
        toast.success(`${result.batches.length} response batch${result.batches.length === 1 ? '' : 'es'} received`);
      }
    },
    onError: (err: any) => toast.error(apiErrorMessage(err, 'Failed to check the response queue')),
  });

  const live = data?.transport === 'mqipt';
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Transport</CardTitle>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : data ? (
              <>
                <Badge
                  className={
                    live
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }
                >
                  {live ? 'MQIPT — live CBP CERT' : 'Mock loopback'}
                </Badge>
                <Badge variant={data.ok ? 'secondary' : 'destructive'} className="text-[10px]">
                  {data.ok ? (data.detail ?? 'healthy') : (data.detail ?? 'unhealthy')}
                </Badge>
              </>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => receive.mutate()}
            disabled={receive.isPending || !data?.ok}
          >
            {receive.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Radio className="h-3.5 w-3.5 mr-1.5" />
            )}
            Check for responses
          </Button>
        </div>
        {live && (
          <CardDescription>
            Transmissions go to CBP for real. Responses pulled here are audit-logged — copy each
            batch into its transmission's CBP response box below.
          </CardDescription>
        )}
      </CardHeader>
      {batches !== null && batches.length > 0 && (
        <CardContent className="space-y-3">
          {batches.map((batch, i) => (
            <WireTextBlock key={i} text={batch.join('\n')} label={`Response batch ${i + 1}`} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Background data: manufacturer add ($I) ────────────────
// Scenario manufacturers don't exist in CERT until added — AE filings
// bounce with F523 MFGR CODE UNKNOWN. The server refuses the batch if the
// firm details don't derive the expected MID (Directive 3500-13 check).
function AmfCard() {
  const [form, setForm] = useState({
    name: '', street: '', city: '', countryCode: '', expectedMid: '',
  });
  const [lastResult, setLastResult] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () =>
      certApi.addManufacturer({
        name: form.name,
        street: form.street || undefined,
        city: form.city,
        countryCode: form.countryCode,
        expectedMid: form.expectedMid || undefined,
      }),
    onSuccess: (r) => {
      setLastResult(`MID ${r.mid} transmitted via ${r.transport} — MQ message ${r.messageId.slice(0, 16)}…  Check for responses for the $R confirmation.`);
      toast.success(`Manufacturer batch sent (${r.mid})`);
    },
    onError: (err: any) => toast.error(apiErrorMessage(err, 'Manufacturer add failed')),
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const complete = form.name && form.city && form.countryCode.length === 2;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Background data — add manufacturer (MID)</CardTitle>
        <CardDescription>
          Adds the firm to ACE CERT's manufacturer file via a $I batch. Fill the firm details;
          the expected MID (from the scenario) guards against derivation mismatches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1"><Label className="text-xs">Firm name</Label>
            <Input value={form.name} onChange={set('name')} placeholder="SIGMA PRINTERS PTE LTD" /></div>
          <div className="space-y-1"><Label className="text-xs">Street</Label>
            <Input value={form.street} onChange={set('street')} placeholder="123 ORCHARD ROAD" /></div>
          <div className="space-y-1"><Label className="text-xs">City</Label>
            <Input value={form.city} onChange={set('city')} placeholder="SINGAPORE" /></div>
          <div className="space-y-1"><Label className="text-xs">Country (ISO-2)</Label>
            <Input value={form.countryCode} onChange={set('countryCode')} placeholder="SG" maxLength={2} /></div>
          <div className="space-y-1"><Label className="text-xs">Expected MID</Label>
            <Input value={form.expectedMid} onChange={set('expectedMid')} placeholder="SGSIGPRI123SIN" className="font-mono" /></div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => send.mutate()} disabled={!complete || send.isPending}>
            {send.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
            Send $I batch to CBP
          </Button>
          {lastResult && <span className="text-xs text-muted-foreground">{lastResult}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Background data: HTS query (HA/HY) ────────────────────
// CERT's HTS table can diverge from the published tariff (live F642/F434
// evidence). This asks ACE's own table what it considers valid — validity
// window + required units per number — so filings match CERT's reality.
function HtsQueryCard() {
  const [numbers, setNumbers] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof certApi.htsQuery>> | null>(null);
  const query = useMutation({
    mutationFn: () =>
      certApi.htsQuery(
        numbers.split(/[\s,]+/).map((n) => n.trim()).filter((n) => /^\d{8,10}$/.test(n)),
      ),
    onSuccess: (r) => {
      setResult(r);
      if (r.note) toast.info(r.note);
      else toast.success('CERT HTS answers received');
    },
    onError: (err: any) => toast.error(apiErrorMessage(err, 'HTS query failed')),
  });
  const valid = numbers.split(/[\s,]+/).some((n) => /^\d{8,10}$/.test(n.trim()));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Background data — query CERT's HTS table (HA)</CardTitle>
        <CardDescription>
          Asks ACE's own tariff file which numbers it accepts, their validity dates, and required
          units. Space- or comma-separated 8–10 digit numbers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-3">
          <Input
            value={numbers}
            onChange={(e) => setNumbers(e.target.value)}
            placeholder="8443992050 99990084 99030125"
            className="font-mono"
          />
          <Button size="sm" onClick={() => query.mutate()} disabled={!valid || query.isPending}>
            {query.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
            Query CERT
          </Button>
        </div>
        {result?.parsed && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queried</TableHead>
                <TableHead>CERT says</TableHead>
                <TableHead>Valid from</TableHead>
                <TableHead>Valid to</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.parsed.queries.flatMap((q) =>
                q.tariffs.length === 0 ? (
                  <TableRow key={q.fromTariffNumber}>
                    <TableCell className="font-mono text-xs">{q.fromTariffNumber}</TableCell>
                    <TableCell colSpan={5} className="text-xs text-destructive">{q.narrativeMessage || 'no data returned'}</TableCell>
                  </TableRow>
                ) : (
                  q.tariffs.map((t) => (
                    <TableRow key={`${q.fromTariffNumber}-${t.tariffNumber}`}>
                      <TableCell className="font-mono text-xs">{q.fromTariffNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{t.tariffNumber}</TableCell>
                      <TableCell className="text-xs">{t.beginEffectiveDate ?? '—'}</TableCell>
                      <TableCell className="text-xs">{t.endEffectiveDate ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{t.unitsOfMeasure.join(' ') || '—'}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{t.commodityDescription ?? ''}</TableCell>
                    </TableRow>
                  ))
                ),
              )}
            </TableBody>
          </Table>
        )}
        {result && !result.parsed && result.raw.length > 0 && (
          <WireTextBlock text={result.raw.map((b) => b.join('\n')).join('\n\n')} label="Raw response" />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Single transmission card (detail sheet) ───────────────
function TransmissionCard({
  transmission,
  scenarioId,
  isLatest,
}: {
  transmission: CertTransmission;
  scenarioId: string;
  isLatest: boolean;
}) {
  const queryClient = useQueryClient();
  const [responseDraft, setResponseDraft] = useState(transmission.responseText ?? '');
  const [notesDraft, setNotesDraft] = useState(transmission.notes ?? '');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedOpen, setParsedOpen] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['cert', 'transmissions', scenarioId] });
    queryClient.invalidateQueries({ queryKey: ['cert', 'scenarios'] });
  };

  const update = useMutation({
    mutationFn: (body: { status?: CertTransmissionStatus; responseText?: string; notes?: string }) =>
      certApi.updateTransmission(transmission.id, body),
  });

  const { data: transportInfo } = useQuery({
    queryKey: ['cert', 'transport'],
    queryFn: () => certApi.transport(),
    refetchInterval: 60_000,
  });

  const transmit = useMutation({
    mutationFn: () => certApi.transmit(transmission.id),
    onSuccess: (result) => {
      toast.success(`Transmitted via ${result.transport} — MQ message ${result.messageId.slice(0, 16)}…`);
      refresh();
    },
    onError: (err: any) => toast.error(apiErrorMessage(err, 'Transmit failed')),
  });

  const handleTransmit = () => {
    const live = transportInfo?.transport === 'mqipt';
    const ok = window.confirm(
      live
        ? 'Send this batch to CBP CERT for real (transport: mqipt)?'
        : 'Send this batch through the mock loopback transport?'
    );
    if (ok) transmit.mutate();
  };

  const handleStatusChange = async (status: CertTransmissionStatus) => {
    try {
      await update.mutateAsync({ status });
      toast.success(`Status set to ${STATUS_META[status].label}`);
      refresh();
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Failed to update status'));
    }
  };

  const handleParseSave = async () => {
    try {
      const result = await update.mutateAsync({ responseText: responseDraft });
      setParseError(result.parseError ?? null);
      if (result.parseError) {
        toast.warning('Response saved, but parsing failed — see the error below.');
      } else {
        toast.success('Response saved and parsed');
        setParsedOpen(true);
      }
      refresh();
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Failed to save response'));
    }
  };

  const handleNotesSave = async () => {
    try {
      await update.mutateAsync({ notes: notesDraft });
      toast.success('Notes saved');
      refresh();
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Failed to save notes'));
    }
  };

  const hasParsed = transmission.responseParsed !== null && transmission.responseParsed !== undefined;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      {/* Header row: created + status select */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={transmission.status} />
          {isLatest && <Badge variant="outline" className="text-[10px]">Latest</Badge>}
          <span className="text-xs text-muted-foreground">
            Generated {formatDateTime(transmission.createdAt)} · Updated {formatDateTime(transmission.updatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {transmission.status === 'generated' && transmission.wireText && (
            <Button size="sm" onClick={handleTransmit} disabled={transmit.isPending}>
              {transmit.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5 mr-1.5" />
              )}
              Transmit to CBP
            </Button>
          )}
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={transmission.status}
            onValueChange={(v) => handleStatusChange(v as CertTransmissionStatus)}
            disabled={update.isPending}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Wire text */}
      {transmission.wireText ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Wire text</Label>
          <WireTextBlock text={transmission.wireText} label="Wire text" />
        </div>
      ) : null}

      {/* Client-side rejection evidence */}
      {transmission.evidenceText ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <FileWarning className="h-3.5 w-3.5" />
            Client-side rejection evidence
          </Label>
          <pre className="rounded-md border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/40 p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
            {transmission.evidenceText}
          </pre>
        </div>
      ) : null}

      {/* CBP response paste + parse */}
      <div className="space-y-1.5">
        <Label htmlFor={`response-${transmission.id}`} className="text-xs text-muted-foreground">
          CBP response
        </Label>
        <Textarea
          id={`response-${transmission.id}`}
          placeholder="Paste the raw CBP response (AX/UC/…) here"
          value={responseDraft}
          onChange={(e) => setResponseDraft(e.target.value)}
          className="font-mono text-xs min-h-[90px]"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleParseSave}
            disabled={update.isPending || responseDraft.trim().length === 0}
          >
            {update.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Parse &amp; save
          </Button>
          {parseError && (
            <span className="text-xs text-red-600 dark:text-red-400">Parse error: {parseError}</span>
          )}
        </div>
        {hasParsed && (
          <Collapsible open={parsedOpen} onOpenChange={setParsedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                <ChevronDown className={`h-3.5 w-3.5 mr-1 transition-transform ${parsedOpen ? 'rotate-180' : ''}`} />
                Parsed response
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-1 rounded-md border bg-muted/50 p-3 text-xs font-mono whitespace-pre overflow-x-auto max-h-64 overflow-y-auto">
                {JSON.stringify(transmission.responseParsed, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor={`notes-${transmission.id}`} className="text-xs text-muted-foreground">
          Notes
        </Label>
        <Textarea
          id={`notes-${transmission.id}`}
          placeholder="Ops notes — channel used, rep replies, follow-ups…"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          className="text-xs min-h-[60px]"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleNotesSave}
          disabled={update.isPending || notesDraft === (transmission.notes ?? '')}
        >
          Save notes
        </Button>
      </div>
    </div>
  );
}

// ─── Scenario detail sheet ─────────────────────────────────
function ScenarioDetailSheet({
  scenario,
  onClose,
}: {
  scenario: CertScenario | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const scenarioId = scenario?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['cert', 'transmissions', scenarioId],
    queryFn: () => certApi.transmissions(scenarioId!),
    enabled: !!scenarioId,
  });
  const transmissions = data?.transmissions ?? [];

  const generate = useMutation({
    mutationFn: (id: string) => certApi.generate(id),
    onSuccess: (result) => {
      toast.success(
        result.transmission.status === 'rejected_clientside'
          ? 'Scenario ran — client-side rejection evidence recorded'
          : 'Wire text generated',
      );
      queryClient.invalidateQueries({ queryKey: ['cert', 'transmissions', scenarioId] });
      queryClient.invalidateQueries({ queryKey: ['cert', 'scenarios'] });
    },
    onError: (err: any) => toast.error(apiErrorMessage(err, 'Generation failed')),
  });

  return (
    <Sheet open={!!scenario} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {scenario && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span className="font-mono text-base">{scenario.id}</span>
                <Badge variant="outline">{scenario.application}</Badge>
                <Badge variant={scenario.kind === 'reject' ? 'secondary' : 'default'} className="text-[10px]">
                  {scenario.kind === 'reject' ? 'Reject test' : 'Transmit'}
                </Badge>
              </SheetTitle>
              <SheetDescription>{scenario.title}</SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              {scenario.notes && (
                <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{scenario.notes}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Transmissions
                  {transmissions.length > 0 && (
                    <span className="ml-1.5 text-muted-foreground font-normal">({transmissions.length})</span>
                  )}
                </h3>
                <Button
                  size="sm"
                  onClick={() => generate.mutate(scenario.id)}
                  disabled={generate.isPending}
                >
                  {generate.isPending
                    ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    : <Zap className="mr-2 h-3.5 w-3.5" />}
                  Generate
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading transmissions…
                </div>
              ) : transmissions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nothing generated yet — hit Generate to build this scenario with the current parameters.
                </p>
              ) : (
                <div className="space-y-4">
                  {transmissions.map((t, idx) => (
                    <TransmissionCard
                      key={t.id}
                      transmission={t}
                      scenarioId={scenario.id}
                      isLatest={idx === 0}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ──────────────────────────────────────────────────
export function AdminCertConsolePage() {
  const [selected, setSelected] = useState<CertScenario | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cert', 'scenarios'],
    queryFn: () => certApi.scenarios(),
  });
  const scenarios = data?.scenarios ?? [];

  // Keep the open sheet's scenario object fresh after refetches.
  useEffect(() => {
    if (!selected) return;
    const fresh = scenarios.find((s) => s.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [scenarios]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    let started = 0;
    for (const s of scenarios) {
      if (s.latest) {
        started += 1;
        counts[s.latest.status] = (counts[s.latest.status] ?? 0) + 1;
      }
    }
    return { encoded: scenarios.length, started, notStarted: scenarios.length - started, counts };
  }, [scenarios]);

  const summaryChips: { label: string; count: number; className?: string }[] = [
    { label: 'encoded', count: summary.encoded },
    ...ALL_STATUSES
      .filter((s) => (summary.counts[s] ?? 0) > 0)
      .map((s) => ({
        label: STATUS_META[s].label.toLowerCase(),
        count: summary.counts[s],
        className: STATUS_META[s].className,
      })),
    { label: 'not started', count: summary.notStarted },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ABI Certification Console</h1>
          <p className="text-muted-foreground">
            Run the 89-scenario CBP CERT test — generate wire text, track transmissions, parse responses.
          </p>
        </div>
      </div>

      {/* Progress summary strip */}
      {!isLoading && scenarios.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {summaryChips.map((chip) => (
            <Badge
              key={chip.label}
              variant="secondary"
              className={`text-xs tabular-nums ${chip.className ?? ''}`}
            >
              {chip.count} {chip.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Transport status + response drain */}
      <TransportCard />

      {/* Background data (HTS queries + manufacturer adds) */}
      <HtsQueryCard />
      <AmfCard />

      {/* Parameters */}
      <ParamsCard />

      {/* Scenario table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scenarios</CardTitle>
          <CardDescription>
            The CBP CERT test package — click a row to generate and track its transmissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading scenarios…
            </div>
          ) : scenarios.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No scenarios encoded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Latest status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(s)}
                  >
                    <TableCell className="font-mono text-sm">{s.id}</TableCell>
                    <TableCell className="text-sm max-w-md">
                      <span className="line-clamp-2">{s.title}</span>
                      {s.notes && (
                        <AlertTriangle className="inline-block h-3 w-3 ml-1.5 text-amber-500 align-[-1px]" aria-label="Has coordination notes" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{s.application}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${s.kind === 'reject'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                          : 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200'}`}
                      >
                        {s.kind === 'reject' ? 'reject' : 'transmit'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.latest
                        ? <StatusBadge status={s.latest.status} />
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(s.latest?.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ScenarioDetailSheet scenario={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
