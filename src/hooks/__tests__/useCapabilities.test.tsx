/** The capability gate must read the same for an operator's trimmed billing response. */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCapabilities } from '../useBilling';

const subscription = vi.hoisted(() => ({ data: null as unknown }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: subscription.data, isLoading: false, isError: false }),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));

describe('useCapabilities', () => {
  it('works from the trimmed response an operator gets', () => {
    subscription.data = {
      plan: { id: 'isf', name: 'ISF Filing', perFilingCents: null },
      capabilities: ['isf.file'],
      canFile: true, card: null, cardOnFile: true, delinquent: false,
    };
    const { result } = renderHook(() => useCapabilities());
    expect(result.current).toMatchObject({ planId: 'isf', planName: 'ISF Filing', hasActivePlan: true, canFile: true, cardOnFile: true, delinquent: false });
    expect(result.current.can('isf.file' as never)).toBe(true);
  });
});
