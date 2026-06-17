import { useQuery, useMutation } from '@tanstack/react-query';
import { billingApi } from '../api/client';
import type { Capability } from '../lib/planMeta';

export function useSubscription(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => billingApi.subscription(),
    ...options,
  });
}

/**
 * Capability gate for the UI. Derives the org's unlocked capabilities from the
 * active subscription. While loading we report `isLoading` so callers can avoid
 * flashing a locked state before the real entitlements arrive.
 *
 * This is cosmetic only — the server enforces the real boundary via
 * requireCapability. Use it to hide nav items, disable buttons, and show
 * upgrade nudges.
 */
export function useCapabilities() {
  const { data, isLoading, isError } = useSubscription();
  const capabilities = (data?.capabilities ?? []) as Capability[];
  return {
    isLoading,
    isError,
    planId: data?.plan?.id ?? null,
    planName: data?.plan?.name ?? null,
    hasActivePlan: !!data?.plan,
    capabilities,
    /** True once entitlements are known and the capability is present. */
    can: (cap: Capability) => capabilities.includes(cap),
  };
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
