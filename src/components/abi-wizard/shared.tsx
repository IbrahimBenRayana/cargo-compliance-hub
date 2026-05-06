/**
 * Shared primitives for the ABI 7501 wizard step components.
 *
 * These helpers mirror ShipmentWizard.tsx's inline TextField/SelectField style
 * so the two wizards feel consistent, but they are kept separate because the
 * ABI wizard works against a DeepPartial `ABIDocumentDraft` state instead of
 * a flat ISF form model.
 */
import { memo, useState, type ReactNode } from 'react';
import { AlertCircle, Check, ChevronsUpDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ─── YYYYMMDD <-> ISO date helpers ─────────────────────────
// CBP stores dates as YYYYMMDD strings; <input type="date"> uses YYYY-MM-DD.
export function yyyymmddToISO(v: string | undefined | null): string {
  if (!v) return '';
  const s = String(v);
  if (s.length === 10 && s.includes('-')) return s; // already ISO
  if (s.length !== 8) return '';
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function uiToYYYYMMDD(v: string | undefined | null): string {
  if (!v) return '';
  const s = String(v);
  if (s.length === 8 && !s.includes('-')) return s;
  return s.replace(/-/g, '');
}

// ─── US states (inline — no existing helper in the codebase) ──
export const US_STATES: { value: string; label: string }[] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
  ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
  ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'], ['PR', 'Puerto Rico'],
].map(([value, label]) => ({ value, label: `${value} — ${label}` }));

// ─── Common countries (reused across invoice / item / consignee) ──
export const COUNTRIES: { value: string; label: string }[] = [
  { value: 'US', label: 'US — United States' },
  { value: 'CN', label: 'CN — China' },
  { value: 'IN', label: 'IN — India' },
  { value: 'DE', label: 'DE — Germany' },
  { value: 'JP', label: 'JP — Japan' },
  { value: 'KR', label: 'KR — South Korea' },
  { value: 'TW', label: 'TW — Taiwan' },
  { value: 'VN', label: 'VN — Vietnam' },
  { value: 'TH', label: 'TH — Thailand' },
  { value: 'MX', label: 'MX — Mexico' },
  { value: 'CA', label: 'CA — Canada' },
  { value: 'GB', label: 'GB — United Kingdom' },
  { value: 'FR', label: 'FR — France' },
  { value: 'IT', label: 'IT — Italy' },
  { value: 'BR', label: 'BR — Brazil' },
  { value: 'BD', label: 'BD — Bangladesh' },
  { value: 'ID', label: 'ID — Indonesia' },
  { value: 'PK', label: 'PK — Pakistan' },
  { value: 'TR', label: 'TR — Turkey' },
  { value: 'MY', label: 'MY — Malaysia' },
  { value: 'SG', label: 'SG — Singapore' },
  { value: 'HK', label: 'HK — Hong Kong' },
  { value: 'AE', label: 'AE — UAE' },
  { value: 'NL', label: 'NL — Netherlands' },
  { value: 'ES', label: 'ES — Spain' },
  { value: 'AU', label: 'AU — Australia' },
  { value: 'PH', label: 'PH — Philippines' },
];

export const CURRENCIES: { value: string; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'JPY', label: 'JPY' },
  { value: 'CNY', label: 'CNY' },
  { value: 'CAD', label: 'CAD' },
  { value: 'MXN', label: 'MXN' },
  { value: 'KRW', label: 'KRW' },
  { value: 'INR', label: 'INR' },
  { value: 'AUD', label: 'AUD' },
];

// ─── HintLabel ─────────────────────────────────────────────
export const HintLabel = memo(function HintLabel({
  label,
  hint,
  required,
  labelExtra,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  /** Optional slot rendered after the label (e.g. provenance chip). */
  labelExtra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {hint && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {hint}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {labelExtra}
    </div>
  );
});

// ─── TextField ─────────────────────────────────────────────
export const TextField = memo(function TextField({
  label,
  hint,
  required,
  placeholder,
  value,
  onChange,
  maxLength,
  type = 'text',
  error,
  disabled,
  className: cls,
  labelExtra,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  type?: 'text' | 'number' | 'date' | 'email';
  error?: string;
  disabled?: boolean;
  className?: string;
  labelExtra?: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', cls)}>
      <HintLabel label={label} hint={hint} required={required} labelExtra={labelExtra} />
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        className={cn(error && 'border-red-500 focus-visible:ring-red-500')}
      />
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
});

// ─── SelectField ───────────────────────────────────────────
export const SelectField = memo(function SelectField({
  label,
  hint,
  required,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled,
  disabledValues,
  className: cls,
  labelExtra,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  disabledValues?: string[];
  className?: string;
  labelExtra?: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', cls)}>
      <HintLabel label={label} hint={hint} required={required} labelExtra={labelExtra} />
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={cn(error && 'border-red-500')}>
          <SelectValue placeholder={placeholder || 'Select...'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              disabled={disabledValues?.includes(o.value)}
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
});

// ─── ComboboxField (for long searchable lists like ports) ──
export const ComboboxField = memo(function ComboboxField({
  label,
  hint,
  required,
  value,
  onChange,
  options,
  placeholder,
  error,
  className: cls,
  searchPlaceholder,
  labelExtra,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  className?: string;
  searchPlaceholder?: string;
  labelExtra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <div className={cn('space-y-1.5', cls)}>
      <HintLabel label={label} hint={hint} required={required} labelExtra={labelExtra} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between font-normal h-9 px-3',
              !selected && 'text-muted-foreground',
              error && 'border-red-500',
            )}
          >
            <span className="truncate">
              {selected ? selected.label : placeholder || 'Select…'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command>
            <CommandInput
              placeholder={searchPlaceholder || 'Search…'}
            />
            <CommandList className="max-h-[280px]">
              <CommandEmpty>No match.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === o.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
});

// ─── DateField: YYYYMMDD storage, YYYY-MM-DD UI ────────────
export const DateField = memo(function DateField({
  label,
  hint,
  required,
  value, // YYYYMMDD
  onChange, // receives YYYYMMDD
  error,
  disabled,
  className: cls,
  labelExtra,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
  labelExtra?: React.ReactNode;
}) {
  const iso = yyyymmddToISO(value);
  return (
    <div className={cn('space-y-1.5', cls)}>
      <HintLabel label={label} hint={hint} required={required} labelExtra={labelExtra} />
      <Input
        type="date"
        value={iso}
        disabled={disabled}
        onChange={(e) => onChange(uiToYYYYMMDD(e.target.value))}
        className={cn(error && 'border-red-500 focus-visible:ring-red-500')}
      />
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
});

// ─── SectionHeader ─────────────────────────────────────────
export function SectionHeader({
  title,
  description,
  icon,
  right,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}
