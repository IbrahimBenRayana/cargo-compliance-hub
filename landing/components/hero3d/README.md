# Hero 3D

Animated 3D hero visuals in real-time three.js, one per page template. They were approved by Ibrahim on Oct 26 2026. The source prototypes are in the marketing deliverable `2026-10-23-website-rework/hero-3d/`, which has the README, the concept per page and INTEGRATION.md.

```
engine.ts          the shared world kit: renderer, light rig, materials, primitives, run loop, dispose()
scenes/<slug>.ts   one scene per page: `export const scene: SceneDef` (pure function of time)
Hero3D.tsx         'use client' wrapper: poster first, then the live scene on idle
```

## Usage

```tsx
<Hero3D scene="home" />
```

The slugs are the keys of `HERO_SCENES` in `Hero3D.tsx`. The visual is decorative (`aria-hidden`). Everything it shows must already be in the page copy.

## Load order

1. Server render: a `<picture>` with the poster from `/public/hero/` is the first paint. It loads eagerly with `fetchPriority="high"`. It follows `prefers-color-scheme` before hydration. Once next-themes resolves, a manual theme toggle wins.
2. After hydration, on `requestIdleCallback`, the component checks three things: reduced motion, Save-Data, and WebGL2 support. If any of them rules the scene out, it stops and three.js is never downloaded.
3. Otherwise it imports `engine.ts` (three.js plus the engine, one shared chunk of about 177 KB gzipped) and the scene chunk (about 2 KB). It waits for Inter, draws the first frame on a fresh canvas starting at the poster's time, then cross-fades the canvas in and the poster out over 600 ms.
4. The loop pauses when the canvas is offscreen or the tab is hidden. Unmounting, a theme change or reduced motion turning on calls `dispose()`. That frees the geometries, materials, textures, environment map and observers, then the WebGL context.

The scene is loaded with a plain `import()` inside the effect, not with `next/dynamic`, because the module is not a React component. The effect is the same: it is client-only, code-split and never part of SSR.

**Tiers.** Full is shadows, DPR up to 2 and pointer parallax. Lite is for phones, coarse pointers or 4 or fewer cores: no shadows, DPR 1.5, a lighter sea and no parallax.

## Posters

`/public/hero/<slug>.webp` is the desktop poster (1512×1240, 2x) and `<slug>-m.webp` is the mobile one (780×720, 2x). Each has a `-dark` variant. They have transparent backgrounds, so the page background and the CSS gold glow show through, and they are rendered at the scene's `poster:` time.

`api` is dark-only and uses the same file in both themes.

After you change a scene, re-render its posters from the prototype pages with the marketing `render.mjs`. Set `deviceScaleFactor: 2`, render with transparent backgrounds, and render a dark pass with `dark: true`.
