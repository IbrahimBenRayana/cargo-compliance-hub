import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { complianceApi } from '@/api/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FILL, TINT } from '@/components/dashboard/tones';
import { cn } from '@/lib/utils';
import { OverviewTab } from '@/components/compliance/OverviewTab';
import { RiskTab } from '@/components/compliance/RiskTab';
import { RecordsTab } from '@/components/compliance/RecordsTab';
import { ClassificationTab } from '@/components/compliance/ClassificationTab';
import { RejectionCoachDrawer } from '@/components/compliance/RejectionCoachDrawer';

/**
 * Compliance Center — top-level page.
 *
 * Tabs:
 *   • Overview      — score + 3-stat strip + action queue (this is the
 *                     "what needs my attention right now" surface)
 *   • Risk          — UFLPA scan + PGA lookup + 5106 self-check
 *   • Classification — placeholder for v2 (HTS, ADD/CVD, FTA preference)
 *   • Records       — liquidation tracker + protest deadlines
 *
 * The AI Coach drawer lives at the page level so any tab can trigger it.
 * Overview rows + Risk/Records details all flow through the same instance.
 * URL-synced via ?tab=… for deep-link from notifications/emails.
 */
export default function CompliancePage() {
  const [search, setSearch] = useSearchParams();
  const active = (search.get('tab') ?? 'overview') as TabId;

  const { data: aiStatus } = useQuery({
    queryKey: ['compliance', 'ai-status'],
    queryFn: () => complianceApi.aiStatus(),
    staleTime: 5 * 60_000,
  });

  // Cross-tab counter — total open items in the action queue.
  // Surfaced as a subtle badge next to the Overview tab label so users
  // know there's work waiting even if they're on another tab.
  const { data: queueData } = useQuery({
    queryKey: ['compliance', 'action-queue'],
    queryFn: () => complianceApi.actionQueue(),
    staleTime: 60_000,
  });

  // Page-level AI Coach drawer state. Any child component can call
  // openAiCoach(filingId, mode) to slide it in.
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachFilingId, setCoachFilingId] = useState<string | null>(null);
  const [coachMode, setCoachMode] = useState<'rejection' | 'draft-review'>('draft-review');
  function openAiCoach(filingId: string, mode: 'rejection' | 'draft-review') {
    setCoachFilingId(filingId);
    setCoachMode(mode);
    setCoachOpen(true);
  }

  function setTab(t: TabId) {
    const next = new URLSearchParams(search);
    next.set('tab', t);
    setSearch(next, { replace: true });
  }

  const actionCount = queueData?.counts.total ?? 0;

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">Compliance</h1>
          <p className="text-[13px] text-muted-foreground">Your score, what needs attention, and what to watch after CBP accepts a filing.</p>
        </div>
        {aiStatus && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', aiStatus.enabled ? FILL.done : FILL.calm)} />
            AI coach {aiStatus.enabled ? 'on' : 'off'}
          </p>
        )}
      </header>

      <Tabs value={active} onValueChange={(v) => setTab(v as TabId)} className="flex flex-col gap-5">
        <TabsList className="h-auto w-full justify-start gap-5 overflow-x-auto overflow-y-hidden rounded-none border-b border-border/70 bg-transparent p-0 [scrollbar-width:none] [&>*]:shrink-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="-mb-px rounded-none border-b-2 border-transparent px-0 pb-2.5 pt-1 text-[13px] font-medium text-muted-foreground shadow-none transition-colors duration-150 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none can-hover:hover:text-foreground"
            >
              {t.label}
              {t.id === 'overview' && actionCount > 0 && (
                <span className={cn('ml-1.5 rounded-md px-1.5 py-px text-[11.5px] font-medium tabular-nums', TINT.urgent)}>
                  {actionCount > 99 ? '99+' : actionCount}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab onOpenAiCoach={openAiCoach} />
        </TabsContent>
        <TabsContent value="risk" className="mt-0">
          <RiskTab />
        </TabsContent>
        <TabsContent value="classification" className="mt-0">
          <ClassificationTab />
        </TabsContent>
        <TabsContent value="records" className="mt-0">
          <RecordsTab />
        </TabsContent>
      </Tabs>

      {/* Page-level AI Coach drawer */}
      <RejectionCoachDrawer
        open={coachOpen}
        onOpenChange={setCoachOpen}
        mode={coachMode}
        filingId={coachFilingId}
      />
    </div>
  );
}

// ─── Tabs config ─────────────────────────────────────────────────────

type TabId = 'overview' | 'risk' | 'classification' | 'records';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'risk', label: 'Risk and watch' },
  { id: 'classification', label: 'Classification' },
  { id: 'records', label: 'Records' },
];
