import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A machined tray holding one plate: every card on the page sits in one of these. */
export function Surface({ children, className, index = 0, core }: { children: ReactNode; className?: string; index?: number; core?: string }) {
  return (
    <div className={cn('bezel rise', className)} style={{ '--i': index } as React.CSSProperties}>
      <div className={cn('bezel-core overflow-hidden', core)}>{children}</div>
    </div>
  );
}

export function PanelTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{children}</h2>
      {aside && <span className="text-[12.5px] tabular-nums text-muted-foreground">{aside}</span>}
    </div>
  );
}
