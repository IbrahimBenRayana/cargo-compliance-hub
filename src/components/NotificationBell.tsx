import { useMemo, useState } from 'react';
import {
  Bell,
  Upload,
  CheckCircle2,
  XCircle,
  FilePen,
  Ban,
  Clock,
  AlertCircle,
  FileText,
  PauseCircle,
  Hourglass,
  FileCheck,
  Search,
  CreditCard,
  XOctagon,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/useFilings';
import type { Notification, NotificationSeverity } from '@/types/notification';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from '@/lib/utils';
import { cn } from '@/lib/utils';

// ─── Visual mapping (kind → icon, severity → rail color) ─────────────

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  // Filing
  filing_submitted: { icon: Upload,        color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
  filing_accepted:  { icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  filing_rejected:  { icon: XCircle,       color: 'text-red-500',     bg: 'bg-red-500/10'     },
  filing_on_hold:   { icon: PauseCircle,   color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
  filing_amended:   { icon: FilePen,       color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
  filing_cancelled: { icon: Ban,           color: 'text-slate-400',   bg: 'bg-slate-400/10'   },
  filing_stale:     { icon: Hourglass,     color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
  // Deadlines
  deadline_warning: { icon: Clock,         color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
  deadline_overdue: { icon: Clock,         color: 'text-red-500',     bg: 'bg-red-500/10'     },
  // ABI / CBP entry
  entry_submitted:  { icon: Upload,        color: 'text-violet-500',  bg: 'bg-violet-500/10'  },
  entry_accepted:   { icon: FileCheck,     color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  entry_rejected:   { icon: XCircle,       color: 'text-red-500',     bg: 'bg-red-500/10'     },
  // Manifest queries
  manifest_query_complete: { icon: Search, color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
  manifest_query_failed:   { icon: Search, color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
  // Billing
  billing_subscription_changed:  { icon: CreditCard, color: 'text-blue-500',  bg: 'bg-blue-500/10'  },
  billing_subscription_canceled: { icon: XOctagon,   color: 'text-amber-500', bg: 'bg-amber-500/10' },
  billing_payment_failed:        { icon: XOctagon,   color: 'text-red-500',   bg: 'bg-red-500/10'   },
  // Team
  team_member_joined: { icon: UserPlus,    color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  // System
  api_error:        { icon: AlertCircle,   color: 'text-red-500',     bg: 'bg-red-500/10'     },
};
const defaultType = { icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted' };

const severityRailClass: Record<NotificationSeverity, string> = {
  critical: 'bg-red-500/70',
  warning:  'bg-amber-500/70',
  info:     '',
};

// ─── Day grouping ────────────────────────────────────────────────────

type DayBucket = 'today' | 'yesterday' | 'older';
const dayBucketLabel: Record<DayBucket, string> = {
  today:     'Today',
  yesterday: 'Yesterday',
  older:     'Earlier',
};

function bucketFor(iso: string): DayBucket {
  const created = new Date(iso);
  const now = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Compare date-only (local time), not absolute hours, so "yesterday" is
  // strictly the previous calendar day rather than 24h ago.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const createdMs = created.getTime();

  if (createdMs >= startOfToday) return 'today';
  if (createdMs >= startOfToday - oneDayMs) return 'yesterday';
  return 'older';
}

// ─── Tabs ────────────────────────────────────────────────────────────

type TabId = 'all' | 'unread' | 'critical';

const tabsOrder: TabId[] = ['all', 'unread', 'critical'];

const tabLabel: Record<TabId, string> = {
  all:      'All',
  unread:   'Unread',
  critical: 'Critical',
};

// ─── Component ───────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>('all');

  // Always run the unscoped query so the bell badge stays accurate
  // regardless of which tab is active.
  const baseQuery = useNotifications({});
  const filteredQuery = useNotifications(
    tab === 'unread'   ? { unreadOnly: true } :
    tab === 'critical' ? { severity: 'critical' } :
    {}
  );

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  const unreadCount = baseQuery.data?.unreadCount ?? 0;
  const criticalUnread = baseQuery.data?.criticalUnreadCount ?? 0;
  const notifications = (filteredQuery.data?.data ?? []) as Notification[];
  const isLoading = filteredQuery.isLoading;

  // Bell badge color reflects highest urgency: red if any critical unread,
  // else amber if any unread, else hidden.
  const badgeKind: 'critical' | 'unread' | 'none' =
    criticalUnread > 0 ? 'critical'
    : unreadCount > 0   ? 'unread'
    :                     'none';
  const badgeCount = badgeKind === 'critical' ? criticalUnread : unreadCount;

  // Group notifications by day bucket. Server already returns by createdAt desc
  // so the buckets are emitted in the right visual order.
  const grouped = useMemo(() => {
    const buckets: Record<DayBucket, Notification[]> = { today: [], yesterday: [], older: [] };
    for (const n of notifications) buckets[bucketFor(n.createdAt)].push(n);
    return buckets;
  }, [notifications]);

  function handleClick(n: Notification) {
    if (!n.isRead) markRead.mutate(n.id);
    const target = n.linkUrl ?? (n.filingId ? `/shipments/${n.filingId}` : null);
    if (target) {
      navigate(target);
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
          aria-label={badgeCount > 0 ? `Open notifications, ${badgeCount} unread` : 'Open notifications'}
        >
          <Bell className="h-[18px] w-[18px]" />
          {badgeKind !== 'none' && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full',
                'flex items-center justify-center text-[10px] font-bold ring-2 ring-background',
                badgeKind === 'critical'
                  ? 'bg-red-500 text-white'
                  : 'bg-amber-500 text-amber-950',
              )}
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[360px] p-0" align="end">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b">
          <h4 className="font-semibold text-[13px] tracking-[-0.01em]">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-2 border-b">
          {tabsOrder.map(id => {
            const isActive = id === tab;
            const count = id === 'unread'   ? unreadCount
                        : id === 'critical' ? criticalUnread
                        :                     undefined;
            const showCount = count !== undefined && count > 0;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'group inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-[12px] font-medium',
                  'transition-colors duration-150 cursor-pointer',
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
                )}
              >
                {tabLabel[id]}
                {showCount && (
                  <span
                    className={cn(
                      'min-w-[18px] h-[16px] px-1 rounded-full text-[10px] font-semibold tabular-nums flex items-center justify-center',
                      id === 'critical'
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── List ── */}
        <ScrollArea className="max-h-[440px]">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 items-start animate-pulse">
                  <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2.5 bg-muted rounded w-full" />
                    <div className="h-2.5 bg-muted rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <div className="py-1">
              {(['today', 'yesterday', 'older'] as DayBucket[]).map(bucket => {
                if (grouped[bucket].length === 0) return null;
                return (
                  <div key={bucket}>
                    <div className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                      {dayBucketLabel[bucket]}
                    </div>
                    <div className="divide-y divide-border/60">
                      {grouped[bucket].map(n => (
                        <NotificationRow key={n.id} notification={n} onClick={() => handleClick(n)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function NotificationRow({ notification, onClick }: { notification: Notification; onClick: () => void }) {
  const cfg = typeConfig[notification.type] ?? defaultType;
  const Icon = cfg.icon;
  const railClass = severityRailClass[notification.severity];

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full text-left px-4 py-3 flex gap-3 items-start cursor-pointer',
        'transition-colors duration-150 hover:bg-secondary/60',
        !notification.isRead && 'bg-amber-500/[0.03]',
      )}
    >
      {/* Severity rail — left-edge bar, only for warning/critical */}
      {railClass && (
        <span
          className={cn('absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full', railClass)}
          aria-hidden
        />
      )}

      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
        <Icon className={cn('h-4 w-4', cfg.color)} />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn('text-[13px] leading-snug', !notification.isRead ? 'font-semibold' : 'font-medium')}>
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground/60 mt-1 tabular-nums">
          {formatDistanceToNow(notification.createdAt)}
        </p>
      </div>

      {!notification.isRead && (
        <span
          className={cn(
            'h-2 w-2 rounded-full shrink-0 mt-2',
            notification.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500',
          )}
          aria-label="Unread"
        />
      )}
    </button>
  );
}

function EmptyState({ tab }: { tab: TabId }) {
  const copy =
    tab === 'unread'   ? { title: 'All caught up',     sub: 'No unread notifications.' }
    : tab === 'critical' ? { title: 'Nothing critical', sub: "Things that need urgent attention will show up here." }
    :                       { title: 'Nothing yet',     sub: 'Filing updates and deadline alerts will appear here.' };

  return (
    <div className="py-12 flex flex-col items-center gap-2 text-center">
      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
        <Bell className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-[13px] font-medium text-muted-foreground">{copy.title}</p>
      <p className="text-xs text-muted-foreground/60 max-w-[260px]">{copy.sub}</p>
    </div>
  );
}
