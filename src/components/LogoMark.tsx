import { cn } from '@/lib/utils';

/**
 * MyCargoLens brand mark — the "Focus Frame": four corner brackets
 * locking a single gold subject square in the center. It reads as a
 * reticle locking onto the one filing that matters right now.
 *
 * The frame strokes inherit `currentColor`, so you tint the frame via a
 * parent `color` / `text-*` class (navy on light, light-grey on dark).
 * The subject square is the only gold and stays fixed.
 *
 * Geometry is canonical on a 100×100 canvas — do not re-space the
 * brackets (see the brand handoff).
 *
 * Sizes:
 *   - 18 (inline / nav)
 *   - 24 (compact header)
 *   - 28 (default header)
 *   - 32 (auth panel)
 *   - 64+ (hero / splash)
 */
export function LogoMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* Frame — four corner brackets, tinted via currentColor */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="6.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 26 40 L 26 26 L 40 26" />
        <path d="M 60 26 L 74 26 L 74 40" />
        <path d="M 74 60 L 74 74 L 60 74" />
        <path d="M 40 74 L 26 74 L 26 60" />
      </g>
      {/* Subject — the gold square, the only gold accent in the mark */}
      <rect x="42" y="42" width="16" height="16" rx="4.6" fill="hsl(43 96% 56%)" />
    </svg>
  );
}
