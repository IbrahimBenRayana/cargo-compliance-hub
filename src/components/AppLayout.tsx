import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuthStore, useLogout } from '@/hooks/useAuth';
import { useNotificationStream } from '@/hooks/useNotificationStream';
import { cn } from '@/lib/utils';

function UserAvatar({ user }: { user: any }) {
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  return (
    <div className={cn(
      'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
      'bg-gradient-to-br from-amber-400 to-amber-600',
      'text-[11px] font-bold text-amber-950 select-none',
      'ring-2 ring-amber-400/20',
    )}>
      {initials}
    </div>
  );
}

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const navigate = useNavigate();
  // Phase 7: open the SSE stream once per authenticated session.
  // Falls back transparently to the existing 30s polling if EventSource
  // can't connect (e.g. proxy issues, expired token).
  useNotificationStream();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-mesh">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          {/* ── Glass Header ── */}
          <header className="h-14 flex items-center justify-between px-4 shrink-0 sticky top-0 z-30 glass-header">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
            </div>

            <div className="flex items-center gap-1.5">
              <NotificationBell />

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-2 px-2 hover:bg-secondary/80 cursor-pointer"
                  >
                    <UserAvatar user={user} />
                    {user && (
                      <span className="hidden sm:block text-[13px] font-medium text-foreground/80 max-w-[120px] truncate">
                        {user.firstName} {user.lastName}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {user && (
                    <>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[13px]">
                            {user.firstName} {user.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 text-[13px]"
                    onClick={() => navigate('/settings')}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 text-[13px] text-destructive focus:text-destructive"
                    onClick={() => logout.mutate()}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* ── Page Content ── */}
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>

        </div>
      </div>
    </SidebarProvider>
  );
}
