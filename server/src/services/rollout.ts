/** Who gets a staged change: DASHBOARD_V2, SHIPMENTS_V2, MANIFEST_QUERY_NATIVE. Setting one to off is its rollback. */
export function seesRollout(setting: 'off' | 'staff' | 'all', isPlatformAdmin: boolean): boolean {
  return setting === 'all' || (setting === 'staff' && isPlatformAdmin);
}
