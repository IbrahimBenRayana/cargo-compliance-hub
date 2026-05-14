import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, ShieldCheck, BookOpen, Archive, Activity } from 'lucide-react';
import { complianceApi } from '@/api/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { OverviewTab } from '@/components/compliance/OverviewTab';
import { RiskTab } from '@/components/compliance/RiskTab';
import { RecordsTab } from '@/components/compliance/RecordsTab';
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
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400 mb-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Compliance Center
          </div>
          <h1 className="text-[28px] font-semibold leading-tight text-slate-900 dark:text-slate-50">
            Your CBP compliance, at a glance.
          </h1>
          <p className="text-[13.5px] text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
            Health score, prioritised action queue, and post-acceptance tracking for every shipment your team imports into the United States.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-1">
          {aiStatus?.enabled ? (
            <Badge variant="outline" className="gap-1.5 bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 text-[10.5px] font-semibold uppercase tracking-[0.08em]">
              <Sparkles className="h-3 w-3" />
              AI Coach on
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              AI Coach off
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={active} onValueChange={(v) => setTab(v as TabId)} className="space-y-4">
        <TabsList className="bg-transparent p-0 h-auto border-b border-slate-200 dark:border-slate-800 w-full justify-start rounded-none gap-1">
          {TABS.map((t) => {
            const isOverview = t.id === 'overview';
            return (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-4 py-2.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                <t.icon className="h-3.5 w-3.5 mr-1.5" />
                {t.label}
                {isOverview && actionCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 text-[10px] font-bold tabular-nums px-1.5 min-w-[18px] h-[18px]">
                    {actionCount > 99 ? '99+' : actionCount}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab onOpenAiCoach={openAiCoach} />
        </TabsContent>
        <TabsContent value="risk" className="mt-4">
          <RiskTab />
        </TabsContent>
        <TabsContent value="classification" className="mt-4">
          <ClassificationPlaceholder />
        </TabsContent>
        <TabsContent value="records" className="mt-4">
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

const TABS: Array<{ id: TabId; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'overview',       label: 'Overview',        icon: Activity },
  { id: 'risk',           label: 'Risk & Watch',    icon: ShieldCheck },
  { id: 'classification', label: 'Classification',  icon: BookOpen },
  { id: 'records',        label: 'Records',         icon: Archive },
];

// ─── Classification placeholder ─────────────────────────────────────

function ClassificationPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/20 px-10 py-16 text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-500/15 ring-1 ring-amber-200 dark:ring-amber-500/30 flex items-center justify-center mb-4">
        <BookOpen className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className="text-[16px] font-semibold text-slate-900 dark:text-slate-50 mb-1.5">
        Classification & Rules — coming next
      </h3>
      <p className="text-[13px] text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
        Standalone HTS classifier, ADD/CVD lookup against Commerce's active orders list, and FTA preference calculator (USMCA, GSP). Building this next.
      </p>
      <Badge variant="outline" className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        In development
      </Badge>
    </div>
  );
}
