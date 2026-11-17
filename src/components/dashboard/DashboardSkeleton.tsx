import { cn } from '@/lib/utils';

function Sk({ className, i = 0 }: { className?: string; i?: number }) {
  return <div className={cn('dash-sk', className)} style={{ '--i': i } as React.CSSProperties} />;
}

const CARD = 'rounded-xl border border-border/70 bg-card shadow-card';

/** The real page's shape with a light moving across it, so nothing jumps when data lands. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your dashboard" className="mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 pb-24 sm:mx-auto sm:pb-12">
      <div className="space-y-2">
        <Sk className="h-7 w-28" />
        <Sk className="h-4 w-56" i={1} />
      </div>
      <div className={cn(CARD, 'grid grid-cols-2 gap-px overflow-hidden bg-border p-0 sm:grid-cols-3 xl:grid-cols-6')}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2.5 bg-card p-4">
            <Sk className="h-3.5 w-3/4" i={i} />
            <Sk className="h-7 w-1/2" i={i} />
            <Sk className="h-3 w-2/3" i={i} />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_296px]">
        <div className={cn(CARD, 'overflow-hidden')}>
          <div className="flex items-center justify-between border-b border-border p-4">
            <Sk className="h-4 w-24" />
            <Sk className="h-4 w-1/2" i={1} />
          </div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-border/60 px-4 py-3 first:border-t-0">
              <Sk className="h-7 w-7 shrink-0 rounded-lg" i={i} />
              <Sk className="h-3.5 flex-1" i={i} />
              <Sk className="hidden h-3.5 w-24 sm:block" i={i} />
              <Sk className="h-5 w-16 rounded-md" i={i} />
            </div>
          ))}
        </div>
        <div className="grid gap-5">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className={cn(CARD, 'space-y-3 p-4')}>
              <Sk className="h-4 w-1/2" i={i} />
              <Sk className="h-20 w-full" i={i + 1} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
