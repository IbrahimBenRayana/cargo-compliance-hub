import { useCallback, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Eye, EyeOff, Copy, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { useMfaSetup, useMfaEnable } from '@/hooks/useFilings';
import { RecoveryCodesPanel } from '@/components/settings/RecoveryCodesPanel';
import { toast } from 'sonner';

type Step = 'password' | 'scan' | 'recovery';

/**
 * Reusable authenticator-app enrollment stepper. Drives all three steps of
 * turning MFA on and hands the caller nothing but an onComplete signal — so
 * it drops into both the forced /mfa-setup page and the Settings dialog.
 *
 *   password confirm → POST /mfa/setup  (pending secret + otpauth URI)
 *   scan QR + confirm code → POST /mfa/enable  (recovery codes)
 *   show recovery codes → onComplete
 */
export function MfaEnrollment({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('password');

  // Step (a)
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step (b)
  const [otpauthUri, setOtpauthUri] = useState('');
  const [secretBase32, setSecretBase32] = useState('');
  const [code, setCode] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const submittedFor = useRef<string | null>(null);

  // Step (c)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const setup = useMfaSetup();
  const enable = useMfaEnable();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    try {
      const res = await setup.mutateAsync({ password });
      setOtpauthUri(res.otpauthUri);
      setSecretBase32(res.secretBase32);
      setStep('scan');
    } catch (err: any) {
      setInlineError(err?.body?.error || 'That password is not correct.');
    }
  };

  const runEnable = useCallback(
    async (c: string) => {
      setInlineError(null);
      try {
        const res = await enable.mutateAsync({ code: c });
        setRecoveryCodes(res.recoveryCodes);
        setStep('recovery');
      } catch (err: any) {
        setInlineError(err?.body?.error || 'That code is not correct. Try the current 6 digits.');
        setCode('');
        submittedFor.current = null;
      }
    },
    [enable],
  );

  const handleCodeChange = useCallback(
    (next: string) => {
      setCode(next);
      if (inlineError && next.length < 6) setInlineError(null);
      if (next.length === 6 && submittedFor.current !== next && !enable.isPending) {
        submittedFor.current = next;
        runEnable(next);
      }
    },
    [enable.isPending, inlineError, runEnable],
  );

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secretBase32);
      setSecretCopied(true);
      toast.success('Secret key copied');
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the key manually');
    }
  };

  // Chunk the base32 secret into groups of 4 for readability.
  const prettySecret = useMemo(
    () => secretBase32.replace(/(.{4})/g, '$1 ').trim(),
    [secretBase32],
  );

  // ── Step (a): password re-auth ────────────────────────────────────
  if (step === 'password') {
    return (
      <form onSubmit={handleSetup} className="space-y-5">
        <p className="text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
          Confirm your password to begin setting up an authenticator app (Google Authenticator,
          1Password, Authy, etc.).
        </p>
        <div className="space-y-2">
          <Label htmlFor="mfa-setup-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Password
          </Label>
          <div className="relative">
            <Input
              id="mfa-setup-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoFocus
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {inlineError && (
          <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
            {inlineError}
          </div>
        )}
        <Button type="submit" size="lg" className="w-full font-semibold cursor-pointer" disabled={setup.isPending || !password}>
          {setup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Continue
        </Button>
      </form>
    );
  }

  // ── Step (b): scan QR + confirm code ──────────────────────────────
  if (step === 'scan') {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => { setStep('password'); setCode(''); setInlineError(null); }}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div>
          <p className="text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400 mb-4">
            Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
          </p>
          <div className="flex justify-center">
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm">
              {otpauthUri ? (
                <QRCodeSVG value={otpauthUri} size={168} level="M" />
              ) : (
                <div className="h-[168px] w-[168px] flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manual entry fallback */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-3.5 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Can't scan? Enter this key
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-[12.5px] tracking-wide text-slate-800 dark:text-slate-200 break-all">
              {prettySecret}
            </code>
            <button
              type="button"
              onClick={copySecret}
              className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Copy secret key"
            >
              {secretCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* 6-digit confirm */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Verification code
          </Label>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={handleCodeChange} disabled={enable.isPending} autoFocus>
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

          {enable.isPending && (
            <div className="flex items-center justify-center gap-2 text-[12.5px] text-slate-500 dark:text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verifying…
            </div>
          )}

          {inlineError && !enable.isPending && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
              {inlineError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Step (c): recovery codes ──────────────────────────────────────
  return <RecoveryCodesPanel codes={recoveryCodes} onDone={onComplete} doneLabel="Finish setup" />;
}
