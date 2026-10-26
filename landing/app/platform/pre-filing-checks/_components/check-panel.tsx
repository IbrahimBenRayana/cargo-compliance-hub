import { AlertTriangle, CircleX, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * HTML recreation of the draft check panel. Messages and severities are
 * verbatim from server/src/services/validation.ts (SCAC format = critical;
 * deadline under 24h and consignee number = warning). Static: no countdown.
 */
const CHECKS = [
  {
    severity: "critical" as const,
    field: "SCAC",
    message: "SCAC code must be exactly 4 uppercase letters (e.g., MAEU, CMDU, HLCU)",
  },
  {
    severity: "warning" as const,
    field: "Filing deadline",
    message: "Filing deadline is in less than 24 hours (19h remaining)",
  },
  {
    severity: "warning" as const,
    field: "Consignee",
    message: "Consignee number is required",
  },
];

const SEV = {
  critical: {
    label: "Critical",
    icon: CircleX,
    chip: "bg-[hsl(0_72%_51%/0.1)] text-[hsl(0_70%_38%)] ring-[hsl(0_72%_51%/0.25)] dark:text-[hsl(0_85%_75%)]",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    chip: "bg-[hsl(38_92%_50%/0.12)] text-[hsl(30_90%_30%)] ring-[hsl(38_92%_50%/0.3)] dark:text-[hsl(40_95%_70%)]",
  },
};

export function CheckPanel() {
  return (
    <figure className="m-0">
      <div className="rounded-[22px] p-1.5 site-surface">
        <div className="rounded-[17px] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--surface-border))]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--surface-border))] px-4 py-3 sm:px-5">
            <p className="font-mono text-[12px] text-tone-muted">ISF-10 · draft</p>
            <p className="text-[12.5px] font-semibold text-tone-fg">
              <span className="tabular-nums">1</span> critical · <span className="tabular-nums">2</span> warnings
            </p>
          </div>
          <ul className="divide-y divide-[hsl(var(--surface-border))]">
            {CHECKS.map((c) => {
              const s = SEV[c.severity];
              const Icon = s.icon;
              return (
                <li key={c.message} className="flex gap-3 px-4 py-3.5 sm:px-5">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold ring-1",
                      s.chip,
                    )}
                  >
                    <Icon aria-hidden className="size-3.5" strokeWidth={2.2} />
                    {s.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-tone-muted">{c.field}</p>
                    <p className="mt-0.5 text-[14px] leading-snug text-tone-fg">{c.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[hsl(var(--surface-border))] p-4 sm:px-5">
            <span
              aria-hidden
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--muted))] text-[14px] font-semibold text-tone-muted"
            >
              <Lock className="size-4" />
              Fix 1 error to submit
            </span>
            <span className="sr-only">The submit button stays disabled until the critical error is fixed.</span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-[13px] leading-snug text-tone-muted">
        The check panel on a draft, recreated with the app&apos;s own messages.
      </figcaption>
    </figure>
  );
}
