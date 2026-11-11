/** Who sees a redesigned page: DASHBOARD_V2, SHIPMENTS_V2. Setting one to off is its rollback. */
export function seesRollout(setting: 'off' | 'staff' | 'all', isPlatformAdmin: boolean): boolean {
  return setting === 'all' || (setting === 'staff' && isPlatformAdmin);
}
