import { cn } from '@/lib/utils';

function Sk({ className, i = 0 }: { className?: string; i?: number }) {
  return <div className={cn('dash-sk', className)} style={{ '--i': i } as React.CSSProperties} />;
}

/** The list's own shape, so nothing moves when the rows arrive. */
export function ShipmentsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading shipments" className="mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 pb-24 sm:mx-auto sm:pb-12">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Sk className="h-7 w-32" />
          <Sk className="h-4 w-44" i={1} />
        </div>
        <Sk className="h-8 w-32 rounded-md" i={1} />
      </div>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
        <div className="flex gap-5 border-b border-border px-4 pb-3 pt-4">
          {Array.from({ length: 6 }, (_, i) => <Sk key={i} className="h-4 w-16" i={i} />)}
        </div>
        <div className="flex gap-2 border-b border-border px-4 py-2.5">
          <Sk className="h-8 w-72 rounded-md" />
          <Sk className="h-8 w-24 rounded-md" i={1} />
          <Sk className="h-8 w-24 rounded-md" i={2} />
        </div>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-border/60 px-4 py-3 first:border-t-0">
            <Sk className="h-4 w-4 shrink-0 rounded max-sm:hidden" i={i} />
            <Sk className="h-3.5 w-40" i={i} />
            <Sk className="hidden h-3.5 flex-1 md:block" i={i} />
            <Sk className="h-3.5 w-20" i={i} />
            <Sk className="hidden h-5 w-16 rounded-md sm:block" i={i} />
          </div>
        ))}
      </div>
    </div>
  );
}
