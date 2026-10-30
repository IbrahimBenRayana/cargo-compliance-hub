import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 1 … 4 5 6 … 12: always the ends, and the pages around this one. */
function pageList(page: number, pageCount: number): Array<number | 'gap'> {
  const keep = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...keep].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i && p - pages[i - 1] > 1 ? (['gap', p] as const) : [p]));
}

const BTN = 'relative grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-[13px] font-medium tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';

export function Pagination({ page, pageCount, total, pageSize, onChange }: {
  page: number; pageCount: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Action items pages" className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-2">
      <p className="text-[12.5px] tabular-nums text-muted-foreground">{from}-{to} of {total.toLocaleString()}</p>
      {pageCount > 1 && (
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => onChange(page - 1)} className={cn(BTN, 'text-muted-foreground can-hover:hover:bg-muted can-hover:hover:text-foreground')}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          {pageList(page, pageCount).map((p, i) => (p === 'gap' ? (
            <span key={`gap-${i}`} aria-hidden className="w-6 text-center text-[13px] text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onChange(p)}
              className={cn(BTN, 'max-sm:hidden', p === page ? 'text-primary-foreground' : 'text-muted-foreground can-hover:hover:bg-muted can-hover:hover:text-foreground')}
            >
              {p === page && <motion.span layoutId="attention-page" className="absolute inset-0 rounded-lg bg-primary" transition={{ type: 'spring', bounce: 0, duration: 0.3 }} />}
              <span className="relative">{p}</span>
            </button>
          )))}
          <span className="px-1.5 text-[12.5px] tabular-nums text-muted-foreground sm:hidden">{page} of {pageCount}</span>
          <button type="button" aria-label="Next page" disabled={page === pageCount} onClick={() => onChange(page + 1)} className={cn(BTN, 'text-muted-foreground can-hover:hover:bg-muted can-hover:hover:text-foreground')}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </nav>
  );
}
