import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useRegister } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AuthBackground } from '@/components/AuthBackground';
import { Loader2, CheckCircle2, ShieldCheck, Lock, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { motion, MotionConfig } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

const TRUST_POINTS = [
  { icon: CheckCircle2, label: 'Direct CBP connection' },
  { icon: ShieldCheck, label: 'SOC 2 compliant' },
  { icon: Lock, label: '256-bit encryption' },
];

const FIELD_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.3 + i * 0.05, ease: EASE },
  }),
};

// Inline gold chevron logo mark
function GoldMark() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M12 16 L24 26 L36 16"
        stroke="hsl(43 96% 56%)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 24 L24 34 L36 24"
        stroke="hsl(43 96% 56%)"
        strokeWidth="3"
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
      navigate('/');
    } catch (err: any) {
      toast.error(err.body?.error || 'Registration failed');
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <AuthBackground />

        {/* ── Two-column layout on lg+ ── */}
        <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-12 lg:gap-16 items-center">

          {/* ── Left: branding column (hidden on mobile) ── */}
          <motion.div
            className="hidden lg:flex flex-col gap-8"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <GoldMark />

            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                {inviteToken ? "You've been invited!" : 'Create your account'}
              </h1>
              <p className="text-lg text-muted-foreground">
                {inviteToken
                  ? 'Join your team on MyCargoLens'
                  : 'Start filing ISFs in under 2 minutes'}
              </p>
            </div>

            {inviteToken && (
              <Badge
                variant="secondary"
                className="w-fit flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
                style={{
                  background: 'hsl(43 96% 56% / 0.12)',
                  color: 'hsl(43 96% 56%)',
                  border: '1px solid hsl(43 96% 56% / 0.25)',
                }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Team Invitation
              </Badge>
            )}

            <ul className="flex flex-col gap-3">
              {TRUST_POINTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4 shrink-0" style={{ color: 'hsl(43 96% 56%)' }} />
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* ── Right: form card ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
          >
            {/* Mobile logo (only visible below lg) */}
            <div className="flex justify-center mb-6 lg:hidden">
              <GoldMark />
            </div>

            <div className="glass rounded-2xl shadow-card-hover border border-border/60 p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {inviteToken ? 'Join your team' : 'Create account'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {inviteToken
                    ? 'Complete your profile to get started'
                    : 'Fill in your details to get started'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* First + Last name */}
                <motion.div
                  className="grid grid-cols-2 gap-3"
                  custom={0}
                  variants={FIELD_VARIANTS}
                  initial="hidden"
                  animate="visible"
                >
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
                </motion.div>

                {/* Company name (hidden for invite flow) */}
                {!inviteToken && (
                  <motion.div
                    className="space-y-2"
                    custom={1}
                    variants={FIELD_VARIANTS}
                    initial="hidden"
                    animate="visible"
                  >
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={form.companyName}
                      onChange={update('companyName')}
                      required
                    />
                  </motion.div>
                )}

                {/* Email */}
                <motion.div
                  className="space-y-2"
                  custom={inviteToken ? 1 : 2}
                  variants={FIELD_VARIANTS}
                  initial="hidden"
                  animate="visible"
                >
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={update('email')}
                    required
                  />
                </motion.div>

                {/* Password */}
                <motion.div
                  className="space-y-2"
                  custom={inviteToken ? 2 : 3}
                  variants={FIELD_VARIANTS}
                  initial="hidden"
                  animate="visible"
                >
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={update('password')}
                    minLength={8}
                    required
                  />
                  <p className="text-xs text-muted-foreground">At least 8 characters</p>
                </motion.div>

                {/* Submit button */}
                <motion.div
                  custom={inviteToken ? 3 : 4}
                  variants={FIELD_VARIANTS}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Button
                    type="submit"
                    variant="gold"
                    size="lg"
                    className="w-full"
                    disabled={register.isPending}
                  >
                    {register.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : inviteToken ? (
                      'Join Team'
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </motion.div>
              </form>

              {/* Footer */}
              <div className="mt-6">
                <p className="text-sm text-muted-foreground text-center">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="font-medium transition-colors"
                    style={{ color: 'hsl(43 96% 56%)' }}
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
}
