/**
 * Billing actions are for owners and admins (testing week BUG-011): the server
 * refuses operators, so the screen must not offer them the buttons.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BillingSettings } from '../billing/BillingSettings';

let role = 'owner';

vi.mock('@/hooks/useAuth', () => ({
  useAuthStore: (selector: (s: { user: { role: string } }) => unknown) => selector({ user: { role } }),
}));
vi.mock('@/hooks/useBilling', () => ({
  useSubscription: () => ({
    isLoading: false,
    data: {
      plan: { name: 'Full', perFilingCents: 4900 },
      card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 },
      usage: { filingsBilled: 0, amountCents: 0 },
      delinquent: false,
    },
  }),
  useCreatePortalSession: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/components/billing/CardCapture', () => ({ CardCapture: () => null }));

const renderIt = () => render(<MemoryRouter><BillingSettings /></MemoryRouter>);

describe('BillingSettings', () => {
  beforeEach(() => { role = 'owner'; });

  it.each(['owner', 'admin'])('lets the %s change the plan, the card and open Stripe', (r) => {
    role = r;
    renderIt();
    expect(screen.getByText('Change plan')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText(/Manage cards/)).toBeInTheDocument();
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
});
