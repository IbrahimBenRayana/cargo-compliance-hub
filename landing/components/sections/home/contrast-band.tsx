"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Donut } from "@/components/ui/donut";
import { SeverityPill } from "@/components/ui/severity-pill";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

/**
 * The page's single dark passage: the 1998 patchwork on the left, the calm
 * queue on the right, one viewport, no scroll choreography. The contrast
 * does the arguing.
 */
export function ContrastBand() {
  const ref = React.useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });

  return (
    <section
      ref={ref}
      id="chaos"
      className="dark relative overflow-hidden bg-[hsl(222_47%_6%)] py-20 text-[hsl(210_40%_94%)] md:py-24"
    >
      {/* Faint grid backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(210 40% 94% / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(210 40% 94% / 0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <Container className="relative z-10">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, ease: EASE_OUT_QUART }}
          className="mx-auto mb-12 max-w-3xl text-center md:mb-16"
        >
          <h2 className="mb-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Customs software stuck in 1998.
          </h2>
          <p className="text-base leading-relaxed opacity-75 sm:text-lg">
            ABI terminals. CSV exports. Faxed PDF confirmations. Twelve browser
            tabs to file one shipment, then a CBP rejection three days later
            you can&apos;t read.
          </p>
        </motion.header>

        <div className="relative grid grid-cols-1 items-stretch gap-14 lg:grid-cols-2 lg:gap-16">
          {/* Then — the patchwork */}
          <motion.figure
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.7, delay: 0.15, ease: EASE_OUT_QUART }}
            className="flex min-w-0 flex-col"
          >
            <figcaption className="mb-4 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.16em]">
              <span className="opacity-60">Then</span>
              <span className="opacity-40 normal-case tracking-normal">
                six windows per shipment
              </span>
            </figcaption>
            <div className="relative min-h-[320px] flex-1 sm:min-h-[360px]">
              <As400Terminal
                className="absolute left-0 top-0 w-[62%] -rotate-[1.5deg]"
                inView={inView}
                delay={0.3}
              />
              <CsvWindow
                className="absolute right-0 top-[26%] w-[58%] rotate-[1.2deg]"
                inView={inView}
                delay={0.45}
              />
              <FaxSlip
                className="absolute bottom-0 left-[8%] w-[46%] -rotate-[2deg]"
                inView={inView}
                delay={0.6}
              />
            </div>
          </motion.figure>

          {/* Seam arrow */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[58%] z-20 hidden -translate-x-1/2 -translate-y-1/2 lg:block"
          >
            <span className="grid size-10 place-items-center rounded-full border border-[hsl(210_40%_94%/0.15)] bg-[hsl(222_47%_9%)] shadow-[0_0_24px_hsl(43_96%_56%/0.25)]">
              <ArrowRight className="size-4 text-gold" />
            </span>
          </div>
          <div
            aria-hidden
            className="pointer-events-none relative z-20 -my-9 flex justify-center lg:hidden"
          >
            <span className="grid size-9 place-items-center rounded-full border border-[hsl(210_40%_94%/0.15)] bg-[hsl(222_47%_9%)] shadow-[0_0_24px_hsl(43_96%_56%/0.25)]">
              <ArrowDown className="size-4 text-gold" />
            </span>
          </div>

          {/* Now — the calm surface */}
          <motion.figure
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.7, delay: 0.4, ease: EASE_OUT_QUART }}
            className="flex min-w-0 flex-col"
          >
            <figcaption className="mb-4 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.16em]">
              <span className="text-gold">Now</span>
              <span className="opacity-40 normal-case tracking-normal">
                one calm surface
              </span>
            </figcaption>
            <div className="relative flex flex-1 items-center">
              {/* Gold halo — only behind the answer */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-1/2 h-[280px] -translate-y-1/2"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 60% at 50% 50%, hsl(43 96% 56% / 0.12) 0%, transparent 70%)",
                }}
              />
              <CalmQueueCard inView={inView} />
            </div>
          </motion.figure>
        </div>
      </Container>
    </section>
  );
}

/* ---------- Fragments of 1998 ---------- */

type FragmentProps = {
  className?: string;
  inView: boolean;
  delay: number;
};

function fragmentMotion(inView: boolean, delay: number) {
  return {
    initial: { opacity: 0, y: 16, scale: 0.97 },
    animate: inView ? { opacity: 1, y: 0, scale: 1 } : undefined,
    transition: { duration: 0.6, delay, ease: EASE_OUT_QUART },
  };
}

