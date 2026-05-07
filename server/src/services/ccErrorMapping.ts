/**
 * CustomsCity error → Zod-style issues mapping.
 *
 * CC ships validation errors in two slightly different shapes:
 *
 *   A) Object form (used by /api/duty-calculation-tool, etc.):
 *      { errors: { "items[0]": ["..."], "currency": ["..."] }, message: "..." }
 *
 *   B) Array form (used by /api/documents — ISF):
 *      [{ field: "MBOLNumber: X - HBOLNumber: Y", message: "..." }, ...]
 *
 * This module normalises both into the same `{ path, message }` shape
 * our client uses for per-field error pinning. The client maps each
 * issue's path back to a form-field key (e.g. ['items', 2, 'hts'] →
 * 'item.2.hts') and pins the message to that field.
 *
 * Tested against real CC error responses captured in prod
 * (server/src/__tests__/fixtures/customscity-samples.ts).
 */

export interface CCIssue {
  path: (string | number)[];
  message: string;
}

/**
 * Convert CC's `errors` object into our issues array. Used after duty-
 * calculation-tool and -ai endpoints reject a payload.
 */
export function ccErrorsToIssues(errors: unknown): CCIssue[] {
  if (!errors || typeof errors !== 'object') return [];
  const out: CCIssue[] = [];

  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    const messages: string[] = Array.isArray(value)
      ? (value as unknown[]).filter((v): v is string => typeof v === 'string')
      : typeof value === 'string'
      ? [value]
      : [];

    const itemMatch = key.match(/^items?\[(\d+)\]$/);
    if (itemMatch) {
      const idx = parseInt(itemMatch[1] as string, 10);
      for (const msg of messages) {
        out.push({ path: ['items', idx, guessItemField(msg)], message: msg });
      }
    } else {
      // Top-level key (currency, modeOfTransportation, etc.).
      for (const msg of messages) {
        out.push({ path: [key], message: msg });
      }
    }
  }
  return out;
}

/**
 * Convert CC's ISF error array (shape B) into the same issues array.
 * Each entry has a `field` like "MBOLNumber: X - HBOLNumber: Y" — that's
 * BOL identifiers, not the actual broken field. The broken field has to
 * be inferred from the message text.
 */
export function ccIsfErrorsToIssues(errors: unknown): CCIssue[] {
  if (!Array.isArray(errors)) return [];
  const seen = new Set<string>();
  const out: CCIssue[] = [];

  for (const entry of errors) {
    const e = entry as { field?: string; message?: string };
    const msg = typeof e.message === 'string' ? e.message : '';
    if (!msg) continue;
    // De-dupe — CC sometimes sends the same error twice with slightly
    // different phrasing (e.g., the weightUOM length + allowed-values
    // pair). One UI message per logical issue is enough.
    if (seen.has(msg)) continue;
    seen.add(msg);

    const field = guessIsfField(msg);
    out.push({ path: field ? [field] : [], message: msg });
  }

  return out;
}

// ─── Field inference ─────────────────────────────────────────────────
// CC's error messages don't say "field X is wrong" — they describe the
// failure ("HTS code 'X' is not found"). We sniff keywords to pin the
// message to a specific form field. Unknown messages fall back to the
// most generic field so the user still sees the text somewhere visible.

function guessItemField(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('hts'))         return 'hts';
  if (m.includes('description')) return 'description';
  if (m.includes('quantity'))    return 'quantity1';
  if (m.includes('value'))       return 'totalValue';
  if (m.includes('spi'))         return 'spi';
  return 'description';
}

function guessIsfField(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes('usportofarrival'))       return 'foreignPortOfUnlading';
  if (m.includes('weightuom') || m.includes('weight uom')) return 'commodities.weight.unit';
  if (m.includes('description'))           return 'commodities.description';
  if (m.includes('htsnumber') || m.includes('hts code')) return 'commodities.htsCode';
  if (m.includes('iorname'))               return 'importerName';
  if (m.includes('iornumber'))             return 'importerNumber';
  if (m.includes('consignee'))             return 'consigneeName';
  if (m.includes('bol'))                   return 'masterBol';
  if (m.includes('bond'))                  return 'bondType';
  return null;
}
