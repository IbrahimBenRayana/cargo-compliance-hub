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

describe('CbpTimeline (ISF) when CBP never answers (BUG-022)', () => {
  it('says CBP has not answered and what to check, instead of "waiting"', async () => {
    const { findAllByText, findByText, queryByText } = await import('@testing-library/react').then((rtl) => {
      cbpActivity.mockReset().mockResolvedValue({
        filing: { id: 'f2', status: 'submitted', cbpState: 'NOT_ON_FILE', pendingAction: 'ADD', isfFilerCode: null, cbpTransactionId: null },
        transmissions: [{ id: 't1', environment: 'CERT', action: 'A', filerCode: 'QA1', status: 'SENT', sentAt: '2026-10-22T15:10:55Z', respondedAt: null, createdAt: '2026-10-22T15:10:55Z', lastError: null, isfTransactionNumber: null, inbound: [], overdue: true }],
      });
      return rtl.render(<QueryClientProvider client={new QueryClient()}><CbpTimeline filingId="f2" /></QueryClientProvider>);
    });
    expect((await findAllByText(/No answer from CBP/)).length).toBe(2); // badge + warning
    expect(await findByText(/approved for filer code QA1/i)).toBeInTheDocument();
    expect(queryByText(/Waiting for CBP/)).not.toBeInTheDocument();
  });
});
