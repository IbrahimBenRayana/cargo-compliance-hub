"use client";

import { useEffect } from "react";

/**
 * Fixes the "blank page on browser back" issue.
 *
 * When a user navigates to an external URL (e.g., app.mycargolens.com/login)
 * and presses back, the browser restores the page from its bfcache (back-forward
 * cache). The HTML shell is there but React state/hydration is lost, resulting
 * in a blank page. This component forces a full reload in that scenario.
 */
export function BfcacheFix() {
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      // event.persisted === true means the page was restored from bfcache
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
