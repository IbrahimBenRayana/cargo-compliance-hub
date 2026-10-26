import { CodeXml, FileText, Inbox, Scale, ShieldCheck, Ship, type LucideIcon } from "lucide-react";

/**
 * One accent per product module (wireframes README, Round 3). The colour
 * values live in app/globals.css (`--isf`, `--isf-ink`, `--isf-soft`, …) with
 * dark-mode pairs; this file maps a module to its class, label and icon.
 *
 * Usage: put `accentClass(module)` on any element, then use the Tailwind
 * tokens `text-a-ink`, `bg-a-soft`, `bg-a`, `border-a/25` inside it.
 */
export type ModuleKey = "isf" | "entry" | "inbox" | "checks" | "compliance" | "api";

export type Accent = {
  key: ModuleKey;
  /** Module name as the nav prints it. */
  label: string;
  icon: LucideIcon;
  /** Class that sets --a / --a-ink / --a-soft for the subtree. */
  className: `acc-${ModuleKey}`;
};

export const ACCENTS: Record<ModuleKey, Accent> = {
  isf: { key: "isf", label: "ISF filing", icon: Ship, className: "acc-isf" },
  entry: { key: "entry", label: "Customs entry", icon: FileText, className: "acc-entry" },
  inbox: { key: "inbox", label: "The inbox", icon: Inbox, className: "acc-inbox" },
  checks: { key: "checks", label: "Pre-filing checks", icon: ShieldCheck, className: "acc-checks" },
  compliance: { key: "compliance", label: "Compliance", icon: Scale, className: "acc-compliance" },
  api: { key: "api", label: "API and webhooks", icon: CodeXml, className: "acc-api" },
};

export const MODULE_ORDER: ModuleKey[] = ["isf", "entry", "inbox", "checks", "compliance", "api"];

export function accentClass(module?: ModuleKey | null): string {
  return module ? ACCENTS[module].className : "";
}
