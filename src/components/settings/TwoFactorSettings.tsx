import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Eye, EyeOff } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/hooks/useAuth';
import { useMfaDisable, useMfaRecoveryCodes } from '@/hooks/useFilings';
import { MfaEnrollment } from '@/components/settings/MfaEnrollment';
import { RecoveryCodesPanel } from '@/components/settings/RecoveryCodesPanel';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FILL, TINT, type Tone } from '@/components/dashboard/tones';

/**
 * Two-factor authentication management — lives in the Settings › Profile tab,
 * adjacent to "Password & Security". Reads enrolled state from the cached
 * user (mfaEnabled) and exposes: enroll (dialog reusing MfaEnrollment),
 * regenerate recovery codes, and disable.
 */
export function TwoFactorSettings() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const enabled = user?.mfaEnabled === true;

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const refreshUser = () =>
    queryClient.invalidateQueries({ queryKey: ['currentUser'] });

  const tone: Tone = enabled ? 'done' : 'calm';

  return (
    <section aria-labelledby="two-factor-title" className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
      <div className="px-5 py-3.5">
        <h2 id="two-factor-title" className="text-[14px] font-semibold">Two-factor authentication</h2>
        <p className="text-[13px] text-muted-foreground">Add a second step at sign-in with an authenticator app.</p>
      </div>
      <div className="space-y-4 border-t border-border/70 px-5 py-4">
        {/* Status row */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-foreground">Authenticator app</span>
            <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium', TINT[tone])}>
              <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', FILL[tone])} />
              {enabled ? 'On' : 'Off'}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {enabled
              ? 'A code from your authenticator app is required to sign in.'
              : 'Protect your account with a time-based one-time code.'}
          </p>
        </div>

        {/* Actions */}
        {enabled ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setRegenOpen(true)}>
              Regenerate recovery codes
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer text-urgent can-hover:hover:bg-urgent-tint can-hover:hover:text-urgent"
              onClick={() => setDisableOpen(true)}
            >
              Disable two-factor
            </Button>
          </div>
        ) : (
          <div>
            <Button size="sm" className="cursor-pointer" onClick={() => setEnrollOpen(true)}>
              Set up authenticator app
            </Button>
          </div>
        )}
      </div>

      {/* ── Enroll dialog ── */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>You will need your password and an authenticator app.</DialogDescription>
          </DialogHeader>
          <MfaEnrollment
            onComplete={() => {
              setEnrollOpen(false);
              refreshUser();
              toast.success('Two-factor authentication is on.');
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Regenerate recovery codes dialog ── */}
      <RegenerateDialog open={regenOpen} onOpenChange={setRegenOpen} />

      {/* ── Disable dialog ── */}
      <DisableDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        onDisabled={() => {
          refreshUser();
          toast.success('Two-factor authentication turned off.');
        }}
      />
    </section>
  );
}

// ── Regenerate recovery codes ────────────────────────────────────────
function RegenerateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const regen = useMfaRecoveryCodes();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const reset = () => { setPassword(''); setShow(false); setError(null); setCodes(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await regen.mutateAsync({ password });
      setCodes(res.recoveryCodes);
    } catch (err: any) {
      setError(err?.body?.error || 'That password is not correct.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Regenerate recovery codes</DialogTitle>
          <DialogDescription>
            This creates a new set of codes. Your old codes stop working.
          </DialogDescription>
        </DialogHeader>
        {codes ? (
          <RecoveryCodesPanel codes={codes} onDone={() => { onOpenChange(false); reset(); }} doneLabel="Done" />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="regen-password" className="text-sm font-medium">Confirm your password</Label>
              <div className="relative">
                <Input
                  id="regen-password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoFocus
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:text-foreground"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="rounded-lg bg-urgent-tint px-4 py-3 text-[13px] text-urgent">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full cursor-pointer" disabled={regen.isPending || !password}>
              {regen.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate new codes
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Disable two-factor ───────────────────────────────────────────────
function DisableDialog({
  open, onOpenChange, onDisabled,
}: { open: boolean; onOpenChange: (v: boolean) => void; onDisabled: () => void }) {
  const disable = useMfaDisable();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setPassword(''); setCode(''); setShow(false); setError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await disable.mutateAsync({ password, code: code.trim().toUpperCase() });
      onOpenChange(false);
      reset();
      onDisabled();
    } catch (err: any) {
      setError(err?.body?.error || 'Could not disable two-factor. Check your password and code.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disable two-factor authentication</DialogTitle>
          <DialogDescription>
            Your account will be less secure. Enter your password and a current code to continue.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disable-password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Input
                id="disable-password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShow((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:text-foreground"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="disable-code" className="text-sm font-medium">Authenticator or recovery code</Label>
            <Input
              id="disable-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456 or XXXXX-XXXXX"
              autoComplete="one-time-code"
              className="font-mono tracking-wide tabular-nums"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-urgent-tint px-4 py-3 text-[13px] text-urgent">
              {error}
            </div>
          )}
          <Button
            type="submit"
            variant="destructive"
            className="w-full cursor-pointer"
            disabled={disable.isPending || !password || !code.trim()}
          >
            {disable.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Disable two-factor
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
