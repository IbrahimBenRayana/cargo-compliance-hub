"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Form primitives shared by /book-a-demo and /contact (both owned by T9).
 * Visible labels, 44px targets, errors next to the field and wired with
 * aria-invalid + aria-describedby.
 */

export const controlCls =
  "block h-11 w-full rounded-lg border border-foreground/15 bg-card px-3.5 text-[15px] text-foreground shadow-[inset_0_1px_1px_hsl(var(--foreground)/0.03)] placeholder:text-muted-foreground/80 transition-[border-color,box-shadow] duration-150 hover:border-foreground/25 focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring)/0.25)] aria-[invalid=true]:border-red-600 dark:aria-[invalid=true]:border-red-400";

type FieldProps = {
  id: string;
  label: React.ReactNode;
  /** Appended to the label in muted text, e.g. "(optional)". */
  hint?: string;
  help?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

/** Label + control + help + inline error. The control must use `describedBy(id, …)`. */
export function Field({ id, label, hint, help, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[14px] font-medium text-foreground">
        {label}
        {hint && <span className="font-normal text-muted-foreground"> {hint}</span>}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-[13px] leading-snug text-muted-foreground">
          {help}
        </p>
      )}
      <FieldError id={id} error={error} />
    </div>
  );
}

export function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="flex items-start gap-1.5 text-[13px] leading-snug text-red-700 dark:text-red-300">
      <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
      {error}
    </p>
  );
}

/** aria-describedby for a control: help text and error, when present. */
export function describedBy(id: string, { help, error }: { help?: boolean; error?: string }) {
  const ids = [help && `${id}-help`, error && `${id}-error`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

/** Banner for submit-level problems (validation summary, network, 429, 5xx). */
export function FormAlert({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-red-600/25 bg-red-50 px-4 py-3 text-[14px] leading-snug text-red-800 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-200">
      <p className="flex items-start gap-2">
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}

/** Visually hidden honeypot: off the tab order and hidden from assistive tech. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
      <label htmlFor="website">Website</label>
      <input
        id="website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Focus the first element (by id, in order) that has an error. */
export function focusFirstError(order: string[], errors: Record<string, string | undefined>) {
  const first = order.find((k) => errors[k]);
  if (!first) return;
  const el = document.getElementById(first) ?? document.querySelector<HTMLElement>(`[name="${first}"]`);
  el?.focus();
}
