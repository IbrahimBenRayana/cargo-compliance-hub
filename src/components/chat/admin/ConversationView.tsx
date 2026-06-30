import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  MessagesSquare,
  Mail,
  Globe,
  MonitorSmartphone,
  Hand,
  CheckCheck,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { chatAdminApi, type ChatConversation, type ChatMode } from '@/api/client';
import type { UiMessage } from '@/hooks/useChat';
import { AgentComposer } from './AgentComposer';

/** A blinking three-dot indicator while the visitor is typing. */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1" aria-label="Typing">
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

function MessageRow({ message }: { message: UiMessage }) {
  // In the console, the agent's own replies sit on the right; everything else
  // (visitor, AI, system) on the left.
  const fromAgent = message.role === 'agent';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return <div className="my-1 text-center text-[11px] text-muted-foreground">{message.content}</div>;
  }

  const roleLabel = message.role === 'assistant' ? 'AI assistant' : message.role === 'agent' ? 'You' : 'Visitor';

  return (
    <div className={cn('flex flex-col gap-1', fromAgent ? 'items-end' : 'items-start')}>
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {roleLabel}
      </span>
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words',
          fromAgent
            ? 'rounded-tr-sm bg-primary text-primary-foreground'
            : message.role === 'assistant'
              ? 'rounded-tl-sm bg-[hsl(43_96%_56%/0.12)] text-foreground'
              : 'rounded-tl-sm bg-muted text-foreground',
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function modeBadge(mode: ChatMode) {
  switch (mode) {
    case 'pending_human':
      return <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/15">Waiting for agent</Badge>;
    case 'human':
      return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">Live</Badge>;
    case 'resolved':
      return <Badge variant="secondary">Resolved</Badge>;
    default:
      return <Badge className="bg-[hsl(43_96%_56%/0.15)] text-[hsl(43_96%_46%)] hover:bg-[hsl(43_96%_56%/0.15)]">AI</Badge>;
  }
}

export interface ConversationViewProps {
  conversation: ChatConversation | null;
  messages: UiMessage[];
  loading: boolean;
  visitorTyping: boolean;
  /** Current platform-admin user id — used to know if "I" claimed this. */
  currentUserId?: string;
  onSend: (text: string) => void;
  onClaimed: () => void;
  onResolved: () => void;
  onHandedBack: () => void;
  /** Refetch the queue / transcript after a failed action (e.g. 409 claim). */
  onActionError?: () => void;
}

export function ConversationView({
  conversation,
  messages,
  loading,
  visitorTyping,
  currentUserId,
  onSend,
  onClaimed,
  onResolved,
  onHandedBack,
  onActionError,
}: ConversationViewProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const [busyAction, setBusyAction] = useState<null | 'assign' | 'resolve' | 'handback'>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, visitorTyping]);

  if (!conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <MessagesSquare className="h-8 w-8 opacity-40" />
        <p className="text-[13px]">Select a conversation to view the transcript.</p>
      </div>
    );
  }

  const claimedByMe = conversation.assignedAgentId === currentUserId;
  const canReply = conversation.mode === 'human' && claimedByMe;
  const canClaim = conversation.mode === 'pending_human' || (conversation.mode === 'human' && !conversation.assignedAgentId);

  const runAction = async (
    action: 'assign' | 'resolve' | 'handback',
    fn: () => Promise<unknown>,
    onDone: () => void,
  ) => {
    setBusyAction(action);
    try {
      await fn();
      onDone();
    } catch (err: unknown) {
      // assign() can 409 if another agent grabbed it first — tell the user and
      // let the page refetch (onClaimed is still called via the page's toast
      // path only on success, so re-pull the queue here).
      const e = err as { status?: number; body?: { code?: string } };
      if (action === 'assign' && (e?.status === 409 || e?.body?.code === 'already_claimed')) {
        toast.error('Another agent just claimed this conversation.');
      } else {
        toast.error('That action could not be completed. Please try again.');
      }
      onActionError?.();
    } finally {
      setBusyAction(null);
    }
  };

  const handleSend = async (text: string) => {
    setSending(true);
    try {
      onSend(text);
    } finally {
      setSending(false);
    }
  };

  const visitorName =
    conversation.visitorName ||
    conversation.visitorEmail ||
    'Visitor';

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Identity + actions header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-foreground">{visitorName}</span>
            {modeBadge(conversation.mode)}
            <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
              {conversation.surface === 'marketing' ? (
                <Globe className="h-2.5 w-2.5" />
              ) : (
                <MonitorSmartphone className="h-2.5 w-2.5" />
              )}
              {conversation.surface === 'marketing' ? 'Marketing' : 'In-app'}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {conversation.visitorEmail && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {conversation.visitorEmail}
              </span>
            )}
            {conversation.escalationReason && <span>Reason: {conversation.escalationReason}</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {canClaim && (
            <Button
              size="sm"
              onClick={() => runAction('assign', () => chatAdminApi.assign(conversation.id), onClaimed)}
              disabled={busyAction !== null}
              className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busyAction === 'assign' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
              Claim
            </Button>
          )}
          {conversation.mode === 'human' && claimedByMe && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runAction('handback', () => chatAdminApi.handback(conversation.id), onHandedBack)}
                disabled={busyAction !== null}
                className="h-8 gap-1.5"
              >
                {busyAction === 'handback' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Hand className="h-3.5 w-3.5" />
                )}
                Hand back to AI
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runAction('resolve', () => chatAdminApi.resolve(conversation.id), onResolved)}
                disabled={busyAction !== null}
                className="h-8 gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
              >
                {busyAction === 'resolve' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                Resolve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Transcript */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-3 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            messages.map((m) => <MessageRow key={m.id} message={m} />)
          )}
          {visitorTyping && (
            <div className="flex flex-col items-start gap-1">
              <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Visitor
              </span>
              <div className="rounded-2xl rounded-tl-sm bg-muted px-2 text-muted-foreground">
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {/* Reply composer — only when this agent owns the live conversation */}
      <AgentComposer
        onSend={handleSend}
        onTyping={() => { void chatAdminApi.typing(conversation.id).catch(() => {}); }}
        disabled={!canReply}
        sending={sending}
      />
    </div>
  );
}
