/**
 * Step 4 — Manifest (Bill + Carrier + Ports).
 *
 * Phase 1 models a single manifest (`manifest[0]`). Invoices/items belong to
 * that manifest and are handled in Step 5.
 */
import { Ship } from 'lucide-react';
import type { ABIDocumentDraft, AbiDocument } from '@/api/client';
import { BILL_TYPES, QUANTITY_UOM, YES_NO } from '@/data/abiEnums';
import { SCHEDULE_D_PORTS } from '@/data/schedule-d-ports';
import {
  ComboboxField,
  SectionHeader,
  SelectField,
  TextField,
} from './shared';

interface Props {
  value: ABIDocumentDraft;
  onChange: (patch: ABIDocumentDraft) => void;
  doc?: AbiDocument;
}

export default function Step4Manifest({ value, onChange, doc }: Props) {
  type ManifestSlice = NonNullable<ABIDocumentDraft['manifest']>[number];
  const manifest = (value.manifest?.[0] || {}) as ManifestSlice;
  const bill: NonNullable<ManifestSlice['bill']> = manifest.bill ?? {};
  const carrier: NonNullable<ManifestSlice['carrier']> = manifest.carrier ?? {};
  const ports: NonNullable<ManifestSlice['ports']> = manifest.ports ?? {};

  const setManifest = (patch: Partial<typeof manifest>) => {
    const rest = value.manifest ? value.manifest.slice(1) : [];
    onChange({
      manifest: [
        { ...manifest, ...patch } as typeof manifest,
        ...rest,
      ] as ABIDocumentDraft['manifest'],
    });
  };

  const prefilled = !!doc?.manifestQueryId;

  return (
    <div className="space-y-6">
      {prefilled && (
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 px-3 py-2">
          Pre-populated from Manifest Query {doc?.manifestQueryId}
        </div>
      )}

      <div>
        <SectionHeader
          icon={<Ship className="h-4 w-4 text-primary" />}
          title="Bill of Lading"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SelectField
            label="Bill Type"
            required
            value={bill.type || ''}
            onChange={(v) =>
              setManifest({
                bill: { ...bill, type: v } as typeof bill,
              })
            }
            options={BILL_TYPES}
          />
          <TextField
            label="Master BOL"
            required
            value={bill.mBOL || ''}
            onChange={(v) => {
              // Auto-fill hBOL with the master value for non-consolidated
              // shipments. CC requires hBOL non-empty; CBP convention for
              // straight bills is hBOL = mBOL. The user can still override.
              const nextBill = { ...bill, mBOL: v } as typeof bill;
              if (!bill.hBOL) nextBill.hBOL = v;
              setManifest({ bill: nextBill });
            }}
            placeholder="e.g., MAEU1234567890"
            maxLength={50}
          />
          <TextField
            label="House BOL"
            required
            value={bill.hBOL || ''}
            onChange={(v) =>
              setManifest({
                bill: { ...bill, hBOL: v } as typeof bill,
              })
            }
            placeholder="e.g., HCLA12345678"
            maxLength={50}
            hint="If you have no separate house bill, use the Master BOL value (we auto-fill it)."
          />
          <SelectField
            label="Group BOL"
            value={bill.groupBOL || ''}
            onChange={(v) =>
              setManifest({
                bill: { ...bill, groupBOL: v as 'Y' | 'N' } as typeof bill,
              })
            }
            options={YES_NO}
            hint="Is this part of a grouped bill?"
          />
        </div>
      </div>

      <div>
        <SectionHeader
          icon={<Ship className="h-4 w-4 text-primary" />}
          title="Carrier & Port"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TextField
            label="Carrier SCAC Code"
            required
            value={carrier.code || ''}
            onChange={(v) =>
              setManifest({
                carrier: { ...carrier, code: v.toUpperCase() } as typeof carrier,
              })
            }
            placeholder="MAEU"
            maxLength={4}
            hint="Standard Carrier Alpha Code — 4 uppercase letters."
          />
          <ComboboxField
            label="Port of Unlading"
            required
            value={ports.portOfUnlading || ''}
            onChange={(v) =>
              setManifest({
                ports: { ...ports, portOfUnlading: v } as typeof ports,
              })
            }
            options={SCHEDULE_D_PORTS}
            placeholder="Select port…"
            searchPlaceholder="Search by code or city…"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Quantity"
              required
              value={manifest.quantity || ''}
              onChange={(v) => setManifest({ quantity: v })}
              placeholder="100"
              type="number"
            />
            <SelectField
              label="Qty UOM"
              required
              value={manifest.quantityUOM || ''}
              onChange={(v) => setManifest({ quantityUOM: v })}
              options={QUANTITY_UOM}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
