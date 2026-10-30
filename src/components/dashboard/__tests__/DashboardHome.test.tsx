import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DashboardResponse } from '@/types/dashboard';
import DashboardHome from '../DashboardHome';
import { action, dashboard, NOW } from './fixture';

const api = vi.hoisted(() => ({ get: vi.fn(), actions: vi.fn() }));
const auth = vi.hoisted(() => ({ role: 'operator' }));
const plan = vi.hoisted(() => ({ entries: true, subscription: undefined as unknown }));
vi.mock('@/api/client', () => ({ dashboardApi: api }));
vi.mock('@/hooks/useAuth', () => ({ useCurrentUser: () => ({ data: { role: auth.role } }) }));
vi.mock('@/hooks/useBilling', () => ({
  useCapabilities: () => ({ can: () => plan.entries }),
  useSubscription: () => ({ data: plan.subscription }),
}));
vi.mock('@/components/CelebrationModal', () => ({
  CelebrationModal: ({ planId }: { planId: string | null }) => (planId ? <div>WELCOME {planId}</div> : null),
}));

function show(data?: DashboardResponse, url = '/') {
  api.get.mockResolvedValue(data ?? dashboard());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}><DashboardHome /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = 'operator';
  plan.entries = true;
  plan.subscription = undefined;
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  // Figures settle at once, as they do for anyone who prefers reduced motion.
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

const row = (name: string | RegExp) => screen.findByRole('link', { name });

