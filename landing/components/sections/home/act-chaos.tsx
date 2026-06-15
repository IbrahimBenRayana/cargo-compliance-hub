"use client";

import * as React from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type Transition,
} from "framer-motion";
import { ArrowRight, FileText, Printer } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Donut } from "@/components/ui/donut";
import { SeverityPill } from "@/components/ui/severity-pill";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

// ──────────────────────────────────────────────────────────────────────────
// Fragment definitions — 6 legacy customs-UI surfaces. Each one has its own
// look (AS/400 green-screen, Windows 9x grey, fax-confirmation cream, etc).
// Positions are percentages relative to the stage so they cluster naturally
// without overlap on desktop and tile a smaller "chaotic cloud" on mobile.
// ──────────────────────────────────────────────────────────────────────────

type FragmentKind =
  | "as400"
  | "csv"
  | "outlook"
  | "fax"
  | "pdf"
  | "citrix";

type Fragment = {
  id: FragmentKind;
  /** Rest-pose position inside the stage (% relative). */
  pos: { top: string; left: string };
  /** Approximate width on desktop (px). */
  width: number;
  /** Initial entrance offsets (px), relative to rest position. */
  enterFrom: { x: number; y: number };
  /** Final rest-pose rotation (deg). */
  rotate: number;
  /** Settled scale at rest. */
  scale: number;
  /** Stacking order so newer fragments cover older ones. */
  z: number;
};

const FRAGMENTS: Fragment[] = [
  {
    id: "as400",
    pos: { top: "4%", left: "2%" },
    width: 340,
    enterFrom: { x: -180, y: -40 },
    rotate: -6,
    scale: 0.98,
    z: 5,
  },
  {
    id: "csv",
    pos: { top: "10%", left: "58%" },
    width: 320,
    enterFrom: { x: 200, y: -60 },
    rotate: 4.5,
    scale: 0.95,
    z: 4,
  },
  {
    id: "outlook",
    pos: { top: "44%", left: "28%" },
    width: 360,
    enterFrom: { x: 0, y: -120 },
    rotate: -2,
    scale: 1.0,
    z: 7,
  },
  {
    id: "fax",
    pos: { top: "56%", left: "70%" },
    width: 290,
    enterFrom: { x: 220, y: 100 },
    rotate: 6.5,
    scale: 0.9,
    z: 3,
  },
  {
    id: "pdf",
    pos: { top: "62%", left: "3%" },
    width: 280,
    enterFrom: { x: -200, y: 120 },
    rotate: -5,
    scale: 0.88,
    z: 2,
  },
  {
    id: "citrix",
    pos: { top: "30%", left: "38%" },
    width: 320,
    enterFrom: { x: 0, y: 140 },
    rotate: 2,
    scale: 0.92,
    z: 6,
  },
];

