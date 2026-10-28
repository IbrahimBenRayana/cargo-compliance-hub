// Helpers for the interactive auth scenes: they are driven by form state
// (eased every frame) on top of the engine's time loop.
import type { World } from '../engine';

/** Frame-rate independent ease toward a target. `rate` is roughly 1/seconds. */
export const damp = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Seconds since the previous call (capped, so a paused tab doesn't jump). */
export function frameClock() {
  let last = -1;
  return () => {
    const now = performance.now();
    const dt = last < 0 ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    return dt;
  };
}

/** A canvas texture you can redraw when the text on it changes. */
export function liveTexture(W: World, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const tex = W.canvasTex(w, h, draw);
  const canvas = tex.image as HTMLCanvasElement;
  return {
    tex,
    redraw() {
      const g = canvas.getContext('2d')!;
      g.clearRect(0, 0, w, h);
      draw(g, w, h);
      tex.needsUpdate = true;
    },
  };
}

/** Shorten text to fit `max` pixels in the current font, with an ellipsis. */
export function fitText(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}
