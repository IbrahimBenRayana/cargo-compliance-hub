import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { complianceApi } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Health tab — top-of-funnel compliance dashboard.
 *
 * Four KPI tiles + a weekly rejection-rate trend (13 weeks) + top-5
 * rejection reasons + a deep-link list of recently-rejected filings.
 * Empty states are handled per-tile so a fresh org doesn't see broken charts.
 */
export function HealthTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance', 'health-summary'],
    queryFn: () => complianceApi.healthSummary(),
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const rejectionRate =
    data.totals.all > 0 ? Math.round((data.totals.rejected / data.totals.all) * 100) : null;

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Compliance score"
          value={data.score === null ? '—' : `${data.score}%`}
          tone={
            data.score === null ? 'neutral'
            : data.score >= 90 ? 'emerald'
            : data.score >= 70 ? 'amber'
            : 'rose'
          }
          sub="Last 90 days"
        />
        <KpiTile
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Accepted"
          value={data.totals.accepted.toString()}
          tone="emerald"
          sub={`of ${data.totals.all} total`}
        />
        <KpiTile
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Rejected"
          value={data.totals.rejected.toString()}
          tone={data.totals.rejected === 0 ? 'neutral' : 'rose'}
          sub={rejectionRate === null ? '—' : `${rejectionRate}% rate`}
        />
        <KpiTile
          icon={<Clock className="h-3.5 w-3.5" />}
          label="On-time"
          value={
            data.deadlineAdherence.rate === null ? '—' : `${data.deadlineAdherence.rate}%`
          }
          tone={
            data.deadlineAdherence.rate === null ? 'neutral'
            : data.deadlineAdherence.rate >= 95 ? 'emerald'
            : data.deadlineAdherence.rate >= 80 ? 'amber'
            : 'rose'
          }
          sub={
            data.deadlineAdherence.trackable > 0
              ? `${data.deadlineAdherence.onTime}/${data.deadlineAdherence.trackable} on time`
              : 'Not enough data'
          }
        />
      </div>

      {/* Rejection trend chart */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Rejection trend
              </h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                Weekly volume + rejections, last 13 weeks
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weeklyTrend}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="roseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(226 232 240 / 0.6)" />
                <XAxis
                  dataKey="weekStart"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(d) => d.slice(5)}  /* MM-DD */
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    border: '1px solid rgb(226 232 240)',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#goldGrad)"
                  name="Total"
                />
                <Area
                  type="monotone"
                  dataKey="rejected"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fill="url(#roseGrad)"
                  name="Rejected"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top rejection reasons + recently rejected */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 border-slate-200 dark:border-slate-800">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-1">
              Top rejection reasons
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-3">
              Last 90 days — fix the top ones to lift your score fast
            </p>
            {data.topReasons.length === 0 ? (
              <EmptyHint message="No rejections in the last 90 days. Nice." />
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={data.topReasons}>
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="reason"
                      width={180}
                      tick={{ fontSize: 11, fill: '#475569' }}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                        border: '1px solid rgb(226 232 240)',
                        borderRadius: 8,
                        padding: '8px 10px',
                      }}
                    />
                    <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]}>
                      {data.topReasons.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            i === 0 ? '#dc2626'
                            : i === 1 ? '#f43f5e'
                            : i === 2 ? '#fb7185'
                            : '#fda4af'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-1">
              Recently rejected
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-3">
              Click to open the AI Rejection Coach
            </p>
            {data.recentRejectedFilings.length === 0 ? (
              <EmptyHint message="No recent rejections." />
            ) : (
              <ul className="space-y-1.5">
                {data.recentRejectedFilings.map((f) => (
                  <li key={f.id}>
                    <Link
                      to={`/shipments/${f.id}`}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 px-3 py-2 transition-colors duration-200"
                    >
                      <span className="text-[12.5px] font-mono text-slate-700 dark:text-slate-300 truncate">
                        {f.id.slice(0, 8)}…
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

type Tone = 'emerald' | 'amber' | 'rose' | 'neutral';

const TONE_STYLES: Record<Tone, { bg: string; ring: string; icon: string; value: string }> = {
  emerald: {
    bg:    'bg-emerald-50/80 dark:bg-emerald-500/10',
    ring:  'ring-emerald-200/60 dark:ring-emerald-500/20',
    icon:  'text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    bg:    'bg-amber-50/80 dark:bg-amber-500/10',
    ring:  'ring-amber-200/60 dark:ring-amber-500/20',
    icon:  'text-amber-600 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
  },
  rose: {
    bg:    'bg-rose-50/80 dark:bg-rose-500/10',
    ring:  'ring-rose-200/60 dark:ring-rose-500/20',
    icon:  'text-rose-600 dark:text-rose-400',
    value: 'text-rose-700 dark:text-rose-300',
  },
  neutral: {
    bg:    'bg-slate-50 dark:bg-slate-900',
    ring:  'ring-slate-200 dark:ring-slate-800',
    icon:  'text-slate-500 dark:text-slate-400',
    value: 'text-slate-900 dark:text-slate-50',
  },
};

function KpiTile({
  icon,
  label,
  value,
  tone,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: Tone;
  sub?: string;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div className={cn('rounded-xl px-4 py-3 ring-1 transition-colors duration-200', t.bg, t.ring)}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={cn(t.icon)}>{icon}</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          {label}
        </span>
      </div>
      <div className={cn('text-[22px] font-semibold leading-none tabular-nums', t.value)}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{sub}</div>
      )}
    </div>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-[12.5px] text-slate-400 dark:text-slate-500">
      {message}
    </div>
  );
}
