import { useState } from 'react';
import { Eye, EyeOff, Check, X, Loader2 } from '@/components/icons';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FILL } from '@/components/dashboard/tones';
import { useChangePassword } from '@/hooks/useFilings';
import { estimatePasswordStrength } from '@/lib/passwordStrength';

const MIN_LENGTH = 8; // must match the server's changePasswordSchema minimum

/**
 * A masked password input with its own default-hidden reveal toggle. Per-field
 * (not one global switch), so revealing the new password never exposes the
 * current one, and each field re-masks independently. Password-manager and
 * autofill hints are passed through via `autoComplete`.
 */
function PasswordField({
  id, label, value, onChange, autoComplete, placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring can-hover:hover:text-foreground"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** A single requirement row that fills in as it's satisfied. */
function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className={cn('flex items-center gap-2 text-[12.5px] transition-colors', met ? 'text-done' : 'text-muted-foreground')}>
      {met ? <Check weight="bold" className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 opacity-40" />}
      <span>{children}</span>
    </li>
  );
}

const STRENGTH_COLOR = ['bg-muted', FILL.urgent, FILL.soon, FILL.soon, FILL.done];
const STRENGTH_TEXT = ['text-muted-foreground', 'text-urgent', 'text-soon', 'text-soon', 'text-done'];

/**
 * Change-password card. Security-hardened per big-tech / NIST 800-63B practice:
 * per-field default-hidden reveal, password-manager association (hidden username
 * + autocomplete), a length-first strength meter, live requirements, a match
 * check, blocks reusing the current password, disables submit until valid, and
 * clears every field from memory on success. The server additionally re-checks
 * the current password and invalidates other sessions' refresh tokens.
 */
export function ChangePasswordCard({ email }: { email?: string }) {
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const strength = estimatePasswordStrength(next);
  const longEnough = next.length >= MIN_LENGTH;
  const differsFromCurrent = next.length > 0 && next !== current;
  const matches = confirm.length > 0 && next === confirm;
  const canSubmit =
    current.length > 0 && longEnough && differsFromCurrent && matches && !changePassword.isPending;

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      toast.success('Password changed. Other devices have been signed out.');
      reset();
    } catch (err: any) {
      toast.error(err.body?.error || err.message || 'Failed to change password');
    }
  };

  return (
    <section aria-labelledby="change-password-title" className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
      <div className="px-5 py-3.5">
        <h2 id="change-password-title" className="text-[14px] font-semibold">Password and security</h2>
        <p className="text-[13px] text-muted-foreground">Use a long password that you do not use anywhere else.</p>
      </div>
      <div className="border-t border-border/70 px-5 py-4">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          className="space-y-5"
        >
          {/* Hidden identifier so password managers save/update the right credential. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={email ?? ''}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
          />

          <PasswordField
            id="settings-current-password"
            label="Current password"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
            placeholder="Enter current password"
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <PasswordField
              id="settings-new-password"
              label="New password"
              value={next}
              onChange={setNext}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            <PasswordField
              id="settings-confirm-password"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              placeholder="Re-enter new password"
            />
          </div>

          {/* Strength meter + requirements, only once the user starts typing. */}
          {next.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex h-1.5 gap-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((seg) => (
                    <div
                      key={seg}
                      className={cn(
                        'h-full flex-1 rounded-full transition-colors',
                        seg <= strength.score ? STRENGTH_COLOR[strength.score] : 'bg-muted',
                      )}
                    />
                  ))}
                </div>
                <p className={cn('text-[12.5px] font-medium', STRENGTH_TEXT[strength.score])}>
                  Password strength: {strength.label}
                </p>
              </div>
              <ul className="space-y-1">
                <Requirement met={longEnough}>At least {MIN_LENGTH} characters</Requirement>
                <Requirement met={differsFromCurrent}>Different from your current password</Requirement>
                {confirm.length > 0 && (
                  <Requirement met={matches}>Both new password entries match</Requirement>
                )}
              </ul>
            </div>
          )}

          <p className="text-[12.5px] text-muted-foreground">
            Changing your password signs you out on all other devices.
          </p>

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={!canSubmit} className="cursor-pointer">
              {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update password
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
