import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Monospace, scrollable preview of the CATAIR 80-char record lines with a
 * copy button. Used by the In-Bond wizard review step, the detail page's
 * wire card, and per-event previews in the lifecycle timeline.
 */
export function WirePreview({ text, maxHeight = 280 }: { text: string; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <div className="relative rounded-lg border bg-muted/40 overflow-hidden">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 h-7 gap-1.5 text-xs z-10 bg-background/70 backdrop-blur-sm"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </>
        )}
      </Button>
      <pre
        className="overflow-auto p-3 pr-20 text-[11px] leading-relaxed font-mono whitespace-pre"
        style={{ maxHeight }}
      >
        {text}
      </pre>
    </div>
  );
}
