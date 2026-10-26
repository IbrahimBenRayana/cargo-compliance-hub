"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DemoButton } from "@/components/site/cta";
import { UI_STRINGS, type Persona } from "@/lib/site";

/**
 * Mobile sticky bottom bar (wireframe 01 "H5", conversion plan §3.1 rule 6).
 * Persona and pricing pages only. Slides up once the hero (`[data-hero]`)
 * leaves the viewport and hides while the pre-footer band (`[data-cta-band]`)
 * is visible, so two gold buttons never stack.
 */
export function StickyDemoBar({ persona, src }: { persona?: Persona; src: string }) {
  const [heroGone, setHeroGone] = React.useState(false);
  const [bandVisible, setBandVisible] = React.useState(false);

  React.useEffect(() => {
    const hero = document.querySelector("[data-hero]");
    const band = document.querySelector("[data-cta-band]");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0);
        if (e.target === band) setBandVisible(e.isIntersecting);
      }
    });
    if (hero) io.observe(hero);
    if (band) io.observe(band);
    return () => io.disconnect();
  }, []);

  const show = heroGone && !bandVisible;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-[hsl(var(--card)/0.96)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:hidden"
        >
          {/* right padding leaves room for the chat launcher (fixed bottom-right) */}
          <div className="flex items-center gap-3 pr-16">
            <DemoButton persona={persona} src={src} location="sticky_mobile" className="shrink-0" />
            <p className="text-[12.5px] leading-snug text-muted-foreground">{UI_STRINGS.demoMicrocopy}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
