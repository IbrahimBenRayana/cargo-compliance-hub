/**
 * Entry number blocks — Settings › Organization card.
 *
 * A filer's pre-issued entry-number ranges. The "Assign next number"
 * button in the entry wizard draws from the oldest active block here;
 * this card is where owners/admins register ranges, watch usage, and
 * retire blocks. Overlap rejection happens server-side (409) — a range
 * issued twice is a CBP duplicate-entry incident.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi, type EntryNumberBlock } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

const QUERY_KEY = ['settings', 'entry-blocks'];

export function EntryNumberBlocksCard({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const blocks = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => settingsApi.listEntryBlocks(),
    select: (res) => res.data,
  });

  const [showForm, setShowForm] = useState(false);
  const [filerCode, setFilerCode] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [label, setLabel] = useState('');

  const createBlock = useMutation({
    mutationFn: () =>
      settingsApi.createEntryBlock({
        filerCode: filerCode.trim().toUpperCase(),
        rangeStart: Number(rangeStart),
        rangeEnd: Number(rangeEnd),
        label: label.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setShowForm(false);
      setFilerCode(''); setRangeStart(''); setRangeEnd(''); setLabel('');
      toast.success('Entry number block added');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to add block'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      settingsApi.updateEntryBlock(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to update block'),
  });

  const formValid =
    /^[A-Za-z0-9]{3}$/.test(filerCode.trim()) &&
    Number(rangeStart) >= 1 &&
    Number(rangeEnd) >= Number(rangeStart) &&
    Number(rangeEnd) <= 9_999_999;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <Hash className="h-4 w-4 text-amber-600" />
          Entry Number Blocks
        </CardTitle>
        <CardDescription>
          Your filer-assigned number ranges. The entry wizard&apos;s
          &ldquo;Assign next number&rdquo; draws from the oldest active block.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {blocks.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (blocks.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No blocks yet. Add the entry-number range CBP issued to your filer
            code so filings can draw numbers automatically.
          </p>
        ) : (
          <ul className="space-y-3">
            {blocks.data!.map((block) => (
              <BlockRow
                key={block.id}
                block={block}
                canEdit={canEdit}
                onToggle={(active) => toggleActive.mutate({ id: block.id, active })}
              />
            ))}
          </ul>
        )}

        {canEdit && !showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add block
          </Button>
        )}

        {canEdit && showForm && (
          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="blk-filer" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Filer Code
                </Label>
                <Input
                  id="blk-filer"
                  value={filerCode}
                  onChange={(e) => setFilerCode(e.target.value.toUpperCase())}
                  placeholder="SP7"
                  maxLength={3}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blk-label" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Label <span className="normal-case font-normal">(optional)</span>
                </Label>
                <Input
                  id="blk-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="2026 block"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blk-start" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Range Start
                </Label>
                <Input
                  id="blk-start"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value.replace(/\D/g, '').slice(0, 7))}
                  placeholder="1000000"
                  inputMode="numeric"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blk-end" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Range End
                </Label>
                <Input
                  id="blk-end"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value.replace(/\D/g, '').slice(0, 7))}
                  placeholder="1999999"
                  inputMode="numeric"
                  className="font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              7-digit sequence bounds, check digits are computed automatically.
              Ranges for the same filer code must never overlap.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => createBlock.mutate()}
                disabled={!formValid || createBlock.isPending}
              >
                {createBlock.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save block
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BlockRow({
  block,
  canEdit,
  onToggle,
}: {
  block: EntryNumberBlock;
  canEdit: boolean;
  onToggle: (active: boolean) => void;
}) {
  const capacity = block.rangeEnd - block.rangeStart + 1;
  const usedPct = capacity > 0 ? Math.round((block.used / capacity) * 100) : 0;

  return (
    <li className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-semibold">{block.filerCode}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {String(block.rangeStart).padStart(7, '0')}–{String(block.rangeEnd).padStart(7, '0')}
          </span>
          {block.label && (
            <span className="text-xs text-muted-foreground truncate">· {block.label}</span>
          )}
          {block.exhausted ? (
            <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-600 dark:text-rose-400">
              Exhausted
            </Badge>
          ) : !block.active ? (
            <Badge variant="outline" className="text-[10px]">Inactive</Badge>
          ) : null}
        </div>
        {canEdit && (
          <Switch
            checked={block.active}
            onCheckedChange={onToggle}
            aria-label={`${block.active ? 'Deactivate' : 'Activate'} block ${block.filerCode}`}
          />
        )}
      </div>
      <div className="flex items-center gap-3">
        <Progress value={usedPct} className="h-1.5 flex-1" />
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {block.used.toLocaleString('en-US')} used · {block.remaining.toLocaleString('en-US')} left
        </span>
      </div>
    </li>
  );
}
