import { useEffect, useRef, useState } from 'react';

const prefersReduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Eases a figure to its value. On a change it glides from the old figure, so a
 * refresh reads as an update rather than a flash. `from` sets the first start.
 */
export function useCountUp(target: number, { duration = 800, from = 0 }: { duration?: number; from?: number } = {}): number {
  const [value, setValue] = useState(from);
  const shown = useRef(from);
  useEffect(() => {
    const start = shown.current;
    if (prefersReduced() || start === target) {
      shown.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const began = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - began) / duration, 1);
      const eased = 1 - (1 - p) ** 4;
      shown.current = Math.round(start + (target - start) * eased);
      setValue(shown.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
