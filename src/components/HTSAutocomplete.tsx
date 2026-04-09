/**
 * HTS Autocomplete Field
 * 
 * Provides real-time HTS code suggestions from the CustomsCity AI classifier.
 * User types a product description and gets suggested HTS codes.
 */

import { useState, useRef, useCallback, memo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info, Search, Loader2, Sparkles, AlertCircle, X, Wand2 } from 'lucide-react';
import { integrationsApi } from '@/api/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HTSSuggestion {
  code: string;
  description: string;
  confidence?: number;
}

interface HTSAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
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
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<HTSSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClassify = useCallback(async () => {
    const query = description || searchQuery;
    if (!query.trim()) {
      toast.error('Enter a product description first');
      return;
    }

    setSearching(true);
    try {
      const result = await integrationsApi.classifyHTS(query);
      
      // Backend now returns clean { suggestions: [{ code, description, score }], message? }
      let parsed: HTSSuggestion[] = [];

      if (result.suggestions && Array.isArray(result.suggestions)) {
        parsed = result.suggestions.map((item: any) => ({
          code: item.code || '',
          description: item.description || '',
          confidence: item.score ?? undefined,
        })).filter((s: HTSSuggestion) => s.code);
      } else if (Array.isArray(result)) {
        // Fallback: raw array format
        parsed = result.map((item: any) => ({
          code: item.hts || item.htsCode || item.code || item.hs_code || '',
          description: item.naturalized_description || item.description || item.label || item.name || '',
          confidence: item.score || item.confidence,
        })).filter((s: HTSSuggestion) => s.code);
      }

      if (parsed.length > 0) {
        setSuggestions(parsed);
        setShowSuggestions(true);
      } else {
        const message = result.message || 'No HTS suggestions found. Try a more specific description.';
        toast.info(message);
      }
    } catch (err: any) {
      toast.error('HTS lookup failed: ' + (err.message || 'Service unavailable'));
    } finally {
      setSearching(false);
    }
  }, [description, searchQuery]);

  const selectSuggestion = (code: string) => {
    const digits = code.replace(/[\.\-\s]/g, '');
    onChange(digits.slice(0, 6)); // CC API uses 6-digit HTS
    setShowSuggestions(false);
    toast.success(`HTS code ${digits.slice(0, 6)} selected`);
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
              Harmonized Tariff Schedule — minimum 6 digits. Use the AI lookup button to find the right code based on your product description.
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
        <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
              onClick={handleClassify}
              disabled={searching}
              title="AI HTS Lookup"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">HTS Suggestions</p>
              </div>
              {!description && (
                <div className="mt-2 flex gap-1.5">
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Describe your product..."
                    className="text-xs h-7"
                    onKeyDown={e => e.key === 'Enter' && handleClassify()}
                  />
                  <Button size="sm" className="h-7 text-xs px-2" onClick={handleClassify} disabled={searching}>
                    {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  </Button>
                </div>
              )}
            </div>
            <div className="max-h-64 overflow-auto">
              {suggestions.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {description ? 'Click the button to get suggestions based on the product description' : 'Type a product description above'}
                </div>
              ) : (
                suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full text-left p-3 hover:bg-muted/50 transition-colors border-b last:border-0 group"
                    onClick={() => selectSuggestion(s.code)}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="font-mono text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {s.code}
                      </Badge>
                      {s.confidence && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {Math.round(s.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                    )}
                  </button>
                ))
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
