import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, LogOut } from 'lucide-react';
import { MfaEnrollment } from '@/components/settings/MfaEnrollment';
import { useAuthStore } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/useAuth';

/**
 * /mfa-setup — forced two-factor enrollment for accounts whose org requires
 * it (user.mfaSetupRequired). Whitelisted in ProtectedRoute like /verify-email
 * so the user can actually land here. Full-page, no sidebar. Layout mirrors
 * VerifyEmailPage for a consistent gated-onboarding feel.
 */
export default function MfaSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  const handleComplete = async () => {
    // Refresh the cached user so mfaSetupRequired flips false and the route
    // gate stops redirecting back here, then send them into the app.
    await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Escape hatch — the only way out of a hard gate is to sign out */}
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="inline-flex items-center gap-1.5 mb-6 text-[12px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm overflow-hidden">
          {/* Hero header */}
          <div className="px-7 pt-8 pb-6 bg-gradient-to-b from-amber-50/60 to-transparent dark:from-amber-400/[0.06] dark:to-transparent text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-500/15 ring-1 ring-amber-200 dark:ring-amber-500/30 flex items-center justify-center mb-4">
              <ShieldCheck className="h-7 w-7 text-amber-600 dark:text-amber-400" strokeWidth={2} />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400 mb-2">
              Two-factor authentication
            </div>
            <h1 className="text-[20px] font-semibold leading-tight text-slate-900 dark:text-slate-50">
              Set up two-factor authentication
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
              Your organization requires an authenticator app to secure
              {user ? <> <span className="font-medium text-slate-900 dark:text-slate-100">{user.email}</span></> : ' your account'}.
              It only takes a minute.
            </p>
          </div>

          {/* Enrollment stepper */}
          <div className="px-7 py-7">
            <MfaEnrollment onComplete={handleComplete} />
          </div>
        </div>

        <p className="mt-6 text-center text-[11.5px] text-slate-500 dark:text-slate-500">
          Two-factor authentication adds a second step at sign-in, protecting your customs filings
          even if your password is compromised.
        </p>
      </div>
    </div>
  );
}
