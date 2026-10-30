import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/client';
import type { ActionFilter } from '@/types/dashboard';

/** The stream prompts a refresh; polling covers viewers and quiet changes. */
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get(),
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useFilteredActions(filter: ActionFilter) {
  return useQuery({
    queryKey: ['dashboard', 'actions', filter],
    queryFn: () => dashboardApi.actions({ filter, limit: 50 }),
    enabled: filter !== 'all',
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

/** One shared clock, so a page of countdowns ticks together with a single timer. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
