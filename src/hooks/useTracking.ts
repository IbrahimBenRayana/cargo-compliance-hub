import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trackingApi, TrackedShipment } from '../api/client';

export function useTrackingStatus() {
  return useQuery({
    queryKey: ['tracking', 'status'],
    queryFn: () => trackingApi.status(),
    staleTime: 60_000,
  });
}

export function useTrackedShipments(params?: {
  status?: TrackedShipment['status'];
  filingId?: string;
  q?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['tracking', 'list', params],
    queryFn: () => trackingApi.list(params),
  });
}

export function useTrackedShipment(id: string | undefined) {
  return useQuery({
    queryKey: ['tracking', 'one', id],
    queryFn: () => trackingApi.get(id!),
    enabled: !!id,
    // Pending tracks resolve in seconds-to-minutes; light polling keeps the
    // detail page fresh without webhooks (Phase 2).
    refetchInterval: (q) =>
      q.state.data?.trackedShipment.status === 'pending' ? 15_000 : false,
  });
}

export function useCreateTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof trackingApi.create>[0]) => trackingApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracking', 'list'] });
    },
  });
}

export function useRefreshTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trackingApi.refresh(id),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['tracking', 'list'] });
      qc.setQueryData(['tracking', 'one', resp.trackedShipment.id], resp);
    },
  });
}

export function useDeleteTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trackingApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracking', 'list'] });
    },
  });
}
