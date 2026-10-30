/** Who sees the new dashboard. Setting DASHBOARD_V2 to off is the rollback. */
export function seesDashboardV2(setting: 'off' | 'staff' | 'all', isPlatformAdmin: boolean): boolean {
  return setting === 'all' || (setting === 'staff' && isPlatformAdmin);
}
