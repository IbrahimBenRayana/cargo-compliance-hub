import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Headset } from 'lucide-react';
import {
  chatAdminApi,
  type ChatConversation,
  type ChatMessage,
} from '@/api/client';
import { useAuthStore } from '@/hooks/useAuth';
import { useChatEventStream } from '@/hooks/useChatEventStream';
import type { UiMessage } from '@/hooks/useChat';
import { QueueList } from '@/components/chat/admin/QueueList';
import { ConversationView } from '@/components/chat/admin/ConversationView';

function toUiMessage(m: ChatMessage): UiMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    deeplinks: m.metadata?.deeplinks,
    createdAt: m.createdAt,
  };
}

let agentUid = 0;

/**
 * Live agent console (platform admins). Two-pane layout: a live queue on the
 * left, the selected conversation's transcript + agent composer on the right.
 *
 * Real-time updates come from the admin EventSource (/chat/admin/stream):
 *   • queue_update → refetch the queue
 *   • message      → if it belongs to the open conversation, append it
 *   • mode_change  → if it's the open conversation, refresh its header
 *   • agent_typing → the visitor is typing in the open conversation
 */
export function AdminChatConsolePage() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [filter, setFilter] = useState<'pending' | 'active'>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [visitorTyping, setVisitorTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Queue (React Query; refetched on queue_update + a slow safety poll) ──
  const queueQuery = useQuery({
    queryKey: ['chatAdminQueue', filter],
    queryFn: () => chatAdminApi.queue(filter).then((r) => r.data),
    refetchInterval: 30_000,
  });

  // ── Load the selected conversation's transcript ──
  const loadConversation = useCallback(async (id: string) => {
    setTranscriptLoading(true);
    try {
      const res = await chatAdminApi.getConversation(id);
      setConversation(res.conversation);
      setMessages(res.messages.map(toUiMessage));
    } catch {
      toast.error('Could not load that conversation.');
    } finally {
      setTranscriptLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadConversation(selectedId);
    else {
      setConversation(null);
      setMessages([]);
    }
    setVisitorTyping(false);
  }, [selectedId, loadConversation]);

  const refetchQueue = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['chatAdminQueue'] });
  }, [queryClient]);

  // ── Admin live stream (auto-reconnecting; onOpen catches up) ──
  useChatEventStream('/api/v1/chat/admin/stream', {
    onOpen: () => {
      // Reconnected — refresh the queue and the open transcript so nothing
      // missed while offline is lost.
      refetchQueue();
      if (selectedId) void loadConversation(selectedId);
    },
    onQueueUpdate: () => refetchQueue(),
    onMessage: (msg) => {
      // Append only if it belongs to the conversation that's currently open.
      if (!msg.conversationId || msg.conversationId !== selectedId) {
        refetchQueue();
        return;
      }
      setMessages((prev) => {
        // Reconcile our own optimistic reply by clientId — race-proof whether
        // this echo or the POST response lands first (fixes the double message).
        if (msg.clientId) {
          const idx = prev.findIndex((m) => m.clientId === msg.clientId);
          if (idx !== -1) {
            const next = prev.slice();
            next[idx] = { ...next[idx], id: msg.messageId, status: 'sent' };
            return next;
          }
        }
        if (prev.some((m) => m.id === msg.messageId)) return prev; // dedupe
        return [
          ...prev,
          {
            id: msg.messageId,
            role: msg.role,
            content: msg.content,
            agentName: msg.agentName,
            createdAt: msg.createdAt,
          },
        ];
      });
      setVisitorTyping(false);
    },
    onModeChange: (change) => {
      if (change.conversationId && change.conversationId === selectedId) {
        // Re-pull the header so assignedAgentId / mode are accurate.
        void loadConversation(selectedId);
      }
      refetchQueue();
    },
    onTyping: (data) => {
      if (data.conversationId && data.conversationId !== selectedId) return;
      setVisitorTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setVisitorTyping(false), 4000);
    },
  });

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);

  // ── Agent reply: optimistic append, then POST ──
  const handleSend = useCallback(
    (text: string) => {
      if (!selectedId) return;
      // Client nonce ties the optimistic bubble to its echoed copy so the two
      // collapse into one regardless of which arrives first.
      const clientId = `c-${Date.now()}-${agentUid++}`;
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${clientId}`,
          clientId,
          role: 'agent',
          content: text,
          createdAt: new Date().toISOString(),
          status: 'sending',
        },
      ]);
      chatAdminApi
        .reply(selectedId, text, clientId)
        .then((res) => {
          // Reconcile by clientId (the stream echo may have arrived first).
          setMessages((prev) =>
            prev.map((m) => (m.clientId === clientId ? { ...m, id: res.id, status: 'sent' } : m)),
          );
        })
        .catch(() => {
          toast.error('Failed to send reply.');
          setMessages((prev) => prev.filter((m) => m.clientId !== clientId));
        });
    },
    [selectedId],
  );

  const handleClaimed = useCallback(() => {
    if (selectedId) void loadConversation(selectedId);
    refetchQueue();
    toast.success('Conversation claimed.');
  }, [selectedId, loadConversation, refetchQueue]);

  const handleResolved = useCallback(() => {
    if (selectedId) void loadConversation(selectedId);
    refetchQueue();
    toast.success('Conversation resolved.');
  }, [selectedId, loadConversation, refetchQueue]);

  const handleHandedBack = useCallback(() => {
    if (selectedId) void loadConversation(selectedId);
    refetchQueue();
    toast.success('Handed back to the AI assistant.');
  }, [selectedId, loadConversation, refetchQueue]);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Headset className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold leading-none text-foreground">Live Chat Console</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Answer escalated conversations from customers and the marketing site in real time.
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[300px_1fr]">
        <div className="hidden min-h-0 md:block">
          <QueueList
            items={queueQuery.data ?? []}
            selectedId={selectedId}
            loading={queueQuery.isLoading}
            onSelect={setSelectedId}
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>
        {/* Mobile: queue stacks above when nothing is selected */}
        {!selectedId && (
          <div className="min-h-0 md:hidden">
            <QueueList
              items={queueQuery.data ?? []}
              selectedId={selectedId}
              loading={queueQuery.isLoading}
              onSelect={setSelectedId}
              filter={filter}
              onFilterChange={setFilter}
            />
          </div>
        )}
        <div className={selectedId ? 'flex min-h-0 flex-col' : 'hidden min-h-0 md:flex md:flex-col'}>
          <ConversationView
            conversation={conversation}
            messages={messages}
            loading={transcriptLoading}
            visitorTyping={visitorTyping}
            currentUserId={currentUserId}
            onSend={handleSend}
            onClaimed={handleClaimed}
            onResolved={handleResolved}
            onHandedBack={handleHandedBack}
            onActionError={() => {
              if (selectedId) void loadConversation(selectedId);
              refetchQueue();
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default AdminChatConsolePage;