function WinChrome({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-[#0a246a] to-[#3a6ea5] px-2 py-1">
      <span className="truncate font-mono text-[9px] font-bold text-white">
        {title}
      </span>
      <span className="flex gap-0.5" aria-hidden>
        <span className="grid size-3 place-items-center bg-[#c0c0c0] font-mono text-[7px] leading-none text-black">
          _
        </span>
        <span className="grid size-3 place-items-center bg-[#c0c0c0] font-mono text-[7px] leading-none text-black">
          x
        </span>
      </span>
    </div>
  );
}

function As400Terminal({ className, inView, delay }: FragmentProps) {
  return (
    <motion.div
      {...fragmentMotion(inView, delay)}
      className={cn(
        "overflow-hidden rounded-sm border border-[hsl(210_40%_94%/0.12)] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]",
        className,
      )}
      aria-label="1990s ABI terminal screen"
      role="img"
    >
      <WinChrome title="ABI TERMINAL — ACS CBP 019/2048" />
      <div className="bg-[#041504] px-3 py-2.5 font-mono text-[9px] leading-[1.7] text-[#33ff66] sm:text-[10px]">
        <p>ENTRY 230-1148293-5&nbsp;&nbsp;STATUS=REJ</p>
        <p>CODE 361-021 SEE ADD INVOICE</p>
        <p>MFG ID .............. UNCLASSIFIED</p>
        <p className="flex items-center gap-1">
          F3=EXIT&nbsp;F5=REFRESH
          <span className="inline-block h-[1.1em] w-[0.6ch] animate-pulse bg-[#33ff66]" />
        </p>
      </div>
    </motion.div>
  );
}

function CsvWindow({ className, inView, delay }: FragmentProps) {
  const rows: [string, string, string][] = [
    ["INV-4412", "$121.50", "10"],
    ["INV-4413", "#REF!", "96"],
    ["INV-4414", "$540.00", "#REF!"],
  ];
  return (
    <motion.div
      {...fragmentMotion(inView, delay)}
      className={cn(
        "overflow-hidden rounded-sm border border-[hsl(210_40%_94%/0.12)] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]",
        className,
      )}
      aria-label="Broken CSV export spreadsheet"
      role="img"
    >
      <WinChrome title="COMMODITIES_AUG_14_FINAL_v3.csv" />
      <div className="bg-[#d4d0c8] p-1.5">
        <table className="w-full border-collapse bg-white font-mono text-[8px] leading-tight text-black sm:text-[9px]">
          <thead>
            <tr>
              {["A INVOICE", "B VAL", "C QTY"].map((h) => (
                <th
                  key={h}
                  className="border border-[#808080] bg-[#ececec] px-1 py-0.5 text-left font-normal text-[#444]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([a, b, c]) => (
              <tr key={a}>
                <td className="border border-[#c0c0c0] px-1 py-0.5">{a}</td>
                <td
                  className={cn(
                    "border border-[#c0c0c0] px-1 py-0.5",
                    b === "#REF!" && "bg-[#ffe0e0] text-[#c00000]",
                  )}
                >
                  {b}
                </td>
                <td
                  className={cn(
                    "border border-[#c0c0c0] px-1 py-0.5",
                    c === "#REF!" && "bg-[#ffe0e0] text-[#c00000]",
                  )}
                >
                  {c}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function FaxSlip({ className, inView, delay }: FragmentProps) {
  return (
    <motion.div
      {...fragmentMotion(inView, delay)}
      className={cn(
        "overflow-hidden rounded-sm border border-[hsl(210_40%_94%/0.12)] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]",
        className,
      )}
      aria-label="Fax transmission confirmation slip"
      role="img"
    >
      <div className="bg-[#f4efdf] px-3 py-2.5 font-mono text-[8px] leading-[1.7] text-[#3b3628] sm:text-[9px]">
        <p className="mb-1 border-b border-dashed border-[#3b3628]/40 pb-1 font-bold tracking-widest">
          ** CBP-FAX-GATEWAY **
        </p>
        <p>TO&nbsp;&nbsp;: K-BROKER LLC</p>
        <p>RE&nbsp;&nbsp;: ISF-10 / INV-4421</p>
        <p>
          STATUS: <span className="font-bold">REJECTED</span>
        </p>
        <p className="opacity-60">page 1/1 · 03:12 AM</p>
      </div>
    </motion.div>
  );
}

/* ---------- The calm answer ---------- */

function CalmQueueCard({ inView }: { inView: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={inView ? { opacity: 1, scale: 1 } : undefined}
      transition={{ duration: 0.7, delay: 0.65, ease: EASE_OUT_QUART }}
      className="relative z-10 w-full rounded-2xl border border-[hsl(210_40%_94%/0.12)] bg-[hsl(222_40%_10%)] p-5 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.8)]"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span
              aria-hidden
              className="absolute inline-flex size-full rounded-full bg-emerald-500/60 motion-safe:animate-ping"
            />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(210_40%_94%/0.7)]">
            Action queue
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-[hsl(210_40%_94%/0.45)]">
          2 need you today
        </span>
      </div>

      <ul className="flex flex-col gap-2.5">
        <li className="flex items-center gap-3 rounded-xl border border-[hsl(210_40%_94%/0.1)] bg-[hsl(222_40%_13%)] p-3">
          <Donut value={42} tone="rose" size={34} delay={1} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-[hsl(210_40%_96%)]">
              INV-4421 · CBP rejected
            </div>
            <div className="truncate text-[11px] text-[hsl(210_40%_94%/0.55)]">
              Same rejection as the fax — explained in plain English
            </div>
          </div>
          <SeverityPill tone="rose">Fix now</SeverityPill>
        </li>
        <li className="flex items-center gap-3 rounded-xl border border-[hsl(210_40%_94%/0.1)] bg-[hsl(222_40%_13%)] p-3">
          <Donut value={78} tone="amber" size={34} delay={1.15} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-[hsl(210_40%_96%)]">
              INV-4502 · ISF-10 deadline in 4h
            </div>
            <div className="truncate text-[11px] text-[hsl(210_40%_94%/0.55)]">
              Draft ready · AI pre-flight passed
            </div>
          </div>
          <SeverityPill tone="amber">4h</SeverityPill>
        </li>
      </ul>

      <p className="mt-4 border-t border-[hsl(210_40%_94%/0.08)] pt-3 text-[12px] leading-relaxed text-[hsl(210_40%_94%/0.55)]">
        Everything those six windows knew, ranked by what needs you first.
      </p>
    </motion.div>
  );
}
