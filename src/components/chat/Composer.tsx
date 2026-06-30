import { useState, useRef, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_LEN = 4000;

/**
 * Message input. Enter sends, Shift+Enter inserts a newline. Auto-grows up
 * to a few lines. `onType` fires (caller debounces) so a live agent can be
 * shown a typing indicator.
 */
export function Composer({
  onSend,
  onType,
  disabled,
  placeholder = 'Ask anything about your shipments…',
}: {
  onSend: (text: string) => void;
  onType?: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    // Reset auto-grown height.
    if (ref.current) ref.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
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
            setValue(e.target.value.slice(0, MAX_LEN));
            onType?.();
            // Auto-grow.
            const el = e.target;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={placeholder}
          aria-label="Message"
          className="min-h-0 resize-none border-0 bg-transparent p-1 text-[13px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Button
          type="button"
          size="icon"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className="h-8 w-8 shrink-0 rounded-lg bg-[hsl(43_96%_56%)] text-amber-950 hover:bg-[hsl(43_96%_50%)]"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
