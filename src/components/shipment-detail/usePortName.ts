import { useQuery } from '@tanstack/react-query';

/** US ports are four digits (CBP Schedule D); foreign ports are five (Schedule K). */
export const isUsPort = (code: string | null | undefined): code is string => /^\d{4}$/.test(code?.trim() ?? '');

/**
 * CBP's name for a port code, from the same lists the filing form offers.
 * The lists are large, so they load only when a page asks for a name.
 */
export function usePortName(code: string | null | undefined): string | null {
  const key = code?.trim() || null;
  const { data } = useQuery({
    queryKey: ['port-name', key],
    enabled: !!key,
    staleTime: Infinity,
    queryFn: async () => {
      const list = isUsPort(key)
        ? (await import('@/data/schedule-d-ports')).CBP_PORTS_4DIGIT
        : (await import('@/data/schedule-k-ports')).SCHEDULE_K_PORTS;
      const label = list.find((p) => p.value === key)?.label;
      return label ? label.split(' — ').slice(1).join(' — ') || null : null;
    },
  });
  return data ?? null;
}
