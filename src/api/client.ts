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
export const notificationsApi = {
  list(unreadOnly = false) {
    return apiFetch<{ data: any[]; unreadCount: number }>(`/api/v1/notifications${unreadOnly ? '?unreadOnly=true' : ''}`);
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

  updateOrganization(data: { name?: string; iorNumber?: string; einNumber?: string; address?: any; phone?: string; website?: string }) {
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
