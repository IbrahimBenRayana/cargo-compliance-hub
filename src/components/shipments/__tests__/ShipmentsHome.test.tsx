import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Filing } from '@/types/shipment';
import ShipmentsHome from '../ShipmentsHome';

const NOW = Date.parse('2026-11-11T12:00:00.000Z');
const HOUR = 3_600_000;

const api = vi.hoisted(() => ({ list: vi.fn(), facets: vi.fn(), submit: vi.fn() }));
const auth = vi.hoisted(() => ({ role: 'operator' }));
vi.mock('@/api/client', () => ({
  filingsApi: api,
  templatesApi: { list: vi.fn(async () => ({ data: [] })) },
  bulkApi: { submit: vi.fn(), delete: vi.fn() },
  exportApi: {},
}));
vi.mock('@/hooks/useAuth', () => ({ useCurrentUser: () => ({ data: { role: auth.role } }) }));
vi.mock('@/components/PlanLimitModal', () => ({ PlanLimitModal: () => null }));

function filing(over: Partial<Filing> = {}): Filing {
  return {
    id: 'f1', status: 'draft', houseBol: 'HBL001', masterBol: 'MAEU1001', importerName: 'Acme Imports',
    commodities: [{ htsCode: '8471.30', countryOfOrigin: 'CN', description: 'Laptops' }],
    estimatedDeparture: '2026-11-14T00:00:00.000Z', createdAt: new Date(NOW - 2 * 24 * HOUR).toISOString(),
    cutoff: { at: new Date(NOW + 10 * HOUR).toISOString(), basis: 'LADING' }, consolidationId: null, consolidationSize: null,
    ...over,
  } as Filing;
}

function page(rows: Filing[], total = rows.length, pageNo = 1) {
  return { data: rows, pagination: { total, page: pageNo, limit: 25, totalPages: Math.max(1, Math.ceil(total / 25)) } };
}

const FACETS = { status: { draft: 12, rejected: 3, submitted: 2, pending_cbp: 1, accepted: 280, amended: 1, cancelled: 13 }, origins: [{ code: 'CN', count: 200 }, { code: 'VN', count: 12 }] };

function show(url = '/shipments') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}><ShipmentsHome /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const lastList = () => api.list.mock.calls.at(-1)![0];

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = 'operator';
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  api.list.mockResolvedValue(page([filing()]));
  api.facets.mockResolvedValue(FACETS);
});

