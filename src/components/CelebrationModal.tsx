import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, FileStack, Users, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PLAN_META } from '@/lib/planMeta';

interface CelebrationModalProps {
  planId: string | null;
  onClose: () => void;
}

export function CelebrationModal({ planId, onClose }: CelebrationModalProps) {
  const navigate = useNavigate();
  const meta = planId ? PLAN_META[planId] : null;

  if (!meta) return null;

  function handleStartFiling() {
    onClose();
    navigate('/shipments/new');
  }

  // "What's unlocked" — three stats. We surface the count of premium features
  // beyond the headline filings/seats numbers so the user can immediately see
  // the breadth of what they've bought, not just the volume tier.
  const featureCount = meta.features.length;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        {/* Header band — subtle gold-to-transparent wash, navy primary stays calm */}
        <div className="relative px-6 pt-8 pb-5 bg-gradient-to-b from-amber-50/70 to-transparent dark:from-amber-400/[0.07] dark:to-transparent">
          {/* Hero: single gold ring that pulses ONCE and lands. No confetti, no continuous animation. */}
          <div className="relative mx-auto mb-5 h-16 w-16">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [0.8, 1.25, 1], opacity: [0, 0.5, 0] }}
              transition={{ duration: 1.1, ease: 'easeOut', times: [0, 0.5, 1] }}
              className="absolute inset-0 rounded-full bg-amber-400/30 motion-reduce:hidden"
            />
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="relative h-16 w-16 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 ring-1 ring-amber-300/60 dark:ring-amber-400/40 shadow-[0_8px_24px_-8px_rgba(245,158,11,0.5)] flex items-center justify-center"
            >
              <Check className="h-8 w-8 text-amber-950" strokeWidth={3} />
            </motion.div>
          </div>

          <div className="text-center mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400">
              <Sparkles className="h-3 w-3" />
              Plan activated
            </span>
          </div>

          <DialogHeader className="text-center space-y-1.5">
            <DialogTitle className="text-[22px] leading-tight font-semibold text-slate-900 dark:text-slate-50">
              Welcome to {meta.name}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400 max-w-[22rem] mx-auto">
              Your subscription is live. Here's what's now available to your team.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* What's unlocked — 3-stat grid */}
        <div className="px-6 pt-4 pb-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat
              icon={<FileStack className="h-3.5 w-3.5" />}
              value={meta.filings}
              label="filings / mo"
            />
            <Stat
              icon={<Users className="h-3.5 w-3.5" />}
              value={meta.seats}
              label={meta.seats === 1 ? 'team seat' : 'team seats'}
            />
            <Stat
              icon={<Sparkles className="h-3.5 w-3.5" />}
              value={featureCount}
              label="features"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-1 flex flex-col gap-2">
          <Button
            size="lg"
            className="w-full font-semibold"
            onClick={handleStartFiling}
          >
            Start filing
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            onClick={onClose}
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 px-3 py-3 text-center">
      <div className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-1.5">
        {icon}
      </div>
      <div className="text-[22px] leading-none font-semibold tabular-nums text-slate-900 dark:text-slate-50">
        {value}
      </div>
      <div className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}
