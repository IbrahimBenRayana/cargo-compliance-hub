/**
 * Step 6 — Review & Submit
 *
 * Read-only summary of the drafted ABI document. Runs a lightweight
 * client-side validation of the required scalars (the server enforces the
 * full Zod schema at transmit time). The parent wizard reads validation via
 * the exported `validateAbiDraft` helper to gate the Transmit button.
 */
import {
  CheckCircle2, AlertCircle, FileCheck, Package, Receipt, Scale, Users,
  Landmark, Loader2, RefreshCw,
} from 'lucide-react';
import type { ABIDocumentDraft, AbiDocument, DutyEstimateResult } from '@/api/client';
import { useDutyEstimate } from '@/hooks/useAbiDocument';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from './shared';

export interface ValidationResult {
  valid: boolean;
  missing: string[];
}

/**
 * Lightweight scalar-required validation. Mirrors the required fields in
 * `abiDocumentBodySchema` at server/src/schemas/abiDocument.ts.
 */
export function validateAbiDraft(draft: ABIDocumentDraft): ValidationResult {
  const missing: string[] = [];

  if (!draft.entryType) missing.push('Entry Type');
  if (!draft.modeOfTransport) missing.push('Mode of Transport');
  if (!draft.entryNumber) {
    missing.push('Entry Number');
  } else if (!/^[A-Z0-9-]{9,13}$/.test(draft.entryNumber)) {
    missing.push('Entry Number (9–13 alphanumeric chars; hyphens allowed)');
  }

  if (!draft.dates?.entryDate) missing.push('Entry Date');
  if (!draft.dates?.importDate) missing.push('Import Date');
  if (!draft.dates?.arrivalDate) missing.push('Arrival Date');

  if (!draft.location?.portOfEntry) missing.push('Port of Entry');
  if (!draft.location?.destinationStateUS) missing.push('Destination State');

  if (!draft.ior?.number) missing.push('IOR Number');
  if (!draft.ior?.name) missing.push('IOR Name');

  if (!draft.bond?.type) missing.push('Bond Type');
  if (!draft.bond?.suretyCode) missing.push('Bond Surety Code');
  if (!draft.bond?.taxId) missing.push('Bond Tax ID');

  if (draft.payment?.typeCode === undefined || draft.payment?.typeCode === null) {
    missing.push('Payment Type');
  }
  if (!draft.payment?.preliminaryStatementDate) {
    missing.push('Preliminary Statement Date');
  } else if (
    draft.dates?.entryDate &&
    draft.payment.preliminaryStatementDate < draft.dates.entryDate
  ) {
    missing.push('Preliminary Statement Date must be on or after the Entry Date');
  }

  if (!draft.firms) missing.push('FIRMS Code');

  const c = draft.entryConsignee;
  if (!c?.name) missing.push('Consignee Name');
  if (!c?.taxId) {
    missing.push('Consignee Tax ID');
  } else if (
    !/^(?:[A-Z0-9]{2}-[A-Z0-9]{9}|[A-Z0-9]{3}-[A-Z0-9]{2}-[A-Z0-9]{4}|[A-Z0-9]{6}-[A-Z0-9]{5})$/.test(
      c.taxId,
    )
  ) {
    missing.push('Consignee Tax ID format (EIN 12-3456789 / SSN 123-45-6789 / CBP-assigned ABCDEF-12345)');
  }
  if (!c?.address) missing.push('Consignee Address');
  if (!c?.city) missing.push('Consignee City');
  if (!c?.state) missing.push('Consignee State');
  if (!c?.postalCode) missing.push('Consignee Postal Code');
  if (!c?.country) missing.push('Consignee Country');

  const m = draft.manifest?.[0];
  if (!m) {
    missing.push('Manifest');
  } else {
    if (!m.bill?.type) missing.push('Bill Type');
    if (!m.bill?.mBOL) missing.push('Master BOL');
    if (!m.bill?.hBOL) missing.push('House BOL (use Master BOL value if no separate house bill)');
    if (!m.carrier?.code) missing.push('Carrier SCAC');
    if (!m.ports?.portOfUnlading) missing.push('Port of Unlading');
    if (!m.quantity) missing.push('Manifest Quantity');
    if (!m.quantityUOM) {
      missing.push('Manifest Quantity UOM');
    } else if (m.quantityUOM.length < 3) {
      missing.push('Manifest Quantity UOM (must be at least 3 characters)');
    }

    const invoices = m.invoices ?? [];
    if (invoices.length === 0) {
      missing.push('At least one invoice');
    } else {
      invoices.forEach((inv, i) => {
        const prefix = `Invoice ${i + 1}`;
        if (!inv?.purchaseOrder) missing.push(`${prefix}: Purchase Order`);
        if (!inv?.invoiceNumber) missing.push(`${prefix}: Invoice Number`);
        if (!inv?.exportDate) missing.push(`${prefix}: Export Date`);
        if (!inv?.countryOfExport) missing.push(`${prefix}: Country of Export`);
        if (!inv?.currency) missing.push(`${prefix}: Currency`);
        if (inv?.exchangeRate !== undefined && inv.exchangeRate > 8) {
          missing.push(`${prefix}: Exchange Rate must be ≤ 8`);
        }

        const items = inv?.items ?? [];
        if (items.length === 0) {
          missing.push(`${prefix}: at least one item`);
        } else {
          items.forEach((it, j) => {
            const ipref = `${prefix} Item ${j + 1}`;
            if (!it?.sku) missing.push(`${ipref}: SKU`);
            if (!it?.htsNumber || !/^\d{10}$/.test(it.htsNumber)) {
              missing.push(`${ipref}: HTS (10 digits)`);
            }
            if (!it?.description) missing.push(`${ipref}: Description`);
            if (!it?.origin?.country) missing.push(`${ipref}: Country of Origin`);
            if (it?.values?.totalValueOfGoods === undefined) {
              missing.push(`${ipref}: Total Value`);
            }
            if (it?.values?.exchangeRate !== undefined && it.values.exchangeRate > 8) {
              missing.push(`${ipref}: Exchange Rate must be ≤ 8`);
            }
            if (!it?.quantity1) missing.push(`${ipref}: Quantity`);
            if (!it?.weight?.gross) missing.push(`${ipref}: Gross Weight`);
            if (!(it?.parties?.length)) missing.push(`${ipref}: at least one party`);
          });
        }
      });
    }
  }

  return { valid: missing.length === 0, missing };
}

