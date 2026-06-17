import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Receipt, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PLAN_META, CAPABILITY_LABEL } from '@/lib/planMeta';

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

  // "What's unlocked" — per-filing model. Lead with the per-shipment rate
  // (there's no monthly fee or seat/volume cap) and list the capabilities the
  // tier unlocks so the user immediately sees what they can now do.
  const capabilities = meta.capabilities;

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

        {/* What's unlocked — per-shipment rate + capabilities */}
        <div className="px-6 pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 px-4 py-3">
            <div className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[20px] leading-none font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {meta.priceLabel}
                <span className="ml-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                  {meta.priceFooter}
                </span>
              </div>
              <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                No monthly fee — billed per shipment
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {capabilities.map((cap) => (
              <span
                key={cap}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11.5px] font-medium text-slate-700 dark:text-slate-300"
              >
                <Check className="h-3 w-3 text-amber-500" strokeWidth={3} />
                {CAPABILITY_LABEL[cap] ?? cap}
              </span>
            ))}
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
