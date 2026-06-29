import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/api/client';
import { AuthBrandPanel } from '@/components/AuthBrandPanel';
import { LogoMark } from '@/components/LogoMark';

const EASE = [0.22, 1, 0.36, 1] as const;

// Marketing "Book a demo" page — lives on the marketing site, not the app.
const DEMO_URL = 'https://mycargolens.com/book-a-demo';

// Brand mark for the mobile header — uses the shared Focus Frame LogoMark.
function GoldMark() {
  return <LogoMark size={28} className="text-[hsl(222_47%_22%)] dark:text-[hsl(222_30%_64%)]" />;
}

type Status = 'validating' | 'valid' | 'invalid' | 'done';

export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>('validating');
  const [email, setEmail] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Validate the setup token on mount.
  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setStatus('invalid');
      return;
    }

    (async () => {
      try {
        const res = await authApi.validateSetupToken(token);
        if (cancelled) return;
        if (res.valid) {
          setEmail(res.email);
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      } catch {
        if (!cancelled) setStatus('invalid');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.setPassword(token, password);
      setStatus('done');
      toast.success('Password set — please log in.');
      // Brief pause so the success state is visible, then send to login.
      setTimeout(() => navigate('/login'), 1200);
    } catch (err: any) {
      if (err?.body?.code === 'invalid_setup_token') {
        setStatus('invalid');
        toast.error('This link is invalid or has expired');
      } else {
        toast.error(err?.body?.error || 'Could not set your password');
      }
    } finally {
      setSubmitting(false);
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

            {/* ── Validating ── */}
            {status === 'validating' && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">Verifying your link…</p>
              </div>
            )}

            {/* ── Invalid / expired ── */}
            {status === 'invalid' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  This link is invalid or has expired
                </h1>
                <p className="mt-1 text-sm text-muted-foreground mb-8">
                  Setup links are single-use and time-limited. Request a new one or get in touch
                  with us to continue.
                </p>
                <Button asChild variant="default" size="lg" className="w-full">
                  <a href={DEMO_URL}>Request a demo</a>
                </Button>
                <p className="mt-6 text-sm text-muted-foreground text-center">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="text-foreground font-medium hover:underline transition-colors"
                  >
                    Log in
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ── Success ── */}
            {status === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Password set
                </h1>
                <p className="mt-1 text-sm text-muted-foreground mb-8">
                  Your password has been saved. Redirecting you to sign in…
                </p>
                <Button asChild variant="default" size="lg" className="w-full">
                  <Link to="/login">Go to sign in</Link>
                </Button>
              </motion.div>
            )}

            {/* ── Set password form ── */}
            {status === 'valid' && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Set your password
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground mb-8">
                    Choose a password to finish setting up your account.
                  </p>
                </motion.div>

                <motion.form
                  onSubmit={handleSubmit}
                  className="space-y-5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
                >
                  {/* Email (read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email ?? ''} readOnly disabled />
                  </div>

                  {/* New password */}
                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                    <p className="text-xs text-muted-foreground">At least 8 characters</p>
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="w-full transition-shadow duration-200 hover:shadow-sm"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting password…
                      </>
                    ) : (
                      'Set password'
                    )}
                  </Button>
                </motion.form>

                <motion.p
                  className="mt-6 text-sm text-muted-foreground text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
                >
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="text-foreground font-medium hover:underline transition-colors"
                  >
                    Log in
                  </Link>
                </motion.p>
              </>
            )}

          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
