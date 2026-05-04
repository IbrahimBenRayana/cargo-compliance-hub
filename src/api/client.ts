/**
 * API Client — Typed fetch wrapper with auto-refresh JWT tokens
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Token Storage (in memory — never localStorage) ───────
let accessToken: string | null = null;
let refreshToken: string | null = localStorage.getItem('mcl_refresh'); // Only refresh token in storage

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('mcl_refresh', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('mcl_refresh');
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

  // If 401 and we have a refresh token, try to refresh
  if (response.status === 401 && refreshToken) {
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
    const error = new Error(errorBody.error || `HTTP ${response.status}`);
    (error as any).status = response.status;
    (error as any).body = errorBody;
    throw error;
  }

  return response.json();
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ─── Auth API ─────────────────────────────────────────────
export const authApi = {
  register(data: { email: string; password: string; firstName: string; lastName: string; companyName?: string; iorNumber?: string; inviteToken?: string }) {
    return apiFetch<{ user: any; accessToken: string; refreshToken: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login(email: string, password: string) {
    return apiFetch<{ user: any; accessToken: string; refreshToken: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  logout() {
    return apiFetch('/api/v1/auth/logout', { method: 'POST' }).finally(clearTokens);
  },

  me() {
    return apiFetch<any>('/api/v1/auth/me');
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
    return apiFetch<{ data: any[]; pagination: any }>(`/api/v1/filings${qs ? `?${qs}` : ''}`);
  },

  get(id: string) {
    return apiFetch<any>(`/api/v1/filings/${id}`);
  },

  create(data: any) {
    return apiFetch<any>('/api/v1/filings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: any) {
    return apiFetch<any>(`/api/v1/filings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(id: string) {
    return apiFetch(`/api/v1/filings/${id}`, { method: 'DELETE' });
  },

  submit(id: string) {
    return apiFetch<any>(`/api/v1/filings/${id}/submit`, { method: 'POST' });
  },

  amend(id: string, data?: any) {
    return apiFetch<any>(`/api/v1/filings/${id}/amend`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  cancel(id: string, reason?: string) {
    return apiFetch<any>(`/api/v1/filings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  duplicate(id: string) {
    return apiFetch<any>(`/api/v1/filings/${id}/duplicate`, { method: 'POST' });
  },

  saveAsTemplate(id: string, name: string) {
    return apiFetch<any>(`/api/v1/filings/${id}/save-template`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  validate(id: string) {
    return apiFetch<{ valid: boolean; errors: any[]; score: number; criticalCount: number; warningCount: number; infoCount: number }>(`/api/v1/filings/${id}/validate`, { method: 'POST' });
  },

  checkStatus(id: string) {
    return apiFetch<{
      filing: any;
      ccStatus: any;
      messages: any[];
      statusChanged: boolean;
      newStatus: string | null;
      eventSummary: any;
      lastEvent: any;
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
    return apiFetch<{ total: number; statusCounts: Record<string, number>; recentFilings: any[] }>('/api/v1/filings/stats/overview');
  },
};

// ─── Submission Logs API ──────────────────────────────────
export const submissionLogsApi = {
  list(params?: { filingId?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const qs = query.toString();
    return apiFetch<{ data: any[]; pagination: any }>(`/api/v1/submission-logs${qs ? `?${qs}` : ''}`);
  },
};

// ─── Notifications API ────────────────────────────────────
import type { NotificationListResponse, NotificationSeverity } from '@/types/notification';

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
    return apiFetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllRead() {
    return apiFetch('/api/v1/notifications/read-all', { method: 'POST' });
  },
};

// ─── Integrations API ─────────────────────────────────────
export const integrationsApi = {
  testConnection() {
    return apiFetch<{ connected: boolean; environment: string; baseUrl: string }>('/api/v1/integrations/test', { method: 'POST' });
  },

  classifyHTS(description: string) {
    return apiFetch<any>('/api/v1/integrations/hts-classify', {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  },

  getMIDList() {
    return apiFetch<any>('/api/v1/integrations/mid-list');
  },

  testEmail() {
    return apiFetch<{ success: boolean; message?: string; error?: string }>('/api/v1/integrations/test-email', { method: 'POST' });
  },

  getEmailStatus() {
    return apiFetch<{ configured: boolean; connected: boolean; from: string; error?: string }>('/api/v1/integrations/email-status');
  },
};

// ─── Templates API ────────────────────────────────────────
export const templatesApi = {
  list(params?: { filingType?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const qs = query.toString();
    return apiFetch<{ data: any[] }>(`/api/v1/templates${qs ? `?${qs}` : ''}`);
  },

  get(id: string) {
    return apiFetch<any>(`/api/v1/templates/${id}`);
  },

  create(data: { name: string; filingType: string; templateData?: any }) {
    return apiFetch<any>('/api/v1/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: { name?: string; templateData?: any }) {
    return apiFetch<any>(`/api/v1/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(id: string) {
    return apiFetch(`/api/v1/templates/${id}`, { method: 'DELETE' });
  },

  apply(id: string) {
    return apiFetch<any>(`/api/v1/templates/${id}/apply`, { method: 'POST' });
  },
};

// ─── Settings API ─────────────────────────────────────────
export const settingsApi = {
  getProfile() {
    return apiFetch<{
      id: string; email: string; firstName: string | null; lastName: string | null;
      role: string; createdAt: string; lastLoginAt: string | null;
      organization: { id: string; name: string; iorNumber: string | null; einNumber: string | null; ccEnvironment: string; address: any };
    }>('/api/v1/settings/profile');
  },

  updateProfile(data: { firstName?: string; lastName?: string; email?: string }) {
    return apiFetch<any>('/api/v1/settings/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  changePassword(currentPassword: string, newPassword: string) {
    return apiFetch<{ success: boolean; message: string }>('/api/v1/settings/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  getOrganization() {
    return apiFetch<{
      id: string; name: string; iorNumber: string | null; einNumber: string | null;
      ccEnvironment: string; address: any; createdAt: string;
      _count: { users: number; filings: number; filingTemplates: number };
    }>('/api/v1/settings/organization');
  },

  updateOrganization(data: { name?: string; iorNumber?: string; einNumber?: string; address?: any }) {
    return apiFetch<any>('/api/v1/settings/organization', {
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
    return apiFetch<{ data: any[]; pagination: any }>(`/api/v1/settings/audit-log${qs ? `?${qs}` : ''}`);
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

  if (response.status === 401 && refreshToken) {
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

  if (response.status === 401 && refreshToken) {
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
    return apiUpload<{ data: any[]; count: number }>(`/api/v1/documents/${filingId}`, formData);
  },

  download(filingId: string, docId: string) {
    return apiDownload(`/api/v1/documents/${filingId}/${docId}/download`);
  },

  delete(filingId: string, docId: string) {
    return apiFetch(`/api/v1/documents/${filingId}/${docId}`, { method: 'DELETE' });
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

// ─── Billing API ──────────────────────────────────────────
export const billingApi = {
  subscription() {
    return apiFetch<{
      plan: {
        id: string;
        name: string;
        description: string | null;
        priceCents: number;
        billingInterval: string;
        filingsIncluded: number;
        maxSeats: number;
        overageCents: number;
        features: string[];
      } | null;
      subscription: {
        status: string;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
      } | null;
      usage: { month: string; count: number; limit: number };
    }>('/api/v1/billing/subscription');
  },

  createCheckoutSession(body: { planId: string; successUrl?: string; cancelUrl?: string }) {
    return apiFetch<{ url: string; sessionId: string }>('/api/v1/billing/checkout-session', {
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

// ─── Manifest Query API ───────────────────────────────────
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
    return apiFetch<{ data: any }>(`/api/v1/manifest-queries/${id}`);
  },

  list(params?: { page?: number; limit?: number; bolNumber?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const qs = query.toString();
    return apiFetch<{ data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(`/api/v1/manifest-queries${qs ? `?${qs}` : ''}`);
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
    return apiFetch<any>(`/api/v1/organization/members/${memberId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  removeMember(memberId: string) {
    return apiFetch(`/api/v1/organization/members/${memberId}`, { method: 'DELETE' });
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
    return apiFetch(`/api/v1/organization/invitations/${invitationId}`, { method: 'DELETE' });
  },

  completeOnboarding() {
    return apiFetch('/api/v1/organization/onboarding', { method: 'PATCH' });
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
  entryType: '01' | '11';
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
