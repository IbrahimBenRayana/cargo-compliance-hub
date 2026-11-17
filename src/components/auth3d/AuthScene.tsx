import { useEffect, useRef, useState } from 'react';
import type { AuthSceneState } from './state';
import { setAuthSceneLive } from './success';

// Posters (always-dark panel): 2x, rendered from these scenes in their idle state.
const POSTER = { gate: '/auth/gate.webp', berth: '/auth/berth.webp' } as const;
const FADE_MS = 600;

/** Why this visitor gets the still poster only (and three.js is never imported). */
function stillReason(): string | null {
  // the panel is desktop-only: phones never download the scene
  if (!matchMedia('(min-width: 1024px)').matches) return 'small-screen';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced-motion';
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return 'save-data';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'no-webgl';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    return 'no-webgl';
  }
  return null;
}

/** The brand panel only shows from lg up; below that render nothing at all. */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(min-width: 1024px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

const onIdle = (fn: () => void) => {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn, { timeout: 2000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
};

/**
 * Interactive 3D scene for the auth brand panel. Reacts to the form through
 * `state`; decorative, so it is aria-hidden and every fact is in the form.
 */
export function AuthScene({ state }: { state: AuthSceneState }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [isLive, setIsLive] = useState(false);
  const reduceMotion = useReducedMotion();
  const wide = useWide();
  const kind = state.kind;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || reduceMotion || !wide) return;
    let cancelled = false;
    let handle: { dispose(): void } | null = null;
    let canvas: HTMLCanvasElement | null = null;

    const teardown = () => {
      setAuthSceneLive(false);
      handle?.dispose();
      handle = null;
      canvas?.remove();
      canvas = null;
    };

    const cancelIdle = onIdle(async () => {
      if (cancelled || stillReason()) return;
      try {
        const [{ mountHero, setFont }, scenes] = await Promise.all([
          import('./engine'),
          kind === 'gate' ? import('./scenes/gate') : import('./scenes/berth'),
        ]);
        const family = getComputedStyle(document.body).fontFamily;
        await Promise.all([
          document.fonts.load(`650 38px ${family}`),
          document.fonts.load(`700 50px ${family}`),
        ]).catch(() => {});
        await document.fonts.ready;
        if (cancelled) return;
        setFont(family);

        const def = 'gateScene' in scenes
          ? scenes.gateScene(() => stateRef.current as Extract<AuthSceneState, { kind: 'gate' }>)
          : scenes.berthScene(() => stateRef.current as Extract<AuthSceneState, { kind: 'berth' }>);

        canvas = document.createElement('canvas');
        canvas.className = 'absolute inset-0 block h-full w-full';
        canvas.style.opacity = '0';
        canvas.style.transition = `opacity ${FADE_MS}ms cubic-bezier(.22,1,.36,1)`;
        canvas.addEventListener('webglcontextlost', () => {
          if (cancelled) return;
          teardown();
          setIsLive(false);
        });
        stage.appendChild(canvas);
        const c = canvas;
        handle = mountHero(c, def, {
          lite: (navigator.hardwareConcurrency || 8) <= 4,
          onReady: () => {
            if (cancelled) return;
            c.style.opacity = '1';
            setAuthSceneLive(true);
            setIsLive(true);
          },
        });
      } catch (err) {
        teardown();
        if (import.meta.env.DEV) console.warn('[AuthScene]', err);
      }
    });

    return () => {
      cancelled = true;
      cancelIdle();
      teardown();
      setIsLive(false);
    };
  }, [kind, reduceMotion, wide]);

  return (
    <div ref={stageRef} aria-hidden="true" className="absolute inset-0 select-none">
      {wide && <img
        src={POSTER[kind]}
        alt=""
        loading="eager"
        decoding="async"
        className="absolute inset-0 block h-full w-full object-cover"
        style={{ opacity: isLive ? 0 : 1, transition: `opacity ${FADE_MS}ms cubic-bezier(.22,1,.36,1)` }}
      />}
    </div>
  );
}
