import { LayoutDashboard, Ship, Shield, Plug, Settings, FileText, ChevronRight, Users, Search, FileCheck } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const mainNav = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Shipments', url: '/shipments', icon: Ship },
  { title: 'Compliance', url: '/compliance', icon: Shield },
];

const integrationsNav = [
  { title: 'API Settings', url: '/integrations/api', icon: Plug },
  { title: 'Submission Logs', url: '/integrations/logs', icon: FileText },
];

const toolsNav = [
  { title: 'Manifest Query', url: '/manifest-query', icon: Search },
  { title: 'Entry Documents', url: '/abi-documents', icon: FileCheck },
];

const managementNav = [
  { title: 'Team', url: '/team', icon: Users },
];

const navItemClass = cn(
  'group/btn relative rounded-lg transition-all duration-200',
  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  'data-[active=true]:text-[hsl(43_96%_56%)]',
  'data-[active=true]:bg-[hsl(43_96%_56%/0.1)]',
  'data-[active=true]:shadow-sm',
  // Collapsed-state centering: override the default left-aligned flex
  'group-data-[collapsible=icon]:justify-center',
);

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon">
      {/* ── Logo Header ── */}
      <SidebarHeader
        className={cn(
          'border-b border-sidebar-border transition-all',
          collapsed ? 'p-2' : 'p-4',
        )}
      >
        <div
          className={cn(
            'flex items-center',
            collapsed ? 'justify-center' : 'gap-3',
          )}
        >
          {/* Logo mark — smaller when collapsed so it fits inside the 3rem (48px) rail */}
          <div
            className={cn(
              'relative rounded-xl shrink-0 flex items-center justify-center',
              'bg-gradient-to-br from-amber-400 to-amber-600',
              'shadow-lg shadow-amber-500/25 ring-1 ring-amber-300/20',
              'transition-all duration-200',
              collapsed ? 'h-8 w-8' : 'h-9 w-9',
            )}
          >
            <Ship className={cn('text-amber-950', collapsed ? 'h-4 w-4' : 'h-[18px] w-[18px]')} />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/15 pointer-events-none" />
          </div>

          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[15px] tracking-tight text-sidebar-accent-foreground leading-none">
                MyCargoLens
              </span>
              <span className="text-[10px] text-sidebar-foreground/50 font-medium tracking-widest uppercase mt-0.5">
                ISF Platform
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent
        className={cn(
          'py-3 transition-[padding]',
          // Expanded: comfortable horizontal padding; Collapsed: no padding so buttons center in rail
          'px-2 group-data-[collapsible=icon]:px-0',
        )}
      >
        {/* ── Main Navigation ── */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-1 px-3">
              Navigation
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={navItemClass}
                  >
                    <NavLink to={item.url} end={item.url === '/'}>
                      <item.icon className="h-[18px] w-[18px] transition-transform duration-200 group-hover/btn:scale-110 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="font-medium text-[13px]">{item.title}</span>
                          {isActive(item.url) && (
                            <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Integrations ── */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-1 px-3">
              Integrations
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {integrationsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={navItemClass}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-[18px] w-[18px] transition-transform duration-200 group-hover/btn:scale-110 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="font-medium text-[13px]">{item.title}</span>
                          {isActive(item.url) && (
                            <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Tools ── */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-1 px-3">
              Tools
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {toolsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={navItemClass}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-[18px] w-[18px] transition-transform duration-200 group-hover/btn:scale-110 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="font-medium text-[13px]">{item.title}</span>
                          {isActive(item.url) && (
                            <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Management ── */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-1 px-3">
              Management
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {managementNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={navItemClass}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-[18px] w-[18px] transition-transform duration-200 group-hover/btn:scale-110 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="font-medium text-[13px]">{item.title}</span>
                          {isActive(item.url) && (
                            <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter
        className={cn(
          'border-t border-sidebar-border',
          'p-2 group-data-[collapsible=icon]:px-0',
        )}
      >
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/settings')}
              tooltip="Settings"
              className={navItemClass}
            >
              <NavLink to="/settings">
                <Settings className="h-[18px] w-[18px] transition-transform duration-200 group-hover/btn:rotate-90 shrink-0" />
                {!collapsed && <span className="font-medium text-[13px]">Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
