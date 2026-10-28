/**
 * Billing actions are for owners and admins (testing week BUG-011): the server
 * refuses operators, so the screen must not offer them the buttons.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BillingSettings } from '../billing/BillingSettings';

let role = 'owner';
let extra: Record<string, unknown> = {};

vi.mock('@/hooks/useAuth', () => ({
  useAuthStore: (selector: (s: { user: { role: string } }) => unknown) => selector({ user: { role } }),
}));
vi.mock('@/hooks/useBilling', () => ({
  useSubscription: () => ({
    isLoading: false,
    data: {
      plan: { name: 'ISF Filing', perFilingCents: 4500, isPublic: true },
      pricing: { isfCents: 4500, entryLinkedCents: 10500, entryOnlyCents: 12500 },
      card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 },
      usage: { filingsBilled: 0, amountCents: 0 },
      delinquent: false,
      billingMode: 'card',
      ...extra,
    },
  }),
  useCreatePortalSession: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/components/billing/CardCapture', () => ({ CardCapture: () => null }));

const renderIt = () => render(<MemoryRouter><BillingSettings /></MemoryRouter>);

describe('BillingSettings', () => {
  beforeEach(() => { role = 'owner'; extra = {}; });

  it.each(['owner', 'admin'])('lets the %s change the plan, the card and open Stripe', (r) => {
    role = r;
    renderIt();
    expect(screen.getByText('Change plan')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText(/Manage cards/)).toBeInTheDocument();
  });

  it("shows the org's own prices by what is filed", () => {
    renderIt();
    expect(screen.getByText('$45 per accepted ISF')).toBeInTheDocument();
    expect(screen.getByText('+$105 for an entry on the same shipment as an ISF')).toBeInTheDocument();
    expect(screen.getByText('$125 per entry without an ISF')).toBeInTheDocument();
  });

  it('shows an operator the plan and card but no billing actions', () => {
    role = 'operator';
    renderIt();
    expect(screen.getByText('visa •••• 4242')).toBeInTheDocument();
    expect(screen.queryByText('Change plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Update')).not.toBeInTheDocument();
    expect(screen.queryByText(/Manage cards/)).not.toBeInTheDocument();
    expect(screen.getByText(/Only owners and admins can change billing/)).toBeInTheDocument();
  });

  it('an invoiced account sees its monthly terms, the ACH account and the month so far — no card', () => {
    extra = {
      billingMode: 'invoiced',
      card: null,
      pricing: { isfCents: 500, entryLinkedCents: null, entryOnlyCents: null },
      invoicing: {
        monthlyMinimumCents: 25000,
        includedIsfs: 50,
        bankAccount: { bankName: 'STRIPE TEST BANK', last4: '6789' },
        monthToDate: { isfs: 12, shipments: 12, estimatedCents: 25000, lines: [{ code: 'minimum', description: 'Monthly minimum: includes 50 accepted ISFs (12 used)', quantity: 1, unitCents: 25000, amountCents: 25000 }] },
      },
    };
    renderIt();
    expect(screen.getByText('$250 a month, including 50 accepted ISFs')).toBeInTheDocument();
    expect(screen.getByText('$5 per accepted ISF above the 50 included')).toBeInTheDocument();
    expect(screen.getByText('STRIPE TEST BANK •••• 6789')).toBeInTheDocument();
    expect(screen.getByText('Monthly minimum: includes 50 accepted ISFs (12 used)')).toBeInTheDocument();
    expect(screen.queryByText(/Payment method/)).not.toBeInTheDocument();
  });
});
