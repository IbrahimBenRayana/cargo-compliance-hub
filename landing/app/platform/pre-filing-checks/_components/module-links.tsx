import * as React from "react";
import Link from "next/link";

/** In-copy text link ("See it in the inbox →"). */
export function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[15px] font-semibold text-a-ink underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current"
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

/** Small cited-source line under a third-party fact. */
export function SourceNote({ label, href }: { label: string; href: string }) {
  return (
    <p className="text-[12.5px] text-tone-muted">
      Source:{" "}
      <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-current/40 underline-offset-2 hover:text-tone-fg">
        {label}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  );
}
