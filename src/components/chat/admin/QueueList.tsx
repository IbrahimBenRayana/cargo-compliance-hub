import { Loader2, Inbox, Globe, MonitorSmartphone, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ChatQueueItem } from '@/api/client';

/** Relative "x ago" for the queue rows; falls back to a short date. */
function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function visitorLabel(item: ChatQueueItem): string {
  if (item.user) return `${item.user.firstName} ${item.user.lastName}`.trim() || item.user.email;
  return item.visitorName || item.visitorEmail || 'Visitor';
}

export function QueueList({
  items,
  selectedId,
  loading,
  onSelect,
  filter,
  onFilterChange,
}: {
  items: ChatQueueItem[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  filter: 'pending' | 'active';
  onFilterChange: (f: 'pending' | 'active') => void;
}) {
  return (
    <div className="flex h-full flex-col border-r border-border">
      {/* Filter tabs */}
      <div className="flex shrink-0 gap-1 border-b border-border p-2">
        {(['pending', 'active'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFilterChange(f)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-colors',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {f === 'pending' ? 'Waiting' : 'Active'}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-muted-foreground">
            <Inbox className="h-7 w-7 opacity-50" />
            <p className="text-[13px]">
              {filter === 'pending' ? 'No one is waiting right now.' : 'No active conversations.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const selected = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      'flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors',
                      selected ? 'bg-[hsl(43_96%_56%/0.1)]' : 'hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-foreground">
                        {visitorLabel(item)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {timeAgo(item.lastMessageAt ?? item.escalatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="gap-1 px-1.5 py-0 text-[10px] font-medium"
                      >
                        {item.surface === 'marketing' ? (
                          <Globe className="h-2.5 w-2.5" />
                        ) : (
                          <MonitorSmartphone className="h-2.5 w-2.5" />
                        )}
                        {item.surface === 'marketing' ? 'Marketing' : 'In-app'}
                      </Badge>
                      {item.mode === 'human' && (
                        <Badge className="bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-600 hover:bg-emerald-500/15">
                          {item.assignedAgent
                            ? `${item.assignedAgent.firstName} ${item.assignedAgent.lastName}`
                            : 'In progress'}
                        </Badge>
                      )}
                      {item.mode === 'pending_human' && (
                        <Badge className="bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-600 hover:bg-amber-500/15">
                          Waiting
                        </Badge>
                      )}
                    </div>
                    {item.escalationReason && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {item.escalationReason}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
