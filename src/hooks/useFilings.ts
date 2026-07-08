import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { filingsApi, FilingListParams, notificationsApi, templatesApi, settingsApi, integrationsApi, bulkApi, organizationApi, documentsApi, exportApi } from '../api/client';

export function useFilings(params?: FilingListParams) {
  return useQuery({
    queryKey: ['filings', params],
    queryFn: () => filingsApi.list(params),
  });
}

export function useFiling(id: string | undefined) {
  return useQuery({
    queryKey: ['filing', id],
    queryFn: () => filingsApi.get(id!),
    enabled: !!id,
  });
}

export function useFilingStats() {
  return useQuery({
    queryKey: ['filingStats'],
    queryFn: () => filingsApi.stats(),
  });
}

export function useCreateFiling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => filingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filingStats'] });
    },
  });
}

export function useCreateConsolidation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => filingsApi.createConsolidation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filingStats'] });
    },
  });
}

/** Sibling filings for a consolidation (used by list popover + detail strip). */
export function useConsolidationSiblings(consolidationId: string | null | undefined) {
  return useQuery({
    queryKey: ['consolidation', consolidationId],
    queryFn: () => filingsApi.getConsolidation(consolidationId as string),
    enabled: !!consolidationId,
    staleTime: 30_000,
  });
}

export function useUpdateFiling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => filingsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filing', variables.id] });
    },
  });
}

/**
 * Debounced autosave for the ShipmentWizard (audit Phase 8.2).
 *
 * Mirrors the ABI flow's `useAbiDocumentAutosave`: rapid `save()` calls
 * coalesce into a single PATCH after `debounceMs`. Pending edits flush on
 * unmount so closing the tab / navigating away doesn't lose data, and an
 * `isDirty` flag (+ pending-on-window-close listener) prevents accidental
 * destruction of unsaved work via the browser's beforeunload warning.
 */
export function useFilingAutosave(id: string | undefined, debounceMs = 800) {
  const update = useUpdateFiling();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, any>>({});
  const idRef = useRef(id);
  const dirtyRef = useRef(false);

  useEffect(() => {
    idRef.current = id;
  }, [id]);

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const nextId = idRef.current;
    const payload = pendingRef.current;
    if (!nextId || Object.keys(payload).length === 0) return;
    pendingRef.current = {};
    dirtyRef.current = false;
    update.mutate({ id: nextId, data: payload });
  };

  const save = (patch: Record<string, any>) => {
    pendingRef.current = { ...pendingRef.current, ...patch };
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, debounceMs);
  };

  // beforeunload guard — only attached while there's actual unsaved state.
  // Some browsers ignore the returned string in modern versions but still
  // honour event.returnValue, so we set both.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Flush pending edits on unmount so we don't drop the last keystroke.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const nextId = idRef.current;
      const payload = pendingRef.current;
      if (nextId && Object.keys(payload).length > 0) {
        pendingRef.current = {};
        dirtyRef.current = false;
        update.mutate({ id: nextId, data: payload });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    save,
    flush,
    isSaving: update.isPending,
    error: update.error,
  };
}

export function useDeleteFiling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => filingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filingStats'] });
    },
  });
}

export function useSubmitFiling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => filingsApi.submit(id),
    // onSettled (not onSuccess) — a 422 rejection still mutates the filing
    // server-side (status flips to "rejected", rejectionReason updated),
    // so the cache must refresh even when the mutation throws. Without this,
    // resubmitting a fixed filing kept showing the previous rejection until
    // the user hard-refreshed.
    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filing', id] });
      queryClient.invalidateQueries({ queryKey: ['filingStats'] });
    },
  });
}

export function useValidateFiling() {
  return useMutation({
    mutationFn: (id: string) => filingsApi.validate(id),
  });
}

export function useCheckFilingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => filingsApi.checkStatus(id),
    onSuccess: (data, id) => {
      if (data.statusChanged) {
        queryClient.invalidateQueries({ queryKey: ['filings'] });
        queryClient.invalidateQueries({ queryKey: ['filing', id] });
        queryClient.invalidateQueries({ queryKey: ['filingStats'] });
      }
    },
  });
}

