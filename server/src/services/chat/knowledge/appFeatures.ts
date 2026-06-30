/**
 * In-app feature guide for the authenticated assistant. Tells the model what
 * each part of the app does and the canonical `feature` keys it can pass to the
 * get_deeplink tool. The keys here MUST match DEEPLINKS in services/chat/tools.ts.
 */
export const APP_FEATURES_KB = `
# Navigating the MyCargoLens app

When a user asks where to do something or how to use a tool, briefly explain it
and offer a deep-link by calling the get_deeplink tool with the matching
\`feature\` key below. Only use these keys (others won't resolve). Some areas are
gated by the org's plan tier — if a user lacks the capability, tell them their
plan doesn't include it and offer the upgrade link (feature "upgrade").

- **dashboard** (/) — home overview: attention items, recent shipments, scores.
- **shipments** (/shipments) — list of all shipments/ISF filings.
- **new_shipment** (/shipments/new) — start a new ISF filing (the shipment wizard).
- **compliance** (/compliance) — Compliance Center: risk scores, validation,
  and the AI Coach that explains CBP rejections.
- **tracking** (/tracking) — container tracking (Complete plan / CONTAINER_TRACKING).
- **manifest_query** (/manifest-query) — query CBP manifest (MBOL) data. Always free.
- **duty_calculator** (/duty-calculator) — HTS duty calculator (Complete plan /
  HTS_CLASSIFICATION).
- **abi_documents** (/abi-documents) — ABI Entry documents (7501 / 3461)
  (ISF+Entry or Complete / ABI_ENTRY).
- **new_abi_entry** (/abi-documents/new) — start a new ABI Entry (entry wizard).
- **api_integrations** (/integrations/api) — API keys for the public API.
- **submission_logs** (/integrations/logs) — history of CBP/CC submissions.
- **settings** (/settings) — org settings, billing, notification preferences.
- **team** (/team) — invite/manage team members and roles.
- **upgrade** (/upgrade) — change plan tier / add a card.

# How common tasks work

- **File an ISF**: shipments → New shipment → fill the wizard → submit. The
  Compliance Center pre-flight review flags issues before submission.
- **A filing was rejected**: open the shipment, read the AI Coach explanation of
  the CBP reason code and the suggested fix, correct the data, resubmit
  (resubmitting the same filing never re-charges).
- **File an Entry (7501/3461)**: ABI Entry documents → New entry (requires the
  ABI_ENTRY capability).
- **Track a container**: Tracking (requires CONTAINER_TRACKING).
- **Classify goods / estimate duty**: Duty calculator (requires HTS_CLASSIFICATION).
- **Check a shipment's status**: ask the assistant directly ("what's the status
  of <BOL or shipment>?") and it can look it up, or open the shipment in Shipments.
`.trim();
