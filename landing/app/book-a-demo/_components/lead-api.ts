/**
 * Client for the public contact endpoint (server/src/routes/contact.ts).
 *
 * Two server contracts are live at once:
 * - PR #186 (lead storage): POST accepts persona/source/UTM fields and
 *   `step: 1`, returns `leadId`; PATCH /:id completes step 2.
 * - Current staging/prod: strict Zod with only name, email, subject, message
 *   and website. Any other key is a 400 "Unrecognized key(s)".
 *
 * We always try the PR #186 shape first. A 400 that names unrecognized keys
 * means the older server, so the caller falls back to the legacy payload
 * (everything folded into `message`). Nothing here ever logs form data.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

const ENDPOINT = `${API_URL}/api/v1/contact`;
const TIMEOUT_MS = 15_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SendFailure = "network" | "rate" | "server" | "legacy" | "notfound" | "invalid";
export type SendResult = { ok: true; leadId?: string } | { ok: false; kind: SendFailure };

/** Drop empty strings and undefined so optional server fields never see "". */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

export async function sendLead(
  method: "POST" | "PATCH",
  body: Record<string, unknown>,
  leadId?: string,
): Promise<SendResult> {
  if (method === "PATCH" && (!leadId || !UUID.test(leadId))) return { ok: false, kind: "notfound" };
  const url = method === "PATCH" ? `${ENDPOINT}/${encodeURIComponent(leadId!)}` : ENDPOINT;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      // Public endpoint: no cookies, and the preflight stays simple.
      credentials: "omit",
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as { leadId?: unknown } | null;
      const id = typeof json?.leadId === "string" && UUID.test(json.leadId) ? json.leadId : undefined;
      return { ok: true, leadId: id };
    }
    if (res.status === 429) return { ok: false, kind: "rate" };
    if (res.status === 404) return { ok: false, kind: "notfound" };
    if (res.status === 400) {
      const json = (await res.json().catch(() => null)) as { details?: { formErrors?: unknown } } | null;
      const formErrors = json?.details?.formErrors;
      const legacy =
        Array.isArray(formErrors) && formErrors.some((m) => typeof m === "string" && /unrecognized key/i.test(m));
      return { ok: false, kind: legacy ? "legacy" : "invalid" };
    }
    return { ok: false, kind: "server" };
  } catch {
    // Offline, DNS, CORS or our timeout: the request didn't land.
    return { ok: false, kind: "network" };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Client-side checks (UX only; the server validates again)
// ---------------------------------------------------------------------------

/** Same shape the server's z.string().email() accepts, close enough for UX. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmaill.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.co": "outlook.com",
  "iclod.com": "icloud.com",
};

/** "jane@gmial.com" → "jane@gmail.com", or null when nothing looks off. */
export function emailTypoFix(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  const fix = DOMAIN_TYPOS[domain];
  return fix ? `${email.slice(0, at)}@${fix}` : null;
}

// ---------------------------------------------------------------------------
// Attribution (first touch, conversion plan §4.3). Never contains PII.
// ---------------------------------------------------------------------------

export type Attribution = {
  src?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPage?: string;
  referrerDomain?: string;
};

const STORE_KEY = "mcl_first_touch";
const UTM: [string, keyof Attribution][] = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_term", "utmTerm"],
  ["utm_content", "utmContent"],
];

/** Printable text only, clipped to the server's max so one long param can't 400 the lead. */
function clean(v: string | null | undefined, max: number): string | undefined {
  if (!v) return undefined;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return s || undefined;
}

/** `?src=` is an internal slug (home-hero, pricing-volume): keep it strict. */
export function cleanSrc(v: string | null | undefined): string | undefined {
  return v && /^[A-Za-z0-9_.-]{1,100}$/.test(v) ? v : undefined;
}

/**
 * Reads UTMs, src, landing page and referrer domain. First touch wins inside a
 * browser session (sessionStorage), so a later internal click can't overwrite
 * the campaign that brought the visitor in.
 */
export function readAttribution(): Attribution {
  let stored: Attribution = {};
  try {
    stored = JSON.parse(sessionStorage.getItem(STORE_KEY) || "{}") as Attribution;
  } catch {
    stored = {};
  }
  const q = new URLSearchParams(window.location.search);
  const now: Attribution = { src: cleanSrc(q.get("src")) };
  for (const [param, key] of UTM) now[key] = clean(q.get(param), 100);
  let referrerDomain: string | undefined;
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.host !== window.location.host) referrerDomain = clean(ref.hostname, 255);
  } catch {
    referrerDomain = undefined;
  }
  const first: Attribution = {
    utmSource: stored.utmSource ?? now.utmSource,
    utmMedium: stored.utmMedium ?? now.utmMedium,
    utmCampaign: stored.utmCampaign ?? now.utmCampaign,
    utmTerm: stored.utmTerm ?? now.utmTerm,
    utmContent: stored.utmContent ?? now.utmContent,
    landingPage: clean(stored.landingPage, 500) ?? clean(window.location.pathname, 500),
    referrerDomain: clean(stored.referrerDomain, 255) ?? referrerDomain,
  };
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(first));
  } catch {
    /* private mode: attribution is best effort */
  }
  // src describes this click, not the first touch.
  return { ...first, src: now.src };
}

/** Pushes an analytics event if a tag manager is present. Enumerated values only, never PII. */
export function track(event: string, props: Record<string, string | number> = {}) {
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event, ...props });
}
