import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A form's progress as one segment a step, across the top of its panel, so
 * the form below keeps the full width. Finished steps can be reopened.
 */
export function StepProgress({ steps, current, onSelect }: {
  steps: readonly { id: string; label: string }[]; current: number; onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Steps" className="px-5 pt-5 sm:px-6">
      <ol className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const isActive = i === current;
          const isDone = i < current;
          return (
            <li key={s.id} className="min-w-0">
              <button
                type="button"
                onClick={() => { if (i <= current) onSelect(i); }}
                disabled={i > current}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${s.label}${isDone ? ', done' : ''}`}
                className={cn('group block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', i > current && 'cursor-not-allowed')}
              >
                <span aria-hidden className={cn('block h-1 rounded-full transition-colors duration-200', isDone ? 'bg-[hsl(var(--done-fill))]' : isActive ? 'bg-primary' : 'bg-border')} />
                <span aria-hidden className="mt-2 flex min-w-0 items-center gap-1.5 text-[12.5px] max-md:hidden">
                  <span className={cn('grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums', isDone ? 'bg-done-tint text-done' : isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                    {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={cn('truncate', isActive ? 'font-semibold text-foreground' : isDone ? 'font-medium text-foreground can-hover:group-hover:underline' : 'text-muted-foreground')}>{s.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
