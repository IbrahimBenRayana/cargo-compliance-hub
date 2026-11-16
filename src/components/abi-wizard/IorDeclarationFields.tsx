/**
 * Importer of record status — CBP's foreign importer of record rule
 * (19 CFR 110.2 / 141.22, 7501 15-Record; docs/specs/foreign-ior-rule.md).
 *
 * The U.S./foreign answer has no default: a wrong "U.S." is the costly
 * mistake, so a person must choose it and attest to it. The server stamps
 * who attested and when. CBP verifies the declaration; we never claim to.
 */
import { useId } from 'react';
import { AlertCircle, ShieldCheck } from '@/components/icons';
import type { ABIDocumentDraft } from '@/api/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { SectionHeader, TextField } from './shared';

type Ior = NonNullable<ABIDocumentDraft['ior']>;

interface Props {
  ior: Ior;
  setIor: (patch: Partial<Ior>) => void;
  errors: Record<string, string>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1 text-xs text-urgent">
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  );
}

export function attestedLine(ior: Pick<Ior, 'usIorAttestedByEmail' | 'usIorAttestedAt'>): string | null {
  if (!ior.usIorAttestedAt) return null;
  const when = new Date(ior.usIorAttestedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return ior.usIorAttestedByEmail ? `Confirmed ${when} by ${ior.usIorAttestedByEmail}` : `Confirmed ${when}`;
}

/** One-line summary of the declaration for the review step and entry detail. */
export function iorStatusLabel(ior: Pick<Ior, 'usImporterOfRecord'> | undefined): string | null {
  if (ior?.usImporterOfRecord === undefined) return null;
  return ior.usImporterOfRecord ? 'U.S. importer of record' : 'Foreign importer of record';
}

export default function IorDeclarationFields({ ior, setIor, errors }: Props) {
  const id = useId();
  const statusError = errors['ior.usImporterOfRecord'];
  const attestError = errors['ior.usIorAttested'];
  const status = ior.usImporterOfRecord === undefined ? '' : ior.usImporterOfRecord ? 'US' : 'FOREIGN';
  const stamp = attestedLine(ior);

  return (
    <div>
      <SectionHeader
        icon={<ShieldCheck className="h-4 w-4 text-primary" />}
        title="Importer of record status"
        description="CBP asks this on every entry. You declare it and CBP verifies it."
      />

      <div className="rounded-lg border border-border/70">
        <RadioGroup
          value={status}
          onValueChange={(v) =>
            setIor(v === 'US' ? { usImporterOfRecord: true } : { usImporterOfRecord: false, usIorAttested: undefined })
          }
          aria-label="Importer of record status"
          aria-required
          aria-invalid={statusError ? true : undefined}
          aria-describedby={statusError ? `${id}-status-error` : undefined}
          className="gap-0 divide-y divide-border/60"
        >
          <label className="flex cursor-pointer items-start gap-3 px-3.5 py-3">
            <RadioGroupItem value="US" id={`${id}-us`} className="mt-0.5" />
            <span>
              <Label htmlFor={`${id}-us`} className="cursor-pointer text-sm">U.S. importer of record</Label>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                A U.S. citizen or permanent resident, or a company located and organized in the U.S. that is at
                least 51% owned and controlled by U.S. citizens or permanent residents, or owns significant
                unencumbered U.S. real property.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 px-3.5 py-3">
            <RadioGroupItem value="FOREIGN" id={`${id}-foreign`} className="mt-0.5" />
            <span>
              <Label htmlFor={`${id}-foreign`} className="cursor-pointer text-sm">Foreign importer of record</Label>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                An importer that does not meet the U.S. test above (19 CFR 110.3).
              </span>
            </span>
          </label>
        </RadioGroup>
      </div>
      <FieldError id={`${id}-status-error`} message={statusError} />

      {ior.usImporterOfRecord && (
        <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 px-3.5 py-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id={`${id}-attest`}
              checked={ior.usIorAttested === true}
              onCheckedChange={(c) => setIor({ usIorAttested: c === true ? true : undefined })}
              aria-invalid={attestError ? true : undefined}
              aria-describedby={attestError ? `${id}-attest-error` : undefined}
              className="mt-0.5 rounded-[4px]"
            />
            <div>
              <Label htmlFor={`${id}-attest`} className="cursor-pointer text-sm font-normal leading-snug">
                I have checked that this importer meets 19 CFR 110.2.
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stamp ??
                  'A wrong U.S. declaration can lead CBP to require live entry and to seek penalties. We record who confirms and when.'}
              </p>
              <FieldError id={`${id}-attest-error`} message={attestError} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-border/70 px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <Label htmlFor={`${id}-bic`} className="text-sm">Our brokerage is the importer of record</Label>
            <p className="text-xs text-muted-foreground">
              Turn on when you, the broker, act as importer of record for a client under power of attorney.
            </p>
          </div>
          <Switch
            id={`${id}-bic`}
            checked={ior.brokerActingAsIor === true}
            onCheckedChange={(c) => setIor(c ? { brokerActingAsIor: true } : { brokerActingAsIor: false, principalOnPoa: undefined })}
          />
        </div>
        {ior.brokerActingAsIor && (
          <TextField
            className={cn('mt-3 md:max-w-sm')}
            label="Client's importer number"
            value={ior.principalOnPoa || ''}
            onChange={(v) => setIor({ principalOnPoa: v.trim().toUpperCase() || undefined })}
            placeholder="12-3456789"
            maxLength={12}
            hint="The principal on your power of attorney: EIN, SSN or CBP-assigned number. CBP requires it unless your brokerage is CTPAT validated."
            error={errors['ior.principalOnPoa']}
          />
        )}
      </div>
    </div>
  );
}
