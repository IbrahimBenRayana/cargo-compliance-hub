import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
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

// Radial sparkle positions
const BURST = Array.from({ length: 10 }, (_, i) => ({
  angle: (i * 360) / 10,
  r: 48,
}));

export function CelebrationModal({ planId, onClose }: CelebrationModalProps) {
  const navigate = useNavigate();
  const meta = planId ? PLAN_META[planId] : null;

  if (!meta) return null;

  function handleStartFiling() {
    onClose();
    navigate('/shipments/new');
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md text-center glass border-gold/30 overflow-hidden">
        {/* Sparkle burst + check icon */}
        <div className="relative h-24 w-24 mx-auto mb-2 mt-2">
          {BURST.map((s, i) => {
            const rad = (s.angle * Math.PI) / 180;
            const x = Math.cos(rad) * s.r;
            const y = Math.sin(rad) * s.r;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], x, y, scale: [0, 1, 0.5] }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.05 }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <Sparkles className="h-3.5 w-3.5 text-gold" />
              </motion.div>
            );
          })}
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="h-24 w-24 rounded-full border-4 border-gold bg-gold/10 flex items-center justify-center"
          >
            <Check className="h-10 w-10 text-gold" strokeWidth={3} />
          </motion.div>
        </div>

        <DialogHeader className="text-center space-y-2">
          <DialogTitle className="text-2xl font-bold text-foreground">
            Welcome to {meta.name}!
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Your {meta.name} plan is active. You now have{' '}
            <span className="font-semibold text-foreground">{meta.filings} filings per month</span>{' '}
            and up to{' '}
            <span className="font-semibold text-foreground">{meta.seats} team members</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-2">
          <Button
            size="lg"
            className="w-full font-semibold bg-gold text-yellow-950 hover:bg-gold/90"
            onClick={handleStartFiling}
          >
            Start filing
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="w-full"
            onClick={onClose}
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
