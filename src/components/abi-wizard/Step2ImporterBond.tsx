/**
 * Step 2 — Importer of Record, Bond, and Payment.
 */
import { Building2, Landmark } from 'lucide-react';
import type { ABIDocumentDraft, AbiDocument } from '@/api/client';
import { BOND_TYPES, PAYMENT_TYPE_CODES, STATEMENT_MONTHS } from '@/data/abiEnums';
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
  errors?: Record<string, string>;
}

export default function Step2ImporterBond({ value, onChange, errors = {} }: Props) {
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
            error={errors['ior.number']}
          />
          <TextField
            label="IOR Name"
            required
            value={ior.name || ''}
            onChange={(v) => setIor({ name: v })}
            placeholder="e.g., Acme Imports Inc"
            maxLength={35}
            hint="Max 35 characters. No periods — CBP rejects them."
            error={errors['ior.name']}
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
            onChange={(v) => setBond({ type: v as '8' | '9', ...(v === '8' && { stbAmount: undefined }) })}
            options={BOND_TYPES}
            hint="Continuous (8) or single transaction (9)."
            error={errors['bond.type']}
          />
          <TextField
            label="Bond Tax ID"
            required
            value={bond.taxId || ''}
            onChange={(v) => setBond({ taxId: v })}
            placeholder="EIN of the bond holder"
            maxLength={15}
            hint="Tax ID of the party holding the bond. Often the same as the IOR."
            error={errors['bond.taxId']}
          />
          <TextField
            label="Surety Code"
            required
            value={bond.suretyCode || ''}
            onChange={(v) => setBond({ suretyCode: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) })}
            placeholder="e.g., 050, 211"
            maxLength={3}
            hint="CBP-issued code identifying the surety company that backs this bond (different from your tax ID)."
            error={errors['bond.suretyCode']}
          />
          {bond.type === '9' && (
            <TextField
              label="Bond Amount (USD)"
              required
              type="number"
              value={bond.stbAmount ? String(bond.stbAmount) : ''}
              onChange={(v) => setBond({ stbAmount: v === '' ? undefined : Math.round(Number(v)) })}
              hint="The single transaction bond's amount, in whole dollars, as written by the surety."
              error={errors['bond.stbAmount']}
            />
          )}
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
            onChange={(v) => {
              // Statement fields follow the payment type (CATAIR note y):
              // clear the ones the new type does not take.
              const typeCode = Number(v);
              const monthly = typeCode >= 6;
              setPayment({
                typeCode,
                ...(typeCode === 1 && { preliminaryStatementDate: undefined }),
                ...(!monthly && { periodicStatementMonth: undefined }),
              });
            }}
            options={PAYMENT_TYPE_CODES}
            hint="ABI payment method code."
            error={errors['payment.typeCode']}
          />
          {payment.typeCode !== undefined && payment.typeCode !== null && payment.typeCode !== 1 && (
            <DateField
              label="Preliminary Statement Date"
              required
              value={payment.preliminaryStatementDate || ''}
              onChange={(v) => setPayment({ preliminaryStatementDate: v })}
              hint="The weekday CBP prints the preliminary statement this entry joins."
              error={errors['payment.preliminaryStatementDate']}
            />
          )}
          {(payment.typeCode === 6 || payment.typeCode === 7 || payment.typeCode === 8) && (
            <SelectField
              label="Statement Month"
              required
              value={payment.periodicStatementMonth || ''}
              onChange={(v) => setPayment({ periodicStatementMonth: v })}
              options={STATEMENT_MONTHS}
              hint="The month of the periodic monthly statement that pays this entry."
              error={errors['payment.periodicStatementMonth']}
            />
          )}
        </div>
      </div>
    </div>
  );
}
