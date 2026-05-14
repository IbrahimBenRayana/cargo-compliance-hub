import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, ShieldCheck, Activity, BookOpen, Archive } from 'lucide-react';
import { complianceApi } from '@/api/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { HealthTab } from '@/components/compliance/HealthTab';
import { RiskTab } from '@/components/compliance/RiskTab';
import { RecordsTab } from '@/components/compliance/RecordsTab';

/**
 * Compliance Center — top-level page with four tabs:
 *   • Health        — score + rejection trend + top issues + KPIs
 *   • Risk          — UFLPA scan + PGA lookup + 5106 self-check
 *   • Classification — placeholder for v2 (HTS standalone, FTA preference, ADD/CVD)
 *   • Records       — liquidation tracker + protest deadlines
 *
 * Tab selection is URL-synced via ?tab=… so the page is deep-linkable
 * from notifications / emails / dashboards.
 *
 * The AI Coach feature toggles based on /compliance/ai-status — if the
 * server has no AI_API_KEY, the AI badge in the header reads "AI off"
 * and AI buttons elsewhere in the app are hidden.
 */
export default function CompliancePage() {
  const [search, setSearch] = useSearchParams();
  const active = (search.get('tab') ?? 'health') as TabId;

  const { data: aiStatus } = useQuery({
    queryKey: ['compliance', 'ai-status'],
    queryFn: () => complianceApi.aiStatus(),
    staleTime: 5 * 60_000,
  });

  function setTab(t: TabId) {
    const next = new URLSearchParams(search);
    next.set('tab', t);
    setSearch(next, { replace: true });
  }

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
            Your CBP compliance health, at a glance.
          </h1>
          <p className="text-[13.5px] text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
            Health metrics, risk surfaces, and post-acceptance tracking for every shipment your team imports into the United States.
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
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-4 py-2.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <t.icon className="h-3.5 w-3.5 mr-1.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="health" className="mt-4">
          <HealthTab />
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
    </div>
  );
}

// ─── Tabs config ─────────────────────────────────────────────────────

type TabId = 'health' | 'risk' | 'classification' | 'records';

const TABS: Array<{ id: TabId; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'health',         label: 'Health',          icon: Activity },
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
