import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/countdown';
import type { DashboardResponse } from '@/types/dashboard';

interface Props {
  attention: DashboardResponse['attention'];
  updatedAt: number;
  isStale: boolean;
  now: number;
  canCreate: boolean;
  onRetry: () => void;
}

function sentence(a: Props['attention'], now: number): { lead: string; tail: string | null } {
  const next = a.nextCutoffAt ? `Next cutoff in ${formatDuration(new Date(a.nextCutoffAt).getTime() - now)}.` : null;
  if (a.now === 0) return { lead: a.soon === 0 ? 'Nothing needs you right now.' : `Nothing urgent. ${a.soon.toLocaleString()} coming up.`, tail: next };
  const lead = `${a.now.toLocaleString()} ${a.now === 1 ? 'item needs' : 'items need'} you now.`;
  return { lead, tail: a.overdue > 0 ? `${a.overdue.toLocaleString()} overdue.` : next };
}

export function DashboardHeadline({ attention, updatedAt, isStale, now, canCreate, onRetry }: Props) {
  const { lead, tail } = sentence(attention, now);
  const date = new Date(now).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const ago = formatDuration(now - updatedAt);
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-7 sm:text-[28px] sm:leading-[34px] font-semibold tracking-[-0.02em] text-balance">
          {lead}
          {tail && <span className="font-medium text-muted-foreground"> {tail}</span>}
        </h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground tabular-nums">
          {isStale ? (
            <>
              Could not refresh. Showing {new Date(updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ·{' '}
              <button type="button" onClick={onRetry} className="underline text-foreground">Retry</button>
            </>
          ) : (
            <>{date} · Updated {ago === '<1m' ? 'just now' : `${ago} ago`}</>
          )}
        </p>
      </div>
      {canCreate && (
        <Button asChild className="shrink-0 h-11 w-11 p-0 sm:h-9 sm:w-auto sm:px-3.5">
          <Link to="/shipments/new" aria-label="New shipment">
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">New shipment</span>
          </Link>
        </Button>
      )}
    </header>
  );
}
