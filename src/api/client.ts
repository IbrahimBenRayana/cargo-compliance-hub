/**
 * API Client — Typed fetch wrapper with auto-refresh JWT tokens
 */

import type { AuthSession, User } from '@/types/auth';
import type { Filing } from '@/types/shipment';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Shared response envelopes ─────────────────────────────
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}
export interface SuccessResponse {
  success: boolean;
  message?: string;
}
export interface MessageResponse {
  message: string;
}

/** Validation issue surfaced by the rule-based validator. */
export interface ValidationIssue {
  field?: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  code?: string;
}

// ─── Token Storage ────────────────────────────────────────
// Access token: in-memory only — never localStorage. Lost on tab close,
// regained on demand via /auth/refresh.
// Refresh token: NOT in JS reach. Lives in the mcl_refresh httpOnly
// cookie managed by the server (audit Phase 6). The browser handles
// it automatically when we hit the path-scoped /api/v1/auth/refresh
// endpoint with credentials: 'include'.
let accessToken: string | null = null;

// Remembers the outcome of the most recent /auth/refresh so a late "second
// wave" of 401s on the same page load reuses it instead of starting a SECOND
// token rotation that races the cookie the first rotation just set. See
// tryRefreshToken() below.
let lastRefresh: { at: number; ok: boolean } | null = null;
const REFRESH_REUSE_MS = 4000;

// Drop any legacy localStorage entry from the pre-Phase-6 era so the same
// browser session doesn't keep a now-orphaned token around. Safe to keep
// indefinitely — by the time everyone has rotated, this is a no-op.
try {
  localStorage.removeItem('mcl_refresh');
} catch {
  /* private browsing / SSR fallback */
}

export function setAccessToken(access: string | null) {
  accessToken = access;
}

export function clearTokens() {
  accessToken = null;
  lastRefresh = null;
}

export function getAccessToken() {
  return accessToken;
}

// ─── Core Fetch with Auth ─────────────────────────────────
async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(url, { ...options, headers });

  // If 401, attempt a refresh — the browser will send the httpOnly
  // mcl_refresh cookie if it has one. If it doesn't, the refresh call
  // will fail fast (401) and we surface the original 401 unchanged.
  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(url, { ...options, headers });
    } else {
      // Refresh failed — force logout
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }));
    // Email-verification gate: server returned 403 with code='email_not_verified'.
    // The frontend's ProtectedRoute already redirects on app load, but a stale
    // tab whose user state hasn't refreshed could still call a sensitive route.
    // Bounce to /verify-email with the current path as the redirect target.
    if (
      response.status === 403 &&
      errorBody?.code === 'email_not_verified' &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/verify-email')
    ) {
      const intent = window.location.pathname + window.location.search;
      window.location.href = `/verify-email?redirect=${encodeURIComponent(intent)}`;
      throw new Error('Email verification required');
    }
    const error = new Error(errorBody.error || `HTTP ${response.status}`);
    (error as any).status = response.status;
    (error as any).body = errorBody;
    throw error;
  }

  return response.json();
}

// Single in-flight refresh promise. Prevents the refresh-token race that
// killed sessions: if N parallel requests all see 401 at once and each
// fires its own refresh, the server rotates the token on the first one
// and rejects the rest — every "loser" then triggers clearTokens() +
// redirect-to-login, kicking the user out mid-flow.
//
// With this guard, the first 401 starts a refresh; concurrent 401s wait
// on the same promise and all see the same outcome.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  // Concurrent 401s share the in-flight refresh.
  if (refreshInFlight) return refreshInFlight;

  // A refresh just completed (within the reuse window): the access token it set
  // is still valid, so reuse that outcome and let the caller retry with the new
  // token. This stops a late second 401 from triggering another rotation that
  // would race the freshly-set cookie and bounce the user to /login.
  if (lastRefresh && Date.now() - lastRefresh.at < REFRESH_REUSE_MS) {
    return lastRefresh.ok;
  }

  const inflight = (async () => {
    try {
      // credentials: 'include' is what tells the browser to send the
      // path-scoped mcl_refresh cookie. We send no JSON body — the
      // server reads the token from the cookie only (audit Phase 6).
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) return false;

      const data = await res.json();
      setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    }
  })();

  refreshInFlight = inflight;
  try {
    const ok = await inflight;
    lastRefresh = { at: Date.now(), ok };
    return ok;
  } finally {
    // Release the lock so a later 401 (past the reuse window) can refresh again.
    refreshInFlight = null;
  }
}

