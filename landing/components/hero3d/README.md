# Hero 3D

Animated 3D hero visuals in real-time three.js, one per page template. They were approved by the founders. The source prototypes are in the marketing deliverable `2026-10-23-website-rework/hero-3d/`, which has the README, the concept per page and INTEGRATION.md.

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

**Tiers.** Full is shadows, DPR up to 2 and pointer parallax. Lite is for phones, coarse pointers or 4 or fewer cores: no shadows, a lighter sea and no parallax, but DPR up to 3 so labels stay sharp on 3x phones. `pixelRatio()` in the engine caps the drawing buffer by pixel count (lite 1.6M, full 3.2M), so a large canvas on a weak device drops DPR instead of fill rate. The loop still pauses offscreen.

**Framing.** `radius`/`width` keep the set inside the frustum; `fit: { d, m }` on each scene then zooms and re-centres it so it fills the slot (`[zoom, x, y]`, shifts in NDC; `d` for the desktop slot, `m` for the squarer phone slot). The values are measured, not hand-tuned: the harness's fit pass renders the whole loop at zoom 0.75, takes the bounding box of everything visible in at least 20% of frames (light and dark), and fits it to 95% of the slot while shadows and glows stay inside. Props that slide in from off-frame may still enter from the edge. Re-run it after changing a scene's camera or layout.

**Slot.** `PageHero` lets the visual bleed into the page gutter: edge to edge on phones, about 2-3rem into the right gutter on desktop (the canvas is transparent and the sets are wide, so width is what makes them read bigger).

## Posters

`/public/hero/<slug>.webp` is the desktop poster (1512×1240, 2x of 756×620). Phones get `<slug>-m.webp` (780×718, 2x of 390×359) or `<slug>-m3x.webp` (1170×1077, 3x), picked by `srcset` w-descriptors and `sizes`. Each has a `-dark` variant. They have transparent backgrounds, so the page background and the CSS gold glow show through, and they are rendered at the scene's `poster:` time.

Every scene follows the site theme: the engine's `dark` flag switches the light rig, plinth and label colours, emissive levels and adds a light pool under the diorama so contact shadows read on the dark page.

The posters are rendered from this engine, not from the prototypes. After you change the engine or a scene, re-render them: bundle `engine.ts` and the scenes with esbuild into a small page, call `mountHero(canvas, { ...scene, dark }, { lite, still: scene.poster })` in headless Chromium at 756×620 (desktop, full tier, `deviceScaleFactor: 2`) and 390×359 (mobile, lite tier, `deviceScaleFactor` 2 and 3), and screenshot with a transparent background. Then convert with `cwebp -q 82 -alpha_q 90 -m 6`. The 120 posters weigh about 6.7 MB in total; a visitor downloads one (desktop ~25-130 KB, phone 3x ~15-110 KB). The harness is in the hero-3d side-session notes (`hero3d-poster-harness/`): `fit.mjs` + `applyfit.py` measure and write `fit`, `render.mjs` renders the posters. `mountHero` returns `renderAt(t)` for the fit pass.
