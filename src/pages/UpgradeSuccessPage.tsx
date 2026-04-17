import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useSubscription } from '@/hooks/useBilling';

const MAX_WAIT_MS = 30_000;
const POLL_INTERVAL_MS = 2_500;
const COUNTDOWN_FROM = 3;

// Small sparkle burst positions (angle, distance)
const SPARKLES = Array.from({ length: 12 }, (_, i) => ({
  angle: (i * 360) / 12,
  r: 60 + Math.random() * 30,
}));

export default function UpgradeSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionId = searchParams.get('session_id');
  void sessionId; // logged for tracing but not used client-side

  const [activated, setActivated] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [showContent, setShowContent] = useState(false);

  const startedAt = useRef(Date.now());
  const toastId = useRef<string | number | null>(null);

  // Start polling immediately; show content after 600ms to avoid flash
  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 600);
    return () => clearTimeout(t);
  }, []);

  const { data: billing } = useSubscription({
    refetchInterval: activated ? false : POLL_INTERVAL_MS,
    enabled: !timedOut,
  });

  // Detect activation
  useEffect(() => {
    if (activated || timedOut) return;
    if (!billing) return;

    const isActive =
      billing.subscription?.status === 'active' &&
      billing.plan !== null &&
      billing.plan.id !== 'starter';

    if (isActive) {
      if (toastId.current) toast.dismiss(toastId.current);
      setActivated(true);
    } else {
      // If we've waited more than 5s, show a soft "activating" toast
      const elapsed = Date.now() - startedAt.current;
      if (elapsed > 5_000 && !toastId.current) {
        toastId.current = toast.loading('Activating your plan…');
      }
      // Check max wait
      if (elapsed >= MAX_WAIT_MS) {
        if (toastId.current) toast.dismiss(toastId.current);
        setTimedOut(true);
      }
    }
  }, [billing, activated, timedOut]);

  // Countdown + navigate once activated
  useEffect(() => {
    if (!activated) return;
    const planId = billing?.plan?.id ?? '';
    let count = COUNTDOWN_FROM;
    setCountdown(count);

    const interval = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        navigate(`/?welcome=${planId}`, { replace: true });
      }
    }, 1_000);

    return () => clearInterval(interval);
  }, [activated, billing, navigate]);

  const planName = billing?.plan?.name ?? 'Pro';
  const filings = billing?.plan?.filingsIncluded ?? '–';
  const seats = billing?.plan?.maxSeats ?? '–';

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
      <AnimatePresence>
        {showContent && (
          <motion.div
            key="success-card"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="glass rounded-2xl p-10 md:p-14 max-w-lg w-full text-center shadow-xl"
          >
            {timedOut ? (
              // Still processing fallback
              <>
                <div className="h-20 w-20 rounded-full bg-muted/60 border border-border flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="h-8 w-8 text-gold" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-3">Still processing…</h1>
                <p className="text-muted-foreground text-sm mb-6">
                  Your payment was received, but plan activation is taking a moment.
                  This usually resolves within a minute.
                </p>
                <p className="text-xs text-muted-foreground">
                  Need help?{' '}
                  <a
                    href="mailto:support@mycargolens.com"
                    className="underline text-foreground hover:text-gold transition-colors"
                  >
                    Contact support
                  </a>
                </p>
              </>
            ) : activated ? (
              // Activated state
              <>
                {/* Animated checkmark with sparkle burst */}
                <div className="relative h-28 w-28 mx-auto mb-8">
                  {/* Sparkle burst */}
                  {SPARKLES.map((s, i) => {
                    const rad = (s.angle * Math.PI) / 180;
                    const x = Math.cos(rad) * s.r;
                    const y = Math.sin(rad) * s.r;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0], x, y, scale: [0, 1.2, 0.6] }}
                        transition={{ duration: 0.7, delay: 0.15 + i * 0.03 }}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                      >
                        <Sparkles className="h-4 w-4 text-gold" />
                      </motion.div>
                    );
                  })}

                  {/* Circle + check */}
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="h-28 w-28 rounded-full border-4 border-gold bg-gold/10 flex items-center justify-center"
                  >
                    <motion.div
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                    >
                      <Check className="h-12 w-12 text-gold" strokeWidth={3} />
                    </motion.div>
                  </motion.div>
                </div>

                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Welcome to {planName}!
                </h1>
                <p className="text-muted-foreground mb-6 text-sm">
                  {filings} filings per month · {seats} team members
                </p>

                <motion.p
                  key={countdown}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground"
                >
                  Taking you to your workspace in {countdown}…
                </motion.p>
              </>
            ) : (
              // Waiting / polling state
              <>
                <div className="h-20 w-20 rounded-full bg-gold/10 border-2 border-gold/40 flex items-center justify-center mx-auto mb-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
                  >
                    <Sparkles className="h-8 w-8 text-gold" />
                  </motion.div>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Activating your plan…
                </h1>
                <p className="text-muted-foreground text-sm">
                  Confirming payment with Stripe. This takes just a moment.
                </p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
