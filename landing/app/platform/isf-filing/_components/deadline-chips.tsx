import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Three static states of the app's ISF deadline chip (wireframe 04, S3:
 * recreated in HTML, no live countdown). Sample bill number.
 */
const STATES = [
  { due: "Due in 72h", label: "First alert", chip: "bg-sky-500/12 text-sky-800 ring-sky-600/25 dark:text-sky-200" },
  { due: "Due in 48h", label: "Second alert", chip: "bg-amber-500/15 text-amber-900 ring-amber-600/30 dark:text-amber-200" },
  { due: "Due in 24h", label: "Final alert", chip: "bg-rose-500/12 text-rose-800 ring-rose-600/30 dark:text-rose-200" },
];

export function DeadlineChips() {
  return (
    <ul aria-label="ISF deadline alerts at 72, 48 and 24 hours" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {STATES.map((s) => (
        <li key={s.due} className="rounded-2xl p-4 site-surface">
          <p className="font-mono text-[11px] text-tone-muted">ISF-10 · HBL GGLI55023877</p>
          <span
            className={cn(
              "mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold tabular-nums ring-1",
              s.chip,
            )}
          >
            <Clock aria-hidden className="size-3.5" />
            {s.due}
          </span>
          <p className="mt-2 text-[13px] text-tone-muted">{s.label}</p>
        </li>
      ))}
    </ul>
  );
}
