import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manifestQueryApi } from '../api/client';

export function useManifestQueries(params?: { page?: number; limit?: number; bolNumber?: string; status?: string }) {
  return useQuery({
    queryKey: ['manifest-queries', params],
    queryFn: () => manifestQueryApi.list(params),
  });
}

export function useManifestQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['manifest-query', id],
    queryFn: () => manifestQueryApi.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === 'pending' ? 3000 : false;
    },
  });
}

export function useCreateManifestQuery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof manifestQueryApi.create>[0]) => manifestQueryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manifest-queries'] });
    },
  });
}

export function usePollManifestQuery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => manifestQueryApi.poll(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['manifest-query', id] });
      queryClient.invalidateQueries({ queryKey: ['manifest-queries'] });
    },
  });
}
