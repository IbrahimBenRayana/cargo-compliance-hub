/**
 * Tool dispatch security. The single highest-severity risk in the chat feature
 * is an org-data leak: a prompt-injected user (or a confused model) supplying an
 * orgId/userId argument and reading another tenant's filings. These tests pin
 * the invariant that the org scope ALWAYS comes from the verified actor, never
 * from tool arguments — and that marketing/anon callers get no data access.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: { filing: { findMany: vi.fn(), findFirst: vi.fn() } },
}));
vi.mock('../../../config/database.js', () => ({ prisma }));
vi.mock('../../../config/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { dispatchTool, toolsForSurface, type ToolContext } from '../tools.js';

const appCtx: ToolContext = { surface: 'app', orgId: 'ORG_A', escalate: vi.fn() };

beforeEach(() => {
  prisma.filing.findMany.mockReset();
  prisma.filing.findFirst.mockReset();
});

describe('toolsForSurface', () => {
  const toolName = (t: { type: string; function?: { name: string } }) =>
    t.type === 'function' ? t.function!.name : t.type;
  it('gives the app surface data + deeplink tools', () => {
    const names = toolsForSurface('app').map(toolName);
    expect(names).toEqual(expect.arrayContaining(['get_deeplink', 'search_user_filings', 'get_filing_status', 'escalate_to_human']));
  });
  it('gives the marketing surface only escalation', () => {
    const names = toolsForSurface('marketing').map(toolName);
    expect(names).toEqual(['escalate_to_human']);
  });
});

describe('search_user_filings org scoping', () => {
  it('forces where.orgId to the actor org and ignores a model-supplied orgId', async () => {
    prisma.filing.findMany.mockResolvedValue([]);
    await dispatchTool('search_user_filings', JSON.stringify({ query: 'ACME', orgId: 'ORG_EVIL', userId: 'EVIL' }), appCtx);
    expect(prisma.filing.findMany).toHaveBeenCalledTimes(1);
    const arg = prisma.filing.findMany.mock.calls[0][0];
    expect(arg.where.orgId).toBe('ORG_A');
    // The injected scope must not appear anywhere in the where clause.
    expect(JSON.stringify(arg.where)).not.toContain('ORG_EVIL');
    expect(arg.take).toBe(10);
  });

  it('returns no data on the marketing surface', async () => {
    const res = await dispatchTool('search_user_filings', '{}', { surface: 'marketing', orgId: null, escalate: vi.fn() });
    expect(prisma.filing.findMany).not.toHaveBeenCalled();
    expect(res.content).toMatch(/no account data/i);
  });
});

describe('get_filing_status org scoping', () => {
  it('scopes findFirst to the actor org', async () => {
    prisma.filing.findFirst.mockResolvedValue(null);
    await dispatchTool('get_filing_status', JSON.stringify({ reference: 'MBOL123', orgId: 'ORG_EVIL' }), appCtx);
    const arg = prisma.filing.findFirst.mock.calls[0][0];
    expect(arg.where.orgId).toBe('ORG_A');
    expect(JSON.stringify(arg.where)).not.toContain('ORG_EVIL');
  });
});

describe('get_deeplink', () => {
  it('resolves an allowlisted feature and rejects unknown ones', async () => {
    const ok = await dispatchTool('get_deeplink', JSON.stringify({ feature: 'duty_calculator' }), appCtx);
    expect(ok.deeplink).toEqual({ url: '/duty-calculator', label: expect.any(String) });
    const bad = await dispatchTool('get_deeplink', JSON.stringify({ feature: 'https://evil.example' }), appCtx);
    expect(bad.deeplink).toBeUndefined();
  });
});

describe('escalate_to_human', () => {
  it('invokes the injected escalate side-effect', async () => {
    const escalate = vi.fn().mockResolvedValue(undefined);
    const res = await dispatchTool('escalate_to_human', JSON.stringify({ reason: 'help' }), { surface: 'marketing', orgId: null, escalate });
    expect(escalate).toHaveBeenCalledWith('help');
    expect(res.escalated).toBe(true);
  });
});
