import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    onSuccess: (_, id) => {
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
    onSuccess: (_, variables) => {
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['filings'] });
      queryClient.invalidateQueries({ queryKey: ['filing', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['filingStats'] });
    },
  });
}

// ─── Notifications ────────────────────────────────────────
export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: () => notificationsApi.list(unreadOnly),
    refetchInterval: 30_000, // Poll every 30s for new notifications
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
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
