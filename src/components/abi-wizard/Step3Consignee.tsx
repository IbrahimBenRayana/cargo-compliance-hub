/**
 * Step 3 — Entry Consignee.
 *
 * The party named on the 7501 as the ultimate receiver. CBP accepts a
 * single consignee at entry-summary level (distinct from trade-party-level
 * ship-to on individual items).
 */
import { MapPin } from 'lucide-react';
import type { ABIDocumentDraft, AbiDocument } from '@/api/client';
import {
  COUNTRIES,
  SectionHeader,
  SelectField,
  TextField,
  US_STATES,
} from './shared';

interface Props {
  value: ABIDocumentDraft;
  onChange: (patch: ABIDocumentDraft) => void;
  doc?: AbiDocument;
}

export default function Step3Consignee({ value, onChange }: Props) {
  const c = value.entryConsignee || {};

  const set = (
    patch: Partial<NonNullable<ABIDocumentDraft['entryConsignee']>>,
  ) =>
    onChange({
      entryConsignee: {
        ...c,
        ...patch,
      } as ABIDocumentDraft['entryConsignee'],
    });

  const isUS = (c.country || '').toUpperCase() === 'US';

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<MapPin className="h-4 w-4 text-primary" />}
        title="Entry Consignee"
        description="Ultimate receiver of the merchandise at the 7501 level."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField
          label="Name"
          required
          value={c.name || ''}
          onChange={(v) => set({ name: v })}
          maxLength={35}
          placeholder="Company or individual name"
          hint="Max 35 characters. No periods."
        />
        <TextField
          label="Tax ID"
          required
          value={c.taxId || ''}
          onChange={(v) => set({ taxId: v })}
          maxLength={50}
          placeholder="EIN, SSN, or CBP-assigned number"
          hint="IRS / EIN / SSN — CC requires this to identify the consignee."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField
          label="Address"
          required
          value={c.address || ''}
          onChange={(v) => set({ address: v })}
          maxLength={35}
          placeholder="Street address"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TextField
          label="City"
          required
          value={c.city || ''}
          onChange={(v) => set({ city: v })}
          maxLength={35}
        />
        {isUS ? (
          <SelectField
            label="State"
            required
            value={c.state || ''}
            onChange={(v) => set({ state: v })}
            options={US_STATES}
          />
        ) : (
          <TextField
            label="State / Province"
            value={c.state || ''}
            onChange={(v) => set({ state: v })}
            maxLength={20}
          />
        )}
        <TextField
          label="Postal Code"
          required
          value={c.postalCode || ''}
          onChange={(v) => set({ postalCode: v })}
          maxLength={10}
          placeholder="00000"
        />
        <SelectField
          label="Country"
          required
          value={c.country || ''}
          onChange={(v) => set({ country: v })}
          options={COUNTRIES}
        />
      </div>
    </div>
  );
}
