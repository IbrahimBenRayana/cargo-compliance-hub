/**
 * Importer of record status — CBP's foreign importer of record rule
 * (19 CFR 110.2 / 141.22, 7501 15-Record; docs/specs/foreign-ior-rule.md).
 *
 * The U.S./foreign answer has no default: a wrong "U.S." is the costly
 * mistake, so a person must choose it and attest to it. The server stamps
 * who attested and when. CBP verifies the declaration; we never claim to.
 */
import { useEffect, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ShieldCheck } from '@/components/icons';
import { importerProfilesApi, type ABIDocumentDraft, type ImporterProfile } from '@/api/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { SectionHeader, SelectField, TextField } from './shared';
import { canonicalIorNumber } from './validators';

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

const CTPAT_OPTIONS = [
  { value: 'VALIDATED', label: 'Yes, validated (Tier 2 or 3)' },
  { value: 'NONE', label: 'No' },
  { value: 'UNKNOWN', label: 'Not sure' },
];

function savedLine(saved: ImporterProfile): string {
  const status = saved.usIorStatus === 'US' ? 'U.S. importer of record' : 'Foreign importer of record';
  const when = saved.declaredAt ? new Date(saved.declaredAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null;
  return `Filled in from your saved importer: ${status}${when ? `, declared ${when}` : ''}${saved.declaredByEmail ? ` by ${saved.declaredByEmail}` : ''}.`;
}

export default function IorDeclarationFields({ ior, setIor, errors }: Props) {
  const id = useId();
  const statusError = errors['ior.usImporterOfRecord'];
  const attestError = errors['ior.usIorAttested'];
  const status = ior.usImporterOfRecord === undefined ? '' : ior.usImporterOfRecord ? 'US' : 'FOREIGN';

  // Saved importers: the org's last declaration for this IOR fills an
  // unanswered entry in. It never overrides an answer already given.
  const lookupNumber = canonicalIorNumber(ior.number ?? '');
  const { data: saved } = useQuery({
    queryKey: ['importer-profile', lookupNumber],
    queryFn: () => importerProfilesApi.lookup(lookupNumber!).then((r) => r.data),
    enabled: lookupNumber !== null,
    staleTime: 60_000,
  });
  const unanswered = ior.usImporterOfRecord === undefined;
  useEffect(() => {
    if (!saved || !unanswered) return;
    setIor({
      usImporterOfRecord: saved.usIorStatus === 'US',
      usIorAttested: saved.usIorStatus === 'US' && saved.declaredAt ? true : undefined,
      ...(saved.ctpatStatus !== 'UNKNOWN' && { ctpatStatus: saved.ctpatStatus }),
      ...(!ior.name && saved.name && { name: saved.name }),
    });
    // setIor and ior.name change every render; the saved answer applies once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, unanswered]);
  const fromSaved = saved && saved.usIorStatus === status && saved.iorNumber === lookupNumber ? saved : null;
  const stamp =
    attestedLine(ior) ??
    (fromSaved?.usIorStatus === 'US' && ior.usIorAttested && fromSaved.declaredAt
      ? attestedLine({ usIorAttestedAt: fromSaved.declaredAt, usIorAttestedByEmail: fromSaved.declaredByEmail ?? undefined })
      : null);

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
      {fromSaved && <p className="mt-1.5 text-xs text-muted-foreground">{savedLine(fromSaved)}</p>}

      {ior.usImporterOfRecord === false && (
        <SelectField
          className="mt-3 md:max-w-sm"
          label={ior.brokerActingAsIor ? 'Is your client CTPAT validated?' : 'Is this importer CTPAT validated?'}
          value={ior.ctpatStatus ?? ''}
          onChange={(v) => setIor({ ctpatStatus: v as Ior['ctpatStatus'] })}
          options={CTPAT_OPTIONS}
          placeholder="Choose…"
          hint="CBP checks CTPAT itself and is not told your answer. It only lets us warn you before CBP would reject a foreign importer's entry."
        />
      )}

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
