import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLogin } from '@/hooks/useAuth';
import { motion, MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
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

              <p className="text-xs text-muted-foreground text-center">
                <span className="font-medium">Demo credentials</span>
                <br />
                demo@mycargolens.com / password123
              </p>

              {/* Footer */}
              <p className="mt-6 text-sm text-muted-foreground text-center">
                Don&apos;t have an account?{' '}
                <Link
                  to="/register"
                  className="text-foreground font-medium hover:underline transition-colors"
                >
                  Sign up
                </Link>
              </p>
            </motion.div>

          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