export function ActChaos() {
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(stageRef, { once: true, amount: 0.3 });
  const rawReduce = useReducedMotion();
  // SSR-safe: defer the reduced-motion branch one render so server and
  // first client paint match. Without this, reduce=true on first client
  // render diverges from the server's reduce=null/false output.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const reduce = mounted ? rawReduce : false;

  // Scroll-linked collapse: progress 0..1 maps from "section's top hits
  // viewport bottom" (entering) to "section's center hits viewport center"
  // (fully centered). This compresses the animation to play out WHILE the
  // section is in view, not as it's leaving.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "center center"],
  });

  // Chaos fragments hold their chaotic state for the first ~50% of the
  // section's scroll life so the user has plenty of time to read them.
  // Then they collapse over the remaining scroll range. The unified
  // MyCargoLens card waits until the collapse is mostly done before
  // resolving in — feels like an answer, not a parallel appearance.
  const collapseProgress = useTransform(scrollYProgress, [0.5, 0.95], [0, 1]);
  // Unified card fades in only at the very end of the scroll range so the
  // user has watched the full collapse before the calm answer arrives.
  const cardOpacity = useTransform(scrollYProgress, [0.8, 0.98], [0, 1]);
  const cardScale = useTransform(scrollYProgress, [0.8, 0.98], [0.92, 1]);

  return (
    <section
      ref={sectionRef}
      id="chaos"
      className={cn(
        "relative overflow-hidden bg-[hsl(222_47%_6%)] text-[hsl(210_40%_94%)]",
        "py-20 md:py-28",
      )}
    >
      {/* Subtle moving grid for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(210 40% 80%) 1px, transparent 1px), linear-gradient(90deg, hsl(210 40% 80%) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          backgroundPosition: "center",
        }}
      />
      {/* Spotlight halo behind the unified card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto h-[420px] max-w-[760px]"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 50%, hsl(43 96% 56% / 0.12) 0%, transparent 70%)",
        }}
      />

      <Container className="relative">
        {/* Stage — fragment cloud + unified card */}
        <div
          ref={stageRef}
          className="relative mx-auto w-full max-w-5xl"
          style={{ height: "min(640px, 70vh)", minHeight: 480 }}
        >
          {FRAGMENTS.map((frag, i) => (
            <FragmentLayer
              key={frag.id}
              fragment={frag}
              index={i}
              inView={inView}
              reduce={reduce ?? false}
              collapseProgress={collapseProgress}
            />
          ))}

          {/* Unified action-queue card — fades in as fragments collapse */}
          <motion.div
            style={
              reduce
                ? { opacity: 1, scale: 1 }
                : { opacity: cardOpacity, scale: cardScale }
            }
            className="absolute top-1/2 left-1/2 z-30 w-[min(420px,92%)] -translate-x-1/2 -translate-y-1/2"
            aria-label="MyCargoLens action queue"
          >
            <UnifiedCard />
          </motion.div>
        </div>

        {/* Caption + heading sit BELOW the visual — reversed for variety. */}
        <div className="relative z-10 mx-auto mt-12 max-w-3xl text-center md:mt-16">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{
              duration: 0.5,
              ease: EASE_OUT_QUART,
              delay: reduce ? 0 : 0.6,
            }}
            className="mb-5 inline-flex items-center gap-2 text-sm text-[hsl(210_30%_72%)]"
          >
            <ArrowRight className="size-3.5 text-[hsl(43_96%_56%)]" aria-hidden />
            One calm surface.
          </motion.p>
          <span className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(210_40%_94%)]/60">
            Before MyCargoLens
          </span>
          <h2 className="text-2xl font-semibold leading-tight tracking-tight text-[hsl(210_40%_98%)] sm:text-3xl md:text-4xl">
            Customs software stuck in 1998.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[hsl(210_30%_78%)] sm:text-lg">
            ABI terminals. CSV exports. Faxed PDF confirmations. Twelve browser
            tabs to file one shipment, then a CBP rejection three days later
            you can&rsquo;t read.
          </p>
        </div>
      </Container>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Fragment layer — handles entrance + scroll-driven collapse for one fragment.
// ──────────────────────────────────────────────────────────────────────────

