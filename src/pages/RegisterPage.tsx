import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useRegister } from '@/hooks/useAuth';
import { motion, MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Lock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api/client';
import { toast } from 'sonner';
import { AuthBrandPanel } from '@/components/AuthBrandPanel';
import { LogoMark } from '@/components/LogoMark';

const EASE = [0.22, 1, 0.36, 1] as const;

// Marketing "Book a demo" page — lives on the marketing site, not the app.
const DEMO_URL = 'https://mycargolens.com/book-a-demo';

// Brand mark for the mobile header — uses the shared Focus Frame LogoMark.
function GoldMark() {
  return <LogoMark size={34} className="text-[hsl(222_47%_22%)] dark:text-[hsl(222_30%_64%)]" />;
}

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    companyName: '',
  });
  const navigate = useNavigate();
  const redirectTo = searchParams.get('redirect') || '/';
  const register = useRegister();

  // Resolve the invitation so the invited email is prefilled and locked —
  // the token itself is the credential, so this endpoint is public.
  const invitationQuery = useQuery({
    queryKey: ['invitation', inviteToken],
    queryFn: () => authApi.getInvitation(inviteToken),
    enabled: !!inviteToken,
    retry: false,
    staleTime: Infinity,
  });
  const invitation = invitationQuery.data;
  useEffect(() => {
    if (invitation?.email) setForm((prev) => ({ ...prev, email: invitation.email }));
  }, [invitation?.email]);

  const passwordsMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  // Self-serve signup is disabled server-side. Without an invite token the page
  // shows an invitation-only state; a 403 `signup_disabled` from the API (e.g.
  // a stale/forged token) flips this on too.
  const [signupDisabled, setSignupDisabled] = useState(false);
  const invitationOnly = !inviteToken || signupDisabled || invitationQuery.isError;

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match. Please re-type your password.');
      return;
    }
    try {
      const payload: any = {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
      };
      if (inviteToken) {
        payload.inviteToken = inviteToken;
      } else {
        payload.companyName = form.companyName;
      }
      await register.mutateAsync(payload);
      toast.success(inviteToken ? 'Welcome to the team!' : 'Account created! Welcome to MyCargoLens.');
      navigate(redirectTo);
    } catch (err: any) {
      if (err?.body?.code === 'signup_disabled') {
        setSignupDisabled(true);
        return;
      }
      toast.error(err.body?.error || 'Registration failed');
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      {/* Full-viewport split layout */}
      <div className="flex min-h-screen">

        {/* ── Left: dark brand panel (desktop only) ── */}
        <div className="w-1/2 flex-shrink-0">
          <AuthBrandPanel variant="register" />
        </div>

        {/* ── Right: form panel ── */}
        <div className="flex-1 lg:w-1/2 bg-background flex items-center justify-center px-6 py-12 min-h-screen">
          <div className="w-full max-w-sm mx-auto">

            {/* Mobile-only logo mark */}
            <div className="flex justify-center mb-8 lg:hidden">
              <GoldMark />
            </div>

            {/* ── Invitation-only state (no invite token, or signup disabled) ── */}
            {invitationOnly ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  By invitation only
                </h1>
                <p className="mt-1 text-sm text-muted-foreground mb-8">
                  MyCargoLens accounts are set up after a demo. Book a walkthrough and our team
                  will get you onboarded.
                </p>
                <Button asChild variant="default" size="lg" className="w-full">
                  <a href={DEMO_URL}>Request a demo</a>
                </Button>
                <p className="mt-6 text-sm text-muted-foreground text-center">
                  Already have an account?{' '}
                  <Link
                    to={redirectTo !== '/' ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}
                    className="text-foreground font-medium hover:underline transition-colors"
                  >
                    Log in
                  </Link>
                </p>
              </motion.div>
            ) : (
            <>
            {/* Invite badge */}
            {inviteToken && (
              <div className="mb-4">
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium w-fit"
                  style={{
                    background: 'hsl(43 96% 56% / 0.12)',
                    color: 'hsl(43, 96%, 56%)',
                    border: '1px solid hsl(43 96% 56% / 0.25)',
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Team Invitation
                </Badge>
              </div>
            )}

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {invitation ? `Join ${invitation.organizationName}` : inviteToken ? 'Join your team' : 'Create account'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground mb-8">
                {invitation
                  ? `${invitation.inviterName} invited you to join as ${/^[aeiou]/i.test(invitation.role) ? 'an' : 'a'} ${invitation.role}`
                  : inviteToken
                    ? "You've been invited to join a workspace"
                    : 'Fill in your details to get started'}
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
              {/* First + Last name */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={update('firstName')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={update('lastName')}
                    required
                  />
                </div>
              </div>

              {/* Company name (hidden for invite flow) */}
              {!inviteToken && (
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={form.companyName}
                    onChange={update('companyName')}
                    required
                  />
                </div>
              )}

              {/* Email — locked to the invited address for invite signups */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={inviteToken ? (invitation?.email ?? '') : form.email}
                    onChange={update('email')}
                    placeholder={inviteToken ? 'Loading your invitation…' : 'you@company.com'}
                    disabled={!!inviteToken}
                    aria-readonly={!!inviteToken}
                    className={inviteToken ? 'pr-9 bg-muted/60 text-muted-foreground' : undefined}
                    required
                  />
                  {inviteToken && (
                    <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                  )}
                </div>
                {inviteToken && (
                  <p className="text-xs text-muted-foreground">
                    Your invitation was sent to this address — it can't be changed here.
                  </p>
                )}
              </div>

              {/* Password + confirmation */}
              <div className="space-y-2">
                <Label htmlFor="password">Choose a password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={update('password')}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">At least 8 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Re-type your password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={update('confirmPassword')}
                  placeholder="••••••••"
                  minLength={8}
                  required
                  aria-invalid={passwordsMismatch}
                  className={passwordsMismatch ? 'border-destructive focus-visible:ring-destructive' : undefined}
                />
                {passwordsMismatch && (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full transition-shadow duration-200 hover:shadow-sm"
                disabled={register.isPending || passwordsMismatch || (!!inviteToken && !invitation)}
              >
                {register.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {inviteToken ? 'Joining team...' : 'Creating account...'}
                  </>
                ) : inviteToken ? (
                  'Join Team'
                ) : (
                  'Create Account'
                )}
              </Button>
            </motion.form>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
            >
              <p className="mt-6 text-sm text-muted-foreground text-center">
                Already have an account?{' '}
                <Link
                  to={redirectTo !== '/' ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}
                  className="text-foreground font-medium hover:underline transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </motion.div>
            </>
            )}

          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
