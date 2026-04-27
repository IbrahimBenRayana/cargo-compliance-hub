import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, Send, RefreshCw, Loader2, AlertTriangle, FileText,
  Ship, User, MapPin, Package, ChevronDown, ChevronRight, ExternalLink, CheckCircle2,
  Hash, Calendar, Building2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
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
import type {
  AbiDocument,
  AbiDocumentStatus,
  ABIInvoice,
  ABIItem,
} from '@/api/client';
import {
  ABI_DOCUMENT_STATUS_MAP,
  ENTRY_TYPES,
  MODES_OF_TRANSPORT,
  BOND_TYPES,
  PAYMENT_TYPE_CODES,
  BILL_TYPES,
} from '@/data/abiEnums';

function lookupLabel(options: { value: string; label: string }[], value: string | null | undefined) {
  if (!value) return '—';
  const found = options.find((o) => o.value === value);
  return found ? found.label : value;
}

function formatYYYYMMDD(raw: string | null | undefined): string {
  if (!raw) return '—';
  if (raw.length === 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
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

function StatusPill({ status }: { status: AbiDocumentStatus }) {
  const cfg = ABI_DOCUMENT_STATUS_MAP[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium',
        cfg.className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

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

function ItemsTable({ items }: { items: ABIItem[] }) {
  if (!items?.length) {
    return <p className="text-xs text-muted-foreground italic">No line items.</p>;
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
              <TableCell className="font-mono text-xs">{item.sku ?? '—'}</TableCell>
              <TableCell className="font-mono text-xs">{item.htsNumber ?? '—'}</TableCell>
              <TableCell className="text-xs max-w-[240px]">
                <span className="block truncate" title={item.description}>
                  {item.description ?? '—'}
                </span>
              </TableCell>
              <TableCell className="text-xs">{item.origin?.country ?? '—'}</TableCell>
              <TableCell className="text-xs text-right tabular-nums">
                {item.values?.totalValueOfGoods != null
                  ? `${item.values.currency ?? ''} ${item.values.totalValueOfGoods.toLocaleString()}`
                  : '—'}
              </TableCell>
              <TableCell className="text-xs text-right tabular-nums">
                {item.quantity1 ?? '—'}
              </TableCell>
              <TableCell className="text-xs text-right tabular-nums">
                {item.weight?.gross
                  ? `${item.weight.gross} ${item.weight.uom ?? ''}`.trim()
                  : '—'}
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
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left hover:bg-muted/40 transition-colors"
          >
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                {open ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Invoice {invoice.invoiceNumber || <span className="text-muted-foreground italic">—</span>}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    PO {invoice.purchaseOrder || '—'} · {itemCount} item{itemCount === 1 ? '' : 's'}
                  </CardDescription>
                </div>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {invoice.currency ?? ''}{' '}
                {invoice.exchangeRate != null ? `@ ${invoice.exchangeRate}` : ''}
              </div>
            </CardHeader>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <LabeledValue label="Export Date" value={formatYYYYMMDD(invoice.exportDate)} />
              <LabeledValue label="Country of Export" value={invoice.countryOfExport} />
              <LabeledValue label="Related Parties" value={invoice.relatedParties} />
              <LabeledValue label="Currency" value={invoice.currency} />
            </div>
            <Separator />
            <ItemsTable items={invoice.items ?? []} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

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

export default function ABIDocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useAbiDocument(id);
  const sendDoc = useSendAbiDocument();
  const pollDoc = usePollAbiDocument();
  const deleteDoc = useDeleteAbiDocument();

  const [showTransmitConfirm, setShowTransmitConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data?.data) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link to="/abi-documents">
            <ArrowLeft className="h-4 w-4" />
            Back to entries
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load entry</AlertTitle>
          <AlertDescription>
            {(error as any)?.message ?? 'The requested entry could not be loaded.'}
          </AlertDescription>
        </Alert>
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
  const isSending = doc.status === 'SENDING';
  const isTerminal =
    doc.status === 'SENT' ||
    doc.status === 'ACCEPTED' ||
    doc.status === 'REJECTED';
  const isCancelled = doc.status === 'CANCELLED';

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Back link */}
      <div
        className="opacity-0 animate-fade-in-up"
        style={{ animationFillMode: 'forwards' }}
      >
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
          <Link to="/abi-documents">
            <ArrowLeft className="h-4 w-4" />
            Back to entries
          </Link>
        </Button>
      </div>

      {/* Header + action bar */}
      <div
        className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 opacity-0 animate-fade-in-up"
        style={{ animationFillMode: 'forwards', animationDelay: '20ms' }}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-blue-500" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight">
                {doc.entryNumber ? `Entry #${doc.entryNumber}` : 'Draft Entry'}
              </h1>
              <StatusPill status={doc.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Created {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
              {doc.updatedAt !== doc.createdAt &&
                ` · updated ${formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDraft && (
            <>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => navigate(`/abi-documents/${doc.id}/edit`)}
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
              <Button className="gap-1.5" onClick={() => setShowTransmitConfirm(true)}>
                <Send className="h-4 w-4" />
                Transmit to CBP
              </Button>
            </>
          )}

          {isSending && (
            <>
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Transmitting…
              </div>
              <Button
                variant="outline"
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

          {isCancelled && (
            <span className="text-xs text-muted-foreground italic">
              This entry has been cancelled.
            </span>
          )}
        </div>
      </div>

      {/* Idempotent send note */}
      {note && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      )}

      {/* Last error warning */}
      {doc.lastError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Last error</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">
            {doc.lastError}
          </AlertDescription>
        </Alert>
      )}

      {/* Status timeline (non-DRAFT only) */}
      {!isDraft && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Transmission</CardTitle>
            <CardDescription>Current CBP response details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <LabeledValue label="Sent" value={formatDateTime(doc.sentAt)} />
              <LabeledValue label="Responded" value={formatDateTime(doc.respondedAt)} />
              <LabeledValue
                label="Entry Summary"
                value={doc.entrySummaryStatus ?? '—'}
              />
              <LabeledValue
                label="Cargo Release"
                value={doc.cargoReleaseStatus ?? '—'}
              />
              <LabeledValue
                label="CC Document ID"
                value={doc.ccDocumentId ?? '—'}
                mono
              />
              <LabeledValue label="Poll Attempts" value={String(doc.pollAttempts ?? 0)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Entry Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Entry Info</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <LabeledValue
              label="Entry Type"
              value={lookupLabel(ENTRY_TYPES, doc.entryType)}
            />
            <LabeledValue
              label="Mode of Transport"
              value={lookupLabel(MODES_OF_TRANSPORT, doc.modeOfTransport)}
            />
            <LabeledValue label="Entry Date" value={formatYYYYMMDD(doc.entryDate)} />
            <LabeledValue label="Import Date" value={formatYYYYMMDD(doc.importDate)} />
            <LabeledValue label="Arrival Date" value={formatYYYYMMDD(doc.arrivalDate)} />
            <LabeledValue
              label="Port of Entry"
              value={doc.portOfEntry ? <span className="font-mono">{doc.portOfEntry}</span> : null}
            />
            <LabeledValue
              label="Destination State"
              value={doc.destinationStateUS}
            />
            <LabeledValue
              label="FIRMS Code"
              value={payload.firms ? <span className="font-mono">{payload.firms}</span> : null}
            />
          </CardContent>
        </Card>

        {/* IOR / Bond / Payment */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Importer of Record</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <LabeledValue
              label="IOR Number"
              value={doc.iorNumber ? <span className="font-mono">{doc.iorNumber}</span> : null}
            />
            <LabeledValue label="IOR Name" value={doc.iorName ?? ior?.name} />
            <LabeledValue
              label="Bond Type"
              value={bond?.type ? lookupLabel(BOND_TYPES, bond.type) : null}
            />
            <LabeledValue
              label="Bond Tax ID"
              value={bond?.taxId ? <span className="font-mono">{bond.taxId}</span> : null}
            />
            <LabeledValue
              label="Payment Type"
              value={
                payment?.typeCode != null
                  ? lookupLabel(PAYMENT_TYPE_CODES, String(payment.typeCode))
                  : null
              }
            />
            <LabeledValue
              label="Prelim. Statement Date"
              value={formatYYYYMMDD(payment?.preliminaryStatementDate)}
            />
          </CardContent>
        </Card>

        {/* Consignee */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Consignee</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <LabeledValue label="Name" value={doc.consigneeName ?? consignee?.name} />
            <LabeledValue label="Address" value={consignee?.address} />
            <div className="grid grid-cols-3 gap-3">
              <LabeledValue label="City" value={consignee?.city} />
              <LabeledValue label="State" value={consignee?.state} />
              <LabeledValue label="Postal Code" value={consignee?.postalCode} />
            </div>
            <LabeledValue label="Country" value={consignee?.country} />
          </CardContent>
        </Card>

        {/* Manifest */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Ship className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Manifest</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <LabeledValue
              label="Bill Type"
              value={manifest0?.bill?.type ? lookupLabel(BILL_TYPES, manifest0.bill.type) : null}
            />
            <LabeledValue
              label="Carrier Code"
              value={
                manifest0?.carrier?.code ? (
                  <span className="font-mono">{manifest0.carrier.code}</span>
                ) : null
              }
            />
            <LabeledValue
              label="Master BOL"
              value={
                doc.mbolNumber ? <span className="font-mono text-xs">{doc.mbolNumber}</span> : null
              }
            />
            <LabeledValue
              label="House BOL"
              value={
                doc.hbolNumber ? <span className="font-mono text-xs">{doc.hbolNumber}</span> : null
              }
            />
            <LabeledValue
              label="Port of Unlading"
              value={
                manifest0?.ports?.portOfUnlading ? (
                  <span className="font-mono">{manifest0.ports.portOfUnlading}</span>
                ) : null
              }
            />
            <LabeledValue
              label="Quantity"
              value={
                manifest0?.quantity
                  ? `${manifest0.quantity} ${manifest0.quantityUOM ?? ''}`.trim()
                  : null
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Invoices & items */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">
            Invoices &amp; Items
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({invoices.length})
            </span>
          </h2>
        </div>
        {invoices.length === 0 ? (
          <Card>
            <CardContent className="py-10 flex flex-col items-center gap-2 text-center">
              <Package className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No invoices added yet.</p>
              {isDraft && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => navigate(`/abi-documents/${doc.id}/edit`)}
                >
                  Add invoices in the wizard
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv, i) => (
              <InvoiceCard key={i} invoice={inv} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Submission log placeholder */}
      {!isDraft && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Submission Log</CardTitle>
            <CardDescription>
              Full audit log available via Submission Logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Every CBP request and response for this entry is recorded against
                  correlation ID{' '}
                  <code className="font-mono bg-muted px-1 py-0.5 rounded">
                    {doc.id}
                  </code>
                  .
                </span>
              </div>
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link to={`/integrations/logs?correlationId=${doc.id}`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  View submission logs
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
