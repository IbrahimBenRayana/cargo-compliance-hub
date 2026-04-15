import { cn } from '@/lib/utils';
import { ShipmentStatus } from '@/types/shipment';

interface StatusConfig {
  label: string;
  dot: string;
  className: string;
}

const statusConfig: Record<ShipmentStatus, StatusConfig> = {
  draft: {
    label: 'Draft',
    dot: 'bg-slate-400',
    className: 'bg-slate-400/10 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/40',
  },
  submitted: {
    label: 'Submitted',
    dot: 'bg-blue-500',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50',
  },
  accepted: {
    label: 'Accepted',
    dot: 'bg-emerald-500',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50',
  },
  rejected: {
    label: 'Rejected',
    dot: 'bg-red-500',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50',
  },
  on_hold: {
    label: 'On Hold',
    dot: 'bg-amber-500',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50',
  },
  pending_cbp: {
    label: 'Pending CBP',
    dot: 'bg-blue-400',
    className: 'bg-blue-400/10 text-blue-500 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40',
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-slate-300',
    className: 'bg-slate-400/8 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/30 opacity-70',
  },
  amended: {
    label: 'Amended',
    dot: 'bg-amber-400',
    className: 'bg-amber-400/10 text-amber-500 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50',
  },
};

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full',
      'text-xs font-medium leading-none',
      config.className,
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)} />
      {config.label}
    </span>
  );
}
