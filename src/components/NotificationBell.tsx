import { useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useFilings';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from '@/lib/utils';
import { cn } from '@/lib/utils';

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  filing_submitted: { icon: Upload,       color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  filing_accepted:  { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  filing_rejected:  { icon: XCircle,      color: 'text-red-500',     bg: 'bg-red-500/10' },
  filing_amended:   { icon: FilePen,      color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  filing_cancelled: { icon: Ban,          color: 'text-slate-400',   bg: 'bg-slate-400/10' },
  deadline_warning: { icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  api_error:        { icon: AlertCircle,  color: 'text-red-500',     bg: 'bg-red-500/10' },
};

const defaultType = { icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted' };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.data ?? [];

  function handleClickNotification(notification: any) {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    if (notification.filingId) {
      navigate(`/shipments/${notification.filingId}`);
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
          aria-label="Open notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className={cn(
              'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full',
              'flex items-center justify-center',
              'bg-amber-500 text-[10px] font-bold text-amber-950',
              'ring-2 ring-background',
            )}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[340px] p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-[13px]">Notifications</h4>
            {unreadCount > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-semibold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
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

        {/* List */}
        <ScrollArea className="max-h-[420px]">
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
            <div className="py-12 flex flex-col items-center gap-2 text-center">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[13px] font-medium text-muted-foreground">All caught up</p>
              <p className="text-xs text-muted-foreground/60">No new notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {notifications.slice(0, 20).map((n: any) => {
                const cfg = typeConfig[n.type] ?? defaultType;
                const Icon = cfg.icon;

                return (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={cn(
                      'w-full text-left px-4 py-3.5 flex gap-3 items-start cursor-pointer',
                      'transition-colors duration-150 hover:bg-secondary/60',
                      !n.isRead && 'bg-amber-500/[0.03]',
                    )}
                  >
                    <div className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                      cfg.bg,
                    )}>
                      <Icon className={cn('h-4 w-4', cfg.color)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        'text-[13px] leading-snug',
                        !n.isRead ? 'font-semibold' : 'font-medium',
                      )}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(n.createdAt)}
                      </p>
                    </div>

                    {!n.isRead && (
                      <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 mt-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
