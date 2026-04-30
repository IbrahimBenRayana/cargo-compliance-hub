/**
 * Step 1 — Entry & Shipment Info
 *
 * entryType is locked to "01" (Consumption Formal) for Phase 1. The "11"
 * Informal Entry option is still rendered so users see where it will appear
 * but selecting it is blocked via `disabledValues` + a tooltip hint.
 */
import { Info, Ship } from 'lucide-react';
import type { ABIDocumentDraft, AbiDocument } from '@/api/client';
import { ENTRY_TYPES, MODES_OF_TRANSPORT } from '@/data/abiEnums';
import { CBP_PORTS_4DIGIT } from '@/data/schedule-d-ports';
import {
  ComboboxField,
  DateField,
  SectionHeader,
  SelectField,
  TextField,
  US_STATES,
} from './shared';

export interface StepProps {
  value: ABIDocumentDraft;
  onChange: (patch: ABIDocumentDraft) => void;
  doc?: AbiDocument;
  errors?: Record<string, string>;
}

export default function Step1EntryShipment({ value, onChange, errors = {} }: StepProps) {
  const dates = value.dates || {};
  const location = value.location || {};

  const setDates = (patch: Partial<NonNullable<ABIDocumentDraft['dates']>>) =>
    onChange({ dates: { ...dates, ...patch } as ABIDocumentDraft['dates'] });

  const setLocation = (
    patch: Partial<NonNullable<ABIDocumentDraft['location']>>,
  ) =>
    onChange({
      location: { ...location, ...patch } as ABIDocumentDraft['location'],
    });

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Ship className="h-4 w-4 text-primary" />}
        title="Entry type & transport"
        description="Identify the filing type and how the cargo is arriving."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField
          label="Entry Type"
          required
          value={value.entryType || '01'}
          onChange={(v) => onChange({ entryType: v as '01' | '11' })}
          options={ENTRY_TYPES}
          hint="Phase 1 supports Consumption Entry (01) only. Informal entries are coming soon."
          disabledValues={['11']}
          error={errors.entryType}
        />
        <SelectField
          label="Mode of Transport"
          required
          value={value.modeOfTransport || ''}
          onChange={(v) => onChange({ modeOfTransport: v })}
          options={MODES_OF_TRANSPORT}
          hint="CBP code describing how the shipment moves (vessel, air, truck, rail)."
          error={errors.modeOfTransport}
        />
      </div>

      <TextField
        label="Entry Number"
        required
        value={value.entryNumber || ''}
        onChange={(v) => onChange({ entryNumber: v.toUpperCase() })}
        placeholder="S4G12580927 or S4G-1258092-7"
        maxLength={13}
        hint="Filer-assigned entry number (3-letter filer code + 7-digit sequence + 1-digit check digit). Hyphens are stripped before transmission."
        error={errors.entryNumber}
      />

      <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-400 px-3 py-2 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Phase 1 ships <strong>Consumption Entry (01)</strong> only. Informal
          entries (11) will unlock in a later phase.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DateField
          label="Entry Date"
          required
          value={dates.entryDate || ''}
          onChange={(v) => setDates({ entryDate: v })}
          hint="Date the entry is being filed with CBP."
          error={errors['dates.entryDate']}
        />
        <DateField
          label="Import Date"
          required
          value={dates.importDate || ''}
          onChange={(v) => setDates({ importDate: v })}
          hint="Date goods first crossed into the customs territory."
          error={errors['dates.importDate']}
        />
        <DateField
          label="Arrival Date"
          required
          value={dates.arrivalDate || ''}
          onChange={(v) => setDates({ arrivalDate: v })}
          hint="Date the conveyance arrived at the port of entry."
          error={errors['dates.arrivalDate']}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ComboboxField
          label="Port of Entry"
          required
          value={location.portOfEntry || ''}
          onChange={(v) => setLocation({ portOfEntry: v })}
          options={CBP_PORTS_4DIGIT}
          placeholder="Select port…"
          searchPlaceholder="Search by code or city…"
          hint="CBP Schedule D port code where goods enter the US."
          error={errors['location.portOfEntry']}
        />
        <SelectField
          label="Destination State"
          required
          value={location.destinationStateUS || ''}
          onChange={(v) => setLocation({ destinationStateUS: v })}
          options={US_STATES}
          hint="Final US state of delivery."
          error={errors['location.destinationStateUS']}
        />
        <TextField
          label="FIRMS Code"
          required
          value={value.firms || ''}
          onChange={(v) => onChange({ firms: v.toUpperCase() })}
          placeholder="ABCD"
          maxLength={4}
          hint="4-character Facilities Information & Resources Management System code."
          error={errors.firms}
        />
      </div>
    </div>
  );
}
