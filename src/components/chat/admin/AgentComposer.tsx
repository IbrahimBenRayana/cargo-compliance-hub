import { useState, useRef, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Live-agent reply composer for the admin console. Enter sends; Shift+Enter
 * newline. Fires `onType` on a debounce so the user sees a typing indicator.
 */
export function AgentComposer({
  onSend,
  onTyping,
  disabled,
  sending,
}: {
  onSend: (text: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
  sending?: boolean;
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled || sending) return;
    onSend(text);
    setValue('');
    if (ref.current) ref.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // Debounced typing ping — at most once per 2.5s while actively typing.
  const pingTyping = () => {
    if (!onTyping || typingTimer.current) return;
    onTyping();
    typingTimer.current = setTimeout(() => {
      typingTimer.current = null;
    }, 2500);
  };

  return (
    <div className="border-t border-border bg-background p-3">
      <div
        className={cn(
          'flex items-end gap-2 rounded-xl border border-input bg-background px-2 py-1.5',
          'focus-within:ring-2 focus-within:ring-[hsl(43_96%_56%)] focus-within:border-transparent',
          disabled && 'opacity-60',
        )}
      >
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            setValue(e.target.value.slice(0, 4000));
            pingTyping();
            const el = e.target;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={disabled ? 'Claim this conversation to reply' : 'Type your reply…'}
          aria-label="Reply"
          className="min-h-0 resize-none border-0 bg-transparent p-1 text-[13px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Button
          type="button"
          size="icon"
          onClick={submit}
          disabled={disabled || sending || !value.trim()}
          aria-label="Send reply"
          className="h-8 w-8 shrink-0 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
