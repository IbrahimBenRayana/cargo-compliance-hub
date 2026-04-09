import { LayoutDashboard, Ship, Shield, Plug, Settings, FileText, ChevronRight, Users } from 'lucide-react';
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

const mainNav = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Shipments', url: '/shipments', icon: Ship },
  { title: 'Compliance', url: '/compliance', icon: Shield },
];

const integrationsNav = [
  { title: 'API Settings', url: '/integrations/api', icon: Plug },
  { title: 'Submission Logs', url: '/integrations/logs', icon: FileText },
];

const managementNav = [
  { title: 'Team', url: '/team', icon: Users },
];

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
      {/* Logo Header */}
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
            <Ship className="h-4.5 w-4.5 text-primary-foreground" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/10" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-[15px] tracking-tight text-sidebar-foreground">MyCargoLens</span>
              <span className="text-[10px] text-sidebar-foreground/50 font-medium tracking-wider uppercase">ISF Platform</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* Main Navigation */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-1 px-3">Navigation</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="group/btn relative rounded-lg transition-all duration-200 hover:bg-sidebar-accent/80 data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/15 data-[active=true]:to-primary/5 data-[active=true]:text-primary data-[active=true]:shadow-sm data-[active=true]:border data-[active=true]:border-primary/10"
                  >
                    <NavLink to={item.url} end={item.url === '/'}>
                      <item.icon className="h-4 w-4 transition-transform duration-200 group-hover/btn:scale-110" />
                      {!collapsed && (
                        <>
                          <span className="font-medium text-[13px]">{item.title}</span>
                          {isActive(item.url) && <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary/60" />}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Integrations */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-1 px-3">Integrations</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {integrationsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="group/btn relative rounded-lg transition-all duration-200 hover:bg-sidebar-accent/80 data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/15 data-[active=true]:to-primary/5 data-[active=true]:text-primary data-[active=true]:shadow-sm data-[active=true]:border data-[active=true]:border-primary/10"
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4 transition-transform duration-200 group-hover/btn:scale-110" />
                      {!collapsed && (
                        <>
                          <span className="font-medium text-[13px]">{item.title}</span>
                          {isActive(item.url) && <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary/60" />}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-1 px-3">Management</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {managementNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="group/btn relative rounded-lg transition-all duration-200 hover:bg-sidebar-accent/80 data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/15 data-[active=true]:to-primary/5 data-[active=true]:text-primary data-[active=true]:shadow-sm data-[active=true]:border data-[active=true]:border-primary/10"
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4 transition-transform duration-200 group-hover/btn:scale-110" />
                      {!collapsed && (
                        <>
                          <span className="font-medium text-[13px]">{item.title}</span>
                          {isActive(item.url) && <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary/60" />}
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

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/settings')}
              className="group/btn rounded-lg transition-all duration-200 hover:bg-sidebar-accent/80 data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/15 data-[active=true]:to-primary/5 data-[active=true]:text-primary"
            >
              <NavLink to="/settings">
                <Settings className="h-4 w-4 transition-transform duration-200 group-hover/btn:rotate-90" />
                {!collapsed && <span className="font-medium text-[13px]">Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
