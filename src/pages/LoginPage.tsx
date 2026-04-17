import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLogin } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthBackground } from '@/components/AuthBackground';
import { Loader2, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';
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

export default function LoginPage() {
  const [email, setEmail] = useState('demo@mycargolens.com');
  const [password, setPassword] = useState('password123');
  const navigate = useNavigate();
  const login = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      toast.success('Welcome back!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.body?.error || 'Login failed');
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
                Welcome back
              </h1>
              <p className="text-lg text-muted-foreground">
                Sign in to your MyCargoLens workspace
              </p>
            </div>

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
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your credentials to continue
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email field */}
                <motion.div
                  className="space-y-2"
                  custom={0}
                  variants={FIELD_VARIANTS}
                  initial="hidden"
                  animate="visible"
                >
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </motion.div>

                {/* Password field */}
                <motion.div
                  className="space-y-2"
                  custom={1}
                  variants={FIELD_VARIANTS}
                  initial="hidden"
                  animate="visible"
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
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
                </motion.div>

                {/* Submit button */}
                <motion.div
                  custom={2}
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
                    disabled={login.isPending}
                  >
                    {login.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </motion.div>
              </form>

              {/* Footer */}
              <div className="mt-6 space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="font-medium transition-colors"
                    style={{ color: 'hsl(43 96% 56%)' }}
                  >
                    Sign up
                  </Link>
                </p>
                <div className="text-xs text-muted-foreground text-center border-t border-border/50 pt-3">
                  <p className="font-medium mb-0.5">Demo credentials</p>
                  <p>demo@mycargolens.com / password123</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
}
