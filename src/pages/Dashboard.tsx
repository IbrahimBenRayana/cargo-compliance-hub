import { useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useFilings, useFilingStats } from '@/hooks/useFilings';
import { Filing, getFirstCommodity } from '@/types/shipment';
import {
  Ship, Clock, Send, AlertTriangle, CheckCircle2, Plus, Eye, Pencil,
  ExternalLink, FileText, Shield, Globe, TrendingUp, Activity,
  Zap, BarChart3, Timer,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadialBarChart, RadialBar, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { cn } from '@/lib/utils';

// ─── Animated Counter ──────────────────────────────────────

function useAnimatedCounter(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);
  return value;
}

// ─── Helpers ───────────────────────────────────────────────

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function daysUntil(ts: string) {
  return Math.ceil((new Date(ts).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ─── Metric Card ───────────────────────────────────────────

function MetricCard({ label, value, icon: Icon, color, delay }: {
  label: string; value: number; icon: React.ElementType;
  color: string; delay: number;
}) {
  const count = useAnimatedCounter(value);
  return (
    <Card className={cn(
      'relative overflow-hidden opacity-0 animate-fade-in-up group cursor-default',
      'hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all duration-500 hover:-translate-y-1',
    )} style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}>
      <div className={cn('absolute inset-0 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity duration-500', color)} />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>
            <p className="text-4xl font-black tracking-tighter tabular-nums">{count}</p>
          </div>
          <div className={cn(
            'h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500',
            'group-hover:scale-110 group-hover:rotate-3',
            color,
          )}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Filing Pipeline ───────────────────────────────────────

function FilingPipeline({ filings }: { filings: Filing[] }) {
  const stages = useMemo(() => {
    const draftCount = filings.filter(f => f.status === 'draft').length;
    const submittedCount = filings.filter(f => f.status === 'submitted' || f.status === 'pending_cbp').length;
    const acceptedCount = filings.filter(f => f.status === 'accepted').length;
    const rejectedCount = filings.filter(f => f.status === 'rejected').length;
    return [
      { label: 'Draft', count: draftCount, icon: FileText, color: 'bg-slate-500', light: 'bg-slate-100 dark:bg-slate-800/50' },
      { label: 'Sent to CC', count: submittedCount, icon: Send, color: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-950/40' },
      { label: 'Accepted', count: acceptedCount, icon: CheckCircle2, color: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-950/40' },
      { label: 'Rejected', count: rejectedCount, icon: AlertTriangle, color: 'bg-red-500', light: 'bg-red-50 dark:bg-red-950/40' },
    ];
  }, [filings]);

  return (
    <div className="flex items-center gap-0">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center flex-1">
          <div className={cn('flex items-center gap-2.5 rounded-xl px-3 py-2.5 flex-1 min-w-0 transition-colors', s.light)}>
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', s.color)}>
              <s.icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold tabular-nums">{s.count}</p>
            </div>
          </div>
          {i < stages.length - 1 && (
            <div className="w-6 flex justify-center shrink-0">
              <div className="h-0.5 w-4 bg-border" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────

export default function Dashboard() {
  const { data: statsData, isLoading: statsLoading } = useFilingStats();
  const { data: filingsData, isLoading: filingsLoading } = useFilings({ sortBy: 'createdAt', sortOrder: 'desc', limit: 100 });

  const filings = filingsData?.data ?? [];
  const statusCounts = statsData?.statusCounts ?? {};
  const totalFilings = statsData?.total ?? 0;

  const accepted = statusCounts['accepted'] ?? 0;
  const rejected = statusCounts['rejected'] ?? 0;
  const submitted = statusCounts['submitted'] ?? 0;
  const draft = statusCounts['draft'] ?? 0;

  const complianceRate = useMemo(() => {
    const resolved = accepted + rejected;
    if (resolved === 0) return 100;
    return Math.round((accepted / resolved) * 100);
  }, [accepted, rejected]);

  const recentFilings = useMemo(() =>
    [...filings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
  [filings]);

  const deadlineFilings = useMemo(() =>
    filings
      .filter(f => (f.status === 'draft' || f.status === 'submitted') && f.filingDeadline)
      .sort((a, b) => new Date(a.filingDeadline!).getTime() - new Date(b.filingDeadline!).getTime())
      .slice(0, 5),
  [filings]);

  const statusData = useMemo(() => [
    { name: 'Draft', value: draft, fill: 'hsl(var(--status-draft))' },
    { name: 'Submitted', value: submitted, fill: 'hsl(var(--status-submitted))' },
    { name: 'Accepted', value: accepted, fill: 'hsl(var(--status-accepted))' },
    { name: 'Rejected', value: rejected, fill: 'hsl(var(--status-rejected))' },
  ].filter(d => d.value > 0), [draft, submitted, accepted, rejected]);

  const countryData = useMemo(() => {
    const counts: Record<string, number> = {};
    filings.forEach(f => {
      const c = getFirstCommodity(f).countryOfOrigin || 'N/A';
      counts[c] = (counts[c] || 0) + 1;
    });
    const flags: Record<string, string> = { CN: '\xf0\x9f\x87\xa8\xf0\x9f\x87\xb3', JP: '\xf0\x9f\x87\xaf\xf0\x9f\x87\xb5', VN: '\xf0\x9f\x87\xbb\xf0\x9f\x87\xb3', IN: '\xf0\x9f\x87\xae\xf0\x9f\x87\xb3', DE: '\xf0\x9f\x87\xa9\xf0\x9f\x87\xaa', US: '\xf0\x9f\x87\xba\xf0\x9f\x87\xb8', KR: '\xf0\x9f\x87\xb0\xf0\x9f\x87\xb7', TW: '\xf0\x9f\x87\xb9\xf0\x9f\x87\xbc', TH: '\xf0\x9f\x87\xb9\xf0\x9f\x87\xad', MX: '\xf0\x9f\x87\xb2\xf0\x9f\x87\xbd', BD: '\xf0\x9f\x87\xa7\xf0\x9f\x87\xa9' };
    const colors = ['hsl(220, 70%, 55%)', 'hsl(142, 60%, 45%)', 'hsl(38, 90%, 50%)', 'hsl(0, 65%, 50%)', 'hsl(280, 55%, 55%)', 'hsl(180, 50%, 45%)'];
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([code, val], i) => ({ name: (flags[code] || '') + ' ' + code, value: val, fill: colors[i % colors.length] }));
  }, [filings]);

  const weeklyData = useMemo(() => {
    const weeks: Record<string, { total: number; accepted: number; rejected: number }> = {};
    filings.forEach(f => {
      const d = new Date(f.createdAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!weeks[label]) weeks[label] = { total: 0, accepted: 0, rejected: 0 };
      weeks[label].total++;
      if (f.status === 'accepted') weeks[label].accepted++;
      if (f.status === 'rejected') weeks[label].rejected++;
    });
    return Object.entries(weeks).map(([week, d]) => ({ week, ...d })).slice(-8);
  }, [filings]);

  const complianceData = useMemo(() => [{
    name: 'Score', value: complianceRate,
    fill: complianceRate > 80 ? 'hsl(142, 71%, 45%)' : complianceRate > 60 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 51%)',
  }], [complianceRate]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const isLoading = statsLoading || filingsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <Skeleton className="h-12 w-72 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{greeting} <span role="img" aria-label="wave">👋</span></h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {' \u00b7 '}
            <span className="font-medium text-foreground">{totalFilings} total filings</span>
          </p>
        </div>
        <Link to="/shipments/new">
          <Button size="default" className="gap-2 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">
            <Plus className="h-4 w-4" /> New ISF Filing
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Filings" value={totalFilings} icon={Ship} color="bg-blue-500" delay={80} />
        <MetricCard label="Draft" value={draft} icon={Clock} color="bg-amber-500" delay={160} />
        <MetricCard label="Submitted to CBP" value={submitted + accepted} icon={Send} color="bg-emerald-500" delay={240} />
        <MetricCard label="Rejected" value={rejected} icon={AlertTriangle} color="bg-red-500" delay={320} />
      </div>

      {/* Filing Pipeline */}
      <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '380ms', animationFillMode: 'forwards' }}>
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">ISF Filing Pipeline</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <FilingPipeline filings={filings} />
        </CardContent>
      </Card>

      {/* Main Content: Table + Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Filings Table */}
        <Card className="lg:col-span-2 opacity-0 animate-fade-in-up" style={{ animationDelay: '440ms', animationFillMode: 'forwards' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Recent ISF Filings</CardTitle>
                <Badge variant="secondary" className="text-[10px] ml-1">{totalFilings}</Badge>
              </div>
              <Link to="/shipments">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
                  View All <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden rounded-b-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 h-9">BOL</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 h-9">Importer</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 h-9">Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 h-9">Created</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 h-9 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentFilings.map((f, i) => (
                    <TableRow
                      key={f.id}
                      className="group/row opacity-0 animate-fade-in-up hover:bg-muted/40 transition-colors"
                      style={{ animationDelay: `${480 + i * 50}ms`, animationFillMode: 'forwards' }}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0">
                            <Ship className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div>
                            <Link to={`/shipments/${f.id}`} className="font-semibold text-sm hover:text-primary transition-colors">
                              {f.houseBol || f.masterBol || '\u2014'}
                            </Link>
                            <p className="text-[10px] text-muted-foreground font-mono">{f.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm">{f.importerName || '\u2014'}</span>
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusBadge status={f.status} />
                      </TableCell>
                      <TableCell className="py-3">
                        <div>
                          <span className="text-xs tabular-nums">{new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          <p className="text-[10px] text-muted-foreground">{relativeTime(f.createdAt)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" asChild>
                            <Link to={`/shipments/${f.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                          </Button>
                          {f.status === 'draft' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" asChild>
                              <Link to={`/shipments/${f.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {recentFilings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">No filings yet</p>
                            <p className="text-sm text-muted-foreground mt-1">Create your first ISF filing to get started</p>
                          </div>
                          <Link to="/shipments/new">
                            <Button size="sm" className="mt-1"><Plus className="h-3.5 w-3.5 mr-1" /> New Filing</Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: Status Donut + Compliance */}
        <div className="space-y-6">
          <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '520ms', animationFillMode: 'forwards' }}>
            <CardHeader className="pb-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {totalFilings > 0 ? (
                <>
                  <ChartContainer config={{
                    draft: { label: 'Draft', color: 'hsl(var(--status-draft))' },
                    submitted: { label: 'Submitted', color: 'hsl(var(--status-submitted))' },
                    accepted: { label: 'Accepted', color: 'hsl(var(--status-accepted))' },
                    rejected: { label: 'Rejected', color: 'hsl(var(--status-rejected))' },
                  }} className="mx-auto aspect-square max-h-[200px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} strokeWidth={3} stroke="hsl(var(--background))" paddingAngle={2}>
                        {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-3xl font-black">{totalFilings}</text>
                      <text x="50%" y="58%" textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-[10px] font-medium uppercase tracking-wider">Filings</text>
                    </PieChart>
                  </ChartContainer>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {statusData.map(s => (
                      <div key={s.name} className="flex items-center gap-2 text-xs rounded-lg bg-muted/40 px-2.5 py-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                        <span className="text-muted-foreground flex-1">{s.name}</span>
                        <span className="font-bold tabular-nums">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">No filings data</div>
              )}
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}>
            <CardHeader className="pb-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Compliance Rate</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-2">
              <div className="relative h-[160px] w-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="72%" outerRadius="92%" startAngle={90} endAngle={-270} data={complianceData} barSize={12}>
                    <RadialBar dataKey="value" cornerRadius={10} background={{ fill: 'hsl(var(--muted))' }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black tabular-nums">{complianceRate}%</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {complianceRate > 80 ? 'Excellent' : complianceRate > 60 ? 'Good' : 'Needs Work'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 w-full">
                <div className="text-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30 py-2">
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{accepted}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Accepted</p>
                </div>
                <div className="text-center rounded-lg bg-red-50 dark:bg-red-950/30 py-2">
                  <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{rejected}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '680ms', animationFillMode: 'forwards' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Filings Over Time</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {weeklyData.length > 0 ? (
              <ChartContainer config={{
                total: { label: 'Total', color: 'hsl(var(--primary))' },
                accepted: { label: 'Accepted', color: 'hsl(142, 71%, 45%)' },
              }} className="h-[240px]">
                <AreaChart data={weeklyData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="acceptedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                  <YAxis tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#totalGrad)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="accepted" stroke="hsl(142, 71%, 45%)" fill="url(#acceptedGrad)" strokeWidth={2} strokeDasharray="4 4" />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                No filing history yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '760ms', animationFillMode: 'forwards' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Country of Origin</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {countryData.length > 0 ? (
              <>
                <ChartContainer config={{}} className="mx-auto aspect-square max-h-[200px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie data={countryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} strokeWidth={3} stroke="hsl(var(--background))" paddingAngle={2}>
                      {countryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {countryData.map(c => (
                    <div key={c.name} className="flex items-center gap-2 text-xs px-2 py-1">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.fill }} />
                      <span className="text-muted-foreground flex-1 truncate">{c.name}</span>
                      <span className="font-bold tabular-nums">{c.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                No origin data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deadlines + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 opacity-0 animate-fade-in-up" style={{ animationDelay: '840ms', animationFillMode: 'forwards' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Upcoming Deadlines</CardTitle>
              {deadlineFilings.length > 0 && (
                <Badge variant="outline" className="text-[10px] ml-1">{deadlineFilings.length} pending</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {deadlineFilings.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">No pending deadlines</p>
              </div>
            ) : deadlineFilings.map((f, i) => {
              const days = daysUntil(f.filingDeadline!);
              const isUrgent = days <= 3;
              const isWarning = days <= 7;
              const totalWindow = new Date(f.filingDeadline!).getTime() - new Date(f.createdAt).getTime();
              const elapsed = Date.now() - new Date(f.createdAt).getTime();
              const progress = totalWindow > 0 ? Math.min(Math.max(elapsed / totalWindow, 0), 1) * 100 : 0;

              return (
                <div key={f.id}
                  className={cn(
                    'rounded-xl border p-3 space-y-2 transition-all duration-200 opacity-0 animate-fade-in-up hover:bg-muted/30',
                    isUrgent && 'border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10',
                    isWarning && !isUrgent && 'border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10',
                  )}
                  style={{ animationDelay: `${880 + i * 60}ms`, animationFillMode: 'forwards' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link to={`/shipments/${f.id}`} className="font-semibold text-sm hover:text-primary transition-colors truncate">
                        {f.houseBol || f.masterBol || f.id.slice(0, 8)}
                      </Link>
                      <StatusBadge status={f.status} />
                    </div>
                    <span className={cn(
                      'text-xs font-bold tabular-nums shrink-0 px-2 py-0.5 rounded-full',
                      isUrgent ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                      isWarning ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                      'bg-muted text-muted-foreground',
                    )}>
                      {days <= 0 ? 'OVERDUE' : days + 'd left'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all animate-progress-fill',
                          isUrgent ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500',
                        )}
                        style={{ width: progress + '%' }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {new Date(f.filingDeadline!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 opacity-0 animate-fade-in-up" style={{ animationDelay: '920ms', animationFillMode: 'forwards' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/shipments/new" className="block">
              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3.5 hover:bg-primary/10 hover:border-primary/50 transition-all cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Plus className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Create New ISF Filing</p>
                    <p className="text-[11px] text-muted-foreground">Start a new Importer Security Filing</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to="/shipments" className="block">
              <div className="rounded-xl border p-3.5 hover:bg-muted/50 transition-all cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                    <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">View All Filings</p>
                    <p className="text-[11px] text-muted-foreground">{totalFilings} filings total</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to="/submission-logs" className="block">
              <div className="rounded-xl border p-3.5 hover:bg-muted/50 transition-all cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                    <Activity className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">API Submission Logs</p>
                    <p className="text-[11px] text-muted-foreground">View CBP submission history</p>
                  </div>
                </div>
              </div>
            </Link>

            <Separator className="my-3" />

            <div className="rounded-xl bg-muted/30 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Filing Process</p>
              <div className="space-y-1.5">
                {[
                  { step: '1', label: 'Create ISF', desc: 'Fill out all required fields' },
                  { step: '2', label: 'Validate', desc: 'Check for errors before sending' },
                  { step: '3', label: 'Prepare Filing', desc: 'Prepare document for submission' },
                  { step: '4', label: 'Send to CBP', desc: 'Transmit filing to U.S. Customs' },
                ].map((s) => (
                  <div key={s.step} className="flex items-center gap-2.5 text-xs">
                    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">{s.step}</span>
                    <div className="min-w-0">
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted-foreground ml-1">{'\u2014'} {s.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
