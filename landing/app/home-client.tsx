"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, CodeXml, Ship, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentClass, type ModuleKey } from "@/lib/accents";
import type { Persona } from "@/lib/site";

/**
 * Home S7 persona router (copy/home.md S7). The only client island on the
 * home page: a click on a card records `persona_select` (conversion-plan §7)
 * on window.dataLayer when analytics is present. The cards are plain links,
 * so they work without JS.
 */
export type RouterCard = {
  persona: Persona;
  title: string;
  line: string;
  linkLabel: string;
  href: string;
  module: ModuleKey;
};

const ICONS: Record<Persona, LucideIcon> = {
  importer: Building2,
  nvocc: Ship,
  developer: CodeXml,
  broker: BadgeCheck,
};

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

function trackPersona(persona: Persona) {
  const w = window as DataLayerWindow;
  if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: "persona_select", persona, location: "home-router" });
}

export default function PersonaRouter({ cards }: { cards: RouterCard[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-5">
      {cards.map((c) => {
        const Icon = ICONS[c.persona];
        return (
          <li key={c.persona} className="flex">
            <Link
              href={c.href}
              onClick={() => trackPersona(c.persona)}
              data-event="persona_select"
              data-persona={c.persona}
              className={cn(
                "group flex w-full flex-col rounded-[20px] p-6 site-surface",
                "transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-quart)] [@media(hover:hover)]:hover:-translate-y-px",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                accentClass(c.module),
              )}
            >
              <span
                aria-hidden
                className="mb-4 grid size-10 place-items-center rounded-xl bg-a-soft text-a-ink shadow-[inset_0_0_0_1px_hsl(var(--a)/0.25)]"
              >
                <Icon className="size-5" strokeWidth={1.9} />
              </span>
              <h3 className="text-[18px] font-semibold leading-snug tracking-[-0.015em] text-tone-fg">{c.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-tone-muted">{c.line}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-5 text-[14px] font-semibold text-a-ink">
                {c.linkLabel}
                <ArrowRight
                  aria-hidden
                  className="size-3.5 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
