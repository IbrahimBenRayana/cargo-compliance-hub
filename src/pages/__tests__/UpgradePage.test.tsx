/**
 * Only owners and admins can switch plans (testing week BUG-011).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UpgradePage from '../UpgradePage';

let role = 'owner';

vi.mock('@/hooks/useAuth', () => ({
  useAuthStore: (selector: (s: { user: { role: string } }) => unknown) => selector({ user: { role } }),
}));
vi.mock('@/hooks/useBilling', () => ({
  useSubscription: () => ({ isLoading: false, data: { plan: null, card: null } }),
  useSelectTier: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/components/billing/CardCapture', () => ({ CardCapture: () => null }));

const planButtons = () => screen.getAllByRole('button').filter((b) => /^Choose /.test(b.textContent ?? ''));

describe('UpgradePage', () => {
  beforeEach(() => { role = 'owner'; });

  it('lets an owner pick a plan', () => {
    render(<MemoryRouter><UpgradePage /></MemoryRouter>);
    expect(planButtons().length).toBeGreaterThan(0);
    planButtons().forEach((b) => expect(b).toBeEnabled());
  });

  it('shows an operator the plans but not the means to switch', () => {
    role = 'operator';
    render(<MemoryRouter><UpgradePage /></MemoryRouter>);
    planButtons().forEach((b) => expect(b).toBeDisabled());
    expect(screen.getByText(/Only owners and admins can change the plan/)).toBeInTheDocument();
  });
});
