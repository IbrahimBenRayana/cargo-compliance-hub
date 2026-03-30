import { Badge } from '@/components/ui/badge';
import { ShipmentStatus } from '@/types/shipment';
import { cn } from '@/lib/utils';

const statusConfig: Record<ShipmentStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted-foreground/15 text-muted-foreground border-transparent' },
  submitted: { label: 'Submitted', className: 'bg-primary/15 text-primary border-transparent' },
  accepted: { label: 'Accepted', className: 'bg-[hsl(var(--status-accepted))]/15 text-[hsl(var(--status-accepted))] border-transparent' },
  rejected: { label: 'Rejected', className: 'bg-destructive/15 text-destructive border-transparent' },
};

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const config = statusConfig[status];
  return (
    <Badge className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  );
}
