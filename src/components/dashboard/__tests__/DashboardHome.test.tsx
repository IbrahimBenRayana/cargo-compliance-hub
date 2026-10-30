import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DashboardResponse } from '@/types/dashboard';
import WorkQueuePage from '../WorkQueuePage';
import { action, dashboard, NOW } from './fixture';

const api = vi.hoisted(() => ({ get: vi.fn(), actions: vi.fn() }));
const auth = vi.hoisted(() => ({ role: 'operator' }));
vi.mock('@/api/client', () => ({ dashboardApi: api }));
vi.mock('@/hooks/useAuth', () => ({ useCurrentUser: () => ({ data: { role: auth.role } }) }));
vi.mock('@/hooks/useBilling', () => ({ useCapabilities: () => ({ can: () => true }) }));
vi.mock('@/components/CelebrationModal', () => ({
  CelebrationModal: ({ planId }: { planId: string | null }) => (planId ? <div>WELCOME {planId}</div> : null),
}));

function show(data?: DashboardResponse, url = '/') {
  api.get.mockResolvedValue(data ?? dashboard());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}><WorkQueuePage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = 'operator';
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  // Figures settle at once, as they do for anyone who prefers reduced motion.
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

describe('WorkQueuePage', () => {
  it('leads with the count and what is overdue', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('4 items need you now.');
    expect(screen.getByText(/1 overdue/)).toBeInTheDocument();
  });

  it('puts the most urgent row first, under the Focus Frame', async () => {
    const { container } = show();
    const first = (await screen.findAllByRole('listitem'))[0];
    expect(first).toHaveTextContent('ISF cutoff passed');
    expect(container.querySelectorAll('.focus-frame')).toHaveLength(1);
    expect(first.querySelector('.focus-frame')).not.toBeNull();
  });

  it('names each row for what it does, with one link per row', async () => {
    show();
    const link = await screen.findByRole('link', { name: 'Finish ISF: ISF due, HLCU4471902' });
    expect(link).toHaveAttribute('href', '/shipments/1/edit');
    const row = link.closest('li')!;
    expect(within(row).getAllByRole('link')).toHaveLength(1);
  });

  it('marks a cutoff estimated from the sailing date', async () => {
    show();
    expect(await screen.findByText('Est. 19h')).toBeInTheDocument();
  });

  it('shows a rejected change, which the status alone would hide', async () => {
    show();
    expect(await screen.findByText('CBP rejected your change. The earlier version is on file.')).toBeInTheDocument();
  });

  it('keeps the action in its column on a row with no pill', async () => {
    show();
    const link = await screen.findByRole('link', { name: 'Start entry: Ready for entry, ZIMU9041177' });
    const grid = link.closest('li')!.querySelector('.grid')!;
    expect(grid.children).toHaveLength(4); // text, pill slot, button, chevron
  });

  it('keeps Later closed until asked', async () => {
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText('ISF draft')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /later/i }));
    expect(screen.getByText('ISF draft')).toBeInTheDocument();
  });

  it('shows each count once: Now lives in the headline', async () => {
    show();
    const now = await screen.findByRole('button', { name: /^now/i });
    expect(now).not.toHaveTextContent('4');
  });

  it('offers no create button to a viewer', async () => {
    auth.role = 'viewer';
    show();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'New shipment' })).toBeNull();
  });

  it('offers it to an operator', async () => {
    show();
    expect(await screen.findByRole('link', { name: 'New shipment' })).toBeInTheDocument();
  });

  it('says so when nothing needs you', async () => {
    show(dashboard({ attention: { now: 0, soon: 0, later: 0, overdue: 0, nextCutoffAt: null }, lanes: [] }));
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Nothing needs you right now.');
  });

  it('filters through the server, so the result covers the whole org', async () => {
    api.actions.mockResolvedValue({ items: [action({ id: 'x', title: 'Filtered row' })], nextCursor: null, total: 1 });
    show();
    fireEvent.click(await screen.findByRole('button', { name: /rejected/i }));
    expect(await screen.findByText('Filtered row')).toBeInTheDocument();
    expect(api.actions).toHaveBeenCalledWith({ filter: 'rejected', limit: 50 });
  });

  it('disables a chip with nothing behind it', async () => {
    show();
    expect(await screen.findByRole('button', { name: /no response/i })).toBeDisabled();
  });

  it('loads the next page of a lane', async () => {
    const d = dashboard();
    d.lanes[0] = { ...d.lanes[0], total: 30, nextCursor: 'c1' };
    api.actions.mockResolvedValue({ items: [action({ id: 'y', title: 'Row 26' })], nextCursor: null, total: 30 });
    show(d);
    fireEvent.click(await screen.findByRole('button', { name: /show 25 more/i }));
    expect(await screen.findByText('Row 26')).toBeInTheDocument();
    expect(api.actions).toHaveBeenCalledWith({ lane: 'now', cursor: 'c1', limit: 25 });
  });

  it('expands a group into its house bills', async () => {
    const d = dashboard();
    d.lanes[0].items = [action({ id: 'group:c', title: '12 house bills: ISF due', group: { id: 'c1', count: 12, label: '12 house bills' }, primary: { label: 'Show 12', href: '/shipments/1/edit', enabled: true, disabledReason: null } })];
    api.actions.mockResolvedValue({ items: [action({ id: 'm', title: 'One house bill' })], nextCursor: null, total: 1 });
    show(d);
    fireEvent.click(await screen.findByRole('button', { name: '12 house bills: ISF due' }));
    expect(await screen.findByText('One house bill')).toBeInTheDocument();
  });

  it('gives two ways forward when nothing could load', async () => {
    api.get.mockRejectedValue(new Error('down'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><WorkQueuePage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('We could not load your dashboard.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shipments' })).toBeInTheDocument();
  });

  it('keeps the welcome modal the upgrade flow relies on', async () => {
    show(undefined, '/?welcome=entry');
    expect(await screen.findByText('WELCOME entry')).toBeInTheDocument();
  });

  it('shows the share of ISFs sent before their cutoff, and how many it is based on', async () => {
    show();
    expect(await screen.findByText('Sent before cutoff')).toBeInTheDocument();
    expect(screen.getByText('118 ISFs with a cutoff')).toBeInTheDocument();
    expect(screen.getByText('96')).toBeInTheDocument();
  });

  it('shows no rate rather than a perfect one when nothing was sent', async () => {
    const d = dashboard();
    d.metrics.sentOnTime = { rate: null, sample: 0, prior: null };
    show(d);
    expect(await screen.findByText('No sends yet')).toBeInTheDocument();
  });

  it('states exposure as an upper figure', async () => {
    show();
    expect(await screen.findByText('$5,000')).toBeInTheDocument();
    expect(screen.getByText('Up to $5,000 per overdue ISF')).toBeInTheDocument();
  });

  it('says nothing is overdue when exposure is zero', async () => {
    const d = dashboard();
    d.metrics.exposureUsd = 0;
    show(d);
    expect(await screen.findByText('Nothing overdue')).toBeInTheDocument();
  });

  it('counts each stage and links to it', async () => {
    const d = dashboard({ flow: [{ key: 'isf_to_send', label: 'ISF to send', count: 14, href: '/shipments?stage=isf_to_send' }] });
    show(d);
    expect(await screen.findByRole('link', { name: /ISF to send/ })).toHaveAttribute('href', '/shipments?stage=isf_to_send');
  });

  it('describes waiting items by what is known, with no promise about timing', async () => {
    const d = dashboard({ awaiting: { count: 2, noResponse: 1, items: [
      { id: 'a', ref: 'AAA', kind: 'isf', state: 'UNKNOWN', sentAt: null, href: '/shipments/1' },
      { id: 'b', ref: 'BBB', kind: 'isf', state: 'SENT', sentAt: new Date(NOW - 8 * 60_000).toISOString(), href: '/shipments/2' },
    ] } });
    show(d);
    expect(await screen.findByText('Outcome unknown')).toBeInTheDocument();
    expect(screen.getByText('Sent 8m ago')).toBeInTheDocument();
  });

  it('leads with what stops filing, and offers the fix when there is one', async () => {
    const d = dashboard({ blockers: [{ code: 'PAYMENT_FAILED', scope: 'all', title: 'Filing is paused.', detail: 'Update your payment method.', fix: { label: 'Update payment', href: '/settings?tab=billing' } }] });
    show(d);
    expect(await screen.findByRole('alert')).toHaveTextContent('Filing is paused.');
    expect(screen.getByRole('link', { name: 'Update payment' })).toBeInTheDocument();
  });

  it('never says cleared or with CBP', async () => {
    const { container } = show();
    await waitFor(() => expect(container.textContent).toContain('need you now'));
    expect(container.textContent).not.toMatch(/cleared|released|with cbp/i);
  });
});
