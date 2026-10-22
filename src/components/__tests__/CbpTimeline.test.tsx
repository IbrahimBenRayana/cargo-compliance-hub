/**
 * BUG-020: when CBP's answer to an ISF lands, the shipment itself (status,
 * lifecycle, buttons) must refresh, not just the activity card.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CbpTimeline } from '../CbpTimeline';

const { cbpActivity } = vi.hoisted(() => ({ cbpActivity: vi.fn() }));
vi.mock('@/api/client', () => ({ filingsApi: { cbpActivity }, abiDocumentsApi: {} }));

const activity = (pendingAction: string | null, status: string) => ({
  filing: { id: 'f1', status, cbpState: 'NOT_ON_FILE', pendingAction, isfFilerCode: null, cbpTransactionId: null },
  transmissions: [],
});

describe('CbpTimeline (ISF)', () => {
  it('refreshes the shipment when CBP\'s answer lands', async () => {
    cbpActivity.mockResolvedValueOnce(activity('ADD', 'submitted')).mockResolvedValue(activity(null, 'rejected'));
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    render(<QueryClientProvider client={qc}><CbpTimeline filingId="f1" /></QueryClientProvider>);
    await waitFor(() => expect(cbpActivity).toHaveBeenCalledTimes(1));
    await qc.refetchQueries({ queryKey: ['filing', 'f1', 'cbp'] });
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['filing', 'f1'] }));
  });

  it('does not refresh when nothing was pending', async () => {
    cbpActivity.mockReset().mockResolvedValue(activity(null, 'accepted'));
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    render(<QueryClientProvider client={qc}><CbpTimeline filingId="f1" /></QueryClientProvider>);
    await waitFor(() => expect(cbpActivity).toHaveBeenCalled());
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['filing', 'f1'] });
  });
});
