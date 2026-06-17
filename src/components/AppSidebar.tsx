import { LayoutDashboard, Ship, Shield, ShieldCheck, Plug, Settings, FileText, ChevronRight, Users, Search, FileCheck, Calculator, Container } from 'lucide-react';
import { LogoMark } from '@/components/LogoMark';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/hooks/useAuth';
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
import { useCapabilities } from '@/hooks/useBilling';
import { CAPABILITIES, type Capability } from '@/lib/planMeta';

// ─── Navigation grouped by purpose, not feature type ────────────────
//
// The lifecycle goes: ISF → Manifest verified → Entry → Cleared.
// Sidebar groups follow the verb the user is doing, so the path from
// "I have a shipment to file" → "I want to track / look something up"
// → "I need to manage settings" is visually obvious.
//
//   Workspace    → where you start (Dashboard)
//   Operations   → where you DO the work (Shipments, Entry Documents)
//   Lookups      → where you investigate (Manifest Query)
//   Compliance   → where you check rules
//   Activity     → where you audit (Submission Logs)
//   Account      → where you configure (API, Team)
// ────────────────────────────────────────────────────────────────────

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  /** When set, the item is hidden unless the org's plan includes this capability. */
  requiredCapability?: Capability;
  /** When true, the item is only shown to platform admins (MyCargoLens staff). */
  platformAdminOnly?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Shipments',       url: '/shipments',     icon: Ship },
      { title: 'Entry Documents', url: '/abi-documents', icon: FileCheck, requiredCapability: CAPABILITIES.ABI_ENTRY },
    ],
  },
  {
    label: 'Lookups',
    items: [
      { title: 'Tracking',        url: '/tracking',        icon: Container, requiredCapability: CAPABILITIES.CONTAINER_TRACKING },
      { title: 'Manifest Query',  url: '/manifest-query',  icon: Search },
      { title: 'Duty Calculator', url: '/duty-calculator', icon: Calculator, requiredCapability: CAPABILITIES.HTS_CLASSIFICATION },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { title: 'Compliance', url: '/compliance', icon: Shield },
    ],
  },
  {
    label: 'Activity',
    items: [
      { title: 'Submission Logs', url: '/integrations/logs', icon: FileText },
    ],
  },
  {
    label: 'Account',
    items: [
      { title: 'API Settings', url: '/integrations/api', icon: Plug },
      { title: 'Team',         url: '/team',             icon: Users },
    ],
  },
  {
    label: 'Platform',
    items: [
      { title: 'Clients', url: '/admin', icon: ShieldCheck, platformAdminOnly: true },
    ],
  },
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
  const { isLoading: capsLoading, can } = useCapabilities();
  const isPlatformAdmin = useAuthStore((s) => s.user?.isPlatformAdmin ?? false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Hide nav items the org's plan doesn't unlock. While entitlements load we
  // keep gated items hidden to avoid a flash of links that then vanish; items
  // without a requiredCapability always show. Sections that end up empty are
  // dropped entirely.
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.platformAdminOnly && !isPlatformAdmin) return false;
        if (!item.requiredCapability) return true;
        if (capsLoading) return false;
        return can(item.requiredCapability);
      }),
    }))
    .filter((section) => section.items.length > 0);

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
          {/* Logo mark — 6-blade aperture, sized for collapsed vs expanded rail */}
          <LogoMark
            size={collapsed ? 28 : 32}
            className="text-[hsl(43_96%_70%)]"
          />
          {/* Old gold-tile + Ship icon retired in favor of the aperture mark.
              The sidebar bg is dark-navy in both modes, so we tint the mark gold. */}

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
        {/* Render all sections from the navSections array. The previous
            implementation had four near-identical JSX blocks; this is one
            map so adding/reordering groups is a one-line change. */}
        {visibleSections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mb-1 px-3">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className={navItemClass}
                    >
                      <NavLink to={item.url} end={item.end}>
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
        ))}
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
