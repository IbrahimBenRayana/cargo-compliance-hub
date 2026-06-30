import { useEffect, useRef } from 'react';
import { Sparkles, Headset, User as UserIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { UiMessage } from '@/hooks/useChat';
import { DeepLinkCard } from './DeepLinkCard';

/** A blinking three-dot indicator while the AI / agent composes a reply. */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1.5" aria-label="Typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function Avatar({ role }: { role: UiMessage['role'] }) {
  if (role === 'user') {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <UserIcon className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (role === 'agent') {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
        <Headset className="h-3.5 w-3.5" />
      </div>
    );
  }
  // assistant
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-amber-950">
      <Sparkles className="h-3.5 w-3.5" />
    </div>
  );
}

function Bubble({ message }: { message: UiMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="my-1 text-center text-[11px] text-muted-foreground">{message.content}</div>
    );
  }

  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <Avatar role={message.role} />
      <div className={cn('flex max-w-[82%] flex-col gap-1.5', isUser && 'items-end')}>
        {message.role === 'agent' && message.agentName && (
          <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
            {message.agentName}
          </span>
        )}
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words',
            isUser
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-muted text-foreground',
            message.pending && 'opacity-70',
          )}
        >
          {message.content || (message.streaming ? <TypingDots /> : null)}
        </div>
        {message.deeplinks && message.deeplinks.length > 0 && (
          <div className="flex w-full flex-col gap-1.5">
            {message.deeplinks.map((link, i) => (
              <DeepLinkCard key={`${link.url}-${i}`} link={link} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  agentTyping,
  emptyState,
}: {
  messages: UiMessage[];
  agentTyping?: boolean;
  emptyState?: React.ReactNode;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the latest content as it streams / arrives.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, agentTyping]);

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="flex flex-col gap-3 p-4">
        {messages.length === 0 && emptyState}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {agentTyping && (
          <div className="flex gap-2">
            <Avatar role="agent" />
            <div className="rounded-2xl rounded-tl-sm bg-muted px-2 text-emerald-600">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
