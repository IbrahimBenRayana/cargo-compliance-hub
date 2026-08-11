import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  inbondApi,
  type InbondEntryType,
  type InbondListParams,
  type InbondPayloadDraft,
  type InbondRecordEventBody,
} from '../api/client';

export function useInbondList(params?: InbondListParams) {
  return useQuery({
    queryKey: ['inbond', 'list', params],
    queryFn: () => inbondApi.list(params),
  });
}

export function useInbondFiling(id: string | undefined) {
  return useQuery({
    queryKey: ['inbond', id],
    queryFn: () => inbondApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateInbond() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { entryType: InbondEntryType; payload?: InbondPayloadDraft }) =>
      inbondApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbond', 'list'] });
    },
  });
}

export function useUpdateInbond() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      entryType,
      payload,
    }: {
      id: string;
      entryType?: InbondEntryType;
      payload?: InbondPayloadDraft;
    }) => inbondApi.update(id, { entryType, payload }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['inbond', id] });
      queryClient.invalidateQueries({ queryKey: ['inbond', 'list'] });
    },
  });
}

export function useDeleteInbond() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inbondApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbond', 'list'] });
    },
  });
}

/** Validate & build the wire; a 422 rejection carries err.body.issues. */
export function useBuildInbond() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inbondApi.build(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['inbond', id] });
      queryClient.invalidateQueries({ queryKey: ['inbond', 'list'] });
    },
  });
}

export function useRecordInbondEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: InbondRecordEventBody }) =>
      inbondApi.recordEvent(id, body),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['inbond', id] });
      queryClient.invalidateQueries({ queryKey: ['inbond', 'list'] });
    },
  });
}
