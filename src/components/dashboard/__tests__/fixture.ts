import type { ActionItem, DashboardResponse } from '@/types/dashboard';

export const NOW = Date.parse('2026-10-30T12:00:00Z');
const HOUR = 3_600_000;

export function action(over: Partial<ActionItem> = {}): ActionItem {
  return {
    id: 'isf:1', kind: 'isf_due', lane: 'now', title: 'ISF due', ref: 'HLCU4471902', party: 'Acme Imports', meta: 'ETD Nov 2',
    due: { at: new Date(NOW + 4 * HOUR).toISOString(), basis: 'LADING' }, occurredAt: new Date(NOW - HOUR).toISOString(), group: null,
    primary: { label: 'Finish ISF', href: '/shipments/1/edit', enabled: true, disabledReason: null }, ...over,
  };
}

export function dashboard(over: Partial<DashboardResponse> = {}): DashboardResponse {
  const now = [
    action({ id: 'isf:0', kind: 'isf_overdue', title: 'ISF cutoff passed', ref: 'COSU6287340', due: { at: new Date(NOW - 3 * HOUR).toISOString(), basis: 'LADING' } }),
    action(),
    action({ id: 'isf:2', kind: 'isf_rejected', title: 'Rejected: invalid manufacturer ID', ref: 'MAEU2241890', party: 'Northwind Trading', due: { at: new Date(NOW + 19 * HOUR).toISOString(), basis: 'ETD_ESTIMATE' }, primary: { label: 'Fix ISF', href: '/shipments/2', enabled: true, disabledReason: null } }),
    action({ id: 'isf:3', kind: 'isf_change_rejected', title: 'CBP rejected your change. The earlier version is on file.', ref: 'ONEY7719032', due: null, primary: { label: 'Review change', href: '/shipments/3', enabled: true, disabledReason: null } }),
  ];
  const soon = [
    action({ id: 'isf:4', lane: 'soon', ref: 'ONEY3380165', due: { at: new Date(NOW + 51 * HOUR).toISOString(), basis: 'ETD_ESTIMATE' } }),
    action({ id: 'isf:5', lane: 'soon', kind: 'isf_no_date', title: 'Sailing date missing, no cutoff can run', ref: 'YMLU5512208', due: null, primary: { label: 'Add date', href: '/shipments/5/edit', enabled: true, disabledReason: null } }),
    action({ id: 'isf:6', lane: 'soon', kind: 'entry_needed', title: 'Ready for entry', ref: 'ZIMU9041177', due: null, primary: { label: 'Start entry', href: '/abi-documents/new?fromShipment=6', enabled: true, disabledReason: null } }),
  ];
  const later = [action({ id: 'isf:7', lane: 'later', kind: 'isf_draft', title: 'ISF draft', ref: 'TCNU8812045', due: { at: new Date(NOW + 200 * HOUR).toISOString(), basis: 'LADING' } })];
  return {
    generatedAt: new Date(NOW).toISOString(), isEmpty: false,
    attention: { now: now.length, soon: soon.length, later: later.length, overdue: 1, nextCutoffAt: new Date(NOW + 4 * HOUR).toISOString() },
    flow: [], horizon: null,
    filters: [
      { key: 'all', label: 'All', count: 8 }, { key: 'overdue', label: 'Overdue', count: 1 }, { key: 'due_today', label: 'Due today', count: 2 },
      { key: 'rejected', label: 'Rejected', count: 2 }, { key: 'no_response', label: 'No response', count: 0 },
    ],
    lanes: [
      { lane: 'now', total: now.length, items: now, nextCursor: null },
      { lane: 'soon', total: soon.length, items: soon, nextCursor: null },
      { lane: 'later', total: later.length, items: later, nextCursor: null },
    ],
    awaiting: { count: 0, noResponse: 0, items: [] }, recent: [], month: null, blockers: [], setup: null,
    ...over,
  };
}
