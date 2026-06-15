/**
 * Brand color tokens (hsl strings, ready for SVG / canvas / inline styles).
 *
 * Tailwind classes are still the right tool for DOM elements. These
 * constants exist for places Tailwind can't reach: SVG fill/stroke,
 * canvas, Framer Motion gradient stops, illustration components.
 *
 * Keep these in sync with --primary / --accent / --gold* in globals.css.
 * They were inlined as `const GOLD = "hsl(43 96% 56%)"` in 11 different
 * files before this module existed; that meant any palette tweak missed
 * a third of the illustrations. Now there's one source of truth.
 */

/** Primary brand accent. Maps to --accent and --color-gold. */
export const GOLD = "hsl(43 96% 56%)";

/** Lighter gold for highlights and rim-lights. Maps to --color-gold-light. */
export const GOLD_LIGHT = "hsl(43 96% 70%)";

/** Darker gold for hover/depth. Maps to --color-gold-dark. */
export const GOLD_DARK = "hsl(38 92% 44%)";

/**
 * Severity tones — used ONLY when showing compliance state
 * (urgent / pending / accepted). Do not use as decorative accents.
 */
export const ROSE = "hsl(0 72% 51%)";
export const AMBER = "hsl(38 92% 50%)";
export const EMERALD = "hsl(160 84% 39%)";