describe('DashboardHome', () => {
  it('labels the table columns', async () => {
    show();
    expect(await screen.findByRole('columnheader', { name: 'Issue' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Due' })).toBeInTheDocument();
  });

  it('opens on the numbers that matter today', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText('Needs attention', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('1 overdue')).toBeInTheDocument();
    expect(screen.getByText('Next ISF cutoff')).toBeInTheDocument();
  });

  it('ranks the most urgent issue first in the table', async () => {
    show();
    await screen.findByRole('table');
    const rows = screen.getAllByRole('link').filter((l) => l.closest('tbody'));
    expect(rows[0]).toHaveTextContent('ISF cutoff passed');
  });

  it('names each row for what it does, with one link per row', async () => {
    show();
    const link = await row('Finish ISF: ISF due, HLCU4471902');
    expect(link).toHaveAttribute('href', '/shipments/1/edit');
    expect(within(link.closest('tr')!).getAllByRole('link')).toHaveLength(1);
  });

  it('marks a cutoff estimated from the sailing date', async () => {
    show();
    expect(await screen.findByText('Est. 19h')).toBeInTheDocument();
  });

  it('shows a rejected change, which the status alone would hide', async () => {
    show();
    expect(await screen.findByText('Change rejected. Earlier version on file.')).toBeInTheDocument();
  });

  it('keeps Later closed until asked', async () => {
    show();
    await screen.findByRole('table');
    expect(screen.queryByText('ISF draft')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /later/i }));
    expect(screen.getByText('ISF draft')).toBeInTheDocument();
  });

  it('shows the first rows of a lane, then the rest on request', async () => {
    const d = dashboard();
    d.lanes[0] = { ...d.lanes[0], total: 12, items: Array.from({ length: 12 }, (_, i) => action({ id: `n${i}`, ref: `REF${i}` })) };
    show(d);
    await screen.findAllByText('REF7');
    expect(screen.queryAllByText('REF8')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /show 4 more/i }));
    expect((await screen.findAllByText('REF11')).length).toBeGreaterThan(0);
  });

  it('asks the server for rows it does not have yet', async () => {
    const d = dashboard();
    d.lanes[0] = { ...d.lanes[0], total: 30, nextCursor: 'c1' };
    api.actions.mockResolvedValue({ items: [action({ id: 'y', title: 'Row 26' })], nextCursor: null, total: 30 });
    show(d);
    fireEvent.click(await screen.findByRole('button', { name: /more of/i }));
    expect(await screen.findByText('Row 26')).toBeInTheDocument();
    expect(api.actions).toHaveBeenCalledWith({ lane: 'now', cursor: 'c1', limit: 25 });
  });

  it('filters through the server, so the result covers the whole org', async () => {
    api.actions.mockResolvedValue({ items: [action({ id: 'x', title: 'Filtered row' })], nextCursor: null, total: 1 });
    show();
    fireEvent.click(await screen.findByRole('button', { name: /^rejected/i }));
    expect(await screen.findByText('Filtered row')).toBeInTheDocument();
    expect(api.actions).toHaveBeenCalledWith({ filter: 'rejected', limit: 50 });
  });

  it('disables a filter with nothing behind it', async () => {
    show();
    expect(await screen.findByRole('button', { name: /no response/i })).toBeDisabled();
  });

  it('expands a group into its house bills', async () => {
    const d = dashboard();
    d.lanes[0].items = [action({ id: 'group:c', title: '12 house bills: ISF due', group: { id: 'c1', count: 12, label: '12 house bills' }, primary: { label: 'Show 12', href: '/shipments/1/edit', enabled: true, disabledReason: null } })];
    api.actions.mockResolvedValue({ items: [action({ id: 'm', title: 'One house bill' })], nextCursor: null, total: 1 });
    show(d);
    fireEvent.click(await screen.findByRole('button', { name: '12 house bills: ISF due' }));
    expect(await screen.findByText('One house bill')).toBeInTheDocument();
  });

  it('mentions the penalty only while an ISF is late or due today', async () => {
    show();
    expect(await screen.findByText(/liquidated damages of up to \$5,000/)).toBeInTheDocument();
  });

  it('stays quiet about the penalty when nothing is close', async () => {
    const d = dashboard({ attention: { now: 0, soon: 0, later: 0, overdue: 0, nextCutoffAt: null }, lanes: [] });
    d.filters = d.filters.map((f) => ({ ...f, count: 0 }));
    show(d);
    expect(await screen.findByText('Nothing needs attention right now.')).toBeInTheDocument();
    expect(screen.queryByText(/\$5,000/)).toBeNull();
  });

  it('never presents a penalty figure as a number on the dashboard', async () => {
    show();
    await screen.findByRole('table');
    expect(screen.queryByText('Late ISF exposure')).toBeNull();
  });

  it('offers no create buttons to a viewer', async () => {
    auth.role = 'viewer';
    show();
    await screen.findByRole('table');
    expect(screen.queryByRole('link', { name: 'New shipment' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'New entry' })).toBeNull();
  });

  it('offers New entry only on plans with entries', async () => {
    plan.entries = false;
    show();
    expect(await screen.findByRole('link', { name: 'New shipment' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New entry' })).toBeNull();
  });

  it('counts shipments near arrival with no entry, on plans with entries', async () => {
    show();
    expect(await screen.findByText('Arriving without entry')).toBeInTheDocument();
  });

  it('counts plain arrivals on a plan without entries', async () => {
    const d = dashboard({ arrivingWithoutEntry: null });
    show(d);
    expect(await screen.findByText('Arriving')).toBeInTheDocument();
  });

  it('flags a last free day coming up', async () => {
    show();
    expect(await screen.findByText('1 near last free day')).toBeInTheDocument();
  });

  it('shows no rate rather than a perfect one when nothing was sent', async () => {
    const d = dashboard();
    d.metrics.sentOnTime = { rate: null, sample: 0, prior: null };
    show(d);
    expect(await screen.findByText('Not enough filings yet')).toBeInTheDocument();
  });

  it('switches the chart between measures', async () => {
    show();
    const sent = await screen.findByRole('tab', { name: /isfs sent/i });
    expect(sent).toHaveAttribute('aria-selected', 'true');
    const rejected = screen.getByRole('tab', { name: /isfs rejected/i });
    fireEvent.click(rejected);
    expect(rejected).toHaveAttribute('aria-selected', 'true');
  });

  it('leaves entries off the chart on a plan without them', async () => {
    const d = dashboard();
    d.metrics.entriesAccepted = null;
    show(d);
    await screen.findByRole('tab', { name: /isfs sent/i });
    expect(screen.queryByRole('tab', { name: /entries accepted/i })).toBeNull();
  });

  it('shows an owner their usage, in the terms they are billed', async () => {
    auth.role = 'owner';
    plan.subscription = { invoicing: { includedIsfs: 25, monthToDate: { isfs: 18 } }, usage: { amountCents: 0 } };
    show();
    expect(await screen.findByText('18 of 25 included ISFs used this month')).toBeInTheDocument();
  });

  it('keeps billing figures from an operator', async () => {
    plan.subscription = { invoicing: null, usage: { amountCents: 189000 } };
    show();
    await screen.findByRole('table');
    expect(screen.queryByText(/billed this month/)).toBeNull();
  });

  it('shows open items by importer only when there is more than one', async () => {
    const one = dashboard({ workload: [{ name: 'Harbor Goods', count: 4 }] });
    const { unmount } = show(one);
    await screen.findByRole('table');
    expect(screen.queryByText('Open items by importer')).toBeNull();
    unmount();
    show(dashboard({ workload: [{ name: 'Harbor Goods', count: 4 }, { name: 'Delmar Foods', count: 2 }] }));
    expect(await screen.findByText('Open items by importer')).toBeInTheDocument();
  });

  it('describes waiting items by what is known, with no promise about timing', async () => {
    show(dashboard({ awaiting: { count: 2, noResponse: 1, items: [
      { id: 'a', ref: 'AAA', kind: 'isf', state: 'UNKNOWN', sentAt: null, href: '/shipments/1' },
      { id: 'b', ref: 'BBB', kind: 'isf', state: 'SENT', sentAt: new Date(NOW - 8 * 60_000).toISOString(), href: '/shipments/2' },
    ] } }));
    expect(await screen.findByText('Outcome unknown')).toBeInTheDocument();
    expect(screen.getByText('Sent 8m ago')).toBeInTheDocument();
  });

  it('counts each stage and links to it', async () => {
    show(dashboard({ flow: [{ key: 'isf_to_send', label: 'ISF to send', count: 14, href: '/shipments?stage=isf_to_send' }] }));
    expect(await row(/ISF to send/)).toHaveAttribute('href', '/shipments?stage=isf_to_send');
  });

  it('leads with what stops filing, and offers the fix when there is one', async () => {
    show(dashboard({ blockers: [{ code: 'PAYMENT_FAILED', scope: 'all', title: 'Filing is paused.', detail: 'Update your payment method.', fix: { label: 'Update payment', href: '/settings?tab=billing' } }] }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Filing is paused.');
    expect(screen.getByRole('link', { name: 'Update payment' })).toBeInTheDocument();
  });

  it('gives a new org its setup steps instead of empty charts', async () => {
    show(dashboard({ isEmpty: true, setup: [{ key: 'first_isf', label: 'File your first ISF', done: false, href: '/shipments/new' }] }));
    expect(await screen.findByText('File your first ISF')).toBeInTheDocument();
    expect(screen.queryByText('Filing activity')).toBeNull();
  });

  it('gives two ways forward when nothing could load', async () => {
    api.get.mockRejectedValue(new Error('down'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><DashboardHome /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('We could not load your dashboard.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shipments' })).toBeInTheDocument();
  });

  it('keeps the welcome modal the upgrade flow relies on', async () => {
    show(undefined, '/?welcome=entry');
    expect(await screen.findByText('WELCOME entry')).toBeInTheDocument();
  });

  it('never says cleared or with CBP', async () => {
    const { container } = show();
    await waitFor(() => expect(container.textContent).toContain('Needs attention'));
    expect(container.textContent).not.toMatch(/cleared|released|with cbp/i);
  });
});
