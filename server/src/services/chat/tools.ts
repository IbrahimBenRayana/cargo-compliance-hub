/**
 * Assistant tools (OpenAI function-calling) + their server-side dispatch.
 *
 * SECURITY MODEL (read before editing):
 *   • Data tools NEVER accept an orgId/userId argument from the model. The
 *     org scope comes ONLY from `ctx.orgId`, which is derived from the verified
 *     JWT actor. A model (or a prompt-injected user) cannot widen the scope.
 *   • Data + deeplink tools are exposed ONLY on the 'app' surface. Anonymous
 *     marketing visitors get just escalate_to_human — no data access at all.
 *   • get_deeplink resolves against a fixed allowlist; the model cannot produce
 *     arbitrary URLs.
 */
import type { OpenAI } from 'openai';
import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import type { ChatSurface } from './knowledge/index.js';

type ToolDef = OpenAI.Chat.Completions.ChatCompletionTool;

// ─── Deep-link allowlist (keys mirror knowledge/appFeatures.ts) ──────
const DEEPLINKS: Record<string, { url: string; label: string }> = {
  dashboard:       { url: '/',                  label: 'Open Dashboard' },
  shipments:       { url: '/shipments',         label: 'Open Shipments' },
  new_shipment:    { url: '/shipments/new',     label: 'Start a new ISF filing' },
  compliance:      { url: '/compliance',        label: 'Open Compliance Center' },
  tracking:        { url: '/tracking',          label: 'Open Container Tracking' },
  manifest_query:  { url: '/manifest-query',    label: 'Open Manifest Query' },
  duty_calculator: { url: '/duty-calculator',   label: 'Open Duty Calculator' },
  abi_documents:   { url: '/abi-documents',     label: 'Open ABI Entry documents' },
  new_abi_entry:   { url: '/abi-documents/new', label: 'Start a new ABI Entry' },
  api_integrations:{ url: '/integrations/api',  label: 'Open API & Integrations' },
  submission_logs: { url: '/integrations/logs', label: 'Open Submission Logs' },
  settings:        { url: '/settings',          label: 'Open Settings' },
  team:            { url: '/team',              label: 'Open Team' },
  upgrade:         { url: '/upgrade',           label: 'Change plan / billing' },
};

// ─── Tool schemas ────────────────────────────────────────────────────
const getDeeplinkTool: ToolDef = {
  type: 'function',
  function: {
    name: 'get_deeplink',
    description:
      'Return a clickable in-app link to a feature/page so the user can jump straight there. Use when explaining where to do something.',
    parameters: {
      type: 'object',
      properties: {
        feature: {
          type: 'string',
          enum: Object.keys(DEEPLINKS),
          description: 'Which app area to link to.',
        },
      },
      required: ['feature'],
      additionalProperties: false,
    },
  },
};

const searchFilingsTool: ToolDef = {
  type: 'function',
  function: {
    name: 'search_user_filings',
    description:
      "Search the signed-in user's OWN organization's shipments/ISF filings. Use to answer 'show my recent filings', 'which of my shipments were rejected', etc. Returns up to 10 matches.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional free text matched against BOL numbers, consignee, importer, or vessel.',
        },
        status: {
          type: 'string',
          description: "Optional status filter, e.g. 'draft', 'submitted', 'accepted', 'rejected'.",
        },
      },
      additionalProperties: false,
    },
  },
};

const getFilingStatusTool: ToolDef = {
  type: 'function',
  function: {
    name: 'get_filing_status',
    description:
      "Look up the current status of one of the user's OWN shipments by a reference (Master BOL, House BOL, or shipment id). Use for 'what's the status of <ref>?'.",
    parameters: {
      type: 'object',
      properties: {
        reference: {
          type: 'string',
          description: 'A Master BOL, House BOL, or shipment id belonging to the user.',
        },
      },
      required: ['reference'],
      additionalProperties: false,
    },
  },
};

const escalateTool: ToolDef = {
  type: 'function',
  function: {
    name: 'escalate_to_human',
    description:
      "Hand the conversation to a human MyCargoLens specialist. Call this when the user explicitly asks for a person, is frustrated, or you cannot help accurately. After calling, briefly tell the user you're connecting them.",
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'A short summary of what the user needs help with (shown to the agent).',
        },
      },
      required: ['reason'],
      additionalProperties: false,
    },
  },
};

