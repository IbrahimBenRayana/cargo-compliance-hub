import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useRegister } from '@/hooks/useAuth';
import { motion, MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { AuthBrandPanel } from '@/components/AuthBrandPanel';

const EASE = [0.22, 1, 0.36, 1] as const;

// Small gold chevron for mobile header
function GoldMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M12 16 L24 26 L36 16"
        stroke="hsl(43, 96%, 56%)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 24 L24 34 L36 24"
        stroke="hsl(43, 96%, 56%)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';

  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    companyName: '',
  });
  const navigate = useNavigate();
  const redirectTo = searchParams.get('redirect') || '/';
  const register = useRegister();

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
                {inviteToken ? 'Join your team' : 'Create account'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground mb-8">
                {inviteToken
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

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  placeholder="you@company.com"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={update('password')}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">At least 8 characters</p>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full transition-shadow duration-200 hover:shadow-sm"
                disabled={register.isPending}
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

          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
