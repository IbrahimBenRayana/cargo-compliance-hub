import { Sparkles, Loader2, Headset, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMode } from '@/api/client';

/**
 * Compact status pill reflecting who the user is talking to. Colour follows
 * the brand: gold for the AI, amber while connecting, green for a live
 * specialist, muted when resolved.
 */
export function ModeBadge({
  mode,
  agentName,
  className,
}: {
  mode: ChatMode;
  agentName?: string | null;
  className?: string;
}) {
  const map: Record<ChatMode, { label: string; icon: typeof Sparkles; classes: string; spin?: boolean }> = {
    ai: {
      label: 'AI assistant',
      icon: Sparkles,
      classes: 'bg-[hsl(43_96%_56%/0.15)] text-[hsl(43_96%_46%)] border-[hsl(43_96%_56%/0.3)]',
    },
    pending_human: {
      label: 'Connecting you to a specialist…',
      icon: Loader2,
      classes: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
      spin: true,
    },
    human: {
      label: agentName ? `Live agent: ${agentName}` : 'Live agent',
      icon: Headset,
      classes: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    },
    resolved: {
      label: 'Resolved',
      icon: CheckCircle2,
      classes: 'bg-muted text-muted-foreground border-border',
    },
  };

  const { label, icon: Icon, classes, spin } = map[mode];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        classes,
        className,
      )}
    >
      <Icon className={cn('h-3 w-3 shrink-0', spin && 'animate-spin')} />
      <span className="truncate">{label}</span>
    </span>
  );
}
