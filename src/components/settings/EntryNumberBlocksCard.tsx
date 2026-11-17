/**
 * Entry number blocks, the Settings › Organization card.
 *
 * A filer's pre-issued entry-number ranges. The "Assign next number"
 * button in the entry wizard draws from the oldest active block here;
 * this card is where owners/admins register ranges, watch usage, and
 * retire blocks. Overlap rejection happens server-side (409): a range
 * issued twice is a CBP duplicate-entry incident.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from '@/components/icons';
import { toast } from 'sonner';
import { settingsApi, organizationApi, type EntryNumberBlock } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { FILL, TINT, type Tone } from '@/components/dashboard/tones';
import { cn } from '@/lib/utils';

const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';
const FIELD_LABEL = 'text-[12px] font-normal text-muted-foreground';

const QUERY_KEY = ['settings', 'entry-blocks'];

export function EntryNumberBlocksCard({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const blocks = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => settingsApi.listEntryBlocks(),
    select: (res) => res.data,
  });

  const [showForm, setShowForm] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [label, setLabel] = useState('');

  const createBlock = useMutation({
    mutationFn: () =>
      settingsApi.createEntryBlock({
        rangeStart: Number(rangeStart),
        rangeEnd: Number(rangeEnd),
        label: label.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setShowForm(false);
      setRangeStart(''); setRangeEnd(''); setLabel('');
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

  // The filer code comes from the org's CBP setup (set by MyCargoLens), never typed.
  const { data: cbpData } = useQuery({
    queryKey: ['org', 'cbp'],
    queryFn: () => organizationApi.cbpIdentity(),
  });
  const filerCode = cbpData?.cbp.filerCode ?? null;

  const formValid =
    !!filerCode &&
    Number(rangeStart) >= 1 &&
    Number(rangeEnd) >= Number(rangeStart) &&
    Number(rangeEnd) <= 9_999_999;

  return (
    <section aria-labelledby="entry-blocks-title" className={PANEL}>
      <div className="px-5 py-3.5">
        <h2 id="entry-blocks-title" className="text-[14px] font-semibold">Entry number blocks</h2>
        <p className="text-[13px] text-muted-foreground">
          Your filer-assigned number ranges. The entry wizard&apos;s
          &ldquo;Assign next number&rdquo; draws from the oldest active block.
        </p>
      </div>
      <div className="space-y-4 border-t border-border/70 px-5 py-4 text-[13px]">
        {blocks.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (blocks.data?.length ?? 0) === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            No blocks yet. Add the entry-number range CBP issued to your filer
            code so filings can draw numbers automatically.
          </p>
        ) : (
          <ul className="-my-1 divide-y divide-border/60">
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
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)} disabled={!filerCode}>
              <Plus aria-hidden />Add block
            </Button>
            {!filerCode && (
              <span className="text-[12.5px] text-muted-foreground">
                Entry numbers use your own CBP filer code, which MyCargoLens sets up with you first.
              </span>
            )}
          </div>
        )}

        {canEdit && showForm && (
          <div className="space-y-4 rounded-lg bg-muted/50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="blk-filer" className={FIELD_LABEL}>
                  Filer code
                </Label>
                <Input id="blk-filer" value={filerCode ?? ''} readOnly disabled className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="blk-label" className={FIELD_LABEL}>
                  Label (optional)
                </Label>
                <Input
                  id="blk-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="2026 block"
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="blk-start" className={FIELD_LABEL}>
                  Range start
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
              <div className="space-y-1.5">
                <Label htmlFor="blk-end" className={FIELD_LABEL}>
                  Range end
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
            <p className="text-[12px] text-muted-foreground">
              7-digit sequence bounds. Check digits are computed automatically.
              Ranges for the same filer code must never overlap.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => createBlock.mutate()}
                disabled={!formValid || createBlock.isPending}
              >
                {createBlock.isPending && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
                Save block
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
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

  const status: { tone: Tone; word: string } | null = block.exhausted
    ? { tone: 'urgent', word: 'Exhausted' }
    : !block.active
      ? { tone: 'calm', word: 'Inactive' }
      : null;

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[13px] font-semibold">{block.filerCode}</span>
          <span className="font-mono text-[12.5px] text-muted-foreground">
            {String(block.rangeStart).padStart(7, '0')} to {String(block.rangeEnd).padStart(7, '0')}
          </span>
          {block.label && (
            <span className="truncate text-[12.5px] text-muted-foreground">{block.label}</span>
          )}
          {status && (
            <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium', TINT[status.tone])}>
              <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[status.tone])} />
              {status.word}
            </span>
          )}
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
        <Progress value={usedPct} className="h-1.5 flex-1 bg-muted" aria-label="Entry numbers used" />
        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
          {block.used.toLocaleString('en-US')} used, {block.remaining.toLocaleString('en-US')} left
        </span>
      </div>
    </li>
  );
}
