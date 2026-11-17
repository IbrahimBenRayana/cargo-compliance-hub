import { useCallback, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Eye, EyeOff, Copy, Check, ArrowLeft } from '@/components/icons';
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
 *
 * onEnrollmentStart fires once the password is accepted, so a host page that
 * redirects on "MFA is on" can hold off until the codes have been saved.
 */
export function MfaEnrollment({
  onComplete,
  onEnrollmentStart,
}: {
  onComplete: () => void;
  onEnrollmentStart?: () => void;
}) {
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
      onEnrollmentStart?.();
      setStep('scan');
    } catch (err: any) {
      // Account is already protected — the only way to be here is stale
      // client state (e.g. enrollment finished in another tab/session).
      // Finish the flow instead of stranding the user on a dead end.
      if (err?.body?.code === 'mfa_already_enabled') {
        onComplete();
        return;
      }
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
      toast.error('Could not copy. Select the key and copy it manually.');
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
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Confirm your password to start setting up an authenticator app, such as Google
          Authenticator, 1Password or Authy.
        </p>
        <div className="space-y-2">
          <Label htmlFor="mfa-setup-password" className="text-sm font-medium">
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
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {inlineError && (
          <div className="rounded-lg bg-urgent-tint px-4 py-3 text-[13px] text-urgent">
            {inlineError}
          </div>
        )}
        <Button type="submit" size="lg" className="w-full cursor-pointer" disabled={setup.isPending || !password}>
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
          className="inline-flex items-center gap-1.5 rounded-sm text-[12px] font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div>
          <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
            Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
          </p>
          <div className="flex justify-center">
            <div className="rounded-lg border border-border/70 bg-white p-4">
              {otpauthUri ? (
                <QRCodeSVG value={otpauthUri} size={168} level="M" />
              ) : (
                <div className="h-[168px] w-[168px] flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manual entry fallback */}
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <div className="mb-1.5 text-[12px] text-muted-foreground">
            Can't scan? Enter this key in the app instead.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all font-mono text-[12.5px] tracking-wide text-foreground">
              {prettySecret}
            </code>
            <button
              type="button"
              onClick={copySecret}
              className="shrink-0 cursor-pointer rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:text-foreground"
              aria-label="Copy secret key"
            >
              {secretCopied ? <Check weight="bold" className="h-4 w-4 text-done" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* 6-digit confirm */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Verification code
          </Label>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={handleCodeChange} disabled={enable.isPending} autoFocus>
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-12 w-11 text-lg font-semibold tabular-nums" />
                <InputOTPSlot index={1} className="h-12 w-11 text-lg font-semibold tabular-nums" />
                <InputOTPSlot index={2} className="h-12 w-11 text-lg font-semibold tabular-nums" />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} className="h-12 w-11 text-lg font-semibold tabular-nums" />
                <InputOTPSlot index={4} className="h-12 w-11 text-lg font-semibold tabular-nums" />
                <InputOTPSlot index={5} className="h-12 w-11 text-lg font-semibold tabular-nums" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {enable.isPending && (
            <div className="flex items-center justify-center gap-2 text-[12.5px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verifying…
            </div>
          )}

          {inlineError && !enable.isPending && (
            <div className="rounded-lg bg-urgent-tint px-4 py-3 text-[13px] text-urgent">
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
