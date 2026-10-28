import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/api/client';
import { AuthBrandPanel } from '@/components/AuthBrandPanel';
import type { GateState } from '@/components/auth3d/state';
import { LogoMark } from '@/components/LogoMark';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Request a password reset link. The server answers the same way whether or
 * not the email has an account, so the page always shows the same message.
 * The emailed link opens /set-password.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again in a minute.');
    } finally {
      setSubmitting(false);
    }
  };

  // the sign-in gate scene, reading the email; once sent, the gate says so
  const gate: GateState = {
    kind: 'gate',
    email,
    hasPassword: false,
    phase: submitting ? 'checking' : 'idle',
    codeLength: 0,
    errorCount: 0,
    note: sent ? 'Link sent · check your email' : undefined,
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen">
        <div className="hidden lg:block lg:w-1/2 flex-shrink-0">
          <AuthBrandPanel scene={gate} caption="Reset your password and get back to your inbox." />
        </div>
        <div className="flex-1 lg:w-1/2 bg-background flex items-center justify-center px-6 py-12 min-h-screen">
          <div className="w-full max-w-sm mx-auto">
            <div className="flex justify-center mb-8 lg:hidden">
              <LogoMark size={34} className="text-[hsl(222_47%_22%)] dark:text-[hsl(222_30%_64%)]" />
            </div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {sent ? 'Check your email' : 'Reset your password'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground mb-8">
                {sent
                  ? `If an account exists for ${email.trim()}, we've sent a link to choose a new password. It expires in 1 hour.`
                  : "Enter the email you sign in with and we'll send you a link to choose a new password."}
              </p>
            </motion.div>
            {!sent && (
              <motion.form
                onSubmit={handleSubmit}
                className="space-y-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={submitting || !email.trim()}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
              </motion.form>
            )}
            <p className="mt-6 text-sm text-muted-foreground text-center">
              <Link to="/login" className="text-foreground font-medium hover:underline transition-colors">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