export function useCheckAllFilingStatuses() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => filingsApi.checkAllStatuses(),
    onSuccess: (data) => {
      if (data.updated > 0) {
        queryClient.invalidateQueries({ queryKey: ['filings'] });
        queryClient.invalidateQueries({ queryKey: ['filingStats'] });
      }
    },
  });
}

export function useAmendFiling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) => filingsApi.amend(id, data),
    // onSettled — amendment failures still update server-side status / rejection
    // reason, so the UI needs the fresh record either way.
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filing', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['filingStats'] });
    },
  });
}

export function useCancelFiling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => filingsApi.cancel(id, reason),
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filing', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['filingStats'] });
    },
  });
}

// ─── Notifications ────────────────────────────────────────
import type { Notification, NotificationListResponse, NotificationSeverity } from '@/types/notification';
import type { NotificationsListParams } from '../api/client';

export function useNotifications(params: NotificationsListParams = {}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationsApi.list(params),
    refetchInterval: 30_000, // Poll every 30s for new notifications
  });
}

/** Optimistic mark-read: flips isRead/unreadCount in the cache before the
 *  server roundtrip resolves, so the UI never shows a stale unread badge. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const snapshots = queryClient.getQueriesData<NotificationListResponse>({ queryKey: ['notifications'] });
      for (const [key, snap] of snapshots) {
        if (!snap) continue;
        const target = snap.data.find(n => n.id === id);
        const wasUnread = target ? !target.isRead : false;
        const wasUnreadCritical = target ? !target.isRead && target.severity === 'critical' : false;
        queryClient.setQueryData<NotificationListResponse>(key, {
          ...snap,
          data: snap.data.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n),
          unreadCount: Math.max(0, snap.unreadCount - (wasUnread ? 1 : 0)),
          criticalUnreadCount: Math.max(0, snap.criticalUnreadCount - (wasUnreadCritical ? 1 : 0)),
        });
      }
      return { snapshots };
    },
    onError: (_err, _id, context) => {
      // Roll back on failure.
      if (!context?.snapshots) return;
      for (const [key, snap] of context.snapshots) {
        queryClient.setQueryData(key, snap);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const snapshots = queryClient.getQueriesData<NotificationListResponse>({ queryKey: ['notifications'] });
      const now = new Date().toISOString();
      for (const [key, snap] of snapshots) {
        if (!snap) continue;
        queryClient.setQueryData<NotificationListResponse>(key, {
          ...snap,
          data: snap.data.map(n => n.isRead ? n : { ...n, isRead: true, readAt: now }),
          unreadCount: 0,
          criticalUnreadCount: 0,
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (!context?.snapshots) return;
      for (const [key, snap] of context.snapshots) {
        queryClient.setQueryData(key, snap);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Re-export types so callers can `import { Notification, NotificationSeverity } from '@/hooks/useFilings'`
// — but the canonical home is @/types/notification.
export type { Notification, NotificationSeverity };

// ─── Phase 5 — preferences ───────────────────────────────

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationsApi.listPreferences(),
    staleTime: 60_000,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: import('@/types/notification').NotificationPreference[]) =>
      notificationsApi.updatePreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });
}

// ─── Templates ────────────────────────────────────────────
export function useTemplates(params?: { filingType?: string; search?: string }) {
  return useQuery({
    queryKey: ['templates', params],
    queryFn: () => templatesApi.list(params),
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['template', id],
    queryFn: () => templatesApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; filingType: string; templateData?: any }) => templatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; templateData?: any } }) => templatesApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['template', variables.id] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useApplyTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templatesApi.apply(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filingStats'] });
    },
  });
}

// ─── Filing Duplicate ─────────────────────────────────────
export function useDuplicateFiling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => filingsApi.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filingStats'] });
    },
  });
}

// ─── Save Filing as Template ──────────────────────────────
export function useSaveFilingAsTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => filingsApi.saveAsTemplate(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

// ─── Settings ─────────────────────────────────────────────
export function useProfile() {
  return useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: () => settingsApi.getProfile(),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string; email?: string }) => settingsApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      settingsApi.changePassword(currentPassword, newPassword),
  });
}

// ─── Two-factor authentication ────────────────────────────
/** Begin enrollment (re-auth with password → pending secret + QR URI). */
export function useMfaSetup() {
  return useMutation({
    mutationFn: ({ password }: { password: string }) => settingsApi.mfaSetup(password),
  });
}

