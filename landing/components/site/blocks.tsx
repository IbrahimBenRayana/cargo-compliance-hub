import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENTS, accentClass, type ModuleKey } from "@/lib/accents";
import { Eyebrow } from "@/components/site/section";
import { Screenshot, type ScreenshotProps } from "@/components/site/screenshot";

/* ------------------------------------------------------------------ */
/* FeatureSplit                                                         */
/* ------------------------------------------------------------------ */

export type FeatureSplitProps = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Paragraph(s) under the title. */
  body?: React.ReactNode;
  /** Checklist bullets (accent-coloured checks). */
  bullets?: React.ReactNode[];
  /** CTA row under the copy (one secondary at most per section). */
  actions?: React.ReactNode;
  /** Screenshot props, or pass `media` for anything else (illustration, code). */
  screenshot?: ScreenshotProps;
  media?: React.ReactNode;
  /** Media on the left instead of the right (desktop). */
  reverse?: boolean;
  accent?: ModuleKey;
  /** Heading level (default h2). */
  as?: "h2" | "h3";
  className?: string;
};

/** Copy + screenshot, side by side on desktop, stacked (copy first) on mobile. */
export function FeatureSplit({
  eyebrow,
  title,
  body,
  bullets,
  actions,
  screenshot,
  media,
  reverse = false,
  accent,
  as: H = "h2",
  className,
}: FeatureSplitProps) {
  // No visual: one readable column instead of an empty half (never a placeholder).
  const hasVisual = Boolean(screenshot || media);
  return (
    <div
      className={cn(
        hasVisual ? "grid items-center gap-10 lg:grid-cols-2 lg:gap-16" : "max-w-3xl",
        accentClass(accent),
        className,
      )}
    >
      <div className={cn("min-w-0", hasVisual && reverse && "lg:order-2")}>
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <H className="text-[26px] font-semibold leading-[1.12] tracking-[-0.028em] text-tone-fg sm:text-[32px] md:text-[36px]">
          {title}
        </H>
        {body && <div className="mt-4 space-y-3 text-[16px] leading-relaxed text-tone-muted sm:text-[17px]">{body}</div>}
        {bullets && bullets.length > 0 && <CheckList items={bullets} className="mt-6" />}
        {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {hasVisual && (
        <div className={cn("min-w-0", reverse && "lg:order-1")}>
          {screenshot ? <Screenshot {...screenshot} /> : media}
        </div>
      )}
    </div>
  );
}

/** Bulleted list with accent checkmarks (uses the surrounding accent). */
export function CheckList({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[15.5px] leading-snug text-tone-fg">
          <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-a-soft text-a-ink ring-1 ring-[hsl(var(--a)/0.3)]">
            <Check className="size-3" strokeWidth={3} />
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* CardGrid                                                             */
/* ------------------------------------------------------------------ */

export type CardItem = {
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Whole card links here (adds an arrow). */
  href?: string;
  /** Link text shown at the bottom of a linked card. Default "Learn more". */
  linkLabel?: string;
  /** Module accent: tinted card, accent icon tile and title. */
  module?: ModuleKey;
  /** Icon (defaults to the module icon). */
  icon?: LucideIcon;
  /** Small label above the title. */
  kicker?: React.ReactNode;
};

/** Grid of cards. Module cards are tinted with their accent; plain cards use the surface. */
export function CardGrid({
  items,
  columns = 3,
  as: H = "h3",
  className,
}: {
  items: CardItem[];
  columns?: 2 | 3 | 4;
  as?: "h3" | "h4";
  className?: string;
}) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <ul className={cn("grid grid-cols-1 gap-4 md:gap-5", cols, className)}>
      {items.map((item, i) => (
        <li key={i} className="flex">
          <Card item={item} H={H} />
        </li>
      ))}
    </ul>
  );
}

function Card({ item, H }: { item: CardItem; H: "h3" | "h4" }) {
  const Icon = item.icon ?? (item.module ? ACCENTS[item.module].icon : null);
  const tinted = !!item.module;
  const inner = (
    <>
      {Icon && (
        <span
          aria-hidden
          className="mb-4 grid size-10 place-items-center rounded-xl bg-a-soft text-a-ink shadow-[inset_0_0_0_1px_hsl(var(--a)/0.25)]"
        >
          <Icon className="size-5" strokeWidth={1.9} />
        </span>
      )}
      {item.kicker && <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-tone-muted">{item.kicker}</p>}
      <H className={cn("text-[18px] font-semibold leading-snug tracking-[-0.015em]", tinted ? "text-a-ink" : "text-tone-fg")}>
        {item.title}
      </H>
      {item.body && <div className="mt-2 text-[15px] leading-relaxed text-tone-muted">{item.body}</div>}
      {item.href && (
        <span className={cn("mt-auto inline-flex items-center gap-1 pt-5 text-[14px] font-semibold", tinted ? "text-a-ink" : "text-tone-fg")}>
          {item.linkLabel ?? "Learn more"}
          <ArrowRight aria-hidden className="size-3.5 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5" />
        </span>
      )}
    </>
  );
  const cls = cn(
    "group flex w-full flex-col rounded-[20px] p-6 site-surface",
    tinted && "border-[hsl(var(--a)/0.22)] bg-[hsl(var(--a-soft))]",
    accentClass(item.module),
    item.href &&
      "transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-quart)] [@media(hover:hover)]:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
  return item.href ? (
    <Link href={item.href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/* ------------------------------------------------------------------ */
/* StatCards                                                            */
/* ------------------------------------------------------------------ */

export type StatItem = {
  /** The number, as printed (static: stats never count up). */
  value: React.ReactNode;
  label: React.ReactNode;
  /** Cited source (required for third-party numbers). */
  source?: { label: string; href: string };
};

/** Cited stat cards. Numbers use tabular figures and never animate. */
export function StatCards({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", items.length > 2 && "lg:grid-cols-3", className)}>
      {items.map((s, i) => (
        <div key={i} className="flex flex-col rounded-[20px] p-6 site-surface">
          <dt className="order-2 mt-2 text-[15px] leading-snug text-tone-muted">{s.label}</dt>
          <dd className="order-1 text-[36px] font-semibold leading-none tracking-[-0.03em] text-tone-fg tabular-nums sm:text-[44px]">
            {s.value}
          </dd>
          {s.source && (
            <dd className="order-3 mt-4 text-[12.5px] text-tone-muted">
              Source:{" "}
              <a href={s.source.href} target="_blank" rel="noopener noreferrer" className="underline decoration-current/40 underline-offset-2 hover:text-tone-fg">
                {s.source.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* StepFlow                                                             */
/* ------------------------------------------------------------------ */

export type Step = {
  title: React.ReactNode;
  body?: React.ReactNode;
  module?: ModuleKey;
  /** Optional media under the step (e.g. a small Screenshot). */
  media?: React.ReactNode;
};

/** Numbered steps: a row on desktop (connector line), a vertical list on mobile. */
export function StepFlow({ steps, className }: { steps: Step[]; className?: string }) {
  const cols = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" }[
    Math.min(Math.max(steps.length, 2), 5) as 2 | 3 | 4 | 5
  ];
  return (
    <ol className={cn("relative grid grid-cols-1 gap-8 lg:gap-6", cols, className)}>
      {steps.map((s, i) => (
        <li key={i} className={cn("relative flex gap-4 lg:flex-col lg:gap-0", accentClass(s.module))}>
          {/* connector */}
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className="absolute left-[19px] top-11 bottom-[-28px] w-px bg-[hsl(var(--surface-border))] lg:left-11 lg:right-[-12px] lg:top-5 lg:bottom-auto lg:h-px lg:w-auto"
            />
          )}
          <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full bg-a-soft text-[15px] font-semibold text-a-ink ring-1 ring-[hsl(var(--a)/0.3)] tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0 lg:mt-5">
            <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-tone-fg">{s.title}</h3>
            {s.body && <div className="mt-1.5 text-[15px] leading-relaxed text-tone-muted">{s.body}</div>}
            {s.media && <div className="mt-4">{s.media}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
