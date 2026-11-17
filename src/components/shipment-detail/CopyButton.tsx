import { useEffect, useState } from 'react';
import { Check, Copy } from '@/components/icons';
import { cn } from '@/lib/utils';

/** Copies a reference so it can be pasted into an email or a carrier portal. */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(t);
  }, [copied]);
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? 'Copied' : `Copy ${label}`}
      onClick={() => navigator.clipboard?.writeText(value).then(() => setCopied(true), () => {})}
      className={cn(
        'grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors duration-150 can-hover:hover:bg-foreground/5 can-hover:hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
        copied && 'text-done',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
