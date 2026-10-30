import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { Blocker } from '@/types/dashboard';

/** Why filing is stopped, and the fix if this person can make it. Shows the first; the rest are counted. */
export function BlockerBand({ blockers }: { blockers: Blocker[] }) {
  const first = blockers[0];
  if (!first) return null;
  return (
    <div role="alert" className="dash-in flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-urgent/25 bg-urgent-tint px-4 py-2.5 text-[13px]">
      <AlertTriangle className="h-4 w-4 shrink-0 text-urgent" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-semibold text-urgent">{first.title}</span>{' '}
        <span className="text-foreground/80">
          {first.detail}
          {blockers.length > 1 && ` ${blockers.length - 1} more to resolve.`}
        </span>
      </p>
      {first.fix && <Link to={first.fix.href} className="font-medium text-urgent underline underline-offset-2">{first.fix.label}</Link>}
    </div>
  );
}
