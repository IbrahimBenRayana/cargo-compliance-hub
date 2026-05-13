import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, MailCheck, ShieldCheck, RotateCw, ArrowLeft } from 'lucide-react';

import { authApi } from '@/api/client';
import { useAuthStore } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { toast } from 'sonner';

/**
 * /verify-email — 6-digit code entry, big-tech pattern.
 *
 * UX choices:
 *   - 3 + 3 grouped slots with subtle separator (Stripe convention)
 *   - Auto-submit when the last digit lands (no extra button press)
 *   - Resend button shows live countdown driven by the server's state
 *     endpoint, not a local timer — so it survives a page reload
 *   - On success: brief gold check animation, then route to redirect target
 *     (or /onboarding for fresh signups whose org isn't set up yet)
 */
export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [code, setCode] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | undefined>(undefined);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const submittedFor = useRef<string | null>(null);

  // Where to go after success. Falls back to /onboarding for first-timers
  // (their org.onboardingCompleted will be false), otherwise dashboard.
  const redirectTo = useMemo(() => {
    const intent = search.get('redirect');
    if (intent && intent.startsWith('/')) return intent;
    if (user?.organization && user.organization.onboardingCompleted === false) {
      return '/onboarding';
    }
    return '/';
  }, [search, user?.organization]);

  // Polls only on mount + after resend so we don't hammer the API.
  const stateQuery = useQuery({
    queryKey: ['verify-email-state'],
    queryFn: () => authApi.verifyEmailState(),
    staleTime: 30_000,
  });

  // If the user is already verified (e.g. they got here by typing the URL),
  // skip the form and bounce them out.
  useEffect(() => {
    if (stateQuery.data?.emailVerified) {
      navigate(redirectTo, { replace: true });
    }
  }, [stateQuery.data?.emailVerified, redirectTo, navigate]);

  // Resend countdown — updates locally each second, but the *source of truth*
  // is the server's cooldownRemainingSec. We rehydrate on tab focus too.
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (stateQuery.data?.cooldownRemainingSec !== undefined) {
      setCooldown(stateQuery.data.cooldownRemainingSec);
    }
  }, [stateQuery.data?.cooldownRemainingSec]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // ── Mutations ─────────────────────────────────────────────────────
  const confirm = useMutation({
    mutationFn: (c: string) => authApi.verifyEmailConfirm(c),
    onSuccess: async () => {
      setSuccess(true);
      setInlineError(null);
      // Refresh the cached user so route guards stop redirecting back here.
      if (user) setUser({ ...user, emailVerified: true });
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      // Short pause so the gold check animation reads, then bounce.
      setTimeout(() => navigate(redirectTo, { replace: true }), 900);
    },
    onError: (err: any) => {
      const body = err?.body ?? {};
      setInlineError(body.error || 'That code is not correct. Please try again.');
      setAttemptsRemaining(typeof body.attemptsRemaining === 'number' ? body.attemptsRemaining : undefined);
      // Clear the input so the user can retype without backspacing.
      setCode('');
      submittedFor.current = null;
    },
  });

  const resend = useMutation({
    mutationFn: () => authApi.verifyEmailResend(),
    onSuccess: async (data) => {
      if (data.alreadyVerified) {
        toast.success('Email already verified.');
        if (user) setUser({ ...user, emailVerified: true });
        await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        navigate(redirectTo, { replace: true });
        return;
      }
      toast.success('New code sent to your inbox.');
      setInlineError(null);
      setAttemptsRemaining(undefined);
      setCooldown(data.cooldownSec ?? 60);
      // Re-fetch authoritative state in case server cooldown drifted.
      stateQuery.refetch();
    },
    onError: (err: any) => {
      const body = err?.body ?? {};
      if (typeof body.cooldownRemainingSec === 'number') {
        setCooldown(body.cooldownRemainingSec);
      }
      toast.error(body.error || 'Could not send a new code. Try again in a moment.');
    },
  });

  // ── Auto-submit when 6 digits are filled ──────────────────────────
  const handleChange = useCallback(
    (next: string) => {
      setCode(next);
      // Surface input as a user "try" — clear any previous error
      if (inlineError && next.length < 6) setInlineError(null);
      if (next.length === 6 && submittedFor.current !== next && !confirm.isPending) {
        submittedFor.current = next;
        confirm.mutate(next);
      }
    },
    [confirm, inlineError],
  );

  // If the email's "verify in one tap" link delivered ?code=, auto-submit.
  useEffect(() => {
    const fromUrl = search.get('code');
    if (fromUrl && /^\d{6}$/.test(fromUrl)) {
      setCode(fromUrl);
      submittedFor.current = fromUrl;
      confirm.mutate(fromUrl);
    }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const email = stateQuery.data?.email ?? user?.email ?? 'your inbox';
  const isLoadingInitial = stateQuery.isLoading && !stateQuery.data;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Back-to-login (logged-in users can still escape via logout) */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1.5 mb-6 text-[12px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm overflow-hidden">
          {/* Hero header */}
          <div className="px-7 pt-8 pb-6 bg-gradient-to-b from-amber-50/60 to-transparent dark:from-amber-400/[0.06] dark:to-transparent text-center">
            {success ? (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="relative mx-auto h-14 w-14 mb-4"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: [0.8, 1.25, 1], opacity: [0, 0.55, 0] }}
                  transition={{ duration: 1, ease: 'easeOut', times: [0, 0.5, 1] }}
                  className="absolute inset-0 rounded-full bg-amber-400/30 motion-reduce:hidden"
                />
                <div className="relative h-14 w-14 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 ring-1 ring-amber-300/60 dark:ring-amber-400/40 shadow-[0_8px_20px_-10px_rgba(245,158,11,0.5)] flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-amber-950" strokeWidth={2.5} />
                </div>
              </motion.div>
            ) : (
              <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-500/15 ring-1 ring-amber-200 dark:ring-amber-500/30 flex items-center justify-center mb-4">
                <MailCheck className="h-7 w-7 text-amber-600 dark:text-amber-400" strokeWidth={2} />
              </div>
            )}

            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400 mb-2">
              {success ? 'Email verified' : 'Verify your email'}
            </div>
            <h1 className="text-[20px] font-semibold leading-tight text-slate-900 dark:text-slate-50">
              {success ? "You're all set" : 'Enter the 6-digit code'}
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
              {success ? (
                'Redirecting you to the dashboard…'
              ) : (
                <>
                  We sent a code to <span className="font-medium text-slate-900 dark:text-slate-100">{email}</span>.
                </>
              )}
            </p>
          </div>

          {/* OTP input */}
          {!success && (
            <div className="px-7 py-7 space-y-5">
              {isLoadingInitial ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={handleChange}
                    disabled={confirm.isPending}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="h-12 w-11 text-lg font-semibold" />
                      <InputOTPSlot index={1} className="h-12 w-11 text-lg font-semibold" />
                      <InputOTPSlot index={2} className="h-12 w-11 text-lg font-semibold" />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} className="h-12 w-11 text-lg font-semibold" />
                      <InputOTPSlot index={4} className="h-12 w-11 text-lg font-semibold" />
                      <InputOTPSlot index={5} className="h-12 w-11 text-lg font-semibold" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              )}

              {/* Pending state */}
              {confirm.isPending && (
                <div className="flex items-center justify-center gap-2 text-[12.5px] text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Verifying…
                </div>
              )}

              {/* Inline error */}
              {inlineError && !confirm.isPending && (
                <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
                  {inlineError}
                  {typeof attemptsRemaining === 'number' && attemptsRemaining > 0 && (
                    <span className="block mt-0.5 text-[11.5px] text-rose-600/80 dark:text-rose-300/70">
                      {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining before a new code is required.
                    </span>
                  )}
                </div>
              )}

              {/* Resend */}
              <div className="text-center pt-1">
                <span className="text-[12.5px] text-slate-500 dark:text-slate-400">Didn't get the code? </span>
                <button
                  type="button"
                  onClick={() => resend.mutate()}
                  disabled={cooldown > 0 || resend.isPending}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 hover:text-amber-700 dark:hover:text-amber-400 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
                >
                  {resend.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCw className="h-3 w-3" />
                  )}
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send a new code'}
                </button>
              </div>
            </div>
          )}

          {/* Success state continues animating until redirect */}
          {success && (
            <div className="px-7 pb-8 pt-2 flex flex-col items-center gap-3">
              <Button
                size="lg"
                className="w-full font-semibold"
                onClick={() => navigate(redirectTo, { replace: true })}
              >
                Continue
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11.5px] text-slate-500 dark:text-slate-500">
          The code expires in 15 minutes. Check your spam folder if it doesn't arrive.
        </p>
      </div>
    </div>
  );
}
