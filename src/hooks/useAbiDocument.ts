import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  abiDocumentsApi,
  ABIDocumentDraft,
  AbiDocumentEnvelope,
  AbiDocumentListParams,
} from '../api/client';

export function useAbiDocumentsList(params?: AbiDocumentListParams) {
  return useQuery({
    queryKey: ['abi-documents', 'list', params],
    queryFn: () => abiDocumentsApi.list(params),
  });
}

export function useAbiDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['abi-documents', id],
    queryFn: () => abiDocumentsApi.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      // Poll only while the document is mid-transmission. Terminal states
      // (SENT, ACCEPTED, REJECTED, CANCELLED) and DRAFT stop polling.
      return status === 'SENDING' ? 3000 : false;
    },
  });
}

export function useCreateAbiDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof abiDocumentsApi.create>[0]) =>
      abiDocumentsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abi-documents', 'list'] });
    },
  });
}

export function useUpdateAbiDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ABIDocumentDraft;
    }) => abiDocumentsApi.update(id, { payload }),
    // Optimistically patch the cached envelope so autosave feels instant.
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ['abi-documents', id] });
      const previous = queryClient.getQueryData<AbiDocumentEnvelope>([
        'abi-documents',
        id,
      ]);
      if (previous?.data) {
        queryClient.setQueryData<AbiDocumentEnvelope>(['abi-documents', id], {
          ...previous,
          data: {
            ...previous.data,
            payload: { ...previous.data.payload, ...payload },
            updatedAt: new Date().toISOString(),
          },
        });
      }
      return { previous };
    },
    onError: (_err, { id }, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['abi-documents', id], ctx.previous);
      }
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['abi-documents', id] });
    },
  });
}

export function useSendAbiDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => abiDocumentsApi.send(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['abi-documents', id] });
      queryClient.invalidateQueries({ queryKey: ['abi-documents', 'list'] });
    },
  });
}

export function useDeleteAbiDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => abiDocumentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abi-documents', 'list'] });
    },
  });
}

export function usePollAbiDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => abiDocumentsApi.poll(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['abi-documents', id] });
    },
  });
}

/**
 * Debounced autosave helper for the wizard.
 *
 * Usage:
 *   const autosave = useAbiDocumentAutosave(id);
 *   autosave.save({ header: { entryNumber: 'ABC123' } });
 *
 * Rapid calls to `save` within the debounce window are coalesced into one
 * PATCH. A trailing flush on unmount ensures pending edits are not lost.
 */
export function useAbiDocumentAutosave(id: string | undefined, debounceMs = 800) {
  const update = useUpdateAbiDocument();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<ABIDocumentDraft>({});
  const idRef = useRef(id);

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
    update.mutate({ id: nextId, payload });
  };

  const save = (patch: ABIDocumentDraft) => {
    pendingRef.current = { ...pendingRef.current, ...patch };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, debounceMs);
  };

  // Flush any pending patch on unmount so we do not drop the last edit.
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
        update.mutate({ id: nextId, payload });
      }
    };
    // update.mutate is stable across renders; id is tracked via idRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    save,
    flush,
    isSaving: update.isPending,
    error: update.error,
  };
}