function FragmentLayer({
  fragment,
  index,
  inView,
  reduce,
  collapseProgress,
}: {
  fragment: Fragment;
  index: number;
  inView: boolean;
  reduce: boolean;
  collapseProgress: ReturnType<typeof useTransform<number, number>>;
}) {
  // Derive scroll-linked transforms unconditionally so hook order is stable.
  // Translate from rest-pose toward the center (negative of the rest offset).
  const restX = useTransform(collapseProgress, [0, 1], [0, 0]);
  const restY = useTransform(collapseProgress, [0, 1], [0, 0]);
  const scaleDown = useTransform(collapseProgress, [0, 1], [fragment.scale, 0.4]);
  const opacityDown = useTransform(collapseProgress, [0, 1], [1, 0.05]);
  const rotateOut = useTransform(
    collapseProgress,
    [0, 1],
    [fragment.rotate, fragment.rotate * 0.2],
  );
  // (restX/restY use the absolute layout — fragments collapse via scale +
  // opacity rather than translation, which avoids re-flow and reads cleaner.)
  void restX;
  void restY;

  const enterDelay = reduce ? 0 : 0.1 * index;
  const enterTransition: Transition = {
    duration: reduce ? 0.001 : 0.85,
    ease: EASE_OUT_QUART,
    delay: enterDelay,
  };

  return (
    <motion.div
      initial={
        reduce
          ? {
              opacity: 0.05,
              scale: 0.4,
              rotate: fragment.rotate * 0.2,
              x: 0,
              y: 0,
            }
          : {
              opacity: 0,
              scale: 0.6,
              rotate: fragment.rotate + (index % 2 === 0 ? -15 : 15),
              x: fragment.enterFrom.x,
              y: fragment.enterFrom.y,
            }
      }
      animate={
        reduce
          ? undefined
          : inView
            ? {
                opacity: 1,
                scale: fragment.scale,
                rotate: fragment.rotate,
                x: 0,
                y: 0,
              }
            : undefined
      }
      transition={enterTransition}
      style={
        reduce
          ? undefined
          : {
              top: fragment.pos.top,
              left: fragment.pos.left,
              width: fragment.width,
              zIndex: fragment.z,
              // After the entrance settles, scroll progress drives a "settle
              // and shrink" — opacity & scale fade as the page scrolls.
              opacity: opacityDown,
              scale: scaleDown,
              rotate: rotateOut,
            }
      }
      className={cn(
        "absolute hidden md:block",
        reduce && "opacity-[0.05]",
      )}
      aria-hidden
    >
      <FragmentSurface kind={fragment.id} />
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Per-kind surfaces — distinct visual languages.
// ──────────────────────────────────────────────────────────────────────────

function FragmentSurface({ kind }: { kind: FragmentKind }) {
  switch (kind) {
    case "as400":
      return <As400Terminal />;
    case "csv":
      return <CsvWindow />;
    case "outlook":
      return <OutlookEmail />;
    case "fax":
      return <FaxConfirmation />;
    case "pdf":
      return <PdfDialog />;
    case "citrix":
      return <CitrixAbi />;
  }
}

function ChromeBar({
  title,
  variant = "win",
}: {
  title: string;
  variant?: "win" | "fax" | "mac";
}) {
  if (variant === "fax") {
    return (
      <div className="flex items-center justify-between border-b border-[hsl(28_30%_60%)] bg-[hsl(40_50%_92%)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[hsl(30_40%_22%)]">
        <span className="truncate">{title}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 border-b border-black/40 bg-gradient-to-b from-[hsl(220_30%_42%)] to-[hsl(220_30%_28%)] px-2 py-1 text-white">
      <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider">
        {title}
      </span>
      <span className="flex items-center gap-0.5">
        <span className="inline-block size-3 border border-black/60 bg-[hsl(220_15%_82%)] text-center font-mono text-[8px] leading-[10px] text-black/70">
          _
        </span>
        <span className="inline-block size-3 border border-black/60 bg-[hsl(220_15%_82%)] text-center font-mono text-[8px] leading-[10px] text-black/70">
          x
        </span>
      </span>
    </div>
  );
}

// CRT-terminal mockup. Background is brand-tinted near-black
// (hsl 222 47% 2%) rather than pure #000, so the chaos act still
// belongs to the dark-mode color system instead of escaping it.
function As400Terminal() {
  return (
    <div className="overflow-hidden rounded-sm border border-black/70 bg-[hsl(222_47%_2%)] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]">
      <ChromeBar title="ABI Terminal — abi.cbp.gov:9090" />
      <div
        className="px-3 py-2.5 font-mono text-[11px] leading-[16px] tabular-nums text-[hsl(120_70%_70%)]"
        style={{
          background:
            "repeating-linear-gradient(0deg, hsl(120 60% 4%) 0, hsl(120 60% 4%) 14px, hsl(120 60% 6%) 14px, hsl(120 60% 6%) 15px)",
        }}
      >
        <div>ENTRY 234-1148293-5</div>
        <div className="opacity-90">&nbsp;SUMMARY ......... STATUS=REJ</div>
        <div className="opacity-90">&nbsp;CODE 7K1-022 IOR NUM INVALID</div>
        <div className="opacity-90">&nbsp;HTS .............. UNCLASSIFIED</div>
        <div className="mt-1 flex items-center gap-1">
          <span>&gt;</span>
          <span className="inline-block h-3.5 w-1.5 bg-[hsl(120_70%_70%)]" />
        </div>
      </div>
    </div>
  );
}

function CsvWindow() {
  return (
    <div className="overflow-hidden rounded-md border border-black/30 bg-[hsl(220_12%_92%)] text-[hsl(222_47%_12%)] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)]">
      <ChromeBar title="commodities_aug_v3_FINAL.csv" />
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-black/15 bg-[hsl(220_10%_82%)] px-2 py-1 text-[9.5px] font-mono uppercase tracking-wider text-[hsl(220_15%_30%)]">
        <span>file</span>
        <span>edit</span>
        <span>view</span>
        <span>data</span>
      </div>
      {/* Grid */}
      <div className="grid grid-cols-[28px_1fr_1fr_1fr_22px]">
        {/* Column headers */}
        <div className="bg-[hsl(220_10%_78%)] border-r border-b border-black/15 px-1 py-0.5 text-center font-mono text-[10px] text-[hsl(220_15%_30%)]">
          #
        </div>
        {["A invoice", "B HTS", "C ctry", "▾"].map((h) => (
          <div
            key={h}
            className="border-b border-black/15 bg-[hsl(220_10%_78%)] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(220_15%_30%)] truncate"
          >
            {h}
          </div>
        ))}
        {[
          ["1", "INV-4421", "—", "—"],
          ["2", "INV-4422", "6115.96", "VN"],
          ["3", "INV-4423", "#REF!", "—"],
          ["4", "INV-4424", "8504.40", "TH"],
          ["5", "INV-4425", "—", "CN"],
        ].map((row, i) => (
          <React.Fragment key={i}>
            <div className="border-r border-b border-black/10 bg-[hsl(220_10%_84%)] px-1 py-0.5 text-center font-mono text-[10.5px] text-[hsl(220_15%_28%)]">
              {row[0]}
            </div>
            <div className="border-b border-black/10 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums">
              {row[1]}
            </div>
            <div className="border-b border-black/10 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums">
              {row[2]}
            </div>
            <div className="border-b border-black/10 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums">
              {row[3]}
            </div>
            <div className="border-b border-black/10 bg-[hsl(220_10%_84%)]" />
          </React.Fragment>
        ))}
        {/* Scrollbar gutter */}
        <div className="col-span-5 flex h-3 items-stretch border-t border-black/15 bg-[hsl(220_10%_82%)]">
          <div className="flex-1" />
          <div className="w-12 bg-[hsl(220_15%_60%)]" />
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}

function OutlookEmail() {
  return (
    <div className="overflow-hidden rounded-sm border border-[hsl(212_40%_45%)] bg-white text-[hsl(222_47%_12%)] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)]">
      {/* Outlook 2003 ribbon title */}
      <div className="flex items-center justify-between bg-gradient-to-b from-[hsl(212_85%_60%)] to-[hsl(212_85%_42%)] px-2 py-1 text-white">
        <span className="truncate font-mono text-[10px] font-semibold">
          RE: ISF Rejection — Tax ID Missing — Message
        </span>
        <span className="flex items-center gap-0.5">
          <span className="grid size-3 place-items-center bg-[hsl(212_85%_72%)] font-mono text-[8px] leading-none text-white">
            _
          </span>
          <span className="grid size-3 place-items-center bg-[hsl(0_60%_50%)] font-mono text-[8px] leading-none text-white">
            x
          </span>
        </span>
      </div>
      {/* Toolbar strip */}
      <div className="flex items-center gap-2 border-b border-black/15 bg-gradient-to-b from-[hsl(212_60%_92%)] to-[hsl(212_40%_84%)] px-2 py-1">
        <span className="rounded-sm bg-white/60 px-1.5 py-0.5 font-mono text-[9px] text-[hsl(212_40%_30%)]">
          Reply
        </span>
        <span className="rounded-sm bg-white/60 px-1.5 py-0.5 font-mono text-[9px] text-[hsl(212_40%_30%)]">
          Reply All
        </span>
        <span className="rounded-sm bg-white/60 px-1.5 py-0.5 font-mono text-[9px] text-[hsl(212_40%_30%)]">
          Forward
        </span>
      </div>
      {/* Headers */}
      <div className="border-b border-black/15 px-3 py-1.5 text-[10px] leading-[14px]">
        <div>
          <span className="opacity-60">From: </span>
          <span className="font-semibold">CBP-ACE@dhs.gov</span>
        </div>
        <div>
          <span className="opacity-60">To: </span>filings@yourbroker.example
        </div>
        <div>
          <span className="opacity-60">Subject: </span>
          <span className="font-semibold">RE: ISF Rejection — Tax ID Missing</span>
        </div>
      </div>
      {/* Body */}
      <div className="px-3 py-2 font-mono text-[10.5px] leading-[15px] text-[hsl(222_47%_18%)]">
        <div>&gt; ENTRY 234-1148293-5 returned with code 7K1-022.</div>
        <div>&gt; Manufacturer party requires tax ID (DUNS, MID,</div>
        <div>&gt; or foreign ID). Please re-submit within 24h.</div>
        <div>&gt;</div>
        <div>&gt; — Automated ACE notification, do not reply.</div>
      </div>
    </div>
  );
}

function FaxConfirmation() {
  return (
    <div className="overflow-hidden rounded-sm border border-[hsl(28_30%_50%)] bg-[hsl(40_55%_90%)] text-[hsl(30_45%_18%)] shadow-[0_18px_40px_-12px_rgba(80,40,0,0.45)]">
      <ChromeBar variant="fax" title="FAX TRANSMISSION OK · 14:32 · 3 pages" />
      <div className="px-3 py-3 font-mono text-[10.5px] leading-[15px]">
        {/* Faux dot-matrix banner */}
        <div className="mb-2 flex items-center gap-1 text-[10px] tracking-[0.18em]">
          <Printer className="size-3" aria-hidden />
          <span>CBP-FAX-GATEWAY</span>
        </div>
        <div>===========================</div>
        <div>TO   : Y-BROKER LLC</div>
        <div>FROM : CBP PORT 2704</div>
        <div>RE   : ISF-10 / INV-4421</div>
        <div>STAT : REJECTED  ✕</div>
        <div>CODE : 7K1-022</div>
        <div>===========================</div>
        <div className="mt-1 opacity-70">
          See attached cover sheet pp 2-3.
        </div>
      </div>
    </div>
  );
}

function PdfDialog() {
  return (
    <div className="overflow-hidden rounded-md border border-black/30 bg-[hsl(220_12%_94%)] text-[hsl(222_47%_12%)] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)]">
      <ChromeBar title="Adobe Acrobat — Please-Sign-Here.pdf" />
      <div className="flex items-center gap-3 px-4 py-4">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-sm bg-[hsl(0_75%_45%)] text-white shadow-inner"
          aria-hidden
        >
          <FileText className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="truncate font-mono text-[11px] font-semibold">
            Please-Sign-Here.pdf
          </div>
          <div className="truncate text-[10px] opacity-70">
            2.4 MB · 4 pages · Adobe Reader 6.0
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-1.5 border-t border-black/15 bg-[hsl(220_10%_84%)] px-3 py-1.5">
        <span className="rounded-sm border border-black/25 bg-[hsl(220_10%_90%)] px-2 py-0.5 font-mono text-[10px]">
          Open
        </span>
        <span className="rounded-sm border border-black/25 bg-[hsl(220_10%_90%)] px-2 py-0.5 font-mono text-[10px]">
          Cancel
        </span>
      </div>
    </div>
  );
}

function CitrixAbi() {
  const tabs = ["ABI", "HTSUS", "FORMS", "BOND"];
  return (
    <div className="overflow-hidden rounded-md border border-black/30 bg-[hsl(35_15%_94%)] text-[hsl(222_47%_12%)] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)]">
      <ChromeBar title="Citrix Receiver — ABI Workstation" />
      {/* Tab strip */}
      <div className="flex items-end border-b border-black/20 bg-[hsl(35_15%_82%)] px-1 pt-1">
        {tabs.map((t, i) => (
          <span
            key={t}
            className={cn(
              "border border-b-0 px-2 py-0.5 font-mono text-[10px] tracking-wider",
              i === 0
                ? "border-black/30 bg-[hsl(35_15%_94%)] text-[hsl(222_47%_12%)]"
                : "border-black/15 bg-[hsl(35_15%_88%)] text-[hsl(222_20%_40%)]",
            )}
          >
            [{t}]
          </span>
        ))}
      </div>
      {/* Form rows */}
      <div className="p-2.5 font-mono text-[10.5px] leading-[15px]">
        <div className="grid grid-cols-[88px_1fr] gap-y-1">
          <span className="opacity-70">IOR NUMBER</span>
          <span className="border-b border-black/20 tabular-nums">
            12-3456789 00
          </span>
          <span className="opacity-70">ENTRY TYPE</span>
          <span className="border-b border-black/20">01 — CONSUMPTION</span>
          <span className="opacity-70">PORT CODE</span>
          <span className="border-b border-black/20 tabular-nums">2704</span>
          <span className="opacity-70">FILER</span>
          <span className="border-b border-black/20">YYY</span>
        </div>
        <div className="mt-2 flex justify-end gap-1.5">
          <span className="rounded-sm border border-black/25 bg-[hsl(35_15%_88%)] px-2 py-0.5 text-[10px]">
            SUBMIT
          </span>
          <span className="rounded-sm border border-black/25 bg-[hsl(35_15%_88%)] px-2 py-0.5 text-[10px]">
            CLEAR
          </span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Unified card — the "one calm surface" reveal at full scroll-through.
// ──────────────────────────────────────────────────────────────────────────

function UnifiedCard() {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-[hsl(222_47%_10%)] p-4 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8),0_0_0_1px_hsl(43_96%_56%_/_0.18)] backdrop-blur-sm sm:p-5">
      {/* Window chrome stub */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span
              aria-hidden
              className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping"
            />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(210_30%_70%)]">
            Action queue
          </span>
        </div>
        <span className="text-[10px] font-medium tabular-nums text-[hsl(210_25%_55%)]">
          1 of 5
        </span>
      </div>

      {/* The single row */}
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <Donut value={86} tone="gold" size={42} strokeWidth={3.5} showLabel />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[hsl(210_40%_96%)]">
            INV-4421 · CBP rejected
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[hsl(210_25%_70%)]">
            AI Coach explains why
            <ArrowRight
              className="size-3 text-[hsl(43_96%_60%)]"
              aria-hidden
            />
          </div>
        </div>
        <SeverityPill tone="rose">Rejected</SeverityPill>
      </div>
    </div>
  );
}
