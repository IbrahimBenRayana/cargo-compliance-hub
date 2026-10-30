import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';
import type { DashboardResponse, Stage } from '@/types/dashboard';
import { Surface } from './Surface';

const COLOUR: Record<Stage, string> = {
  isf_to_send: 'bg-[hsl(217_91%_60%)]',
  isf_sent: 'bg-[hsl(217_91%_60%/0.55)]',
  entry_needed: 'bg-[hsl(38_92%_55%)]',
  entry_to_send: 'bg-[hsl(262_83%_58%)]',
  entry_sent: 'bg-[hsl(262_83%_58%/0.55)]',
  accepted: 'bg-[hsl(160_84%_39%)]',
};

function Stat({ stage }: { stage: DashboardResponse['flow'][number] }) {
  const shown = useCountUp(stage.count);
  return (
    <Link to={stage.href} className="group min-w-0 rounded-lg px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors duration-150 can-hover:group-hover:text-foreground">
        <i className={cn('h-2 w-2 shrink-0 rounded-sm', COLOUR[stage.key])} />
        <span className="truncate">{stage.label}</span>
      </span>
      <span className="mt-0.5 block text-[22px] font-semibold leading-7 tracking-[-0.02em] tabular-nums">{shown.toLocaleString()}</span>
    </Link>
  );
}

/** Where everything is, in proportion: one bar, one segment per stage. */
export function PipelineBand({ flow, index }: { flow: DashboardResponse['flow']; index: number }) {
  const total = flow.reduce((a, s) => a + s.count, 0);
  return (
    <Surface index={index} core="p-5">
      <h2 className="sr-only">Shipments by stage</h2>
      <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full bg-foreground/[0.05]" aria-hidden>
        {total > 0 && flow.filter((s) => s.count > 0).map((s, i) => (
          <div key={s.key} className={cn('grow-x h-full rounded-[2px]', COLOUR[s.key])} style={{ flex: `${Math.max(s.count, total * 0.015)} 1 0%`, '--i': i } as React.CSSProperties} />
        ))}
      </div>
      <div className={cn('mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3', flow.length > 3 ? 'lg:grid-cols-6' : 'lg:grid-cols-3')}>
        {flow.map((s) => <Stat key={s.key} stage={s} />)}
      </div>
    </Surface>
  );
}
