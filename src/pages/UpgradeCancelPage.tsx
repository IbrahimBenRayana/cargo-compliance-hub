import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PRICING_URL = 'https://mycargolens.com/pricing';

export default function UpgradeCancelPage() {
  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass rounded-2xl p-10 md:p-14 max-w-md w-full text-center shadow-xl"
      >
        {/* Icon */}
        <div className="h-20 w-20 rounded-full bg-muted/60 border border-border flex items-center justify-center mx-auto mb-8">
          <X className="h-9 w-9 text-muted-foreground" strokeWidth={2} />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">Checkout canceled</h1>
        <p className="text-muted-foreground text-sm mb-10">
          No charge was made. You can pick up where you left off any time.
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Button
            asChild
            size="lg"
            className="w-full font-semibold bg-gold text-yellow-950 hover:bg-gold/90"
          >
            <Link to="/">Return to dashboard</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full">
            <a href={PRICING_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Back to pricing
            </a>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
