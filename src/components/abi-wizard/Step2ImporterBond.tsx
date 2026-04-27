/**
 * Step 2 — Importer of Record, Bond, and Payment.
 */
import { Building2, Landmark } from 'lucide-react';
import type { ABIDocumentDraft, AbiDocument } from '@/api/client';
import { BOND_TYPES, PAYMENT_TYPE_CODES } from '@/data/abiEnums';
import {
  DateField,
  SectionHeader,
  SelectField,
  TextField,
} from './shared';

interface Props {
  value: ABIDocumentDraft;
  onChange: (patch: ABIDocumentDraft) => void;
  doc?: AbiDocument;
}

export default function Step2ImporterBond({ value, onChange }: Props) {
  const ior = value.ior || {};
  const bond = value.bond || {};
  const payment = value.payment || {};

  const setIor = (patch: Partial<NonNullable<ABIDocumentDraft['ior']>>) =>
    onChange({ ior: { ...ior, ...patch } as ABIDocumentDraft['ior'] });

  const setBond = (patch: Partial<NonNullable<ABIDocumentDraft['bond']>>) =>
    onChange({ bond: { ...bond, ...patch } as ABIDocumentDraft['bond'] });

  const setPayment = (
    patch: Partial<NonNullable<ABIDocumentDraft['payment']>>,
  ) =>
    onChange({
      payment: { ...payment, ...patch } as ABIDocumentDraft['payment'],
    });

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          icon={<Building2 className="h-4 w-4 text-primary" />}
          title="Importer of Record (IOR)"
          description="Party legally responsible for payment of duties and taxes."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            label="IOR Number"
            required
            value={ior.number || ''}
            onChange={(v) => setIor({ number: v })}
            placeholder="XX-XXXXXXXXX"
            maxLength={15}
            hint="EIN, SSN, or CBP-assigned importer number."
          />
          <TextField
            label="IOR Name"
            required
            value={ior.name || ''}
            onChange={(v) => setIor({ name: v })}
            placeholder="e.g., Acme Imports Inc"
            maxLength={35}
            hint="Max 35 characters. No periods — CBP rejects them."
          />
        </div>
      </div>

      <div>
        <SectionHeader
          icon={<Landmark className="h-4 w-4 text-primary" />}
          title="Bond"
          description="Customs bond that secures payment of duties and fees."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            label="Bond Type"
            required
            value={bond.type || ''}
            onChange={(v) => setBond({ type: v })}
            options={BOND_TYPES}
            hint="Single entry, continuous, or single transaction."
          />
          <TextField
            label="Bond Tax ID"
            required
            value={bond.taxId || ''}
            onChange={(v) => setBond({ taxId: v })}
            placeholder="EIN of the bond holder"
            maxLength={15}
            hint="Tax ID of the party holding the bond. Often the same as the IOR."
          />
        </div>
      </div>

      <div>
        <SectionHeader
          icon={<Landmark className="h-4 w-4 text-primary" />}
          title="Payment"
          description="How duties and fees will be paid to CBP."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            label="Payment Type Code"
            required
            value={
              payment.typeCode !== undefined && payment.typeCode !== null
                ? String(payment.typeCode)
                : ''
            }
            onChange={(v) => setPayment({ typeCode: Number(v) })}
            options={PAYMENT_TYPE_CODES}
            hint="ABI payment method code."
          />
          <DateField
            label="Preliminary Statement Date"
            required
            value={payment.preliminaryStatementDate || ''}
            onChange={(v) => setPayment({ preliminaryStatementDate: v })}
            hint="Statement print/pull date for PMS filings."
          />
        </div>
      </div>
    </div>
  );
}
