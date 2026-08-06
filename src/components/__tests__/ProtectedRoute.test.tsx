/**
 * ProtectedRoute gate-ordering tests.
 *
 * Regression for the invited-teammate lockout: a fresh invitee has
 * emailVerified=false AND mfaSetupRequired=true, and the email/MFA gates
 * must not fight over the route (blank-page <Navigate> loop).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';

interface MockUser {
  emailVerified: boolean;
  mfaSetupRequired: boolean;
  organization?: { onboardingCompleted: boolean };
}

const authState: { isAuthenticated: boolean; isLoading: boolean; user: MockUser | null } = {
  isAuthenticated: true,
  isLoading: false,
  user: null,
};

vi.mock('@/hooks/useAuth', () => ({
  useAuthStore: (selector?: (s: typeof authState) => unknown) => (selector ? selector(authState) : authState),
  useCurrentUser: () => ({ isLoading: false }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>HOME</div>} />
          <Route path="/verify-email" element={<div>VERIFY-EMAIL</div>} />
          <Route path="/mfa-setup" element={<div>MFA-SETUP</div>} />
          <Route path="/onboarding" element={<div>ONBOARDING</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const onboardedOrg = { onboardingCompleted: true };

beforeEach(() => {
  authState.isAuthenticated = true;
  authState.isLoading = false;
  authState.user = null;
});

describe('ProtectedRoute gate ordering', () => {
  it('fresh invitee (unverified + MFA required) reaches /verify-email — no loop', () => {
    authState.user = { emailVerified: false, mfaSetupRequired: true, organization: onboardedOrg };
    renderAt('/');
    expect(screen.getByText('VERIFY-EMAIL')).toBeInTheDocument();
  });

  it('fresh invitee stays on /verify-email (MFA gate must not hijack it)', () => {
    authState.user = { emailVerified: false, mfaSetupRequired: true, organization: onboardedOrg };
    renderAt('/verify-email');
    expect(screen.getByText('VERIFY-EMAIL')).toBeInTheDocument();
  });

  it('after email verification, the invitee is routed to /mfa-setup and it renders', () => {
    authState.user = { emailVerified: true, mfaSetupRequired: true, organization: onboardedOrg };
    renderAt('/');
    expect(screen.getByText('MFA-SETUP')).toBeInTheDocument();
  });

  it('must-enroll user in a not-yet-onboarded org stays on /mfa-setup (onboarding gate must not hijack it)', () => {
    authState.user = {
      emailVerified: true,
      mfaSetupRequired: true,
      organization: { onboardingCompleted: false },
    };
    renderAt('/');
    expect(screen.getByText('MFA-SETUP')).toBeInTheDocument();
  });

  it('verified + enrolled user with incomplete onboarding lands on /onboarding', () => {
    authState.user = {
      emailVerified: true,
      mfaSetupRequired: false,
      organization: { onboardingCompleted: false },
    };
    renderAt('/');
    expect(screen.getByText('ONBOARDING')).toBeInTheDocument();
  });

  it('fully set-up user reaches the app', () => {
    authState.user = { emailVerified: true, mfaSetupRequired: false, organization: onboardedOrg };
    renderAt('/');
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });
});
