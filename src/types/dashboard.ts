/** Mirrors server/src/services/dashboard/types.ts. */
export type Lane = 'now' | 'soon' | 'later';
export type ActionFilter = 'all' | 'overdue' | 'due_today' | 'rejected' | 'no_response';
export type Stage = 'isf_to_send' | 'isf_sent' | 'entry_needed' | 'entry_to_send' | 'entry_sent' | 'accepted';
export type ActionKind =
  | 'isf_overdue' | 'isf_due' | 'isf_rejected' | 'isf_change_rejected'
  | 'isf_no_date' | 'isf_on_hold' | 'isf_draft'
  | 'entry_rejected' | 'entry_change_rejected' | 'entry_release_rejected'
  | 'entry_draft' | 'entry_needed'
  | 'cbp_no_response' | 'cbp_outcome_unknown' | 'cbp_conditional' | 'tracking_hold';

export interface ActionItem {
  id: string;
  kind: ActionKind;
  lane: Lane;
  title: string;
  ref: string;
  party: string | null;
  meta: string | null;
  due: { at: string; basis: 'LADING' | 'ETD_ESTIMATE' } | null;
  occurredAt: string;
  group: { id: string; count: number; label: string } | null;
  primary: { label: string; href: string; enabled: boolean; disabledReason: string | null };
}

export interface Blocker {
  code: string;
  scope: 'all' | 'isf' | 'entry';
  title: string;
  detail: string;
  fix: { label: string; href: string } | null;
}

export interface SetupStep { key: string; label: string; done: boolean; href: string | null }

export interface AwaitingItem {
  id: string;
  ref: string;
  kind: 'isf' | 'entry';
  state: 'QUEUED' | 'SENT' | 'NO_RESPONSE' | 'UNKNOWN' | 'CONDITIONAL';
  sentAt: string | null;
  href: string;
}

export interface RateMetric { rate: number | null; sample: number; prior: number | null }
export interface CountMetric { total: number; prior: number; series: number[] }

export interface DashboardMetrics {
  windowDays: number;
  sentOnTime: RateMetric;
  firstPass: RateMetric;
  isfSent: CountMetric;
  outcomes: { accepted: number[]; rejected: number[]; acceptedTotal: number; rejectedTotal: number };
  entriesAccepted: CountMetric | null;
  arrivals: number[];
  rejectionReasons: Array<{ reason: string; count: number }>;
  exposureUsd: number;
}

export interface LaneData { lane: Lane; total: number; items: ActionItem[]; nextCursor: string | null }

export interface DashboardResponse {
  generatedAt: string;
  isEmpty: boolean;
  attention: { now: number; soon: number; later: number; overdue: number; nextCutoffAt: string | null };
  flow: Array<{ key: Stage; label: string; count: number; href: string }>;
  filters: Array<{ key: ActionFilter; label: string; count: number }>;
  horizon: { startsAt: string; bucketHours: 6; buckets: number[] } | null;
  lanes: LaneData[];
  awaiting: { count: number; noResponse: number; items: AwaitingItem[] };
  workload: Array<{ name: string; count: number }>;
  metrics: DashboardMetrics;
  recent: Array<{ id: string; at: string; text: string; href: string }>;
  month: { isfAccepted: number; isfRejected: number; entriesAccepted: number } | null;
  blockers: Blocker[];
  setup: SetupStep[] | null;
}

export interface ActionsPage { items: ActionItem[]; nextCursor: string | null; total: number }