function fmtDate(yyyymmdd?: string | null): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '—';
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function fmtMoney(n?: number): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

interface Props {
  value: ABIDocumentDraft;
  onChange: (patch: ABIDocumentDraft) => void;
  doc?: AbiDocument;
}

export default function Step6Review({ value, doc }: Props) {
  const validation = validateAbiDraft(value);
  const manifest = value.manifest?.[0];
  const invoices = manifest?.invoices ?? [];

  const invoiceCount = invoices.length;
  const itemCount = invoices.reduce((sum, inv) => sum + (inv?.items?.length ?? 0), 0);
  // Declared related-party transactions get called out below — CBP treats
  // this as a valuation-review flag, so a filer should see it before
  // transmitting rather than discover it in a CF28.
  const relatedInvoices = invoices.filter((inv) => inv?.relatedParties === 'Y');

  // Total declared value in USD (exchange rate applied per invoice).
  const totalValueUSD = invoices.reduce((sum, inv) => {
    const rate = inv?.exchangeRate ?? 1;
    const invoiceTotal = (inv?.items ?? []).reduce((s, it) => {
      return s + ((it?.values?.totalValueOfGoods ?? 0) * (it?.values?.exchangeRate ?? 1));
    }, 0);
    // Convert invoice currency to USD via top-level rate if item rates not USD.
    return sum + invoiceTotal * rate;
  }, 0);

  // Total gross weight, normalized to KG.
  const totalWeightKg = invoices.reduce((sum, inv) => {
    return sum + (inv?.items ?? []).reduce((s, it) => {
      const gross = parseFloat(it?.weight?.gross ?? '') || 0;
      const uom = it?.weight?.uom ?? 'K';
      const kg = uom === 'L' ? gross * 0.45359237 : gross;
      return s + kg;
    }, 0);
  }, 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<FileCheck className="h-4 w-4 text-primary" />}
        title="Review & transmit"
        description="Verify the summary below, then save as draft or transmit to CBP."
      />

      {/* Totals grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" /> Invoices
            </div>
            <p className="text-2xl font-bold mt-1">{invoiceCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Package className="h-3.5 w-3.5" /> Line items
            </div>
            <p className="text-2xl font-bold mt-1">{itemCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Total declared value
            </div>
            <p className="text-2xl font-bold mt-1">{fmtMoney(totalValueUSD)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Scale className="h-3.5 w-3.5" /> Total weight
            </div>
            <p className="text-2xl font-bold mt-1">
              {totalWeightKg.toLocaleString('en-US', { maximumFractionDigits: 0 })} kg
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Related-party declaration — a valuation-review flag worth seeing */}
      {relatedInvoices.length > 0 && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-4 flex items-start gap-3">
          <Users className="h-5 w-5 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
              Related-party transaction declared
              {invoiceCount > 1 && ` on ${relatedInvoices.length} of ${invoiceCount} invoices`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You&apos;ve declared that buyer and seller are related under 19 CFR
              152.102(g). CBP may review whether the transaction value is
              acceptable — keep your transfer-pricing support on file.
            </p>
          </div>
        </div>
      )}

      {/* Estimated duties & fees — the number a filer signs for */}
      <DutyEstimateCard docId={doc?.id} />

      {/* Validation block */}
      {validation.valid ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Ready to transmit
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All required fields are present. You can save as a draft or transmit this
              filing to CBP now. Once transmitted, the document cannot be deleted — only
              replaced or cancelled via amendments.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                {validation.missing.length} field{validation.missing.length === 1 ? '' : 's'} still required
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Transmitting is disabled until these are filled in. You can still save the
                current state as a draft.
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {validation.missing.slice(0, 40).map((m) => (
                  <li key={m}>
                    <Badge variant="outline" className="text-xs font-normal border-amber-500/40">
                      {m}
                    </Badge>
                  </li>
                ))}
                {validation.missing.length > 40 && (
                  <Badge variant="outline" className="text-xs font-normal">
                    +{validation.missing.length - 40} more
                  </Badge>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Shipment summary card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="text-sm font-semibold">Shipment</h4>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Entry Type</dt>
              <dd className="font-medium">{value.entryType ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Transport</dt>
              <dd className="font-medium">{value.modeOfTransport ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Port of Entry</dt>
              <dd className="font-medium">{value.location?.portOfEntry ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Destination</dt>
              <dd className="font-medium">{value.location?.destinationStateUS ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Entry Date</dt>
              <dd className="font-medium">{fmtDate(value.dates?.entryDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Import Date</dt>
              <dd className="font-medium">{fmtDate(value.dates?.importDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Arrival Date</dt>
              <dd className="font-medium">{fmtDate(value.dates?.arrivalDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">FIRMS</dt>
              <dd className="font-medium">{value.firms ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">MBOL</dt>
              <dd className="font-medium">{manifest?.bill?.mBOL ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">HBOL</dt>
              <dd className="font-medium">{manifest?.bill?.hBOL || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Carrier</dt>
              <dd className="font-medium">{manifest?.carrier?.code ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Unlading Port</dt>
              <dd className="font-medium">{manifest?.ports?.portOfUnlading ?? '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* IOR + Consignee */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="text-sm font-semibold">Importer of Record</h4>
            <p className="text-sm">{value.ior?.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{value.ior?.number ?? '—'}</p>
            <div className="pt-2 border-t grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <dt className="text-muted-foreground">Bond</dt>
                <dd className="font-medium">{value.bond?.type ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Payment</dt>
                <dd className="font-medium">{value.payment?.typeCode ?? '—'}</dd>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <h4 className="text-sm font-semibold">Consignee</h4>
            <p className="text-sm">{value.entryConsignee?.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">
              {[
                value.entryConsignee?.address,
                value.entryConsignee?.city,
                value.entryConsignee?.state,
                value.entryConsignee?.postalCode,
                value.entryConsignee?.country,
              ]
                .filter(Boolean)
                .join(', ') || '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {doc && (
        <p className="text-xs text-muted-foreground">
          Last saved {new Date(doc.updatedAt).toLocaleString()} ·
          Draft ID {doc.id.slice(0, 8)}…
        </p>
      )}
    </div>
  );
}

// ─── Estimated duties & fees ─────────────────────────────────────────
//
// Priced server-side on the native engine (same math a native transmit
// would carry) from the last SAVED payload. Autosave invalidation keeps
// it current; the refresh button covers "I don't trust it" moments.

const fmtCents = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Humanize a dot-path issue field ("manifest.0.invoices.0.items.1.htsNumber"). */
function humanizeIssueField(field: string): string {
  if (!field) return 'Draft';
  return field
    .split('.')
    .map((seg) => (/^\d+$/.test(seg) ? `#${Number(seg) + 1}` : seg
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (c) => c.toUpperCase())))
    .join(' › ');
}

function DutyEstimateCard({ docId }: { docId?: string }) {
  const estimate = useDutyEstimate(docId);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Estimated duties &amp; fees</h4>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => estimate.refetch()}
            disabled={!docId || estimate.isFetching}
          >
            {estimate.isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="ml-1.5">Recalculate</span>
          </Button>
        </div>

        {!docId || estimate.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-40" />
          </div>
        ) : estimate.isError ? (
          <p className="text-xs text-muted-foreground">
            Couldn&apos;t reach the duty engine. Use Recalculate to retry.
          </p>
        ) : estimate.data ? (
          <DutyEstimateBody result={estimate.data} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function DutyEstimateBody({ result }: { result: DutyEstimateResult }) {
  // Explicit comparison: the app tsconfig runs non-strict, where truthiness
  // checks don't narrow boolean-literal discriminants.
  if (result.estimable === false) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Not enough of the filing is complete to price it yet. Duties and fees
          will appear once these are resolved:
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {result.issues.slice(0, 12).map((issue, i) => (
            <li key={`${issue.field}-${i}`}>
              <Badge
                variant="outline"
                className="text-xs font-normal"
                title={issue.message}
              >
                {humanizeIssueField(issue.field)}
              </Badge>
            </li>
          ))}
          {result.issues.length > 12 && (
            <Badge variant="outline" className="text-xs font-normal">
              +{result.issues.length - 12} more
            </Badge>
          )}
        </ul>
      </div>
    );
  }

  const { totals } = result;
  // Fee classes beyond MPF/HMF (informal 311, mail 496…) shown by label.
  const otherFees = totals.fees.filter(
    (f) => f.classCode !== '499' && f.classCode !== '501',
  );

  return (
    <div className="space-y-3">
      <dl className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Duty</dt>
          <dd className="font-medium tabular-nums">{fmtCents(totals.dutyCents)}</dd>
        </div>
        {totals.mpfCents > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Merchandise Processing Fee</dt>
            <dd className="font-medium tabular-nums">{fmtCents(totals.mpfCents)}</dd>
          </div>
        )}
        {totals.hmfCents > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Harbor Maintenance Fee</dt>
            <dd className="font-medium tabular-nums">{fmtCents(totals.hmfCents)}</dd>
          </div>
        )}
        {otherFees.map((fee) => (
          <div key={fee.classCode} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{fee.label}</dt>
            <dd className="font-medium tabular-nums">{fmtCents(fee.amountCents)}</dd>
          </div>
        ))}
        {totals.adCvdCents > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">AD/CVD deposits</dt>
            <dd className="font-medium tabular-nums">{fmtCents(totals.adCvdCents)}</dd>
          </div>
        )}
      </dl>
      <div className="flex items-baseline justify-between border-t pt-2">
        <span className="text-sm font-semibold">Estimated total</span>
        <span className="text-2xl font-bold tabular-nums">
          {fmtCents(totals.totalCents)}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Estimate priced by the MyCargoLens duty engine from current USITC rates
        (CBP assesses the final amounts at liquidation). Rate date:{' '}
        {fmtDate(result.applicabilityDate)}.
      </p>
    </div>
  );
}
