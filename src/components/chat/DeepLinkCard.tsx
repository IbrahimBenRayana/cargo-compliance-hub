import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { ChatDeeplink } from '@/api/client';
import { cn } from '@/lib/utils';

/**
 * A clickable deep-link the AI attached to an answer. Navigates within the
 * app via react-router (these are always in-app paths).
 */
export function DeepLinkCard({ link, className }: { link: ChatDeeplink; className?: string }) {
  const navigate = useNavigate();
  // Only navigate in-app for relative paths; ignore anything unexpected.
  const isInternal = link.url.startsWith('/');

  return (
    <button
      type="button"
      onClick={() => {
        if (isInternal) navigate(link.url);
        else window.open(link.url, '_blank', 'noopener,noreferrer');
      }}
      className={cn(
        'group inline-flex w-full items-center justify-between gap-2 rounded-lg border',
        'border-[hsl(43_96%_56%/0.3)] bg-[hsl(43_96%_56%/0.08)] px-3 py-2 text-left',
        'text-[13px] font-medium text-foreground transition-colors',
        'hover:bg-[hsl(43_96%_56%/0.16)] focus:outline-none focus:ring-2 focus:ring-[hsl(43_96%_56%)]',
        className,
      )}
    >
      <span className="truncate">{link.label}</span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-[hsl(43_96%_46%)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </button>
  );
}