/** Tools available on a given surface. */
export function toolsForSurface(surface: ChatSurface): ToolDef[] {
  if (surface === 'app') {
    return [getDeeplinkTool, searchFilingsTool, getFilingStatusTool, escalateTool];
  }
  return [escalateTool]; // marketing: no data/deeplink access
}

// ─── Dispatch ─────────────────────────────────────────────────────────
export interface ToolContext {
  surface: ChatSurface;
  /** Verified org scope for data tools. null on the marketing surface. */
  orgId: string | null;
  /** Performs the real escalation side-effect (injected by the orchestrator). */
  escalate: (reason: string) => Promise<void>;
}

export interface ToolDispatchResult {
  /** JSON/string fed back to the model as the tool result. */
  content: string;
  /** Deep-link payload to persist/render in the UI, when get_deeplink was used. */
  deeplink?: { url: string; label: string };
  /** Set when escalate_to_human ran, so the orchestrator can stop early. */
  escalated?: boolean;
}

const SAFE_FILING_SELECT = {
  id: true,
  filingType: true,
  status: true,
  masterBol: true,
  houseBol: true,
  consigneeName: true,
  importerName: true,
  vesselName: true,
  filingDeadline: true,
  submittedAt: true,
  acceptedAt: true,
  rejectedAt: true,
  rejectionReason: true,
  estimatedDeparture: true,
  estimatedArrival: true,
} as const;

export async function dispatchTool(
  name: string,
  rawArgs: string,
  ctx: ToolContext,
): Promise<ToolDispatchResult> {
  let args: any = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { content: 'Error: could not parse tool arguments.' };
  }

  switch (name) {
    case 'get_deeplink': {
      if (ctx.surface !== 'app') return { content: 'Deep-links are not available here.' };
      const dl = DEEPLINKS[String(args.feature)];
      if (!dl) return { content: `Unknown feature "${args.feature}".` };
      return { content: JSON.stringify(dl), deeplink: dl };
    }

    case 'search_user_filings': {
      if (ctx.surface !== 'app' || !ctx.orgId) {
        return { content: 'No account data is available in this context.' };
      }
      const q = typeof args.query === 'string' ? args.query.trim() : '';
      const status = typeof args.status === 'string' ? args.status.trim() : '';
      const where: any = { orgId: ctx.orgId }; // scope is forced, never from the model
      if (status) where.status = status;
      if (q) {
        where.OR = [
          { masterBol: { contains: q, mode: 'insensitive' } },
          { houseBol: { contains: q, mode: 'insensitive' } },
          { consigneeName: { contains: q, mode: 'insensitive' } },
          { importerName: { contains: q, mode: 'insensitive' } },
          { vesselName: { contains: q, mode: 'insensitive' } },
        ];
      }
      const rows = await prisma.filing.findMany({
        where,
        select: SAFE_FILING_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      return { content: JSON.stringify({ count: rows.length, filings: rows }) };
    }

    case 'get_filing_status': {
      if (ctx.surface !== 'app' || !ctx.orgId) {
        return { content: 'No account data is available in this context.' };
      }
      const ref = typeof args.reference === 'string' ? args.reference.trim() : '';
      if (!ref) return { content: 'Please provide a BOL number or shipment id.' };
      const or: any[] = [
        { masterBol: { equals: ref, mode: 'insensitive' } },
        { houseBol: { equals: ref, mode: 'insensitive' } },
      ];
      // Only treat the ref as an id if it looks like a uuid (avoids a cast error).
      if (/^[0-9a-f-]{36}$/i.test(ref)) or.push({ id: ref });
      const filing = await prisma.filing.findFirst({
        where: { orgId: ctx.orgId, OR: or }, // org scope forced
        select: SAFE_FILING_SELECT,
      });
      if (!filing) {
        return { content: JSON.stringify({ found: false, reference: ref }) };
      }
      return { content: JSON.stringify({ found: true, filing }) };
    }

    case 'escalate_to_human': {
      const reason = typeof args.reason === 'string' ? args.reason.trim() : 'User requested a human agent.';
      try {
        await ctx.escalate(reason);
        return {
          content: JSON.stringify({ escalated: true }),
          escalated: true,
        };
      } catch (err: any) {
        logger.error({ err: err?.message }, '[Chat] escalate tool failed');
        return { content: 'Could not connect to a human right now; please email support@mycargolens.com.' };
      }
    }

    default:
      return { content: `Unknown tool "${name}".` };
  }
}
