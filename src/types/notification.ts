/**
 * Typed notification shape — mirrors the backend Notification model.
 * Add a new `kind` here when you add a new server-side trigger; the
 * NotificationBell uses this union to drive icon + color lookup.
 */

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export type NotificationKind =
  // Filing lifecycle
  | 'filing_submitted'
  | 'filing_accepted'
  | 'filing_rejected'
  | 'filing_amended'
  | 'filing_cancelled'
  | 'filing_on_hold'
  | 'filing_stale'
  // Deadlines
  | 'deadline_warning'
  | 'deadline_overdue'
  // ABI / CBP entry
  | 'entry_submitted'
  | 'entry_accepted'
  | 'entry_rejected'
  // Manifest queries
  | 'manifest_query_complete'
  | 'manifest_query_failed'
  // Billing
  | 'billing_subscription_changed'
  | 'billing_subscription_canceled'
  | 'billing_payment_failed'
  // Team
  | 'team_member_joined'
  // System
  | 'api_error';

export interface Notification {
  id: string;
  userId: string;
  orgId: string;
  filingId: string | null;
  abiDocumentId: string | null;
  /** String rather than the union so the backend can ship new kinds without a frontend deploy. */
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string | null;
  linkUrl: string | null;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  dedupeKey: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  data: Notification[];
  unreadCount: number;
  /** New in Phase 1 — count of unread notifications with severity = 'critical'. */
  criticalUnreadCount: number;
}

// ─── Preferences (Phase 5) ───────────────────────────────────────────

export interface NotificationPreference {
  kind: string;
  inApp: boolean;
  email: boolean;
}

export interface NotificationPreferencesResponse {
  data: NotificationPreference[];
}
