import { Headset, Loader2 } from 'lucide-react';
import type { ChatMode } from '@/api/client';

/**
 * Inline banner shown above the composer once a conversation leaves the AI:
 * reassurance while we find a specialist, then who the user is chatting with.
 * Renders nothing in the AI / resolved states.
 */
export function AgentHandoffBanner({
  mode,
  agentName,
}: {
  mode: ChatMode;
  agentName?: string | null;
}) {
  if (mode === 'pending_human') {
    return (
      <div className="flex items-center gap-2 border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-700">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span>Connecting you with a MyCargoLens specialist. You can keep typing — they’ll see your messages.</span>
      </div>
    );
  }

  if (mode === 'human') {
    return (
      <div className="flex items-center gap-2 border-t border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[12px] text-emerald-700">
        <Headset className="h-3.5 w-3.5 shrink-0" />
        <span>
          {agentName ? `You’re now chatting with ${agentName}.` : 'You’re now chatting with a specialist.'}
        </span>
      </div>
    );
  }

  return null;
}
