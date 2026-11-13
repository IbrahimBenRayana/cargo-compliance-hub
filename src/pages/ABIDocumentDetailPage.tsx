import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Pencil, Trash2, Send, RefreshCw, Loader2, AlertTriangle, FileText,
  ChevronDown, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  useAbiDocument,
  useDeleteAbiDocument,
  usePollAbiDocument,
  useSendAbiDocument,
} from '@/hooks/useAbiDocument';
import { abiDocumentsApi } from '@/api/client';
import type {
  AbiDocument,
  ABIInvoice,
  ABIItem,
} from '@/api/client';
import {
  ENTRY_TYPES,
  MODES_OF_TRANSPORT,
  BOND_TYPES,
  PAYMENT_TYPE_CODES,
  BILL_TYPES,
} from '@/data/abiEnums';
import { useQueryClient } from '@tanstack/react-query';
import { EntryCbpTimeline } from '@/components/CbpTimeline';
import { isNativeResendable, isOnFileAtCbp } from '@/lib/entryLifecycle';
import { BAND, FILL } from '@/components/dashboard/tones';
import { EntryStatusPill } from '@/components/entries/EntryStatus';
import { entryStatusOf } from '@/components/entries/status';
import { summarizeEntry } from '@/components/entries/summary';
import { CopyButton } from '@/components/shipment-detail/CopyButton';
import { stamp } from '@/components/shipment-detail/summary';
import { usePortName } from '@/components/shipment-detail/usePortName';

function lookupLabel(options: { value: string; label: string }[], value: string | null | undefined) {
  if (!value) return '';
  const found = options.find((o) => o.value === value);
  return found ? found.label : value;
}

/** CBP's stored answer, "ACCEPTED", as a word. */
const sentenceCase = (v: string | null | undefined) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : '');

