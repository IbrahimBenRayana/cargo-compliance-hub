import { Plus, Scale, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ABIAdCvdCase } from '@/api/client';
import { SelectField, TextField } from './shared';

/**
 * AD/CVD cases on one entry line (entry type 03, CATAIR usage note ff).
 * A line carries at most two cases (one antidumping, one countervailing).
 * The deposit is computed server-side from the rate: ad valorem on the
 * line value, specific on the case quantity.
 */

const BOND_OR_CASH = [
  { value: 'C', label: 'Cash deposit' },
  { value: 'B', label: 'Bonded' },
];
const RATE_TYPES = [
  { value: 'A', label: 'Ad valorem (%)' },
  { value: 'S', label: 'Specific ($ per unit)' },
];

const EMPTY: ABIAdCvdCase = { caseNumber: '', bondOrCash: 'C', rateType: 'A', rate: 0 };

export function AdCvdCasesEditor({
  cases,
  onChange,
  errors,
  path,
}: {
  cases: ABIAdCvdCase[] | undefined;
  onChange: (cases: ABIAdCvdCase[] | undefined) => void;
  errors: Record<string, string>;
  /** Error-key prefix for this line, e.g. 'invoices.0.items.1'. */
  path: string;
}) {
  const list = cases ?? [];
  const set = (i: number, patch: Partial<ABIAdCvdCase>) =>
    onChange(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="border-t pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h5 className="flex items-center gap-1.5 text-xs font-semibold">
          <Scale className="h-3.5 w-3.5 text-muted-foreground" />
          AD/CVD cases
        </h5>
        {list.length < 2 && (
          <Button variant="ghost" size="sm" onClick={() => onChange([...list, { ...EMPTY }])}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add case
          </Button>
        )}
      </div>
      {errors[`${path}.adCvdCases`] && (
        <p className="mb-2 text-xs text-destructive">{errors[`${path}.adCvdCases`]}</p>
      )}
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No case on this line. Add the Commerce case number if the goods are subject to antidumping or countervailing duty.
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((c, i) => {
            const at = `${path}.adCvdCases.${i}`;
            return (
              <div key={i} className="space-y-3 rounded-md border bg-background p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <TextField
                    label="Case number"
                    required
                    value={c.caseNumber}
                    onChange={(v) => set(i, { caseNumber: v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 13) })}
                    placeholder="A-570-967-000"
                    hint="A = antidumping, C = countervailing."
                    error={errors[`${at}.caseNumber`]}
                  />
                  <SelectField
                    label="Deposit"
                    required
                    value={c.bondOrCash}
                    onChange={(v) => set(i, { bondOrCash: v as ABIAdCvdCase['bondOrCash'] })}
                    options={BOND_OR_CASH}
                  />
                  <SelectField
                    label="Rate type"
                    required
                    value={c.rateType}
                    onChange={(v) =>
                      set(i, { rateType: v as ABIAdCvdCase['rateType'], ...(v === 'A' && { quantity: undefined }) })
                    }
                    options={RATE_TYPES}
                  />
                  <TextField
                    label={c.rateType === 'A' ? 'Deposit rate (%)' : 'Deposit rate ($/unit)'}
                    required
                    type="number"
                    value={c.rate ? String(c.rate) : ''}
                    onChange={(v) => set(i, { rate: v === '' ? 0 : Number(v) })}
                    error={errors[`${at}.rate`]}
                  />
                  {c.rateType === 'S' && (
                    <TextField
                      label="Quantity"
                      required
                      type="number"
                      value={c.quantity !== undefined ? String(c.quantity) : ''}
                      onChange={(v) => set(i, { quantity: v === '' ? undefined : Number(v) })}
                      hint="In the unit the case rate is stated in."
                      error={errors[`${at}.quantity`]}
                    />
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const next = list.filter((_, j) => j !== i);
                      onChange(next.length > 0 ? next : undefined);
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove case
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
