import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers, Loader2, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { abiDocumentsApi, type OverlayHts } from '@/api/client';

/**
 * Chapter 99 numbers on one entry line (Section 301, 232, NT52 and other
 * programs). Searches the ingested USITC chapter 99 by code or words and
 * shows how each heading's rate treats the base classification. The server
 * puts them in CBP's program order and prices them; this only collects.
 */

const EFFECT: Record<OverlayHts['semantics'], string> = {
  additional: 'adds to the base duty',
  replacement: 'replaces the base duty',
  none: 'no additional duty',
  unknown: 'cannot be priced automatically',
};

const dotted = (n: string) => `${n.slice(0, 4)}.${n.slice(4, 6)}.${n.slice(6, 8)}`;

export function Ch99Picker({
  value,
  onChange,
  error,
}: {
  value: string[] | undefined;
  onChange: (next: string[] | undefined) => void;
  error?: string;
}) {
  const list = value ?? [];
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ['overlay-hts', debounced],
    queryFn: () => abiDocumentsApi.searchOverlayHts(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 5 * 60_000,
  });
  const results = (data?.data ?? []).filter((r) => !list.includes(r.htsNumber));

  const add = (n: string) => {
    onChange([...list, n]);
    setQ('');
    setOpen(false);
  };
  const remove = (n: string) => {
    const next = list.filter((x) => x !== n);
    onChange(next.length > 0 ? next : undefined);
  };

  return (
    <div className="border-t pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h5 className="flex items-center gap-1.5 text-xs font-semibold">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          Chapter 99 numbers
        </h5>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" disabled={list.length >= 31}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add number
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(32rem,calc(100vw-2rem))] p-0" align="end">
            <Command shouldFilter={false}>
              <CommandInput value={q} onValueChange={setQ} placeholder="9903.88.03, or words like 'China batteries'" />
              <CommandList>
                {debounced.length < 2 ? (
                  <p className="px-3 py-4 text-xs text-muted-foreground">Type a chapter 99 number or words from its description.</p>
                ) : isFetching ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching
                  </div>
                ) : (
                  <>
                    <CommandEmpty>No chapter 99 heading matches.</CommandEmpty>
                    <CommandGroup>
                      {results.map((r) => (
                        <CommandItem
                          key={r.htsNumber}
                          value={r.htsNumber}
                          onSelect={() => add(r.htsNumber)}
                          disabled={r.semantics === 'unknown'}
                          className="flex flex-col items-start gap-0.5"
                        >
                          <div className="flex w-full items-center gap-2">
                            <span className="font-mono text-xs">{dotted(r.htsNumber)}</span>
                            <span className="text-xs text-muted-foreground">{r.rate || 'no rate'}</span>
                            <span className="ml-auto text-[11px] text-muted-foreground">{EFFECT[r.semantics]}</span>
                          </div>
                          <span className="line-clamp-2 text-[11px] text-muted-foreground">{r.description}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          None. Add the Section 301, 232, NT52 or other chapter 99 numbers that apply to this line; CBP rejects a line missing a required one.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {list.map((n) => (
            <Badge key={n} variant="secondary" className="gap-1 font-mono text-xs">
              {dotted(n)}
              <button type="button" onClick={() => remove(n)} aria-label={`Remove ${dotted(n)}`} className="rounded-sm opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
