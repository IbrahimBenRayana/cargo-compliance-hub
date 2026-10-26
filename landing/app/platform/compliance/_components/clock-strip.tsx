/**
 * The liquidation clock for one entry, as a static diagram (deck S2 visual):
 * accepted → PSC deadline (day 300) → estimated liquidation (day 314) →
 * protest window (180 days after liquidation). Built in HTML because the
 * app capture still shows 270 (screens.ts note). Positions are to scale on
 * a 0-494 day axis.
 */
const AXIS = 494; // 314 + 180

const MARKERS = [
  { day: 0, label: "Entry accepted", when: "Day 0", short: "Accepted", shortWhen: "Day 0" },
  { day: 300, label: "PSC deadline", when: "Day 300", short: "PSC deadline", shortWhen: "Day 300" },
  { day: 314, label: "Estimated liquidation", when: "About day 314", short: "Est. liquidation", shortWhen: "About day 314" },
  { day: 494, label: "Protest window closes", when: "180 days after liquidation", short: "Protest closes", shortWhen: "+180 days" },
];

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" } as const;

const pct = (d: number) => `${(d / AXIS) * 100}%`;

export function ClockStrip() {
  return (
    <figure className="m-0">
      <div className="rounded-[22px] p-1.5 site-surface">
        <div className="rounded-[17px] bg-[hsl(var(--card))] p-5 ring-1 ring-[hsl(var(--surface-border))] sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-[12px] text-tone-muted">Entry · accepted by CBP</p>
            <span className="rounded-full bg-a-soft px-2.5 py-0.5 text-[12px] font-semibold text-a-ink ring-1 ring-[hsl(var(--a)/0.3)]">
              On the clock
            </span>
          </div>

          {/* Tablet and up: to-scale bar. PSC label sits above the bar so it never collides with liquidation. */}
          <div aria-hidden className="relative mt-6 hidden h-[108px] sm:block">
            <div className="absolute inset-x-0 top-[52px] h-2 rounded-full bg-[hsl(var(--muted))]" />
            <div className="absolute left-0 top-[52px] h-2 rounded-l-full bg-a" style={{ width: pct(314) }} />
            {MARKERS.map((m, i) => {
              const above = m.day === 300;
              const align = i === 0 ? "left" : i === MARKERS.length - 1 ? "right" : "center";
              const shift = align === "left" ? "0" : align === "right" ? "-100%" : "-50%";
              return (
                <div key={m.label}>
                  <span
                    className={`absolute top-[48px] block size-4 rounded-full ring-[3px] ring-[hsl(var(--card))] ${above ? "bg-tone-fg" : "bg-a"}`}
                    style={{ left: pct(m.day), transform: "translateX(-50%)", marginLeft: i === 0 ? 8 : i === MARKERS.length - 1 ? -8 : 0 }}
                  />
                  <div
                    className={`absolute w-max whitespace-nowrap ${above ? "top-0" : "top-[72px]"} ${ALIGN[align]}`}
                    style={align === "right" ? { right: 0 } : { left: pct(m.day), transform: `translateX(${shift})` }}
                  >
                    <p className="text-[12.5px] font-semibold text-tone-fg">{m.short}</p>
                    <p className="text-[11.5px] tabular-nums text-tone-muted">{m.shortWhen}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Accessible list (and the phone layout) */}
          <ol className="mt-6 space-y-4 sm:sr-only">
            {MARKERS.map((m) => (
              <li key={m.label} className="flex items-start gap-3">
                <span aria-hidden className={`mt-1 size-3 shrink-0 rounded-full ${m.day === 300 ? "bg-tone-fg" : "bg-a"}`} />
                <div>
                  <p className="text-[14px] font-semibold text-tone-fg">{m.label}</p>
                  <p className="text-[12.5px] tabular-nums text-tone-muted">{m.when}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </figure>
  );
}