function formatYYYYMMDD(raw: string | null | undefined): string {
  if (!raw) return '';
  const iso = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw.slice(0, 10);
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const PANEL = 'rounded-xl border border-border/70 bg-card shadow-card';
const H3 = 'text-[13px] font-semibold';
const GRID = 'mt-3 grid grid-cols-2 gap-x-6 gap-y-4 xl:grid-cols-3';

function LabeledValue({
  label,
  value,
  mono,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  sub?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 truncate text-[13.5px] font-medium', mono && 'font-mono text-[13px]')}>
        {value || <span className="font-sans text-[13.5px] font-normal text-muted-foreground">Not provided</span>}
      </dd>
      {sub && <dd className="truncate text-[12.5px] text-muted-foreground">{sub}</dd>}
    </div>
  );
}

function PortValue({ label, code }: { label: string; code: string | null | undefined }) {
  const name = usePortName(code);
  return <LabeledValue label={label} value={code} mono sub={name} />;
}

function ItemsTable({ items }: { items: ABIItem[] }) {
  if (!items?.length) {
    return <p className="text-[13px] text-muted-foreground">No line items.</p>;
  }
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs">SKU</TableHead>
            <TableHead className="text-xs">HTS</TableHead>
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs">Origin</TableHead>
            <TableHead className="text-xs text-right">Value</TableHead>
            <TableHead className="text-xs text-right">Qty</TableHead>
            <TableHead className="text-xs text-right">Weight</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{item.sku ?? ''}</TableCell>
              <TableCell className="font-mono text-xs">{item.htsNumber ?? ''}</TableCell>
              <TableCell className="text-xs max-w-[240px]">
                <span className="block truncate" title={item.description}>
                  {item.description ?? ''}
                </span>
              </TableCell>
              <TableCell className="text-xs">{item.origin?.country ?? ''}</TableCell>
              <TableCell className="text-xs text-right tabular-nums">
                {item.values?.totalValueOfGoods != null
                  ? `${item.values.currency ?? ''} ${item.values.totalValueOfGoods.toLocaleString()}`
                  : ''}
              </TableCell>
              <TableCell className="text-xs text-right tabular-nums">
                {item.quantity1 ?? ''}
              </TableCell>
              <TableCell className="text-xs text-right tabular-nums">
                {item.weight?.gross
                  ? `${item.weight.gross} ${item.weight.uom ?? ''}`.trim()
                  : ''}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function InvoiceCard({ invoice, index }: { invoice: ABIInvoice; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const itemCount = invoice.items?.length ?? 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border/70 first:border-t-0">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left outline-none transition-colors duration-150 can-hover:hover:bg-muted/40 focus-visible:bg-muted/40">
          <span className="flex min-w-0 items-center gap-2.5">
            {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold">Invoice <span className="font-mono">{invoice.invoiceNumber || 'without a number'}</span></span>
              <span className="block text-[12.5px] text-muted-foreground">
                {invoice.purchaseOrder ? `PO ${invoice.purchaseOrder} · ` : ''}{itemCount} item{itemCount === 1 ? '' : 's'}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground">
            {invoice.currency ?? ''}{invoice.exchangeRate != null ? ` @ ${invoice.exchangeRate}` : ''}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 px-5 pb-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <LabeledValue label="Export date" value={formatYYYYMMDD(invoice.exportDate)} />
            <LabeledValue label="Country of export" value={invoice.countryOfExport} />
            <LabeledValue label="Related parties" value={invoice.relatedParties} />
            <LabeledValue label="Currency" value={invoice.currency} />
          </dl>
          <ItemsTable items={invoice.items ?? []} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading entry" className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <div className="dash-sk h-4 w-28" />
      <div className="space-y-2"><div className="dash-sk h-7 w-56" /><div className="dash-sk h-4 w-72" /></div>
      <div className="dash-sk h-36 w-full rounded-xl" />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="dash-sk h-80 rounded-xl" />
        <div className="dash-sk h-48 rounded-xl" />
      </div>
    </div>
  );
}

export default function ABIDocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useAbiDocument(id);
  const sendDoc = useSendAbiDocument();
  const pollDoc = usePollAbiDocument();
  const deleteDoc = useDeleteAbiDocument();

  const [showTransmitConfirm, setShowTransmitConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cbpAction, setCbpAction] = useState<'REPLACE' | 'DELETE' | null>(null);
  const [cbpActionPending, setCbpActionPending] = useState(false);
  const queryClient = useQueryClient();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data?.data) {
    return (
      <div className="mx-auto max-w-[1200px] py-16 text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-urgent-tint text-urgent"><AlertTriangle className="h-5 w-5" aria-hidden /></span>
        <p className="mt-3 text-[13px] font-medium">We could not load this entry.</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{(error as any)?.message ?? 'It may have been deleted, or it belongs to another account.'}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" onClick={() => refetch()}>Try again</Button>
          <Button size="sm" variant="outline" asChild><Link to="/abi-documents">Entry documents</Link></Button>
        </div>
      </div>
    );
  }

  const doc: AbiDocument = data.data;
  const note = data.note;
  const payload = doc.payload ?? {};
  const manifest0 = payload.manifest?.[0] as any | undefined;
  const invoices: ABIInvoice[] = (manifest0?.invoices ?? []) as ABIInvoice[];
  const consignee = payload.entryConsignee as any | undefined;
  const ior = payload.ior as any | undefined;
  const bond = payload.bond as any | undefined;
  const payment = payload.payment as any | undefined;

  const handleTransmit = async () => {
    try {
      const result = await sendDoc.mutateAsync(doc.id);
      if (result.note) {
        toast.info(result.note);
      } else {
        toast.success('Entry transmitted to CBP');
      }
      setShowTransmitConfirm(false);
    } catch (err: any) {
      if (err?.status === 429) {
        toast.error('Please wait a moment before trying again');
      } else {
        toast.error(err?.body?.error || err?.message || 'Transmission failed');
      }
    }
  };

  const handleRefresh = async () => {
    try {
      await pollDoc.mutateAsync(doc.id);
      toast.success('Status refreshed');
    } catch (err: any) {
      if (err?.status === 429) {
        toast.error('Please wait a moment before trying again');
      } else {
        toast.error(err?.body?.error || err?.message || 'Refresh failed');
      }
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const { blob, filename } = await abiDocumentsApi.downloadPdf(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download the 7501 PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc.mutateAsync(doc.id);
      toast.success('Entry deleted');
      navigate('/abi-documents');
    } catch (err: any) {
      if (err?.status === 429) {
        toast.error('Please wait a moment before trying again');
      } else {
        toast.error(err?.body?.error || err?.message || 'Failed to delete entry');
      }
    }
  };

  const isDraft = doc.status === 'DRAFT';
  // Native entries settle from CBP's own answers; CustomsCity-era entries
  // keep their manual status refresh (audit FNA-12).
  const isNative = !!doc.lastTransmissionId;
  const isSending = doc.status === 'SENDING' && !isNative;
  const isTerminal =
    !isNative &&
    (doc.status === 'SENT' ||
      doc.status === 'ACCEPTED' ||
      doc.status === 'REJECTED');
  const isCancelled = doc.status === 'CANCELLED';
  const canResend = isNativeResendable(doc);
  const onFile = isNative && isOnFileAtCbp(doc);

  const handleCbpAction = async () => {
    if (!cbpAction) return;
    setCbpActionPending(true);
    try {
      await abiDocumentsApi.cbpAction(doc.id, cbpAction);
      toast.success(cbpAction === 'DELETE' ? 'Deletion sent to CBP.' : 'Replacement sent to CBP.');
      setCbpAction(null);
      queryClient.invalidateQueries({ queryKey: ['abi-documents', doc.id] });
      queryClient.invalidateQueries({ queryKey: ['abi-document', doc.id, 'cbp'] });
    } catch (err: any) {
      toast.error(err?.body?.error || err?.message || 'Could not send to CBP');
    } finally {
      setCbpActionPending(false);
    }
  };

  const summary = summarizeEntry(doc);
  const { icon: StatusIcon } = entryStatusOf(doc.status);
  const typeLabel = lookupLabel(ENTRY_TYPES, doc.entryType);

  return (
    <div className="dash-enter mx-auto flex max-w-[1200px] flex-col gap-5 pb-16">
      <Link to="/abi-documents" className="inline-flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />Entry documents
      </Link>

      <div className="-mt-2 flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className={cn('break-all text-[24px] font-semibold leading-8 tracking-[-0.01em]', doc.entryNumber && 'font-mono')}>
              {doc.entryNumber ?? 'Draft entry'}
            </h1>
            <EntryStatusPill status={doc.status} />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {[typeLabel, doc.iorName ?? ior?.name].filter(Boolean).join(' \u00b7 ') || 'Entry summary'}
            {' \u00b7 '}Created {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDraft && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(`/abi-documents/${doc.id}/edit`)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setShowTransmitConfirm(true)}>
                <Send className="h-4 w-4" />
                Transmit to CBP
              </Button>
            </>
          )}

          {isSending && (
            <>
              <div className="flex items-center gap-2 text-[13px] text-info">
                <Loader2 className="h-4 w-4 animate-spin" />
                Transmitting…
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleRefresh}
                disabled={pollDoc.isPending}
              >
                {pollDoc.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh status
              </Button>
            </>
          )}

          {isTerminal && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleRefresh}
              disabled={pollDoc.isPending}
            >
              {pollDoc.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh status
            </Button>
          )}

          {canResend && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(`/abi-documents/${doc.id}/edit`)}
              >
                <Pencil className="h-4 w-4" />
                Correct
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setShowTransmitConfirm(true)}>
                <Send className="h-4 w-4" />
                Send again
              </Button>
            </>
          )}

          {onFile && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(`/abi-documents/${doc.id}/edit`)}
              >
                <Pencil className="h-4 w-4" />
                Edit and replace
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setCbpAction('DELETE')}
              >
                <Trash2 className="h-4 w-4" />
                Delete at CBP
              </Button>
            </>
          )}

          {isNative && doc.pendingAction && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for CBP
            </div>
          )}


          {/* 7501 PDF — available for every status except cancelled;
              non-accepted copies come out watermarked. */}
          {!isCancelled && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              7501 PDF
            </Button>
          )}
        </div>
      </div>

      <section aria-label="Status" className={cn(PANEL, 'overflow-hidden')}>
        <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4', BAND[summary.tone])}>
          <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-white dark:text-background', FILL[summary.tone])}>
            <StatusIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-[16px] font-semibold leading-6">{summary.title}</p>
            {summary.detail && <p className="mt-0.5 text-[13px] text-foreground/75">{summary.detail}</p>}
          </div>
          {doc.entryNumber && (
            <div className="sm:text-right">
              <p className="text-[12px] text-foreground/70">Entry number</p>
              <p className="flex items-center gap-1 sm:justify-end">
                <span className="font-mono text-[15px] font-semibold">{doc.entryNumber}</span>
                <CopyButton value={doc.entryNumber} label="entry number" />
              </p>
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-5">
          <LabeledValue label="Entry type" value={typeLabel} />
          <PortValue label="Port of entry" code={doc.portOfEntry} />
          <LabeledValue label="Entry date" value={formatYYYYMMDD(doc.entryDate)} />
          <LabeledValue label="Import date" value={formatYYYYMMDD(doc.importDate)} />
          <LabeledValue label="Arrival date" value={formatYYYYMMDD(doc.arrivalDate)} />
        </dl>
      </section>

      {/* A second send of the same entry answers with a note instead of sending twice. */}
      {note && (
        <p className="flex items-start gap-2 rounded-xl bg-info-tint px-4 py-3 text-[13px]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />{note}
        </p>
      )}

      {doc.lastError && (
        <div role="alert" className="rounded-xl bg-urgent-tint px-4 py-3">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-urgent"><AlertTriangle className="h-4 w-4" aria-hidden />Last error</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">{doc.lastError}</p>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Every message sent to CBP and CBP's answers. */}
          {isNative && <EntryCbpTimeline entryId={doc.id} />}

          {/* Entries sent before the native connection keep their stored answers. */}
          {!isDraft && !isNative && (
            <section aria-labelledby="transmission-title" className={cn(PANEL, 'p-5')}>
              <h2 id="transmission-title" className="text-[15px] font-semibold">Transmission</h2>
              <dl className={GRID}>
                <LabeledValue label="Sent" value={formatDateTime(doc.sentAt)} />
                <LabeledValue label="Responded" value={formatDateTime(doc.respondedAt)} />
                <LabeledValue label="Entry summary" value={sentenceCase(doc.entrySummaryStatus)} />
                <LabeledValue label="Cargo release request" value={sentenceCase(doc.cargoReleaseStatus)} />
                {doc.ccDocumentId && (
                  <>
                    <LabeledValue label="Legacy document ID" value={doc.ccDocumentId} mono />
                    <LabeledValue label="Poll attempts" value={String(doc.pollAttempts ?? 0)} />
                  </>
                )}
              </dl>
            </section>
          )}

          <section aria-labelledby="filed-title" className={PANEL}>
            <div className="px-5 pt-4">
              <h2 id="filed-title" className="text-[15px] font-semibold">{isDraft ? 'What will be filed' : 'What was filed'}</h2>
            </div>
            <div className="px-5 pb-5 pt-4">
              <h3 className={H3}>Entry</h3>
              <dl className={GRID}>
                <LabeledValue label="Mode of transport" value={lookupLabel(MODES_OF_TRANSPORT, doc.modeOfTransport)} />
                <LabeledValue label="Destination state" value={doc.destinationStateUS} />
                <LabeledValue label="FIRMS code" value={payload.firms} mono />
              </dl>
            </div>
            <div className="border-t border-border/70 px-5 py-5">
              <h3 className={H3}>Importer and bond</h3>
              <dl className={GRID}>
                <LabeledValue label="Importer of record" value={doc.iorName ?? ior?.name} sub={doc.iorNumber ? <span className="font-mono">{doc.iorNumber}</span> : undefined} />
                <LabeledValue label="Bond type" value={bond?.type ? lookupLabel(BOND_TYPES, bond.type) : null} />
                <LabeledValue label="Bond tax ID" value={bond?.taxId} mono />
                <LabeledValue label="Payment type" value={payment?.typeCode != null ? lookupLabel(PAYMENT_TYPE_CODES, String(payment.typeCode)) : null} />
                {payment?.preliminaryStatementDate && <LabeledValue label="Prelim. statement date" value={formatYYYYMMDD(payment.preliminaryStatementDate)} />}
                {payment?.periodicStatementMonth && <LabeledValue label="Statement month" value={payment.periodicStatementMonth} />}
              </dl>
            </div>
            <div className="border-t border-border/70 px-5 py-5">
              <h3 className={H3}>Consignee</h3>
              <dl className={GRID}>
                <LabeledValue label="Name" value={doc.consigneeName ?? consignee?.name} />
                <LabeledValue label="Address" value={consignee?.address} />
                <LabeledValue label="City, state, postal code" value={[consignee?.city, consignee?.state, consignee?.postalCode].filter(Boolean).join(', ')} />
                <LabeledValue label="Country" value={consignee?.country} />
              </dl>
            </div>
            <div className="border-t border-border/70 px-5 py-5">
              <h3 className={H3}>Manifest</h3>
              <dl className={GRID}>
                <LabeledValue label="Master bill" value={doc.mbolNumber} mono />
                <LabeledValue label="House bill" value={doc.hbolNumber} mono />
                <LabeledValue label="Bill type" value={manifest0?.bill?.type ? lookupLabel(BILL_TYPES, manifest0.bill.type) : null} />
                <LabeledValue label="Carrier code" value={manifest0?.carrier?.code} mono />
                <PortValue label="Port of unlading" code={manifest0?.ports?.portOfUnlading} />
                <LabeledValue label="Quantity" value={manifest0?.quantity ? `${manifest0.quantity} ${manifest0.quantityUOM ?? ''}`.trim() : null} />
              </dl>
            </div>
          </section>

          <section aria-labelledby="invoices-title" className={PANEL}>
            <h2 id="invoices-title" className="flex items-center gap-2 px-5 pb-3 pt-4 text-[15px] font-semibold">
              Invoices and items
              <span className="rounded-md bg-muted px-1.5 py-px text-[11.5px] font-medium tabular-nums text-muted-foreground">{invoices.length}</span>
            </h2>
            {invoices.length === 0 ? (
              <div className="border-t border-border/70 px-5 py-8 text-center">
                <p className="text-[13px] font-medium">No invoices yet.</p>
                {isDraft && <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(`/abi-documents/${doc.id}/edit`)}>Add invoices</Button>}
              </div>
            ) : (
              <div className="border-t border-border/70">{invoices.map((inv, i) => <InvoiceCard key={i} invoice={inv} index={i} />)}</div>
            )}
          </section>
        </div>

        <aside aria-label="Related and dates" className={cn(PANEL, 'divide-y divide-border/70 lg:sticky lg:top-4')}>
          {(doc.filingId || doc.manifestQueryId || !isDraft) && (
            <section aria-labelledby="related-title" className="p-5">
              <h2 id="related-title" className={H3}>Related</h2>
              <ul className="mt-3 space-y-3">
                {doc.filingId && (
                  <li className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="text-[13px] font-medium">ISF</p><p className="text-[12.5px] text-muted-foreground">This entry was made from it</p></div>
                    <Button asChild size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2.5 text-[12px]"><Link to={`/shipments/${doc.filingId}`}>Open shipment<ArrowRight className="h-3 w-3" aria-hidden /></Link></Button>
                  </li>
                )}
                {doc.manifestQueryId && (
                  <li className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="text-[13px] font-medium">Manifest query</p><p className="text-[12.5px] text-muted-foreground">Prefilled this entry</p></div>
                    <Button asChild size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2.5 text-[12px]"><Link to={`/manifest-query?queryId=${doc.manifestQueryId}`}>Open<ArrowRight className="h-3 w-3" aria-hidden /></Link></Button>
                  </li>
                )}
                {!isDraft && (
                  <li className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="text-[13px] font-medium">Submission logs</p><p className="text-[12.5px] text-muted-foreground">Every request and response</p></div>
                    <Button asChild size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2.5 text-[12px]"><Link to={`/integrations/logs?correlationId=${doc.id}`}>View logs<ArrowRight className="h-3 w-3" aria-hidden /></Link></Button>
                  </li>
                )}
              </ul>
            </section>
          )}
          <section aria-labelledby="dates-title" className="p-5">
            <h2 id="dates-title" className={H3}>Dates</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              {([['Created', doc.createdAt], ['Last changed', doc.updatedAt !== doc.createdAt ? doc.updatedAt : null], ['Sent', doc.sentAt], ['CBP answered', doc.respondedAt]] as const)
                .filter(([, at]) => at)
                .map(([label, at]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="tabular-nums">{stamp(at!)}</dd>
                  </div>
                ))}
            </dl>
          </section>
        </aside>
      </div>

      {/* Transmit confirmation */}
      <AlertDialog open={showTransmitConfirm} onOpenChange={setShowTransmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transmit entry to CBP?</AlertDialogTitle>
            <AlertDialogDescription>
              This filing will be submitted to CBP. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendDoc.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleTransmit();
              }}
              disabled={sendDoc.isPending}
            >
              {sendDoc.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transmitting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Transmit
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Replace / delete at CBP */}
      <AlertDialog open={cbpAction !== null} onOpenChange={(open) => !open && setCbpAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cbpAction === 'DELETE' ? 'Delete this entry summary at CBP?' : 'Send a replacement to CBP?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cbpAction === 'DELETE'
                ? 'CBP is asked to delete the entry summary it holds for this entry number. CBP only allows this before the entry is scheduled for a statement or liquidation; if it refuses, the summary stays on file.'
                : 'CBP replaces the entry summary it holds with the current version. If CBP rejects the replacement, the version on file stays.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cbpActionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCbpAction();
              }}
              disabled={cbpActionPending}
              className={cbpAction === 'DELETE' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
            >
              {cbpActionPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {cbpAction === 'DELETE' ? 'Delete at CBP' : 'Send replacement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This draft and any data entered will be permanently removed. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDoc.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteDoc.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDoc.isPending ? (
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
