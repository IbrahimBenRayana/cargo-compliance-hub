/** The dashboard's wire contract (spec: docs/specs/dashboard-redesign.md §9.2). */
import type { ActionKind, Lane, Stage } from './rules.js';

export type ActionFilter = 'all' | 'overdue' | 'due_today' | 'rejected' | 'no_response';

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
  code: 'BILLING_HOLD' | 'PAYMENT_FAILED' | 'NO_PAYMENT_METHOD' | 'NO_PLAN'
    | 'ENTRY_PRICING_MISSING' | 'CBP_SETUP_INCOMPLETE' | 'SERVICE_CENTER_NOT_APPROVED';
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

export interface DashboardResponse {
  generatedAt: string;
  isEmpty: boolean;
  attention: { now: number; soon: number; later: number; overdue: number; nextCutoffAt: string | null };
  flow: Array<{ key: Stage; label: string; count: number; href: string }>;
  filters: Array<{ key: ActionFilter; label: string; count: number }>;
  horizon: { startsAt: string; bucketHours: 6; buckets: number[] } | null;
  lanes: Array<{ lane: Lane; total: number; items: ActionItem[]; nextCursor: string | null }>;
  awaiting: { count: number; noResponse: number; items: AwaitingItem[] };
  recent: Array<{ id: string; at: string; text: string; href: string }>;
  month: { isfAccepted: number; isfRejected: number; entriesAccepted: number } | null;
  blockers: Blocker[];
  setup: SetupStep[] | null;
}
