import { Badge } from '@/components/ui/badge';
import { ShipmentStatus } from '@/types/shipment';
import { cn } from '@/lib/utils';

const statusConfig: Record<ShipmentStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted-foreground/15 text-muted-foreground border-transparent' },
  submitted: { label: 'Submitted', className: 'bg-primary/15 text-primary border-transparent' },
  accepted: { label: 'Accepted', className: 'bg-[hsl(var(--status-accepted))]/15 text-[hsl(var(--status-accepted))] border-transparent' },
  rejected: { label: 'Rejected', className: 'bg-destructive/15 text-destructive border-transparent' },
  on_hold: { label: 'On Hold', className: 'bg-[hsl(var(--status-warning))]/15 text-[hsl(var(--status-warning))] border-transparent' },
  pending_cbp: { label: 'Pending CBP', className: 'bg-primary/15 text-primary border-transparent' },
  cancelled: { label: 'Cancelled', className: 'bg-muted-foreground/15 text-muted-foreground border-transparent line-through' },
  amended: { label: 'Amended', className: 'bg-[hsl(var(--status-warning))]/15 text-[hsl(var(--status-warning))] border-transparent' },
};

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const config = statusConfig[status];
  return (
    <Badge className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  );
}
