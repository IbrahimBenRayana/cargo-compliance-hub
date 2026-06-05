/**
 * Shared primitives for the ABI 7501 wizard step components.
 *
 * These helpers mirror ShipmentWizard.tsx's inline TextField/SelectField style
 * so the two wizards feel consistent, but they are kept separate because the
 * ABI wizard works against a DeepPartial `ABIDocumentDraft` state instead of
 * a flat ISF form model.
 */
import { memo, useId, useState, type ReactNode } from 'react';
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
// US_STATES, COUNTRIES, CURRENCIES live in src/data/geo.ts — re-exported here
// so existing imports from this module keep working.
export { US_STATES, COUNTRIES, CURRENCIES } from '@/data/geo';

// ─── HintLabel ─────────────────────────────────────────────
export const HintLabel = memo(function HintLabel({
  label,
  hint,
  required,
  labelExtra,
  htmlFor,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  /** Optional slot rendered after the label (e.g. provenance chip). */
  labelExtra?: React.ReactNode;
  /** id of the labelled input — wires click-to-focus + a11y (Phase 8.4). */
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
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
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  return (
    <div className={cn('space-y-1.5', cls)}>
      <HintLabel label={label} hint={hint} required={required} labelExtra={labelExtra} htmlFor={fieldId} />
      <Input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        className={cn(error && 'border-red-500 focus-visible:ring-red-500')}
      />
      {error && (
        <p id={errorId} className="text-xs text-red-500 flex items-center gap-1">
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
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  return (
    <div className={cn('space-y-1.5', cls)}>
      <HintLabel label={label} hint={hint} required={required} labelExtra={labelExtra} htmlFor={fieldId} />
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(error && 'border-red-500')}
        >
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
        <p id={errorId} className="text-xs text-red-500 flex items-center gap-1">
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
  options: { value: string; label: string; keywords?: string[] }[];
  placeholder?: string;
  error?: string;
  className?: string;
  searchPlaceholder?: string;
  labelExtra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  return (
    <div className={cn('space-y-1.5', cls)}>
      <HintLabel label={label} hint={hint} required={required} labelExtra={labelExtra} htmlFor={fieldId} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
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
                    // keywords feed cmdk's match scorer alongside the value —
                    // lets a country combo find "United States" when the user
                    // types "USA" or "America".
                    keywords={o.keywords}
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
        <p id={errorId} className="text-xs text-red-500 flex items-center gap-1">
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
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  return (
    <div className={cn('space-y-1.5', cls)}>
      <HintLabel label={label} hint={hint} required={required} labelExtra={labelExtra} htmlFor={fieldId} />
      <Input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        type="date"
        value={iso}
        disabled={disabled}
        onChange={(e) => onChange(uiToYYYYMMDD(e.target.value))}
        className={cn(error && 'border-red-500 focus-visible:ring-red-500')}
      />
      {error && (
        <p id={errorId} className="text-xs text-red-500 flex items-center gap-1">
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
