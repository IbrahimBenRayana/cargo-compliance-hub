/**
 * HTS Code field with HTS suggestions.
 *
 * The wand opens the native HTS classifier: describe the goods and pick from
 * real 10-digit lines, each with its confidence, duty rate and warnings, or
 * answer the questions it asks when the description is too vague.
 */

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info, Search, Loader2, Sparkles, AlertCircle, Wand2 } from 'lucide-react';
import { integrationsApi } from '@/api/client';
import { HtsSuggestions } from '@/components/hts/HtsSuggestions';
import { formatHtsCode } from '@/lib/htsFormat';
import type { HtsClassifyResult } from '@/types/htsClassify';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HTSAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /** The line's product description, used to start the search when given. */
  description?: string;
  error?: string;
  maxLength?: number;
}

export const HTSAutocomplete = memo(function HTSAutocomplete({
  value,
  onChange,
  description,
  error,
  maxLength = 10,
}: HTSAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(description ?? '');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<HtsClassifyResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const classify = useCallback(async (text: string) => {
    const q = text.trim();
    if (q.length < 3) {
      setFailure('Describe the product first: what it is, what it is made of, what it is used for.');
      return;
    }
    setQuery(q);
    setSearching(true);
    setFailure(null);
    try {
      setResult(await integrationsApi.classifyHTS(q));
    } catch (err: any) {
      setResult(null);
      setFailure(err?.body?.error || 'HTS suggestions are temporarily unavailable.');
    } finally {
      setSearching(false);
    }
  }, []);

  // Opening with a description and nothing shown yet runs the search at once.
  useEffect(() => {
    if (open && !result && !searching && (description ?? '').trim().length >= 3) {
      void classify(description!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (code: string) => {
    const digits = code.replace(/\D/g, '').slice(0, maxLength);
    onChange(digits);
    setOpen(false);
    toast.success(`HTS code ${formatHtsCode(digits)} selected`);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-sm font-medium">
          HTS Code<span className="text-red-500 ml-0.5">*</span>
        </Label>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              Harmonized Tariff Schedule — minimum 6 digits. Use the wand to get suggestions from a product description.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex gap-1.5">
        <Input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g., 731815"
          maxLength={maxLength}
          className={cn('flex-1', error && 'border-red-500 focus-visible:ring-red-500')}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
              title="AI HTS Lookup"
              aria-label="Suggest an HTS code from a product description"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            </Button>
          </PopoverTrigger>
          {/* Never taller than the room on the side it opens; only the results scroll, so the description box stays on screen. */}
          <PopoverContent
            className="flex flex-col w-[min(30rem,calc(100vw-2rem))] max-h-[min(80vh,var(--radix-popover-content-available-height))] p-0"
            align="end"
            collisionPadding={16}
          >
            <form
              className="shrink-0 p-3 border-b bg-muted/30 space-y-2"
              onSubmit={(e) => { e.preventDefault(); void classify(query); }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                <p className="text-sm font-semibold">HTS suggestions</p>
              </div>
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void classify(query); } }}
                placeholder="What it is, what it's made of, what it's used for"
                aria-label="Product description"
                rows={2}
                maxLength={1000}
                className="resize-none text-xs"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" className="h-7 text-xs px-3 gap-1.5" disabled={searching}>
                  {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  Suggest codes
                </Button>
              </div>
            </form>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3">
              {searching && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the description and checking the tariff…
                </p>
              )}
              {!searching && failure && (
                <p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />{failure}
                </p>
              )}
              {!searching && !failure && result && (
                <HtsSuggestions result={result} onPick={pick} pickLabel="Use" onRetry={(d) => void classify(d)} />
              )}
              {!searching && !failure && !result && (
                <p className="text-xs text-muted-foreground text-center py-2">Describe the product above to get suggestions.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />{error}
        </p>
      )}
      {maxLength && value.length > maxLength * 0.8 && !error && (
        <p className="text-xs text-muted-foreground text-right">{value.length}/{maxLength}</p>
      )}
    </div>
  );
});
