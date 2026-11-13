/**
 * One line of goods in the calculator: what it is, what it is worth, and,
 * folded away, the metal content and exemptions that only some goods need.
 */
import { ChevronDown, Trash2 } from '@/components/icons';
import { TextField } from '@/components/abi-wizard/shared';
import type { SourceProvenance } from '@/lib/duty-calc-prefill';
import { ProvenanceChip } from './SourcePicker';
import type { ItemDraft, Mode } from './types';

const EXEMPTIONS: Array<[keyof ItemDraft, string]> = [
  ['isCottonExempt', 'Cotton fee exempt'],
  ['isAutoPartExempt', 'Auto parts exempt'],
  ['kitchenPartNotComplete', 'Kitchen part, not complete'],
  ['isInformationalMaterialExempt', 'Informational materials exempt'],
];

export function ItemRow({ index, mode, item, onChange, onRemove, provenanceFor, errors }: {
  index: number;
  mode: Mode;
  item: ItemDraft;
  onChange: (patch: Partial<ItemDraft>) => void;
  /** Absent when this is the only line. */
  onRemove?: () => void;
  provenanceFor: (key: string) => SourceProvenance | null;
  errors: Partial<Record<keyof ItemDraft, string>>;
}) {
  const extras = [item.aluminumPercentage, item.steelPercentage, item.copperPercentage].filter(Boolean).length
    + EXEMPTIONS.filter(([k]) => item[k]).length;

  return (
    <li className="px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold">Line {index + 1}</p>
        {onRemove && (
          <button
            type="button" onClick={onRemove} aria-label={`Remove line ${index + 1}`}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:bg-urgent-tint can-hover:hover:text-urgent"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-12">
        {mode === 'standard' && (
          <TextField
            className="lg:col-span-3" label="HTS code" required value={item.hts} onChange={(v) => onChange({ hts: v })}
            placeholder="7320.20.1000" hint="Six to ten digits. Dots are optional."
            labelExtra={<ProvenanceChip source={provenanceFor('hts')} />} error={errors.hts}
          />
        )}
        <TextField
          className={mode === 'standard' ? 'lg:col-span-6' : 'lg:col-span-9'} label="Description" required maxLength={300}
          value={item.description} onChange={(v) => onChange({ description: v })}
          placeholder={mode === 'ai' ? 'Stainless steel kitchen sink, single bowl, brushed finish' : 'What the goods are'}
          hint={mode === 'ai' ? 'Material, use and form all help the classification.' : undefined}
          labelExtra={<ProvenanceChip source={provenanceFor('description')} />} error={errors.description}
        />
        <TextField
          className="lg:col-span-3" label="Value" required type="number" value={item.totalValue} onChange={(v) => onChange({ totalValue: v })}
          placeholder="0.00" hint="Customs value of this line, in the currency chosen above."
          labelExtra={<ProvenanceChip source={provenanceFor('totalValue')} />} error={errors.totalValue}
        />
        <TextField
          className="lg:col-span-3" label="Quantity" type="number" value={item.quantity1} onChange={(v) => onChange({ quantity1: v })}
          placeholder="1500" hint="In the unit the HTS line reports in (kilograms, pieces, dozens). Leave blank if you do not know it."
          labelExtra={<ProvenanceChip source={provenanceFor('quantity1')} />} error={errors.quantity1}
        />
        <TextField
          className="lg:col-span-3" label="Second quantity" type="number" value={item.quantity2} onChange={(v) => onChange({ quantity2: v })}
          placeholder="12" hint="Only for HTS lines that report in two units." error={errors.quantity2}
        />
        <TextField
          className="lg:col-span-3" label="Special program" value={item.spi} onChange={(v) => onChange({ spi: v.toUpperCase() })}
          placeholder="MX" maxLength={4} hint="The special program indicator, such as MX for USMCA." error={errors.spi}
        />
      </div>

      <details className="group mt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronDown className="h-3.5 w-3.5 transition-transform duration-150 group-open:rotate-180" aria-hidden />
          Metal content and exemptions
          {extras > 0 && <span className="rounded-full bg-muted px-1.5 text-[11.5px] tabular-nums text-foreground">{extras}</span>}
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-12">
          <TextField className="lg:col-span-2" label="Aluminum %" type="number" value={item.aluminumPercentage} onChange={(v) => onChange({ aluminumPercentage: v })} placeholder="0" />
          <TextField className="lg:col-span-2" label="Steel %" type="number" value={item.steelPercentage} onChange={(v) => onChange({ steelPercentage: v })} placeholder="0" />
          <TextField className="lg:col-span-2" label="Copper %" type="number" value={item.copperPercentage} onChange={(v) => onChange({ copperPercentage: v })} placeholder="0" />
          <fieldset className="sm:col-span-3 lg:col-span-6">
            <legend className="text-sm font-medium">Exemptions</legend>
            <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {EXEMPTIONS.map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input
                    type="checkbox" className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
                    checked={Boolean(item[key])} onChange={(e) => onChange({ [key]: e.target.checked } as Partial<ItemDraft>)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>
    </li>
  );
}
