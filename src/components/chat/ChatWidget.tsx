import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, X, Headset, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useChat } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { ModeBadge } from './ModeBadge';
import { AgentHandoffBanner } from './AgentHandoffBanner';

/**
 * Floating in-app chat widget for signed-in users.
 *
 * A fixed bottom-right launcher opens a chat panel (slides up on mobile, in
 * from the right on desktop). The conversation is created lazily on first
 * open and restored from localStorage across reloads (see useChat).
 *
 * Graceful degradation via GET /chat/config:
 *   • enabled === false  → the widget renders nothing.
 *   • aiEnabled === false → no AI composer; only the human-handoff CTA.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const { state, send, escalate } = useChat(open);

  const { config, mode, agentName, messages, busy, agentTyping, loading, error, aiUnavailable } = state;

  // enabled === false → hide entirely (only known after first open; until
  // then we still show the launcher, which is the desired behaviour).
  if (config && !config.enabled) return null;

  const aiOn = config?.aiEnabled !== false;
  const inHumanFlow = mode === 'human' || mode === 'pending_human';
  // The composer is for AI in ai/resolved modes (only when AI is on) or for
  // the live agent in human/pending modes (always available).
  const composerEnabled = inHumanFlow || aiOn;
  const composerDisabled = busy || loading || !composerEnabled;

  const placeholder =
    mode === 'human'
      ? 'Message the specialist…'
      : mode === 'pending_human'
        ? 'Add anything else while we connect you…'
        : 'Ask anything about your shipments…';

  const showHumanCta = !inHumanFlow && (aiUnavailable || aiOn);

  return (
    <>
      {/* ── Launcher ── */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed bottom-5 right-5 z-50"
          >
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open chat assistant"
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-full shadow-xl',
                'bg-primary text-primary-foreground ring-2 ring-[hsl(43_96%_56%/0.4)]',
                'transition-transform hover:scale-105 focus:outline-none focus:ring-4',
              )}
            >
              <MessageSquare className="h-6 w-6" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(43_96%_56%)]">
                <Sparkles className="h-2.5 w-2.5 text-amber-950" />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            role="dialog"
            aria-label="Chat assistant"
            className={cn(
              'fixed z-50 flex flex-col overflow-hidden border border-border bg-background shadow-2xl',
              // Mobile: full-width sheet anchored to the bottom.
              'inset-x-0 bottom-0 h-[80vh] rounded-t-2xl',
              // Desktop: floating card bottom-right.
              'sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[600px] sm:max-h-[80vh] sm:w-[400px] sm:rounded-2xl',
            )}
          >
            {/* Header (dark, on-brand) */}
            <div className="flex items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[14px] font-semibold leading-none">MyCargoLens Assistant</span>
                <ModeBadge mode={mode} agentName={agentName} />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="h-8 w-8 text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Transcript */}
            <MessageList
              messages={messages}
              agentTyping={agentTyping}
              emptyState={
                !loading && (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-amber-950">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <p className="text-[14px] font-semibold text-foreground">How can I help?</p>
                    <p className="max-w-[260px] text-[12px] text-muted-foreground">
                      Ask about your shipments, filings, duties, or how a feature works. I can pull
                      up your own records and point you to the right page.
                    </p>
                  </div>
                )
              }
            />

            {/* Error / AI-unavailable notice */}
            {error && (
              <div className="flex items-start gap-2 border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-[12px] text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Hand-off status banner */}
            <AgentHandoffBanner mode={mode} agentName={agentName} />

            {/* Human CTA — escalate to a specialist */}
            {showHumanCta && (
              <div className="border-t border-border px-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => escalate(aiUnavailable ? 'ai_unavailable' : undefined)}
                  className="w-full gap-2 text-[12px]"
                >
                  <Headset className="h-3.5 w-3.5" />
                  {aiUnavailable ? 'Connect with a human' : 'Talk to a human'}
                </Button>
              </div>
            )}

            {/* Composer — hidden when AI is off and we're not in a human flow */}
            {(aiOn || inHumanFlow) && (
              <Composer onSend={send} disabled={composerDisabled} placeholder={placeholder} />
            )}

            {/* AI fully off and no human flow: explain + the CTA above is the path */}
            {!aiOn && !inHumanFlow && (
              <p className="border-t border-border px-4 py-3 text-center text-[12px] text-muted-foreground">
                Our AI assistant is offline right now. Use “Talk to a human” to reach a specialist.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
