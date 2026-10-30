import { cn } from '@/lib/utils';
import type { ActionFilter, DashboardResponse } from '@/types/dashboard';

interface Props {
  filters: DashboardResponse['filters'];
  active: ActionFilter;
  onChange: (f: ActionFilter) => void;
}

export function FilterChips({ filters, active, onChange }: Props) {
  return (
    <div role="group" aria-label="Filter the queue" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
      {filters.map((f) => {
        const on = f.key === active;
        const urgent = f.key === 'overdue' && f.count > 0;
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={on}
            disabled={f.count === 0 && f.key !== 'all'}
            onClick={() => onChange(f.key)}
            className={cn(
              'inline-flex h-9 sm:h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium',
              'disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground can-hover:hover:bg-muted/50',
            )}
          >
            {f.label}
            <span className={cn('tabular-nums font-semibold', on ? 'opacity-75' : urgent ? 'text-urgent' : 'text-muted-foreground')}>
              {f.count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
