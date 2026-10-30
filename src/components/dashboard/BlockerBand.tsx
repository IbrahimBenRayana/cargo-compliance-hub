import { Link } from 'react-router-dom';
import type { Blocker } from '@/types/dashboard';

/** Why filing is stopped, and the fix if this person can make it. Shows the first; the rest are counted. */
export function BlockerBand({ blockers }: { blockers: Blocker[] }) {
  const first = blockers[0];
  if (!first) return null;
  return (
    <div role="alert" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-urgent/30 bg-urgent-tint px-4 py-2.5 text-[13px]">
      <p>
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