describe('ShipmentsHome', () => {
  it('counts every ISF on the server, not the ones on this page', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Shipments' })).toBeInTheDocument();
    const line = await screen.findByText((_, el) => el?.tagName === 'P' && el.textContent === '312 ISFs, 15 to send or fix.');
    expect(within(line).getByText('15 to send or fix')).toHaveClass('text-soon');
    expect(screen.getByRole('button', { name: /^Sent\s*3$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Accepted\s*281$/ })).toBeInTheDocument();
  });

  it('asks for one page of 25, newest first', async () => {
    show();
    await screen.findByRole('table');
    expect(lastList()).toMatchObject({ page: 1, limit: 25, sortBy: 'createdAt', sortOrder: 'desc' });
    expect(lastList().status).toBeUndefined();
  });

  it('opens a tab as the statuses behind it, back on page 1', async () => {
    show('/shipments?page=2');
    await screen.findByRole('table');
    fireEvent.click(await screen.findByRole('button', { name: /^Sent\s*3$/ }));
    await waitFor(() => expect(lastList()).toMatchObject({ status: 'submitted,pending_cbp', page: 1 }));
  });

  it('reads its filters and page from the address, so Back returns to the same place', async () => {
    api.list.mockResolvedValue(page([filing()], 60, 2));
    show('/shipments?tab=rejected&origin=CN&page=2&sort=importerName&dir=asc');
    await screen.findByRole('table');
    expect(lastList()).toMatchObject({ status: 'rejected', origin: 'CN', page: 2, sortBy: 'importerName', sortOrder: 'asc' });
  });

  it('colours each status, and colours the counts of tabs that need a look', async () => {
    api.list.mockResolvedValue(page([filing({ id: 'a', status: 'rejected' })]));
    show();
    await screen.findByRole('table');
    expect(screen.getByText('Rejected', { selector: 'td span' })).toHaveClass('bg-urgent-tint');
    expect(within(screen.getByRole('button', { name: /^Rejected\s*3$/ })).getByText('3')).toHaveClass('bg-urgent-tint');
  });

  it('says Sent for an ISF that has gone out, as the dashboard does', async () => {
    api.list.mockResolvedValue(page([filing({ id: 'a', status: 'submitted' }), filing({ id: 'b', status: 'pending_cbp', houseBol: 'HBL002' })]));
    show();
    await screen.findByRole('table');
    expect(screen.getAllByText('Sent', { selector: 'td span' })).toHaveLength(2);
    expect(screen.queryByText('Submitted')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending CBP')).not.toBeInTheDocument();
  });

  it('counts down to the cutoffs that still matter and marks estimates', async () => {
    api.list.mockResolvedValue(page([
      filing({ id: 'a' }),
      filing({ id: 'b', houseBol: 'HBL002', cutoff: { at: new Date(NOW + 50 * HOUR).toISOString(), basis: 'ETD_ESTIMATE' } }),
      filing({ id: 'c', houseBol: 'HBL003', status: 'accepted', cutoff: { at: '2026-11-02T10:00:00.000Z', basis: 'LADING' } }),
    ]));
    show();
    await screen.findByRole('table');
    const cell = (ref: string) => screen.getByRole('link', { name: ref }).closest('tr')!;
    expect(within(cell('HBL001')).getAllByText('10h')[0]).toBeInTheDocument();
    expect(within(cell('HBL002')).getAllByText('Est. 2d 2h')[0]).toBeInTheDocument();
    expect(within(cell('HBL003')).getAllByText('Nov 2')[0]).toBeInTheDocument();
  });

  it('heads each row with the house bill and links it to the shipment', async () => {
    show();
    const link = await screen.findByRole('link', { name: 'HBL001' });
    expect(link).toHaveAttribute('href', '/shipments/f1');
    expect(within(link.closest('tr')!).getByText('MAEU1001')).toBeInTheDocument();
  });

  it('searches on the server once typing stops', async () => {
    show();
    await screen.findByRole('table');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search shipments' }), { target: { value: 'MAEU ' } });
    await waitFor(() => expect(lastList()).toMatchObject({ search: 'MAEU', page: 1 }));
    expect(screen.getByRole('searchbox')).toHaveValue('MAEU ');
  });

  it('steps back to the last page when the one asked for no longer exists', async () => {
    show('/shipments?page=4');
    await screen.findByRole('table');
    await waitFor(() => expect(lastList()).toMatchObject({ page: 1 }));
  });

  it('pages through everything, not just the newest 100', async () => {
    api.list.mockResolvedValue(page([filing()], 312));
    show();
    expect(await screen.findByText('1-25 of 312')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(lastList()).toMatchObject({ page: 2 }));
  });

  it('offers drafts to send or delete once they are selected', async () => {
    api.list.mockResolvedValue(page([filing(), filing({ id: 'b', houseBol: 'HBL002', status: 'accepted' })]));
    show();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select every shipment on this page' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send 1 draft' })).toBeInTheDocument();
    expect(screen.getByText('Only drafts can be sent or deleted.')).toBeInTheDocument();
  });

  it('shows a viewer the list without anything they cannot do', async () => {
    auth.role = 'viewer';
    show();
    await screen.findByRole('table');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New shipment/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Send/ })).not.toBeInTheDocument();
  });

  it('tells a new account how to start', async () => {
    api.list.mockResolvedValue(page([]));
    api.facets.mockResolvedValue({ status: {}, origins: [] });
    show();
    expect(await screen.findByText('No shipments yet.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /New shipment/ }).length).toBeGreaterThan(0);
  });

  it('says when filters match nothing, and clears them', async () => {
    api.list.mockResolvedValue(page([]));
    show('/shipments?q=zzz');
    expect(await screen.findByText('No shipments match these filters.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    await waitFor(() => expect(lastList().search).toBeUndefined());
  });

  it('offers a retry when the list cannot load', async () => {
    api.list.mockRejectedValue(new Error('down'));
    show();
    expect(await screen.findByText('We could not load your shipments.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
