import { useQuery, useMutation } from '@tanstack/react-query';
import { billingApi } from '../api/client';

export function useSubscription(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => billingApi.subscription(),
    ...options,
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: billingApi.createCheckoutSession,
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: billingApi.createPortalSession,
  });
}
