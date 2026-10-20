/**
 * Autosave ordering (audit FPR-01): flush() resolves only once the edit is
 * on the server, saves never overlap or reorder, and a failed save keeps
 * its patch for the next attempt instead of dropping it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const update = vi.fn();
vi.mock('@/api/client', () => ({ abiDocumentsApi: { update: (...args: unknown[]) => update(...args) } }));

import { useAbiDocumentAutosave } from '../useAbiDocument';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** A server call we resolve by hand. */
function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => update.mockReset());

describe('useAbiDocumentAutosave', () => {
  it('flush resolves only after the save reached the server', async () => {
    const call = deferred();
    update.mockReturnValueOnce(call.promise);
    const { result } = renderHook(() => useAbiDocumentAutosave('d1'), { wrapper });

    act(() => result.current.save({ firms: 'Y123' }));
    let done = false;
    const flushed = result.current.flush().then(() => { done = true; });
    await vi.waitFor(() => expect(update).toHaveBeenCalledWith('d1', { payload: { firms: 'Y123' } }));
    await new Promise((r) => setTimeout(r, 20));
    expect(done).toBe(false);

    call.resolve();
    await flushed;
    expect(done).toBe(true);
  });

  it('runs saves one at a time, in order', async () => {
    const first = deferred();
    update.mockReturnValueOnce(first.promise).mockResolvedValueOnce({});
    const { result } = renderHook(() => useAbiDocumentAutosave('d1'), { wrapper });

    act(() => result.current.save({ firms: 'OLD' }));
    const a = result.current.flush();
    act(() => result.current.save({ firms: 'NEW' }));
    const b = result.current.flush();
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(update).toHaveBeenCalledTimes(1);

    first.resolve();
    await a;
    await b;
    expect(update.mock.calls.map((c) => c[1].payload.firms)).toEqual(['OLD', 'NEW']);
  });

  it('keeps a failed patch and sends it with the next save', async () => {
    update.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
    const { result } = renderHook(() => useAbiDocumentAutosave('d1'), { wrapper });

    act(() => result.current.save({ firms: 'Y123' }));
    await expect(result.current.flush()).rejects.toThrow('offline');

    act(() => result.current.save({ entryNumber: 'ABC-1234567-6' }));
    await result.current.flush();
    expect(update).toHaveBeenLastCalledWith('d1', { payload: { firms: 'Y123', entryNumber: 'ABC-1234567-6' } });
  });
});
