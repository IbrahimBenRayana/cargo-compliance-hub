// The auth pages wait briefly for the scene's success beat before they
// navigate, but only when a live scene is actually showing.

/** How long a page waits for the success beat before it navigates. */
const SUCCESS_MS = 750;

let live = false;

/** AuthScene reports whether its live canvas is on screen. */
export function setAuthSceneLive(on: boolean) {
  live = on;
}

/**
 * Resolves once the success animation has had its moment, or at once when no
 * live scene is showing (phones, reduced motion, no WebGL, still loading).
 */
export function waitForAuthScene(): Promise<void> {
  return live ? new Promise((r) => setTimeout(r, SUCCESS_MS)) : Promise.resolve();
}
