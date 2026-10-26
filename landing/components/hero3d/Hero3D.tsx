"use client";

import * as React from "react";
import { getImageProps } from "next/image";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { SceneDef } from "./engine";

/**
 * One loader per approved hero scene (marketing hero-3d, Oct 26 2026).
 * Each is its own chunk; the engine + three.js are one shared chunk.
 */
export const HERO_SCENES = {
  home: () => import("./scenes/home"),
  platform: () => import("./scenes/platform"),
  "isf-filing": () => import("./scenes/isf-filing"),
  "customs-entry": () => import("./scenes/customs-entry"),
  inbox: () => import("./scenes/inbox"),
  "pre-filing-checks": () => import("./scenes/pre-filing-checks"),
  compliance: () => import("./scenes/compliance"),
  api: () => import("./scenes/api"),
  solutions: () => import("./scenes/solutions"),
  "nvocc-forwarders": () => import("./scenes/nvocc-forwarders"),
  importers: () => import("./scenes/importers"),
  pricing: () => import("./scenes/pricing"),
  compare: () => import("./scenes/compare"),
  resources: () => import("./scenes/resources"),
  "book-a-demo": () => import("./scenes/book-a-demo"),
  "book-a-demo-thanks": () => import("./scenes/book-a-demo-thanks"),
  about: () => import("./scenes/about"),
  security: () => import("./scenes/security"),
  contact: () => import("./scenes/contact"),
  "not-found": () => import("./scenes/not-found"),
} satisfies Record<string, () => Promise<{ scene: SceneDef }>>;

export type HeroSlug = keyof typeof HERO_SCENES;

// Poster files in /public/hero: 1512x1240 desktop and 780x720 mobile (both 2x),
// transparent, light + dark, rendered from this engine at the scene's poster time.
const DESKTOP = { width: 1512, height: 1240 };
const MOBILE = { width: 780, height: 720 };
const MOBILE_MQ = "(max-width: 767px)";
const DARK_MQ = "(prefers-color-scheme: dark)";
const FADE_MS = 600;

type Props = {
  scene: HeroSlug;
  className?: string;
};

/** Why this visitor gets the still poster only (and three.js is never imported). */
function stillReason(): string | null {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced-motion";
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return "save-data";
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return "no-webgl";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    return "no-webgl";
  }
  return null;
}

/** Phones, coarse pointers and low-core machines: no shadows, lower DPR, lighter sea. */
function isLite() {
  return (
    Math.min(innerWidth, innerHeight) < 600 ||
    matchMedia("(pointer: coarse)").matches ||
    (navigator.hardwareConcurrency || 8) <= 4
  );
}

function useReducedMotion() {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

const onIdle = (fn: () => void) => {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(fn, { timeout: 2500 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
};

/**
 * Animated 3D hero visual. The poster image is the first paint (and the whole
 * visual for reduced motion, Save-Data or no WebGL2). After hydration, on idle,
 * the scene + engine chunks load, render behind the poster and cross-fade in.
 * Decorative: everything it shows is already in the page copy.
 */
export function Hero3D({ scene, className }: Props) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [live, setLive] = React.useState(false);
  const { resolvedTheme, systemTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  // every scene follows the site theme (engine dark lighting + dark posters)
  const dark = resolvedTheme === "dark";
  // Before hydration the poster follows the OS colour scheme; once the
  // resolved theme is known, a manual toggle that disagrees wins.
  const themeOverride =
    resolvedTheme && systemTheme && resolvedTheme !== systemTheme
      ? (resolvedTheme as "light" | "dark")
      : null;

  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage || reduceMotion) return;
    let cancelled = false;
    let handle: { dispose(): void } | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;

    const teardown = () => {
      handle?.dispose();
      handle = null;
      canvas?.remove();
      canvas = null;
    };

    const cancelIdle = onIdle(async () => {
      if (cancelled || stillReason()) return;
      try {
        const [{ mountHero, setFont }, { scene: def }] = await Promise.all([
          import("./engine"),
          HERO_SCENES[scene](),
        ]);
        // the scenes print Inter on canvas textures: wait for the real face
        const family = getComputedStyle(document.body).fontFamily;
        await Promise.all([
          document.fonts.load(`650 38px ${family}`),
          document.fonts.load(`700 46px ${family}`),
        ]).catch(() => {});
        await document.fonts.ready;
        if (cancelled) return;
        setFont(family);

        // a fresh canvas per run: a context lost on dispose can't be reused
        canvas = document.createElement("canvas");
        canvas.className = "absolute inset-0 block size-full";
        canvas.style.opacity = "0";
        canvas.style.transition = `opacity ${FADE_MS}ms cubic-bezier(.22,1,.36,1)`;
        canvas.addEventListener("webglcontextlost", () => {
          if (cancelled) return;
          teardown();
          setLive(false);
        });
        stage.appendChild(canvas);
        const c = canvas;
        handle = mountHero(c, { ...def, dark }, {
          lite: isLite(),
          onReady: () => {
            if (cancelled) return;
            c.style.opacity = "1";
            fadeTimer = setTimeout(() => !cancelled && setLive(true), 30);
          },
        });
      } catch (err) {
        // any failure keeps the poster; the visual is decorative
        teardown();
        if (process.env.NODE_ENV !== "production") console.warn("[Hero3D]", err);
      }
    });

    return () => {
      cancelled = true;
      cancelIdle();
      clearTimeout(fadeTimer);
      teardown();
      setLive(false);
    };
  }, [scene, dark, reduceMotion]);

  const light = scene;
  const darkName = `${scene}-dark`;
  const src = (name: string, mobile: boolean) =>
    getImageProps({
      src: `/hero/${name}${mobile ? "-m" : ""}.webp`,
      alt: "",
      unoptimized: true,
      ...(mobile ? MOBILE : DESKTOP),
    }).props.src;

  const base = themeOverride === "dark" ? darkName : light;
  const { props: img } = getImageProps({
    src: `/hero/${base}.webp`,
    alt: "",
    unoptimized: true,
    loading: "eager",
    fetchPriority: "high",
    ...DESKTOP,
  });

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative w-full aspect-[1/0.92] md:aspect-[756/620] select-none",
        className,
      )}
    >
      {/* soft gold glow the diorama floats on (kept out of the posters) */}
      <div
        className="pointer-events-none absolute inset-[8%_6%_4%_4%] blur-[10px] [background:radial-gradient(closest-side,hsl(43_96%_56%/.16),transparent_70%)] dark:[background:radial-gradient(closest-side,hsl(43_96%_56%/.14),hsl(222_60%_30%/.18)_55%,transparent_80%)]"
      />
      <div ref={stageRef} className="absolute inset-0">
        <picture>
          {themeOverride === null && (
            <>
              <source media={`${DARK_MQ} and ${MOBILE_MQ}`} srcSet={src(darkName, true)} {...MOBILE} />
              <source media={DARK_MQ} srcSet={src(darkName, false)} {...DESKTOP} />
            </>
          )}
          <source media={MOBILE_MQ} srcSet={src(base, true)} {...MOBILE} />
          <img
            {...img}
            alt=""
            className="absolute inset-0 block size-full object-contain"
            style={{
              opacity: live ? 0 : 1,
              transition: `opacity ${FADE_MS}ms cubic-bezier(.22,1,.36,1)`,
            }}
          />
        </picture>
      </div>
    </div>
  );
}
