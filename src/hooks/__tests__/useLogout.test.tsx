/**
 * Signing out must drop every cached query (testing week AUTH-07): logout
 * doesn't reload the page, and with a 30s staleTime the next user to sign in
 * on the same tab was served the previous user's cached data.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogout } from '../useAuth';

vi.mock('@/api/client', () => ({
  authApi: { logout: vi.fn() },
  clearTokens: vi.fn(),
}));
import { authApi } from '@/api/client';

function setup() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['filings'], [{ id: 'f1', org: 'previous user' }]);
  queryClient.setQueryData(['subscription'], { plan: { name: 'Full' } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => useLogout(), { wrapper }) };
}

describe('useLogout', () => {
  it('clears cached queries after signing out', async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined as never);
    const { queryClient, result } = setup();
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['filings'])).toBeUndefined();
    expect(queryClient.getQueryData(['subscription'])).toBeUndefined();
  });

  it('clears cached queries even when the logout call fails', async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network'));
    const { queryClient, result } = setup();
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(['filings'])).toBeUndefined();
  });
});
