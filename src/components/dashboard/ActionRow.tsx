import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { dashboardApi } from '@/api/client';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ActionItem } from '@/types/dashboard';
import { DeadlinePill } from './DeadlinePill';

const ROW = 'grid grid-cols-[minmax(0,1fr)_auto_14px] sm:grid-cols-[minmax(0,1fr)_auto_112px] items-center gap-2 sm:gap-3 min-h-16 px-3 sm:px-4 py-2.5 can-hover:group-hover:bg-muted/40 transition-colors duration-100';
const LINK = 'text-[14px] leading-5 font-[550] text-foreground line-clamp-2 sm:line-clamp-1 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset';

function Text({ item }: { item: ActionItem }) {
  return (
    <p className="truncate text-[13px] leading-[18px] text-muted-foreground">
      <span className="font-mono text-[12.5px] font-medium text-foreground">{item.ref}</span>
      {item.party && <> · {item.party}</>}
      {item.meta && <span className="hidden lg:inline"> · {item.meta}</span>}
    </p>
  );
}

function Action({ label, primary }: { label: string; primary: boolean }) {
  return (
    <>
      <span aria-hidden className={cn(buttonVariants({ variant: primary ? 'default' : 'outline', size: 'sm' }), 'hidden sm:inline-flex h-8 w-full px-2 text-[12.5px] pointer-events-none')}>
        {label}
      </span>
      <ChevronRight aria-hidden className="h-3.5 w-3.5 text-muted-foreground sm:hidden" />
    </>
  );
}

export function ActionRow({ item, current, now }: { item: ActionItem; current: boolean; now: number }) {
  const name = `${item.primary.label}: ${item.title}, ${item.ref}`;
  return (
    <li className="group relative border-t border-border/60 first:border-t-0">
      {current && <span className="focus-frame" aria-hidden />}
      <div className={ROW}>
        <div className="min-w-0">
          <Link to={item.primary.href} aria-label={name} aria-current={current ? 'true' : undefined} className={LINK}>
            {item.title}
          </Link>
          <Text item={item} />
        </div>
        <DeadlinePill item={item} now={now} />
        <Action label={item.primary.label} primary={current} />
      </div>
    </li>
  );
}

/** A consolidation: one row of work until someone needs its house bills. */
export function GroupRow({ item, current, now }: { item: ActionItem; current: boolean; now: number }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['dashboard', 'group', item.group!.id, item.kind],
    queryFn: () => dashboardApi.actions({ group: item.group!.id, limit: 50 }),
    enabled: open,
  });
  const members = data?.items.filter((m) => m.kind === item.kind && m.lane === item.lane) ?? [];
  return (
    <>
      <li className="group relative border-t border-border/60 first:border-t-0">
        {current && <span className="focus-frame" aria-hidden />}
        <div className={ROW}>
          <div className="min-w-0">
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={cn(LINK, 'w-full text-left')}>
              {item.title}
            </button>
            <Text item={item} />
          </div>
          <DeadlinePill item={item} now={now} />
          <Action label={open ? 'Hide' : item.primary.label} primary={current} />
        </div>
      </li>
      {open && members.map((m) => <ActionRow key={m.id} item={m} current={false} now={now} />)}
    </>
  );
}
