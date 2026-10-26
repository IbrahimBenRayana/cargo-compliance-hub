/** Public API endpoints (openapi.yaml L93-265), verbatim from the deck. */
const ENDPOINTS = [
  { method: "GET", path: "/ping", does: "Check your key, scopes and plan" },
  { method: "GET · POST", path: "/shipments", does: "List ISF filings · create an ISF draft" },
  { method: "GET", path: "/shipments/{id}", does: "Read one ISF" },
  { method: "POST", path: "/shipments/{id}/submit", does: "Submit the ISF to CBP" },
  { method: "GET · POST", path: "/entries", does: "List entries · create an entry draft (prefill from a linked ISF)" },
  { method: "GET", path: "/entries/{id}", does: "Read one entry" },
  { method: "POST", path: "/entries/{id}/send", does: "Send the entry to CBP" },
];

/**
 * Endpoint table. A real <table> from sm up; on phones each row stacks
 * (method + path, then what it does) so nothing scrolls sideways.
 */
export function EndpointTable() {
  return (
    <div className="overflow-hidden rounded-[20px] site-surface">
      <table className="block w-full border-collapse text-left sm:table">
        <caption className="sr-only">Public API endpoints under /api/public/v1</caption>
        <thead className="hidden sm:table-header-group">
          <tr className="border-b border-[hsl(var(--surface-border))] text-[12px] font-semibold uppercase tracking-[0.12em] text-tone-muted">
            <th scope="col" className="px-5 py-3 font-semibold">Method</th>
            <th scope="col" className="px-5 py-3 font-semibold">Path</th>
            <th scope="col" className="px-5 py-3 font-semibold">What it does</th>
          </tr>
        </thead>
        <tbody className="block sm:table-row-group divide-y divide-[hsl(var(--surface-border))]">
          {ENDPOINTS.map((e) => (
            <tr key={e.path} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-4 py-3.5 sm:table-row sm:p-0">
              <td className="whitespace-nowrap sm:px-5 sm:py-3.5">
                <span className="rounded-md bg-a-soft px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-a-ink ring-1 ring-[hsl(var(--a)/0.25)]">
                  {e.method}
                </span>
              </td>
              <td className="min-w-0 break-words font-mono text-[13px] text-tone-fg sm:px-5 sm:py-3.5">{e.path}</td>
              <td className="col-span-2 text-[14.5px] leading-snug text-tone-muted sm:px-5 sm:py-3.5">{e.does}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