/** Confirm a live code → activate MFA. Refreshes the cached user's mfaEnabled. */
export function useMfaEnable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code }: { code: string }) => settingsApi.mfaEnable(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
    },
  });
}

/** Disable MFA (password + TOTP/recovery code). */
export function useMfaDisable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ password, code }: { password: string; code: string }) =>
      settingsApi.mfaDisable(password, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
    },
  });
}

/** Regenerate recovery codes (password re-auth). */
export function useMfaRecoveryCodes() {
  return useMutation({
    mutationFn: ({ password }: { password: string }) => settingsApi.mfaRecoveryCodes(password),
  });
}

export function useOrganization() {
  return useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => settingsApi.getOrganization(),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; iorNumber?: string; einNumber?: string; address?: any }) =>
      settingsApi.updateOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] });
    },
  });
}

export function useAuditLog(params?: { page?: number; limit?: number; entityType?: string; action?: string }) {
  return useQuery({
    queryKey: ['settings', 'auditLog', params],
    queryFn: () => settingsApi.getAuditLog(params),
  });
}

// ─── Integrations ─────────────────────────────────────────
export function useTestCCConnection() {
  return useMutation({
    mutationFn: () => integrationsApi.testConnection(),
  });
}

export function useClassifyHTS() {
  return useMutation({
    mutationFn: (description: string) => integrationsApi.classifyHTS(description),
  });
}

// ─── Bulk Operations ─────────────────────────────────────
export function useBulkSubmit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filingIds: string[]) => bulkApi.submit(filingIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filingStats'] });
    },
  });
}

export function useBulkDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filingIds: string[]) => bulkApi.delete(filingIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filingStats'] });
    },
  });
}

// ─── Organization ─────────────────────────────────────────
export function useOrgOverview() {
  return useQuery({
    queryKey: ['org-overview'],
    queryFn: () => organizationApi.getOverview(),
  });
}

export function useOrgMembers() {
  return useQuery({
    queryKey: ['org-members'],
    queryFn: () => organizationApi.getMembers(),
  });
}

export function useChangeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      organizationApi.changeRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => organizationApi.removeMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      queryClient.invalidateQueries({ queryKey: ['org-overview'] });
    },
  });
}

export function useOrgInvitations() {
  return useQuery({
    queryKey: ['org-invitations'],
    queryFn: () => organizationApi.getInvitations(),
  });
}

export function useSendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      organizationApi.sendInvitation(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => organizationApi.revokeInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-invitations'] });
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => organizationApi.completeOnboarding(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-overview'] });
    },
  });
}

// ─── Documents ────────────────────────────────────────────
export function useFilingDocuments(filingId: string | undefined) {
  return useQuery({
    queryKey: ['filing-documents', filingId],
    queryFn: () => documentsApi.list(filingId!),
    enabled: !!filingId,
  });
}

export function useUploadDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ filingId, files, documentType }: { filingId: string; files: File[]; documentType: string }) =>
      documentsApi.upload(filingId, files, documentType),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['filing-documents', variables.filingId] });
    },
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: ({ filingId, docId }: { filingId: string; docId: string }) =>
      documentsApi.download(filingId, docId),
    onSuccess: (result) => {
      // Trigger browser download
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ filingId, docId }: { filingId: string; docId: string }) =>
      documentsApi.delete(filingId, docId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['filing-documents', variables.filingId] });
    },
  });
}

// ─── Export ───────────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useExportCsv() {
  return useMutation({
    mutationFn: (params?: { status?: string; filingType?: string }) =>
      exportApi.downloadCsv(params),
    onSuccess: (result) => {
      triggerDownload(result.blob, result.filename);
    },
  });
}

export function useExportPdf() {
  return useMutation({
    mutationFn: (filingId: string) =>
      exportApi.downloadPdf(filingId),
    onSuccess: (result) => {
      triggerDownload(result.blob, result.filename);
    },
  });
}

export function useExportSummaryPdf() {
  return useMutation({
    mutationFn: (params?: { status?: string; filingType?: string }) =>
      exportApi.downloadSummaryPdf(params),
    onSuccess: (result) => {
      triggerDownload(result.blob, result.filename);
    },
  });
}
