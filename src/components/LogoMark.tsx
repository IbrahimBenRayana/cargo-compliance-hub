import { cn } from '@/lib/utils';

/**
 * MyCargoLens brand mark — a 6-blade camera aperture (iris diaphragm)
 * with a gold hex aperture at the center. The "lens" metaphor: many
 * things narrow down to the one item that matters right now.
 *
 * Strokes / fills inherit `currentColor`, so you can tint via a parent
 * `color` / `text-*` class for dark mode.
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
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* Six blades, alternating tones for iris depth */}
      <path d="M 30 16 L 23 3.88 L 16 10.5 L 20.76 13.25 Z" fill="currentColor" />
      <path d="M 23 3.88 L 9 3.88 L 11.24 13.25 L 16 10.5 Z" fill="currentColor" fillOpacity="0.75" />
      <path d="M 9 3.88 L 2 16 L 11.24 18.75 L 11.24 13.25 Z" fill="currentColor" />
      <path d="M 2 16 L 9 28.12 L 16 21.5 L 11.24 18.75 Z" fill="currentColor" fillOpacity="0.75" />
      <path d="M 9 28.12 L 23 28.12 L 20.76 18.75 L 16 21.5 Z" fill="currentColor" />
      <path d="M 23 28.12 L 30 16 L 20.76 13.25 L 20.76 18.75 Z" fill="currentColor" fillOpacity="0.75" />
      {/* Gold hex aperture at the center — the only gold accent in the mark */}
      <path
        d="M 20.76 13.25 L 16 10.5 L 11.24 13.25 L 11.24 18.75 L 16 21.5 L 20.76 18.75 Z"
        fill="hsl(43, 96%, 56%)"
      />
    </svg>
  );
}
