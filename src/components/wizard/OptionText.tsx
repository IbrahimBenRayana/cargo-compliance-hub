import { cn } from '@/lib/utils';

/**
 * "2704 — Los Angeles, California" as a code column and a name. Long names
 * wrap onto their own lines in the list, and cut off with the full text on
 * hover in the closed field. Options without a code show as they are.
 */
export function OptionText({ label, oneLine }: { label: string; oneLine?: boolean }) {
  const cut = label.indexOf(' — ');
  if (cut < 0) return <span className={cn('min-w-0 flex-1 text-[13.5px] leading-5', oneLine && 'truncate')} title={oneLine ? label : undefined}>{label}</span>;
  const name = label.slice(cut + 3);
  return (
    <>
      <span className="w-12 shrink-0 font-mono text-[12.5px] leading-5 text-muted-foreground">{label.slice(0, cut)}</span>
      <span className={cn('min-w-0 flex-1 text-[13.5px] leading-5', oneLine ? 'truncate' : 'break-words')} title={oneLine ? name : undefined}>{name}</span>
    </>
  );
}
