/**
 * MfaSetupPage redirect tests.
 *
 * Regression for BUG-008 (testing week): turning MFA on refreshes the
 * signed-in user, mfaSetupRequired flips to false, and the page used to
 * redirect home at once — so the recovery codes flashed for half a second
 * and a new user never got to save them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MfaSetupPage from '../MfaSetupPage';

const authState: { user: { email: string; mfaSetupRequired: boolean } | null } = { user: null };

vi.mock('@/hooks/useAuth', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
  useLogout: () => ({ mutate: vi.fn() }),
}));

// Stand-in for the stepper: one button per signal it can send the page.
vi.mock('@/components/settings/MfaEnrollment', () => ({
  MfaEnrollment: ({ onEnrollmentStart, onComplete }: { onEnrollmentStart?: () => void; onComplete: () => void }) => (
    <div>
      <div>RECOVERY-CODES</div>
      <button onClick={() => onEnrollmentStart?.()}>start</button>
      <button onClick={onComplete}>finish</button>
    </div>
  ),
}));

const queryClient = new QueryClient();

function tree() {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/mfa-setup']}>
        <Routes>
          <Route path="/" element={<div>HOME</div>} />
          <Route path="/mfa-setup" element={<MfaSetupPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MfaSetupPage', () => {
  beforeEach(() => {
    authState.user = { email: 'owner@example.com', mfaSetupRequired: true };
  });

  it('leaves at once when the user turns out to be enrolled already (stale client state)', () => {
    authState.user = { email: 'owner@example.com', mfaSetupRequired: false };
    render(tree());
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  it('keeps the recovery codes on screen after MFA is turned on, until Finish setup', async () => {
    const view = render(tree());
    fireEvent.click(screen.getByText('start'));

    // Enabling MFA refreshes the user: enrollment is no longer required.
    authState.user = { email: 'owner@example.com', mfaSetupRequired: false };
    view.rerender(tree());
    expect(screen.getByText('RECOVERY-CODES')).toBeInTheDocument();

    fireEvent.click(screen.getByText('finish'));
    expect(await screen.findByText('HOME')).toBeInTheDocument();
  });
});
