import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

const DISMISS_KEY = 'mcl_mfa_nag_dismissed';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * Slim amber prompt nudging existing users (MFA not enabled, not force-enrolled)
 * to turn on two-factor. Dismiss snoozes for 7 days via localStorage. Modeled
 * on AgentHandoffBanner's amber style.
 */
export function MfaNagBanner() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState(() => isSnoozed());

  // Only for existing users who haven't enrolled and aren't under the hard
  // gate (mfaSetupRequired → they're bounced to /mfa-setup instead).
  if (!user || user.mfaEnabled !== false || user.mfaSetupRequired === true) return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private browsing — banner just reappears next load */
    }
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[12.5px] text-amber-700 dark:text-amber-300">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-0">
        Protect your account — set up two-factor authentication.
      </span>
      <button
        type="button"
        onClick={() => navigate('/settings?tab=profile')}
        className="shrink-0 font-semibold underline-offset-2 hover:underline cursor-pointer"
      >
        Set up now
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-100 cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
