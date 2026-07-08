import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, ShieldAlert, Loader2, Eye, EyeOff, RefreshCw, ShieldX,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-amber-600" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>Add a second step at sign-in with an authenticator app</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {/* Status row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={
                enabled
                  ? 'h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-500/15 ring-1 ring-emerald-200 dark:ring-emerald-500/30 flex items-center justify-center'
                  : 'h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-500/15 ring-1 ring-amber-200 dark:ring-amber-500/30 flex items-center justify-center'
              }
            >
              {enabled ? (
                <ShieldCheck className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ShieldAlert className="h-[18px] w-[18px] text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Authenticator app</span>
                {enabled ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 border-transparent">
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not enabled</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {enabled
                  ? 'A code from your authenticator app is required to sign in.'
                  : 'Protect your account with a time-based one-time code.'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        {enabled ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" className="cursor-pointer" onClick={() => setRegenOpen(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate recovery codes
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setDisableOpen(true)}
            >
              <ShieldX className="h-4 w-4 mr-2" />
              Disable two-factor
            </Button>
          </div>
        ) : (
          <div className="pt-1">
            <Button className="cursor-pointer" onClick={() => setEnrollOpen(true)}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Set up authenticator app
            </Button>
          </div>
        )}
      </CardContent>

      {/* ── Enroll dialog ── */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>Secure your account with an authenticator app.</DialogDescription>
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
    </Card>
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
            This creates a new set and invalidates your old codes.
          </DialogDescription>
        </DialogHeader>
        {codes ? (
          <RecoveryCodesPanel codes={codes} onDone={() => { onOpenChange(false); reset(); }} doneLabel="Done" />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="regen-password">Confirm your password</Label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
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
      setError(err?.body?.error || 'Could not disable — check your password and code.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldX className="h-5 w-5" />
            Disable two-factor authentication
          </DialogTitle>
          <DialogDescription>
            Your account will be less secure. Confirm your password and a current code to continue.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disable-password">Password</Label>
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="disable-code">Authenticator or recovery code</Label>
            <Input
              id="disable-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456 or XXXXX-XXXXX"
              autoComplete="one-time-code"
              className="font-mono tracking-wide"
            />
          </div>
          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300">
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