// ─── Auth API ─────────────────────────────────────────────
export const authApi = {
  register(data: { email: string; password: string; firstName: string; lastName: string; companyName?: string; iorNumber?: string; inviteToken?: string }) {
    // Phase 6: refresh token now arrives via httpOnly cookie; response body
    // returns the access token + user only. credentials: 'include' so the
    // Set-Cookie response actually lands in the browser.
    return apiFetch<AuthSession>('/api/v1/auth/register', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(data),
    });
  },

  login(email: string, password: string) {
    return apiFetch<AuthSession>('/api/v1/auth/login', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
  },

  logout() {
    return apiFetch<MessageResponse>('/api/v1/auth/logout', { method: 'POST' }).finally(clearTokens);
  },

  me() {
    return apiFetch<User>('/api/v1/auth/me');
  },

  // Set-password (sales-led onboarding / reset). Public — the token is the credential.
  validateSetupToken(token: string) {
    return apiFetch<{ valid: boolean; email?: string; error?: string }>(
      `/api/v1/auth/set-password/${encodeURIComponent(token)}`,
    );
  },

  setPassword(token: string, password: string) {
    return apiFetch<{ success: true }>('/api/v1/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  verifyEmailState() {
    return apiFetch<{
      emailVerified: boolean;
      email: string;
      canResend: boolean;
      cooldownRemainingSec: number;
      codeLength: number;
    }>('/api/v1/auth/verify-email/state');
  },

  verifyEmailResend() {
    return apiFetch<{ ok: boolean; alreadyVerified?: boolean; cooldownSec?: number; expiresInMin?: number }>(
      '/api/v1/auth/verify-email/resend',
      { method: 'POST' },
    );
  },

  verifyEmailConfirm(code: string) {
    return apiFetch<{ ok: boolean }>(
      '/api/v1/auth/verify-email/confirm',
      { method: 'POST', body: JSON.stringify({ code }) },
    );
  },
};

// ─── Filings API ──────────────────────────────────────────
export interface FilingListParams {
  status?: string;
  filingType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const filingsApi = {
  list(params?: FilingListParams) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const qs = query.toString();
    return apiFetch<PaginatedResponse<Filing>>(`/api/v1/filings${qs ? `?${qs}` : ''}`);
  },

  get(id: string) {
    return apiFetch<Filing>(`/api/v1/filings/${id}`);
  },

  create(data: Partial<Filing> & Record<string, unknown>) {
    return apiFetch<Filing>('/api/v1/filings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Create a consolidation: N draft filings sharing one Master BOL.
   * `data` matches the standard create payload but uses `houseBills: string[]`
   * instead of a single `houseBol`. Returns the generated consolidationId and
   * the N created filings.
   */
  createConsolidation(data: Partial<Filing> & { houseBills: string[] } & Record<string, unknown>) {
    return apiFetch<{ consolidationId: string; count: number; filings: Filing[] }>(
      '/api/v1/filings/consolidation',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  update(id: string, data: Partial<Filing> & Record<string, unknown>) {
    return apiFetch<Filing>(`/api/v1/filings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /** Lightweight sibling list for a consolidation — used by the strip + popover. */
  getConsolidation(consolidationId: string) {
    return apiFetch<{
      consolidationId: string;
      count: number;
      filings: Array<{
        id: string;
        houseBol: string | null;
        masterBol: string | null;
        status: string;
        createdAt: string;
        filingDeadline: string | null;
      }>;
    }>(`/api/v1/filings/consolidations/${consolidationId}`);
  },

  delete(id: string) {
    return apiFetch<MessageResponse>(`/api/v1/filings/${id}`, { method: 'DELETE' });
  },

  submit(id: string) {
    return apiFetch<{
      filing: Filing;
      ccFilingId: string | null;
      sendResponse?: { success?: boolean; 'Documents sent'?: number } & Record<string, unknown>;
    }>(`/api/v1/filings/${id}/submit`, { method: 'POST' });
  },

  amend(id: string, data?: Partial<Filing> & Record<string, unknown>) {
    return apiFetch<{ filing: Filing }>(`/api/v1/filings/${id}/amend`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  cancel(id: string, reason?: string) {
    return apiFetch<{ filing: Filing }>(`/api/v1/filings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  duplicate(id: string) {
    return apiFetch<Filing>(`/api/v1/filings/${id}/duplicate`, { method: 'POST' });
  },

  saveAsTemplate(id: string, name: string) {
    return apiFetch<{ id: string; name: string; filingType: string }>(`/api/v1/filings/${id}/save-template`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  validate(id: string) {
    return apiFetch<{ valid: boolean; errors: ValidationIssue[]; score: number; criticalCount: number; warningCount: number; infoCount: number }>(`/api/v1/filings/${id}/validate`, { method: 'POST' });
  },

  checkStatus(id: string) {
    return apiFetch<{
      filing: Filing;
      ccStatus: unknown;
      messages: unknown[];
      statusChanged: boolean;
      newStatus: string | null;
      eventSummary: unknown;
      lastEvent: unknown;
    }>(`/api/v1/filings/${id}/check-status`, { method: 'POST' });
  },

  checkAllStatuses() {
    return apiFetch<{
      checked: number;
      updated: number;
      results: Array<{ filingId: string; bol: string; oldStatus: string; newStatus: string | null; statusChanged: boolean }>;
    }>('/api/v1/filings/check-all-statuses', { method: 'POST' });
  },

  stats() {
    return apiFetch<{ total: number; statusCounts: Record<string, number>; recentFilings: Filing[] }>('/api/v1/filings/stats/overview');
  },
};

// ─── Submission Logs API ──────────────────────────────────
export interface SubmissionLogEntry {
  id: string;
  orgId: string;
  userId: string | null;
  filingId: string | null;
  method: string;
  url: string;
  requestPayload: Record<string, unknown> | null;
  responseStatus: number;
  responseBody: Record<string, unknown> | null;
  latencyMs: number;
  errorMessage: string | null;
  createdAt: string;
}

export const submissionLogsApi = {
  list(params?: { filingId?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const qs = query.toString();
    return apiFetch<PaginatedResponse<SubmissionLogEntry>>(`/api/v1/submission-logs${qs ? `?${qs}` : ''}`);
  },
};

// ─── Notifications API ────────────────────────────────────
import type {
  NotificationListResponse,
  NotificationSeverity,
  NotificationPreference,
  NotificationPreferencesResponse,
} from '@/types/notification';

export interface NotificationsListParams {
  unreadOnly?: boolean;
  severity?: NotificationSeverity;
}

export const notificationsApi = {
  list(params: NotificationsListParams = {}) {
    const qs = new URLSearchParams();
    if (params.unreadOnly) qs.set('unreadOnly', 'true');
    if (params.severity) qs.set('severity', params.severity);
    const suffix = qs.toString();
    return apiFetch<NotificationListResponse>(`/api/v1/notifications${suffix ? `?${suffix}` : ''}`);
  },

  markRead(id: string) {
    return apiFetch<SuccessResponse>(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllRead() {
    return apiFetch<{ updated: number }>('/api/v1/notifications/read-all', { method: 'POST' });
  },

  // Phase 5 — preferences
  listPreferences() {
    return apiFetch<NotificationPreferencesResponse>('/api/v1/notifications/preferences');
  },

  updatePreferences(preferences: NotificationPreference[]) {
    return apiFetch<{ message: string; count: number }>('/api/v1/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ preferences }),
    });
  },
};

// ─── Integrations API ─────────────────────────────────────
export const integrationsApi = {
  testConnection() {
    return apiFetch<{ connected: boolean; environment: string; baseUrl: string }>('/api/v1/integrations/test', { method: 'POST' });
  },

  classifyHTS(description: string) {
    return apiFetch<{
      suggestions: Array<{ hts: string; description: string; confidence?: number }>;
      message?: string;
      raw?: unknown;
    }>('/api/v1/integrations/hts-classify', {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  },

  getMIDList() {
    return apiFetch<{ data: Array<{ mid: string; name?: string; address?: string }> }>('/api/v1/integrations/mid-list');
  },

  testEmail() {
    return apiFetch<{ success: boolean; message?: string; error?: string }>('/api/v1/integrations/test-email', { method: 'POST' });
  },

  getEmailStatus() {
    return apiFetch<{ configured: boolean; connected: boolean; from: string; error?: string }>('/api/v1/integrations/email-status');
  },
};

// ─── Templates API ────────────────────────────────────────
export interface FilingTemplate {
  id: string;
  orgId: string;
  name: string;
  filingType: string;
  templateData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const templatesApi = {
  list(params?: { filingType?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const qs = query.toString();
    return apiFetch<{ data: FilingTemplate[] }>(`/api/v1/templates${qs ? `?${qs}` : ''}`);
  },

  get(id: string) {
    return apiFetch<FilingTemplate>(`/api/v1/templates/${id}`);
  },

  create(data: { name: string; filingType: string; templateData?: Record<string, unknown> }) {
    return apiFetch<FilingTemplate>('/api/v1/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: { name?: string; templateData?: Record<string, unknown> }) {
    return apiFetch<FilingTemplate>(`/api/v1/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(id: string) {
    return apiFetch<SuccessResponse>(`/api/v1/templates/${id}`, { method: 'DELETE' });
  },

  apply(id: string) {
    return apiFetch<Filing>(`/api/v1/templates/${id}/apply`, { method: 'POST' });
  },
};

// ─── Settings API ─────────────────────────────────────────
export interface OrgAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface SettingsProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  organization: {
    id: string;
    name: string;
    iorNumber: string | null;
    einNumber: string | null;
    ccEnvironment: string;
    address: OrgAddress | null;
  };
}

export interface SettingsOrganization {
  id: string;
  name: string;
  iorNumber: string | null;
  einNumber: string | null;
  ccEnvironment: string;
  address: OrgAddress | null;
  createdAt: string;
  _count: { users: number; filings: number; filingTemplates: number };
}

export interface AuditLogEntry {
  id: string;
  orgId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export const settingsApi = {
  getProfile() {
    return apiFetch<SettingsProfile>('/api/v1/settings/profile');
  },

  updateProfile(data: { firstName?: string; lastName?: string; email?: string }) {
    return apiFetch<SettingsProfile>('/api/v1/settings/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  changePassword(currentPassword: string, newPassword: string) {
    return apiFetch<SuccessResponse>('/api/v1/settings/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  getOrganization() {
    return apiFetch<SettingsOrganization>('/api/v1/settings/organization');
  },

  updateOrganization(data: { name?: string; iorNumber?: string; einNumber?: string; address?: OrgAddress }) {
    return apiFetch<SettingsOrganization>('/api/v1/settings/organization', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getAuditLog(params?: { page?: number; limit?: number; entityType?: string; action?: string }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const qs = query.toString();
    return apiFetch<PaginatedResponse<AuditLogEntry>>(`/api/v1/settings/audit-log${qs ? `?${qs}` : ''}`);
  },
};

// ─── Bulk Operations API ──────────────────────────────────
export const bulkApi = {
  submit(filingIds: string[]) {
    return apiFetch<{
      submitted: number; failed: number; skipped: number;
      results: Array<{ filingId: string; bol: string; success: boolean; error?: string; newStatus?: string }>;
      skippedIds: string[];
    }>('/api/v1/filings/bulk-submit', {
      method: 'POST',
      body: JSON.stringify({ filingIds }),
    });
  },

  delete(filingIds: string[]) {
    return apiFetch<{ deleted: number; requested: number }>('/api/v1/filings/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ filingIds }),
    });
  },
};

// ─── File Upload Helper (FormData, no JSON content-type) ──
async function apiUpload<T = any>(path: string, formData: FormData): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  // Do NOT set Content-Type — browser sets multipart boundary automatically

  let response = await fetch(url, { method: 'POST', headers, body: formData });

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(url, { method: 'POST', headers, body: formData });
    } else {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }));
    const error = new Error(errorBody.error || `HTTP ${response.status}`);
    (error as any).status = response.status;
    (error as any).body = errorBody;
    throw error;
  }

  return response.json();
}

// ─── File Download Helper ─────────────────────────────────
async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(url, { headers });

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(url, { headers });
    }
  }

  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const disposition = response.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename="(.+?)"/);
  const filename = filenameMatch?.[1] || 'download';

  return { blob: await response.blob(), filename };
}

// ─── Documents API ────────────────────────────────────────
export interface FilingDoc {
  id: string;
  filingId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  documentType: string;
  createdAt: string;
  uploadedBy: { firstName: string | null; lastName: string | null; email: string };
}

export const documentsApi = {
  list(filingId: string) {
    return apiFetch<{ data: FilingDoc[] }>(`/api/v1/documents/${filingId}`);
  },

  upload(filingId: string, files: File[], documentType: string) {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('documentType', documentType);
    return apiUpload<{ data: FilingDoc[]; count: number }>(`/api/v1/documents/${filingId}`, formData);
  },

  download(filingId: string, docId: string) {
    return apiDownload(`/api/v1/documents/${filingId}/${docId}/download`);
  },

  delete(filingId: string, docId: string) {
    return apiFetch<SuccessResponse>(`/api/v1/documents/${filingId}/${docId}`, { method: 'DELETE' });
  },
};

// ─── Export API ───────────────────────────────────────────
export const exportApi = {
  csvUrl(params?: { status?: string; filingType?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.filingType) query.set('filingType', params.filingType);
    const qs = query.toString();
    return `${API_BASE}/api/v1/export/csv${qs ? `?${qs}` : ''}`;
  },

  pdfUrl(filingId: string) {
    return `${API_BASE}/api/v1/export/pdf/${filingId}`;
  },

  summaryPdfUrl(params?: { status?: string; filingType?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.filingType) query.set('filingType', params.filingType);
    const qs = query.toString();
    return `${API_BASE}/api/v1/export/pdf-summary${qs ? `?${qs}` : ''}`;
  },

  async downloadCsv(params?: { status?: string; filingType?: string }) {
    return apiDownload(`/api/v1/export/csv${buildQuery(params)}`);
  },

  async downloadPdf(filingId: string) {
    return apiDownload(`/api/v1/export/pdf/${filingId}`);
  },

  async downloadSummaryPdf(params?: { status?: string; filingType?: string }) {
    return apiDownload(`/api/v1/export/pdf-summary${buildQuery(params)}`);
  },
};

// ─── Billing API (card-on-file, immediate per-shipment charge) ─────────────
export type BillingCard = { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null };

export const billingApi = {
  subscription() {
    return apiFetch<{
      plan: {
        id: string;
        name: string;
        description: string | null;
        perFilingCents: number;
        capabilities: string[];
        features: string[];
      } | null;
      capabilities: string[];
      /** May submit/file: a card is on file (or a $0 tier) and no unpaid charge. */
      canFile: boolean;
      status: string | null;
      delinquent: boolean;
      /** Saved card summary, or null when none on file. */
      card: BillingCard | null;
      // This calendar month's charged shipments + running total.
      usage: {
        periodStart: string | null;
        periodEnd: string | null;
        filingsBilled: number;
        amountCents: number;
      };
    }>('/api/v1/billing/subscription');
  },

  /** Publishable key for mounting Stripe Elements. */
  config() {
    return apiFetch<{ publishableKey: string; configured: boolean }>('/api/v1/billing/config');
  },

  /** Choose or change the plan tier (no charge, no card re-entry). */
  selectTier(body: { planId: string }) {
    return apiFetch<{ planId: string; canFile: boolean; cardOnFile: boolean }>('/api/v1/billing/select-tier', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Start saving a card — returns a SetupIntent client secret for Elements. */
  createSetupIntent() {
    return apiFetch<{ clientSecret: string }>('/api/v1/billing/setup-intent', { method: 'POST' });
  },

  /** Confirm the saved card after Elements confirms the SetupIntent. */
  saveCard(body: { setupIntentId: string }) {
    return apiFetch<{ card: BillingCard; canFile: boolean }>('/api/v1/billing/card', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  createPortalSession() {
    return apiFetch<{ url: string }>('/api/v1/billing/portal-session', {
      method: 'POST',
    });
  },
};

export type BillingSubscription = Awaited<ReturnType<typeof billingApi.subscription>>;

// ─── API Keys API (public API credentials) ────────────────
// Customer-managed credentials for the public API. Create/revoke are
// owner/admin only (server enforces). The full secret `key` is returned
// exactly once on create and never again — surface it to the user immediately.
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Create response: same shape as a list row plus the one-time secret. */
export interface ApiKeyCreated {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  key: string;
}

export const apiKeysApi = {
  list() {
    return apiFetch<{ apiKeys: ApiKey[] }>('/api/v1/api-keys');
  },

  create(body: { name: string; scopes: string[] }) {
    return apiFetch<ApiKeyCreated>('/api/v1/api-keys', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  revoke(id: string) {
    return apiFetch<{ success: true }>(`/api/v1/api-keys/${id}`, { method: 'DELETE' });
  },
};

// ─── Platform Admin API (client provisioning) ─────────────
// Only reachable by platform admins (server enforces requirePlatformAdmin).
export interface AdminOrganization {
  id: string;
  name: string;
  iorNumber: string | null;
  maxUsers: number;
  createdAt: string;
  plan: { id: string; name: string } | null;
  subscriptionStatus: string | null;
  owner: { email: string; firstName: string | null; lastName: string | null; emailVerified: boolean } | null;
  userCount: number;
  filingCount: number;
}

export interface AdminPlan {
  id: string;
  name: string;
  description: string | null;
  perFilingCents: number;
  capabilities: string[];
  isPublic: boolean;
}

export const adminApi = {
  plans() {
    return apiFetch<{ plans: AdminPlan[] }>('/api/v1/admin/plans');
  },

  organizations() {
    return apiFetch<{ organizations: AdminOrganization[] }>('/api/v1/admin/organizations');
  },

  provisionOrganization(body: {
    companyName: string;
    iorNumber?: string;
    ownerEmail: string;
    ownerFirstName: string;
    ownerLastName: string;
    planId: string;
    maxUsers?: number;
  }) {
    return apiFetch<{
      organization: { id: string; name: string; iorNumber: string | null };
      owner: { id: string; email: string };
      plan: { id: string; name: string };
    }>('/api/v1/admin/organizations', { method: 'POST', body: JSON.stringify(body) });
  },

  changePlan(orgId: string, planId: string) {
    return apiFetch<{ orgId: string; plan: { id: string; name: string } }>(
      `/api/v1/admin/organizations/${orgId}/plan`,
      { method: 'PATCH', body: JSON.stringify({ planId }) },
    );
  },

  resendSetup(orgId: string) {
    return apiFetch<{ success: true; sentTo: string }>(
      `/api/v1/admin/organizations/${orgId}/resend-setup`,
      { method: 'POST' },
    );
  },
};

// ─── Manifest Query API ───────────────────────────────────
// ─── Container Tracking (Terminal 49) ─────────────────────

export interface TrackedContainerSnapshot {
  id: string;
  number: string;
  equipmentType: string | null;
  equipmentLength: number | null;
  equipmentHeight: string | null;
  sealNumber: string | null;
  currentStatus: string | null;
  availableForPickup: boolean | null;
  pickupLfd: string | null;
  holdsAtPodTerminal: Array<{ name: string; status: string; description?: string }>;
  feesAtPodTerminal: Array<{ type: string; amount: number; currency_code?: string }>;
  locationAtPodTerminal: string | null;
}

export interface TrackedShipmentSnapshot {
  id: string;
  billOfLadingNumber: string | null;
  normalizedNumber: string | null;
  shippingLineScac: string | null;
  shippingLineName: string | null;
  shippingLineShortName: string | null;
  customerName: string | null;
  portOfLadingLocode: string | null;
  portOfLadingName: string | null;
  portOfDischargeLocode: string | null;
  portOfDischargeName: string | null;
  destinationLocode: string | null;
  destinationName: string | null;
  podVesselName: string | null;
  podVesselImo: string | null;
  podVoyageNumber: string | null;
  polEtdAt: string | null;
  polAtdAt: string | null;
  podEtaAt: string | null;
  podOriginalEtaAt: string | null;
  podAtaAt: string | null;
  destinationEtaAt: string | null;
  destinationAtaAt: string | null;
  polTimezone: string | null;
  podTimezone: string | null;
  destinationTimezone: string | null;
  lineTrackingLastSucceededAt: string | null;
  lineTrackingStoppedAt: string | null;
  lineTrackingStoppedReason: string | null;
  refNumbers: string[];
  tags: string[];
  containers: TrackedContainerSnapshot[];
}

export interface TrackedShipment {
  id: string;
  orgId: string;
  createdById: string;
  filingId: string | null;
  t49TrackingRequestId: string | null;
  t49ShipmentId: string | null;
  requestType: 'bill_of_lading' | 'booking_number' | 'container';
  requestNumber: string;
  scac: string;
  status: 'pending' | 'tracking' | 'failed' | 'stopped';
  failedReason: string | null;
  shippingLineName: string | null;
  portOfLadingName: string | null;
  portOfDischargeName: string | null;
  destinationName: string | null;
  podVesselName: string | null;
  polEtdAt: string | null;
  polAtdAt: string | null;
  podEtaAt: string | null;
  podAtaAt: string | null;
  destinationEtaAt: string | null;
  destinationAtaAt: string | null;
  hasHolds: boolean;
  earliestPickupLfd: string | null;
  shipmentSnapshot: TrackedShipmentSnapshot | null;
  lastSyncedAt: string | null;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export const trackingApi = {
  status() {
    return apiFetch<{ enabled: boolean; baseUrl: string }>('/api/v1/tracking/status');
  },

  list(params?: { status?: TrackedShipment['status']; filingId?: string; q?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') qs.set(k, String(v));
      });
    }
    const s = qs.toString();
    return apiFetch<{ trackedShipments: TrackedShipment[] }>(`/api/v1/tracking${s ? `?${s}` : ''}`);
  },

  create(data: {
    requestType: TrackedShipment['requestType'];
    requestNumber: string;
    scac: string;
    filingId?: string;
    refNumbers?: string[];
  }) {
    return apiFetch<{ trackedShipment: TrackedShipment }>('/api/v1/tracking', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  get(id: string) {
    return apiFetch<{ trackedShipment: TrackedShipment }>(`/api/v1/tracking/${id}`);
  },

  refresh(id: string) {
    return apiFetch<{ trackedShipment: TrackedShipment }>(`/api/v1/tracking/${id}/refresh`, {
      method: 'POST',
    });
  },

  remove(id: string) {
    return apiFetch<{ success: true }>(`/api/v1/tracking/${id}`, { method: 'DELETE' });
  },
};

export interface ManifestQueryRecord {
  id: string;
  orgId: string;
  filingId: string | null;
  ccRequestId: string;
  bolNumber: string;
  bolType: string;
  houseBOLNumber: string | null;
  status: 'pending' | 'polling' | 'completed' | 'failed' | 'timeout';
  responseData: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export const manifestQueryApi = {
  create(data: {
    bolNumber: string;
    bolType?: 'BOLNUMBER' | 'AWBNUMBER';
    houseBOLNumber?: string | null;
    limitOutputOption?: '1' | '2' | '3';
    requestRelatedBOL?: boolean;
    requestBOLAndEntryInformation?: boolean;
    filingId?: string;
  }) {
    return apiFetch<{ data: { id: string; ccRequestId: string; status: string; bolNumber: string } }>('/api/v1/manifest-queries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  get(id: string) {
    return apiFetch<{ data: ManifestQueryRecord }>(`/api/v1/manifest-queries/${id}`);
  },

  list(params?: { page?: number; limit?: number; bolNumber?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const qs = query.toString();
    return apiFetch<{ data: ManifestQueryRecord[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(`/api/v1/manifest-queries${qs ? `?${qs}` : ''}`);
  },

  poll(id: string) {
    return apiFetch<{ data: any }>(`/api/v1/manifest-queries/${id}/poll`, { method: 'POST' });
  },
};

// ─── Duty Calculation API ─────────────────────────────────
// Mirrors the SOURCE-OF-TRUTH types in
// server/src/services/customscity.ts (CCDutyCalc*). Two endpoints:
//   POST /api/v1/duty-calculation       — HTS deterministic
//   POST /api/v1/duty-calculation/ai    — description, AI classifies
// Both take the same request body; AI response adds `aiRecommendations`
// and may return `dutiesBreakdown: null`.

export interface DutyCalcItem {
  hts?: string;                          // required for /, optional for /ai
  description: string;
  totalValue: number;
  quantity1?: number | null;
  quantity2?: number | null;
  spi?: string;                          // e.g. "MX" for USMCA
  aluminumPercentage?: number;
  steelPercentage?: number;
  copperPercentage?: number;
  isCottonExempt?: boolean;
  isAutoPartExempt?: boolean;
  kitchenPartNotComplete?: boolean;
  isInformationalMaterialExempt?: boolean;
}

export interface DutyCalcRequest {
  items: DutyCalcItem[];
  entryType: 'formal' | 'informal';
  modeOfTransportation: 'air' | 'ocean' | 'truck' | 'rail';
  estimatedEntryDate: string;            // MM/DD/YYYY
  countryOfOrigin: string;               // ISO-3166 alpha-2
  currency: string;                      // ISO-4217
}

export interface DutyCalcSubheading {
  hts: string;
  name: string;
  duty: number;
  /** AI mode only: 'section301', 'fentanylCN', 'reciprocal', 'steel', etc. */
  section?: string;
}

export interface DutyCalcItemResult {
  classification: { name: string; hts: string };
  description: string;
  quantity1: number | null;
  quantity1UOM: string | null;
  quantity2: number | null;
  quantity2UOM: string | null;
  quantity3?: number | null;
  quantity3UOM?: string | null;
  specificDutyRate?: number;             // AI mode only
  adValoremDutyRate?: number;            // AI mode only
  otherDutyRate?: number;                // AI mode only
  totalDutiable: number;
  charges: number;
  duty: number;
  userFee: number;
  irTax: number;
  adcvdAmount: number;
  subheadingDuties: number;
  subheadings: DutyCalcSubheading[];
  pgaFlags?: unknown[];
  aluminumPercentage?: number;
  steelPercentage?: number;
  copperPercentage?: number;
  isCottonExempt?: boolean;
  isAutoPartExempt?: boolean;
  kitchenPartNotComplete?: boolean;
  isInformationalMaterialExempt?: boolean;
}

/** Both endpoint variants observed in the wild use overlapping but
 *  not-identical summary fields. All optional, calling code must
 *  fall back gracefully. */
export interface DutyCalcSummary {
  totalValue?: number;
  totalDutiableValue: number;
  ddp: number;
  totalDutiesTaxes?: number;          // standard endpoint
  totalDuties?: number;               // AI endpoint
  totalDutiesFees?: number;           // AI endpoint
  totalDutyPercentage?: number;       // AI endpoint (e.g. 77.8 = 77.8%)
  totalUserFee?: number;              // AI endpoint
}

export interface DutyCalcDutiesBreakdown {
  totalChargesAmount: number;
  totalDuties: number;
  processingFee: number;
  totalUserFee: number;
  totalIrTax: number;
  totaladcvdAmount: number;
}

export interface DutyCalcResponse {
  items: DutyCalcItemResult[];
  entryType: string;
  countryOfOrigin: string;
  countryOfOriginName: string;
  modeOfTransportation: string;
  estimatedEntryDate: string;
  currency: string;
  entryFee: { entryProcessingFee: number; portProcessingFee: number };
  summary: DutyCalcSummary;
  /** AI endpoint sometimes returns null — UI must guard. */
  dutiesBreakdown: DutyCalcDutiesBreakdown | null;
  ddpBreakdown: {
    ddpIncluded: boolean;
    ddp: number;
    shipping: number;
    insurance: number;
  };
}

export interface DutyCalcAIRecommendationOption {
  hts: string;
  description: string;
  type: number;
  score: number;
  naturalized_description: string;
  participating_agencies: unknown[];
  construction: {
    components: Array<{ type: string; number: string; description: string }>;
    indent_hierarchy: Array<{ level: number; htsno: string; description: string }>;
  };
}

export interface DutyCalcAIRecommendation {
  itemIndex: number;
  originalDescription: string;
  selectedHts: string;
  explanation: string;
  /** GRI reasoning */
  specializedExplanation: string;
  recommendations: DutyCalcAIRecommendationOption[];
}

export interface DutyCalcAIResponse extends DutyCalcResponse {
  aiRecommendations: DutyCalcAIRecommendation[];
}

export const dutyCalculationApi = {
  calculate(body: DutyCalcRequest) {
    return apiFetch<{ data: DutyCalcResponse }>('/api/v1/duty-calculation', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  calculateAI(body: DutyCalcRequest) {
    return apiFetch<{ data: DutyCalcAIResponse }>('/api/v1/duty-calculation/ai', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

function buildQuery(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v); });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

// ─── Organization API ─────────────────────────────────────
export interface OrgMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { filings: number };
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  inviteLink?: string;
  invitedBy: { firstName: string | null; lastName: string | null; email: string };
}

export const organizationApi = {
  getOverview() {
    return apiFetch<{
      id: string; name: string; slug: string | null; iorNumber: string | null;
      ccEnvironment: string; maxUsers: number; onboardingCompleted: boolean;
      createdAt: string;
      _count: { users: number; filings: number; filingTemplates: number };
    }>('/api/v1/organization/overview');
  },

  getMembers() {
    return apiFetch<{ data: OrgMember[] }>('/api/v1/organization/members');
  },

  changeRole(memberId: string, role: string) {
    return apiFetch<OrgMember>(`/api/v1/organization/members/${memberId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  removeMember(memberId: string) {
    return apiFetch<SuccessResponse>(`/api/v1/organization/members/${memberId}`, { method: 'DELETE' });
  },

  getInvitations() {
    return apiFetch<{ data: OrgInvitation[] }>('/api/v1/organization/invitations');
  },

  sendInvitation(email: string, role: string) {
    return apiFetch<OrgInvitation>('/api/v1/organization/invitations', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },

  revokeInvitation(invitationId: string) {
    return apiFetch<SuccessResponse>(`/api/v1/organization/invitations/${invitationId}`, { method: 'DELETE' });
  },

  completeOnboarding() {
    return apiFetch<SuccessResponse>('/api/v1/organization/onboarding', { method: 'PATCH' });
  },
};

// ─── ABI Documents (Entry Summary 7501) API ───────────────
// Shape is the source-of-truth contract mirroring the server Zod schema
// at server/src/schemas/abiDocument.ts and the Prisma `AbiDocument` model.
export type AbiDocumentStatus =
  | 'DRAFT'
  | 'SENDING'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED';

export interface ABIDates {
  entryDate: string;   // YYYYMMDD
  importDate: string;
  arrivalDate: string;
}

export interface ABILocation {
  portOfEntry: string;
  destinationStateUS: string;
}

export interface ABIIOR {
  number: string;
  name: string;
}

export interface ABIBond {
  type: '8' | '9';   // "8" continuous, "9" single-transaction
  suretyCode: string; // CBP-issued surety company code (3 chars)
  taxId: string;
}

export interface ABIPayment {
  typeCode: number;
  preliminaryStatementDate: string;
}

export interface ABIConsignee {
  name: string;
  taxId: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface ABIBill {
  type: string;   // "M" | "H"
  mBOL: string;
  hBOL: string;   // required by CC; auto-set to mBOL for master-only
  groupBOL: 'Y' | 'N';
}

export interface ABIParty {
  type: 'manufacturer' | 'seller' | 'buyer' | 'shipTo';
  loadFrom?: string;
  taxId?: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  telephone?: string;
  email?: string;
  pointOfContact?: string;
}

export interface ABIItem {
  sku: string;
  htsNumber: string;
  description: string;
  origin: { country: string };
  values: {
    currency: string;
    exchangeRate: number;
    totalValueOfGoods: number;
  };
  quantity1: string;
  weight: { gross: string; uom: string };
  aluminumPercentage?: number;
  steelPercentage?: number;
  copperPercentage?: number;
  cottonFeeExemption?: 'Y' | 'N';
  autoPartsExemption?: 'Y' | 'N';
  otherThanCompletedKitchenParts?: 'Y' | 'N';
  informationalMaterialsExemption?: 'Y' | 'N';
  religiousPurposes?: 'Y' | 'N';
  agriculturalExemption?: 'Y' | 'N';
  semiConductorExemption?: number;
  parties: ABIParty[];
}

export interface ABIInvoice {
  purchaseOrder: string;
  invoiceNumber: string;
  exportDate: string;    // YYYYMMDD
  relatedParties: 'N';   // Phase 1: only "N" accepted by CC
  countryOfExport: string;
  currency: string;
  exchangeRate: number;
  items: ABIItem[];
}

export interface ABIManifest {
  bill: ABIBill;
  carrier: { code: string };
  ports: { portOfUnlading: string };
  quantity: string;
  quantityUOM: string;
  invoices: ABIInvoice[];
}

/**
 * Full ABI document body — the object stored as `payload` on an AbiDocument.
 * This is the "complete" shape required at transmit time; the wizard works
 * with `Partial<ABIDocumentBody>` / DeepPartial while editing drafts.
 */
export interface ABIDocumentBody {
  entryType: '01' | '11' | '86'; // 86 = de minimis (Section 321), cargo-release only
  modeOfTransport: string;   // "40" vessel, "41" air
  entryNumber: string;       // filer-assigned (not CBP-assigned)
  dates: ABIDates;
  location: ABILocation;
  ior: ABIIOR;
  bond: ABIBond;
  payment: ABIPayment;
  firms: string;
  entryConsignee: ABIConsignee;
  manifest: ABIManifest[];
}

/** Recursive DeepPartial — every level becomes optional, including
 *  array element fields. Used for draft state in the wizard so any
 *  nested setter (e.g. `manifest[0].bill.type`) can land partial values. */
type _DeepPartial<T> =
  T extends (infer U)[]
    ? _DeepPartial<U>[]
    : T extends object
      ? { [K in keyof T]?: _DeepPartial<T[K]> }
      : T;

export type ABIDocumentDraft = _DeepPartial<ABIDocumentBody>;

/**
 * AbiDocument — the row returned by the server for an ABI filing.
 * Mirrors the Prisma `AbiDocument` model scalars; `payload` contains the
 * full (possibly partial) ABIDocumentBody the wizard is editing.
 */
export interface AbiDocument {
  id: string;
  orgId: string;
  userId: string;

  status: AbiDocumentStatus;
  entrySummaryStatus: string | null;
  cargoReleaseStatus: string | null;

  entryType: string;
  modeOfTransport: string;
  entryNumber: string | null;
  ccDocumentId: string | null;

  mbolNumber: string | null;
  hbolNumber: string | null;

  iorNumber: string | null;
  iorName: string | null;
  consigneeName: string | null;

  portOfEntry: string | null;
  destinationStateUS: string | null;
  entryDate: string | null;
  importDate: string | null;
  arrivalDate: string | null;

  payload: ABIDocumentDraft;

  sentAt: string | null;
  respondedAt: string | null;
  lastError: string | null;
  pollAttempts: number;

  filingId: string | null;
  manifestQueryId: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface AbiDocumentListParams {
  status?: AbiDocumentStatus;
  mbolNumber?: string;
  entryNumber?: string;
  skip?: number;
  take?: number;
}

/**
 * List response shape returned by `GET /api/v1/abi-documents`.
 * Uses skip/take pagination (not page/limit) to match the server route.
 */
export interface AbiDocumentListResponse {
  data: AbiDocument[];
  pagination: {
    total: number;
    skip: number;
    take: number;
    totalPages: number;
  };
}

/** Single-doc envelope returned by create/get/update/send/poll. */
export interface AbiDocumentEnvelope {
  data: AbiDocument;
  note?: string;
}

export const abiDocumentsApi = {
  list(params?: AbiDocumentListParams) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const qs = query.toString();
    return apiFetch<AbiDocumentListResponse>(
      `/api/v1/abi-documents${qs ? `?${qs}` : ''}`,
    );
  },

  get(id: string) {
    return apiFetch<AbiDocumentEnvelope>(`/api/v1/abi-documents/${id}`);
  },

  create(body: {
    payload: ABIDocumentDraft;
    manifestQueryId?: string;
    filingId?: string;
  }) {
    return apiFetch<AbiDocumentEnvelope>('/api/v1/abi-documents', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  update(id: string, body: { payload: ABIDocumentDraft }) {
    return apiFetch<AbiDocumentEnvelope>(`/api/v1/abi-documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  remove(id: string) {
    return apiFetch<void>(`/api/v1/abi-documents/${id}`, { method: 'DELETE' });
  },

  send(id: string) {
    return apiFetch<AbiDocumentEnvelope>(`/api/v1/abi-documents/${id}/send`, {
      method: 'POST',
    });
  },

  poll(id: string) {
    return apiFetch<AbiDocumentEnvelope>(`/api/v1/abi-documents/${id}/poll`, {
      method: 'POST',
    });
  },
};

// ─── Compliance Center API ────────────────────────────────

export interface AiStatusResponse {
  enabled: boolean;
  provider?: 'openai';
  model?: string;
  dailyLimit?: number;
  callsToday?: number;
  reason?: string;
}

export interface HealthSummary {
  score: number | null;
  totals: { all: number; accepted: number; rejected: number };
  weeklyTrend: Array<{ weekStart: string; total: number; rejected: number }>;
  topReasons: Array<{ reason: string; count: number }>;
  deadlineAdherence: { rate: number | null; onTime: number; trackable: number };
  recentRejectedFilings: Array<{ id: string; rejectedAt: string | null }>;
}

export interface ScoreHistoryPoint {
  at:           string;
  status:       string;
  score:        number;
  message:      string | null;
  /** Present when source === 'snapshots' — explains why the score changed. */
  triggerEvent?: string;
  /** Validation breakdown — only included on snapshot points. */
  breakdown?:    { critical: number; warning: number; info: number };
}

export interface ScoreHistoryResponse {
  filingId:      string;
  currentScore:  number;
  currentStatus: string;
  points:        ScoreHistoryPoint[];
  /** 'snapshots' = validation-driven; 'status-bands' = legacy derivation. */
  source?:       'snapshots' | 'status-bands';
  note:          string;
}

export interface HealthNarrativeResponse {
  narrative: string;
  model: string | null;
  signals: {
    drafts:          number;
    rejected:        number;
    uflpaHigh:       number;
    uflpaElevated:   number;
    pscClosingSoon:  number;
    liquidatingSoon: number;
    awaitingCbp:     number;
  };
  generatedAt: string;
  cached: boolean;
}

export interface UflpaScanResponse {
  scanned: number;
  counts: { high: number; elevated: number; low: number };
  flagged: Array<{
    filingId: string;
    bol: string;
    status: string;
    createdAt: string;
    risk: {
      severity: 'high' | 'elevated' | 'low';
      reasons: string[];
      origin?: { city?: string; state?: string; country?: string };
      htsMatches: string[];
      recommendation: string;
    };
  }>;
}

export interface PgaLookupResponse {
  hts: string;
  matched: boolean;
  flags: Array<{ agency: string; name: string; action: string }>;
  source: { source: string; lastUpdated: string; note: string };
}

export interface ActionItem {
  id: string;
  kind: 'deadline' | 'rejection' | 'uflpa' | 'psc' | 'liquidation' | 'bulk-fix' | 'draft_review';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  context: string;
  filingId?: string;
  bol?: string;
  timestamp: number;
  isNew: boolean;
  /** Per-filing compliance score 0–100. null for bulk-fix items. */
  score: number | null;
  /** Current filing status (draft / submitted / rejected / accepted / etc.).
   *  Surfaced as a status badge on the card. undefined for bulk-fix. */
  status?: string;
  /** Manufacturer / seller name. null when unknown. */
  originCompany: string | null;
  /** ISO-2 country (e.g. "CN", "IN"). null when unknown. */
  originCountry: string | null;
  actions: Array<{
    label: string;
    href?: string;
    kind?: 'open' | 'submit' | 'coach' | 'edit' | 'snooze';
  }>;
}

export interface ActionQueueResponse {
  score: number | null;
  stats: { awaitingCbp: number; withIssues: number; highRisk: number };
  actionQueue: ActionItem[];
  counts: { total: number; critical: number; high: number; medium: number };
}

export interface HtsClassificationResponse {
  matched: boolean;
  message?: string;
  primary: { hts: string; description: string } | null;
  explanation: string | null;
  alternatives: Array<{ hts: string; description: string }>;
}

export interface AddCvdOrder {
  case: string;
  type: 'AD' | 'CVD' | 'ADCVD';
  country: string;
  product: string;
  htsPrefixes: string[];
  note: string;
}

export interface AddCvdLookupResponse {
  query: string;
  matched: boolean;
  orders: AddCvdOrder[];
  source: { source: string; lastUpdated: string; note: string; termsKey: Record<string, string> };
}

export interface FtaProgramMatch {
  key: string;
  fullName: string;
  covers: string;
  claimCode: string;
  link: string;
}

export interface FtaPreferenceResponse {
  country: string;
  matched: boolean;
  programs: FtaProgramMatch[];
  source: { source: string; lastUpdated: string; note: string };
}

export interface LiquidationTracked {
  filingId: string;
  bol: string;
  filingType: string;
  entryDate: string;
  estimatedLiquidationAt: string;
  pscDeadline: string;
  daysUntilLiquidation: number;
  daysUntilPscDeadline: number;
  status: 'pending' | 'psc-window-open' | 'awaiting-liquidation' | 'liquidated';
}

export const complianceApi = {
  aiStatus() {
    return apiFetch<AiStatusResponse>('/api/v1/compliance/ai-status');
  },
  healthNarrative() {
    return apiFetch<HealthNarrativeResponse>('/api/v1/compliance/health-narrative');
  },
  scoreHistory(filingId: string) {
    return apiFetch<ScoreHistoryResponse>(`/api/v1/compliance/filings/${encodeURIComponent(filingId)}/score-history`);
  },
  healthSummary() {
    return apiFetch<HealthSummary>('/api/v1/compliance/health-summary');
  },
  uflpaScan() {
    return apiFetch<UflpaScanResponse>('/api/v1/compliance/risk/uflpa');
  },
  pgaLookup(hts: string) {
    return apiFetch<PgaLookupResponse>(`/api/v1/compliance/pga-lookup?hts=${encodeURIComponent(hts)}`);
  },
  liquidationTracker() {
    return apiFetch<{ total: number; tracked: LiquidationTracked[] }>(
      '/api/v1/compliance/liquidation-tracker',
    );
  },
  actionQueue() {
    return apiFetch<ActionQueueResponse>('/api/v1/compliance/action-queue');
  },
  classifyHts(description: string) {
    return apiFetch<HtsClassificationResponse>('/api/v1/compliance/classify-hts', {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  },
  addCvdLookup(q: string) {
    return apiFetch<AddCvdLookupResponse>(
      `/api/v1/compliance/add-cvd-lookup?q=${encodeURIComponent(q)}`,
    );
  },
  ftaPreference(country: string) {
    return apiFetch<FtaPreferenceResponse>(
      `/api/v1/compliance/fta-preference?country=${encodeURIComponent(country)}`,
    );
  },
  /**
   * Stream a rejection-coach response. Returns an async iterable of text
   * deltas. Caller renders each chunk as it arrives. The stream is SSE
   * with `data: {"delta":"..."}` chunks ending in `event: done`.
   */
  rejectionCoach(filingId: string): AsyncGenerator<string, void, void> {
    return streamCoach('/api/v1/compliance/rejection-coach', filingId);
  },
  /**
   * Pre-flight AI review for a draft / submitted / on-hold filing.
   * Same SSE protocol as rejectionCoach — the drawer is shared.
   */
  draftReview(filingId: string): AsyncGenerator<string, void, void> {
    return streamCoach('/api/v1/compliance/draft-review', filingId);
  },
};

async function* streamCoach(path: string, filingId: string): AsyncGenerator<string, void, void> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ filingId }),
    });
    if (!res.ok || !res.body) {
      const errBody = await res.json().catch(() => ({ error: 'AI request failed' }));
      const e = new Error(errBody.error || `HTTP ${res.status}`);
      (e as any).status = res.status;
      (e as any).body = errBody;
      throw e;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const ev of events) {
        const lines = ev.split('\n');
        let eventName = 'message';
        let dataLine = '';
        for (const l of lines) {
          if (l.startsWith('event: ')) eventName = l.slice(7).trim();
          else if (l.startsWith('data: ')) dataLine += l.slice(6);
        }
        if (eventName === 'done') return;
        if (eventName === 'error') {
          let parsed: { error?: string; code?: string } = {};
          try { parsed = JSON.parse(dataLine); } catch { /* ignore */ }
          throw Object.assign(new Error(parsed.error || 'AI stream error'), { code: parsed.code });
        }
        if (dataLine) {
          try {
            const parsed = JSON.parse(dataLine);
            if (typeof parsed.delta === 'string') yield parsed.delta;
          } catch {
            // ignore malformed line
          }
        }
      }
    }
}

// ─── In-app Chat (AI assistant + live human handoff) ──────────
//
// Two surfaces share one backend at /api/v1/chat:
//   • The signed-in widget (this `chatApi`) — surface 'app'.
//   • The platform-admin live agent console (`chatAdminApi`).
//
// Sends are a streaming POST (NOT EventSource) modelled on streamCoach;
// the persistent EventSource (live agent / system messages, mode changes,
// typing) is opened separately by useChatEventStream.

/** Conversation lifecycle mode. Drives the composer + mode badge. */
export type ChatMode = 'ai' | 'pending_human' | 'human' | 'resolved';

/** Author of a message. 'agent' is a live MyCargoLens specialist. */
export type ChatRole = 'user' | 'assistant' | 'system' | 'agent';

/** Clickable deep-link the AI may attach to an assistant message. */
export interface ChatDeeplink {
  url: string;
  label: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  metadata?: { deeplinks?: ChatDeeplink[] } | null;
  agentId?: string | null;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  surface: 'app' | 'marketing';
  mode: ChatMode;
  status: string;
  visitorName?: string | null;
  visitorEmail?: string | null;
  assignedAgentId?: string | null;
  escalationReason?: string | null;
  createdAt: string;
}

export interface ChatConversationResponse {
  conversation: ChatConversation;
  messages: ChatMessage[];
}

export interface ChatConfig {
  enabled: boolean;
  aiEnabled: boolean;
}

/** A single typed event yielded while streaming an assistant turn. */
export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'deeplink'; url: string; label: string }
  | { type: 'escalated' }
  | { type: 'error'; code?: string; message: string };

/** A row in the live agent console queue. */
export interface ChatQueueItem {
  id: string;
  surface: 'app' | 'marketing';
  mode: ChatMode;
  visitorName?: string | null;
  visitorEmail?: string | null;
  escalationReason?: string | null;
  lastMessageAt?: string | null;
  escalatedAt?: string | null;
  assignedAgentId?: string | null;
  user: { firstName: string; lastName: string; email: string } | null;
  assignedAgent: { firstName: string; lastName: string } | null;
}

const CHAT_BASE = '/api/v1/chat';

export const chatApi = {
  /** Graceful-degradation flags — call once when the widget opens. */
  getConfig() {
    return apiFetch<ChatConfig>(`${CHAT_BASE}/config`);
  },
  /** Lazily create the signed-in conversation (surface is always 'app'). */
  createConversation() {
    return apiFetch<{ conversationId: string; mode: ChatMode; surface: 'app' }>(
      `${CHAT_BASE}/conversations`,
      { method: 'POST', body: JSON.stringify({ surface: 'app' }) },
    );
  },
  /** Restore a transcript (e.g. a conversation id kept in localStorage). */
  getConversation(id: string) {
    return apiFetch<ChatConversationResponse>(
      `${CHAT_BASE}/conversations/${encodeURIComponent(id)}`,
    );
  },
  /** Ask to hand off to a human; flips mode to pending_human server-side. */
  escalate(id: string, reason?: string) {
    return apiFetch<{ mode: ChatMode }>(
      `${CHAT_BASE}/conversations/${encodeURIComponent(id)}/escalate`,
      { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) },
    );
  },
  /**
   * Send a user message and stream the assistant turn. Modelled on
   * streamCoach but yields typed ChatStreamEvents. When the conversation
   * is in a human/pending_human mode the backend returns 204 (the message
   * was handed to the live agent) — we detect that and return with no
   * events; the agent's reply arrives over the EventSource instead.
   */
  sendMessage(conversationId: string, content: string): AsyncGenerator<ChatStreamEvent, void, void> {
    return streamChatMessage(conversationId, content);
  },
};

async function* streamChatMessage(
  conversationId: string,
  content: string,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const res = await fetch(
    `${API_BASE}${CHAT_BASE}/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ content }),
    },
  );

  // Human / pending_human mode: 204 No Content — the message went to the
  // live agent and there is no stream to consume. Also bail if the server
  // (e.g. a proxy) didn't hand back an event-stream for any reason.
  const contentType = res.headers.get('content-type') ?? '';
  if (res.status === 204 || !contentType.includes('text/event-stream')) {
    if (!res.ok && res.status !== 204) {
      const errBody = await res.json().catch(() => ({ error: 'Chat request failed' }));
      yield { type: 'error', code: errBody.code, message: errBody.error || `HTTP ${res.status}` };
    }
    return;
  }
  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const ev of events) {
      const lines = ev.split('\n');
      let eventName = 'message';
      let dataLine = '';
      for (const l of lines) {
        if (l.startsWith('event: ')) eventName = l.slice(7).trim();
        else if (l.startsWith('data: ')) dataLine += l.slice(6);
      }
      if (eventName === 'done') return;
      if (eventName === 'escalated') {
        yield { type: 'escalated' };
        continue;
      }
      if (eventName === 'deeplink') {
        try {
          const parsed = JSON.parse(dataLine) as { url?: string; label?: string };
          if (parsed.url) {
            yield { type: 'deeplink', url: parsed.url, label: parsed.label || parsed.url };
          }
        } catch {
          /* ignore malformed deeplink */
        }
        continue;
      }
      if (eventName === 'error') {
        let parsed: { error?: string; code?: string } = {};
        try { parsed = JSON.parse(dataLine); } catch { /* ignore */ }
        yield { type: 'error', code: parsed.code, message: parsed.error || 'Chat error' };
        return;
      }
      if (dataLine) {
        try {
          const parsed = JSON.parse(dataLine);
          if (typeof parsed.delta === 'string') yield { type: 'delta', text: parsed.delta };
        } catch {
          // ignore malformed line
        }
      }
    }
  }
}

// ─── Live agent console (platform admins) ─────────────────────
const CHAT_ADMIN_BASE = '/api/v1/chat/admin';

export const chatAdminApi = {
  /** pending = waiting for a human; active = pending + human (in progress). */
  queue(status: 'pending' | 'active') {
    return apiFetch<{ data: ChatQueueItem[] }>(
      `${CHAT_ADMIN_BASE}/queue?status=${status}`,
    );
  },
  getConversation(id: string) {
    return apiFetch<ChatConversationResponse>(
      `${CHAT_ADMIN_BASE}/conversations/${encodeURIComponent(id)}`,
    );
  },
  /** Claim a conversation. Throws with status 409 / code 'already_claimed'. */
  assign(id: string) {
    return apiFetch<{ assigned: boolean }>(
      `${CHAT_ADMIN_BASE}/conversations/${encodeURIComponent(id)}/assign`,
      { method: 'POST' },
    );
  },
  reply(id: string, content: string) {
    return apiFetch<{ id: string }>(
      `${CHAT_ADMIN_BASE}/conversations/${encodeURIComponent(id)}/messages`,
      { method: 'POST', body: JSON.stringify({ content }) },
    );
  },
  /** Fire-and-forget typing ping (204). Call on a debounce while typing. */
  typing(id: string) {
    return apiFetch<void>(
      `${CHAT_ADMIN_BASE}/conversations/${encodeURIComponent(id)}/typing`,
      { method: 'POST' },
    );
  },
  resolve(id: string) {
    return apiFetch<{ mode: ChatMode }>(
      `${CHAT_ADMIN_BASE}/conversations/${encodeURIComponent(id)}/resolve`,
      { method: 'POST' },
    );
  },
  /** Hand the conversation back to the AI assistant. */
  handback(id: string) {
    return apiFetch<{ mode: ChatMode }>(
      `${CHAT_ADMIN_BASE}/conversations/${encodeURIComponent(id)}/handback`,
      { method: 'POST' },
    );
  },
};
