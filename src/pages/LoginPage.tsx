import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLogin, useMfaVerify } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/client';
import { isMfaChallenge } from '@/types/auth';
import type { MfaMethod } from '@/types/auth';
import { motion, MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Loader2, ArrowLeft, ShieldCheck, KeyRound, Mail, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { AuthBrandPanel } from '@/components/AuthBrandPanel';
import { LogoMark } from '@/components/LogoMark';

const EASE = [0.22, 1, 0.36, 1] as const;

// Brand mark for the mobile header — uses the shared Focus Frame LogoMark.
function GoldMark() {
  return <LogoMark size={34} className="text-[hsl(222_47%_22%)] dark:text-[hsl(222_30%_64%)]" />;
}

type ChallengeMode = 'totp' | 'recovery' | 'email';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const login = useLogin();
  const verify = useMfaVerify();

  // ── MFA challenge state (never persisted; mfaToken lives here only) ──
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [methods, setMethods] = useState<MfaMethod[]>([]);
  const [mode, setMode] = useState<ChallengeMode>('totp');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | undefined>(undefined);
  const [cooldown, setCooldown] = useState(0);
  const submittedFor = useRef<string | null>(null);

  const inChallenge = mfaToken !== null;

  const resetToPassword = useCallback(() => {
    setMfaToken(null);
    setMethods([]);
    setMode('totp');
    setCode('');
    setRecoveryCode('');
    setInlineError(null);
    setAttemptsRemaining(undefined);
    setCooldown(0);
    submittedFor.current = null;
  }, []);

  // ── Password step ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await login.mutateAsync({ email, password });
      if (isMfaChallenge(result)) {
        // Enter the second-factor challenge. Keep email/password state.
        setMfaToken(result.mfaToken);
        setMethods(result.methods);
        setMode(result.methods.includes('totp') ? 'totp' : (result.methods[0] ?? 'totp'));
        setCode('');
        setRecoveryCode('');
        setInlineError(null);
        return;
      }
      toast.success('Welcome back!');
      navigate(redirectTo);
    } catch (err: any) {
      toast.error(err.body?.error || 'Login failed');
    }
  };

  // ── Verify step ────────────────────────────────────────────────────
  const runVerify = useCallback(
    async (method: MfaMethod, value: string) => {
      if (!mfaToken) return;
      setInlineError(null);
      try {
        await verify.mutateAsync({ mfaToken, method, code: value });
        toast.success('Welcome back!');
        navigate(redirectTo);
      } catch (err: any) {
        const body = err?.body ?? {};
        if (err?.status === 401 && body.code === 'mfa_token_invalid') {
          toast.error('Session expired, sign in again.');
          resetToPassword();
          return;
        }
        setInlineError(body.error || 'That code is not correct. Please try again.');
        setAttemptsRemaining(typeof body.attemptsRemaining === 'number' ? body.attemptsRemaining : undefined);
        setCode('');
        submittedFor.current = null;
      }
    },
    [mfaToken, verify, navigate, redirectTo, resetToPassword],
  );

  // Auto-submit the 6-digit code (TOTP + email OTP) when full.
  const handleCodeChange = useCallback(
    (next: string) => {
      setCode(next);
      if (inlineError && next.length < 6) setInlineError(null);
      if (next.length === 6 && submittedFor.current !== next && !verify.isPending) {
        submittedFor.current = next;
        runVerify(mode === 'email' ? 'email' : 'totp', next);
      }
    },
    [inlineError, verify.isPending, runVerify, mode],
  );

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) return;
    runVerify('recovery', recoveryCode.trim().toUpperCase());
  };

  // ── Email-OTP fallback ─────────────────────────────────────────────
  const emailSend = useMutation({
    mutationFn: () => authApi.mfaEmailSend(mfaToken!),
    onSuccess: (data) => {
      setMode('email');
      setCode('');
      setInlineError(null);
      setAttemptsRemaining(undefined);
      submittedFor.current = null;
      setCooldown(data.cooldownSec ?? 60);
      toast.success('Code sent to your email.');
    },
    onError: (err: any) => {
      const body = err?.body ?? {};
      if (typeof body.secondsRemaining === 'number') {
        setCooldown(body.secondsRemaining);
        setMode('email');
      }
      toast.error(body.error || 'Could not send a code. Try again in a moment.');
    },
  });

  // Countdown tick for the email resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const switchToTotp = () => {
    setMode('totp');
    setCode('');
    setInlineError(null);
    setAttemptsRemaining(undefined);
    submittedFor.current = null;
  };

  // ── Render helpers ─────────────────────────────────────────────────
  const sixDigitInput = (
    <div className="flex justify-center">
      <InputOTP maxLength={6} value={code} onChange={handleCodeChange} disabled={verify.isPending} autoFocus>
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
  );

  const errorBlock = inlineError && !verify.isPending && (
    <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
      {inlineError}
      {typeof attemptsRemaining === 'number' && attemptsRemaining > 0 && (
        <span className="block mt-0.5 text-[11.5px] text-rose-600/80 dark:text-rose-300/70">
          {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining before you'll need to sign in again.
        </span>
      )}
    </div>
  );

  const pendingBlock = verify.isPending && (
    <div className="flex items-center justify-center gap-2 text-[12.5px] text-slate-500 dark:text-slate-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Verifying…
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      {/* Full-viewport split layout */}
      <div className="flex min-h-screen">

        {/* ── Left: dark brand panel (desktop only) ── */}
        <div className="w-1/2 flex-shrink-0">
          <AuthBrandPanel variant="login" />
        </div>

        {/* ── Right: form panel ── */}
        <div className="flex-1 lg:w-1/2 bg-background flex items-center justify-center px-6 py-12 min-h-screen">
          <div className="w-full max-w-sm mx-auto">

            {/* Mobile-only logo mark */}
            <div className="flex justify-center mb-8 lg:hidden">
              <GoldMark />
            </div>

            {!inChallenge ? (
              <>
                {/* Heading */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Sign in
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground mb-8">
                    Enter your credentials to continue
                  </p>
                </motion.div>

                {/* Form */}
                <motion.form
                  onSubmit={handleSubmit}
                  className="space-y-5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
                >
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200">
                        Forgot password?
                      </span>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="w-full transition-shadow duration-200 hover:shadow-sm"
                    disabled={login.isPending}
                  >
                    {login.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </Button>
                </motion.form>

                {/* Divider + demo credentials */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
                >
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-background px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  {import.meta.env.DEV && (
                    <p className="text-xs text-muted-foreground text-center">
                      <span className="font-medium">Demo credentials</span>
                      <br />
                      demo@mycargolens.com / password123
                    </p>
                  )}

                  {/* Footer */}
                  <p className="mt-6 text-sm text-muted-foreground text-center">
                    Don&apos;t have an account?{' '}
                    <a
                      href="https://mycargolens.com/book-a-demo"
                      className="text-foreground font-medium hover:underline transition-colors"
                    >
                      Request a demo
                    </a>
                  </p>
                </motion.div>
              </>
            ) : (
              /* ── MFA challenge ── */
              <motion.div
                key="mfa-challenge"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="space-y-6"
              >
                <div>
                  <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-500/15 ring-1 ring-amber-200 dark:ring-amber-500/30 flex items-center justify-center mb-4">
                    {mode === 'recovery' ? (
                      <KeyRound className="h-6 w-6 text-amber-600 dark:text-amber-400" strokeWidth={2} />
                    ) : mode === 'email' ? (
                      <Mail className="h-6 w-6 text-amber-600 dark:text-amber-400" strokeWidth={2} />
                    ) : (
                      <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" strokeWidth={2} />
                    )}
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground text-center">
                    Two-factor authentication
                  </h1>
                  <p className="mt-1.5 text-sm text-muted-foreground text-center">
                    {mode === 'recovery'
                      ? 'Enter one of your recovery codes.'
                      : mode === 'email'
                      ? 'Enter the 6-digit code we emailed you.'
                      : 'Enter the 6-digit code from your authenticator app.'}
                  </p>
                </div>

                {/* TOTP / email → 6-digit; recovery → text */}
                {mode === 'recovery' ? (
                  <form onSubmit={handleRecoverySubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mfa-recovery-code">Recovery code</Label>
                      <Input
                        id="mfa-recovery-code"
                        value={recoveryCode}
                        onChange={(e) => { setRecoveryCode(e.target.value); if (inlineError) setInlineError(null); }}
                        placeholder="XXXXX-XXXXX"
                        autoFocus
                        autoComplete="one-time-code"
                        className="font-mono tracking-wide text-center"
                      />
                    </div>
                    {errorBlock}
                    <Button type="submit" size="lg" className="w-full font-semibold" disabled={verify.isPending || !recoveryCode.trim()}>
                      {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Verify
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    {sixDigitInput}
                    {pendingBlock}
                    {errorBlock}
                    {mode === 'email' && (
                      <div className="text-center">
                        <span className="text-[12.5px] text-slate-500 dark:text-slate-400">Didn't get it? </span>
                        <button
                          type="button"
                          onClick={() => emailSend.mutate()}
                          disabled={cooldown > 0 || emailSend.isPending}
                          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 hover:text-amber-700 dark:hover:text-amber-400 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
                        >
                          {emailSend.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Alternate methods */}
                <div className="space-y-2 pt-1 text-center">
                  {mode !== 'totp' && methods.includes('totp') && (
                    <button
                      type="button"
                      onClick={switchToTotp}
                      className="block w-full text-[12.5px] font-medium text-slate-600 hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-400 transition-colors"
                    >
                      Use your authenticator app
                    </button>
                  )}
                  {mode !== 'recovery' && methods.includes('recovery') && (
                    <button
                      type="button"
                      onClick={() => { setMode('recovery'); setInlineError(null); setAttemptsRemaining(undefined); }}
                      className="block w-full text-[12.5px] font-medium text-slate-600 hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-400 transition-colors"
                    >
                      Use a recovery code
                    </button>
                  )}
                  {mode !== 'email' && methods.includes('email') && (
                    <button
                      type="button"
                      onClick={() => emailSend.mutate()}
                      disabled={emailSend.isPending}
                      className="inline-flex items-center justify-center gap-1.5 w-full text-[12.5px] font-medium text-slate-600 hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-400 disabled:opacity-60 transition-colors"
                    >
                      {emailSend.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Can't access your app? Email me a code
                    </button>
                  )}
                </div>

                {/* Back to sign in */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={resetToPassword}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to sign in
                  </button>
                </div>
              </motion.div>
            )}

          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
