import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    /** A usable card is on file (or a $0 tier) and the org isn't delinquent. */
    canFile: !!data?.canFile,
    cardOnFile: !!data?.card,
    delinquent: !!data?.delinquent,
    card: data?.card ?? null,
    capabilities,
    /** True once entitlements are known and the capability is present. */
    can: (cap: Capability) => capabilities.includes(cap),
  };
}

/** Choose / change the plan tier (no charge, reuses the saved card). */
export function useSelectTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: billingApi.selectTier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing', 'subscription'] }),
  });
}

/** Begin saving a card — returns a SetupIntent client secret for Elements. */
export function useCreateSetupIntent() {
  return useMutation({ mutationFn: billingApi.createSetupIntent });
}

/** Confirm a saved card after Elements confirms the SetupIntent. */
export function useSaveCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: billingApi.saveCard,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing', 'subscription'] }),
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: billingApi.createPortalSession,
  });
}
