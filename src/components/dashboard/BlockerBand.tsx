import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Blocker } from '@/types/dashboard';

/** Why filing is stopped, and the fix if this person can make it. Shows the first; the rest are counted. */
export function BlockerBand({ blockers }: { blockers: Blocker[] }) {
  const first = blockers[0];
  if (!first) return null;
  return (
    <div role="alert" className="rise flex flex-wrap items-center gap-3 rounded-[18px] bg-urgent-tint px-4 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-urgent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-urgent">{first.title}</p>
        <p className="text-[13px] text-foreground/80">
          {first.detail}
          {blockers.length > 1 && ` ${blockers.length - 1} more to resolve.`}
        </p>
      </div>
      {first.fix && <Button asChild size="sm"><Link to={first.fix.href}>{first.fix.label}</Link></Button>}
    </div>
  );
}
