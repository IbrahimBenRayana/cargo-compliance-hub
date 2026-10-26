/**
 * HTML recreation of the API keys screen (the real settings screen can't be
 * captured: screens.ts excludes it). Scopes are the real ones from
 * openapi.yaml; keys are masked; nothing here is live.
 */
const KEYS = [
  { name: "TMS production", prefix: "mcl_live_…", scopes: ["filings:read", "filings:write", "entries:read", "entries:write"] },
  { name: "Reporting (read only)", prefix: "mcl_live_…", scopes: ["filings:read", "entries:read"] },
];

export function KeyList() {
  return (
    <figure className="m-0">
      <div className="rounded-[22px] p-1.5 site-surface">
        <div className="rounded-[17px] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--surface-border))]">
          <p className="border-b border-[hsl(var(--surface-border))] px-4 py-3 text-[13px] font-semibold text-tone-fg sm:px-5">
            Settings → API
          </p>
          <ul className="divide-y divide-[hsl(var(--surface-border))]">
            {KEYS.map((k) => (
              <li key={k.name} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-semibold text-tone-fg">{k.name}</p>
                  <p className="mt-0.5 font-mono text-[12px] text-tone-muted">{k.prefix}</p>
                  <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Scopes">
                    {k.scopes.map((s) => (
                      <li
                        key={s}
                        className="rounded-md bg-a-soft px-1.5 py-0.5 font-mono text-[11.5px] text-a-ink ring-1 ring-[hsl(var(--a)/0.25)]"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <span
                  aria-hidden
                  className="inline-flex h-8 w-fit shrink-0 items-center rounded-lg border border-[hsl(0_72%_51%/0.35)] px-3 text-[13px] font-semibold text-[hsl(0_70%_42%)] dark:text-[hsl(0_85%_75%)]"
                >
                  Revoke
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="mt-3 text-[13px] leading-snug text-tone-muted">
        Two keys with different scopes, recreated from the app. Keys are masked.
      </figcaption>
    </figure>
  );
}
