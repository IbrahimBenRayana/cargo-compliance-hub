import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { mockShipments, mockActivity, mockWeeklyFilings, mockComplianceScore } from '@/data/mock-data';
import { Ship, Clock, Send, AlertTriangle, ArrowUpRight, AlertCircle, CheckCircle2, Plus, TrendingUp, TrendingDown, Eye, Pencil, ExternalLink } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

// --- Animated Counter Hook ---
function useAnimatedCounter(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);
  return value;
}

// --- Relative time ---
function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// --- KPI Data ---
const kpis = [
  { label: 'Total Shipments', value: mockShipments.length, icon: Ship, trend: '+12%', trendUp: true, gradient: 'from-primary/20 to-primary/5' },
  { label: 'Pending Filings', value: mockShipments.filter(s => s.status === 'draft').length, icon: Clock, trend: '-8%', trendUp: false, gradient: 'from-[hsl(var(--status-warning)/0.2)] to-[hsl(var(--status-warning)/0.05)]' },
  { label: 'Submitted Today', value: mockShipments.filter(s => s.status === 'submitted').length, icon: Send, trend: '+25%', trendUp: true, gradient: 'from-[hsl(var(--status-submitted)/0.2)] to-[hsl(var(--status-submitted)/0.05)]' },
  { label: 'Rejections', value: mockShipments.filter(s => s.status === 'rejected').length, icon: AlertTriangle, trend: '-50%', trendUp: false, gradient: 'from-destructive/20 to-destructive/5' },
];

// --- Status Donut Data ---
const statusData = [
  { name: 'Draft', value: mockShipments.filter(s => s.status === 'draft').length, fill: 'hsl(var(--status-draft))' },
  { name: 'Submitted', value: mockShipments.filter(s => s.status === 'submitted').length, fill: 'hsl(var(--status-submitted))' },
  { name: 'Accepted', value: mockShipments.filter(s => s.status === 'accepted').length, fill: 'hsl(var(--status-accepted))' },
  { name: 'Rejected', value: mockShipments.filter(s => s.status === 'rejected').length, fill: 'hsl(var(--status-rejected))' },
];

// --- Country Donut Data ---
const countryData = (() => {
  const counts: Record<string, number> = {};
  mockShipments.forEach(s => {
    const c = s.productInfo.countryOfOrigin;
    counts[c] = (counts[c] || 0) + 1;
  });
  const colors = ['hsl(220, 70%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)'];
  const flags: Record<string, string> = { CN: '🇨🇳', JP: '🇯🇵', VN: '🇻🇳', IN: '🇮🇳', DE: '🇩🇪' };
  return Object.entries(counts).map(([code, val], i) => ({
    name: `${flags[code] || ''} ${code}`,
    value: val,
    fill: colors[i % colors.length],
  }));
})();

// --- Compliance Radial Data ---
const complianceData = [{ name: 'Score', value: mockComplianceScore, fill: mockComplianceScore > 80 ? 'hsl(142, 71%, 45%)' : mockComplianceScore > 60 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 51%)' }];

const activityIcons = { submission: CheckCircle2, error: AlertCircle, alert: AlertTriangle };
const activityColors = {
  submission: 'border-l-[hsl(var(--status-accepted))] bg-[hsl(var(--status-accepted)/0.04)]',
  error: 'border-l-destructive bg-destructive/[0.04]',
  alert: 'border-l-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning)/0.04)]',
};

// --- KPI Card Component ---
function KpiCard({ kpi, index }: { kpi: typeof kpis[0]; index: number }) {
  const count = useAnimatedCounter(kpi.value);
  const Icon = kpi.icon;
  return (
    <Card
      className="overflow-hidden opacity-0 animate-fade-in-up group hover:shadow-md hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">{kpi.label}</p>
            <p className="text-3xl font-bold tracking-tight">{count}</p>
            <div className="flex items-center gap-1 text-xs font-medium">
              {kpi.trendUp ? (
                <TrendingUp className="h-3 w-3 text-[hsl(var(--status-accepted))]" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <span className={kpi.trendUp ? 'text-[hsl(var(--status-accepted))]' : 'text-destructive'}>
                {kpi.trend}
              </span>
              <span className="text-muted-foreground">vs last week</span>
            </div>
          </div>
          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="h-6 w-6 text-foreground/70" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Dashboard ---
export default function Dashboard() {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between opacity-0 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting} 👋</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <Link to="/shipments/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New ISF Filing
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <KpiCard key={kpi.label} kpi={kpi} index={i} />
        ))}
      </div>

      {/* Recent Shipments Table */}
      <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Recent Shipments</CardTitle>
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
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 h-10">Bill of Lading</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 h-10">Importer</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 h-10">Product</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 h-10">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 h-10">Departure</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 h-10 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockShipments.map((s, i) => (
                  <TableRow
                    key={s.id}
                    className="group/row opacity-0 animate-fade-in-up hover:bg-muted/40 transition-colors duration-200"
                    style={{ animationDelay: `${450 + i * 60}ms` }}
                  >
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0">
                          <Ship className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <Link to={`/shipments/${s.id}`} className="font-semibold text-sm hover:text-primary transition-colors">
                            {s.shipmentInfo.billOfLading}
                          </Link>
                          <p className="text-[11px] text-muted-foreground">{s.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span className="text-sm">{s.importerName}</span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span className="text-sm text-muted-foreground">{s.productInfo.description}</span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span className="text-sm tabular-nums">{new Date(s.departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity duration-200">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" asChild>
                          <Link to={`/shipments/${s.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                        {s.status === 'draft' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" asChild>
                            <Link to={`/shipments/${s.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row 1: Status Donut + Weekly Filings Bar */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '700ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
              draft: { label: 'Draft', color: 'hsl(var(--status-draft))' },
              submitted: { label: 'Submitted', color: 'hsl(var(--status-submitted))' },
              accepted: { label: 'Accepted', color: 'hsl(var(--status-accepted))' },
              rejected: { label: 'Rejected', color: 'hsl(var(--status-rejected))' },
            }} className="mx-auto aspect-square max-h-[260px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} strokeWidth={2} stroke="hsl(var(--background))">
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-2xl font-bold">{mockShipments.length}</text>
                <text x="50%" y="58%" textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-xs">Total</text>
              </PieChart>
            </ChartContainer>
            <div className="flex justify-center gap-4 mt-2">
              {statusData.map(s => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Filings Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ filings: { label: 'Filings', color: 'hsl(var(--primary))' } }} className="h-[260px]">
              <BarChart data={mockWeeklyFilings} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                <YAxis tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <Bar dataKey="filings" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Country Donut + Compliance Score */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Country of Origin</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
              cn: { label: 'China', color: 'hsl(220, 70%, 50%)' },
              jp: { label: 'Japan', color: 'hsl(142, 71%, 45%)' },
              vn: { label: 'Vietnam', color: 'hsl(38, 92%, 50%)' },
              in: { label: 'India', color: 'hsl(0, 72%, 51%)' },
              de: { label: 'Germany', color: 'hsl(280, 60%, 50%)' },
            }} className="mx-auto aspect-square max-h-[260px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={countryData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} strokeWidth={2} stroke="hsl(var(--background))">
                  {countryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {countryData.map(c => (
                <div key={c.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.fill }} />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="font-medium">{c.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '700ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Compliance Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="relative h-[220px] w-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="90%" startAngle={90} endAngle={-270} data={complianceData} barSize={14}>
                  <RadialBar dataKey="value" cornerRadius={10} background={{ fill: 'hsl(var(--muted))' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold">{mockComplianceScore}%</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {mockComplianceScore > 80 ? 'Excellent' : mockComplianceScore > 60 ? 'Good' : 'Needs Attention'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 w-full max-w-xs text-center">
              {[
                { label: 'Complete', val: '3/5', color: 'text-[hsl(var(--status-accepted))]' },
                { label: 'Missing Data', val: '2', color: 'text-[hsl(var(--status-warning))]' },
                { label: 'Errors', val: '1', color: 'text-destructive' },
              ].map(m => (
                <div key={m.label}>
                  <p className={`text-lg font-semibold ${m.color}`}>{m.val}</p>
                  <p className="text-[11px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Activity + Deadlines */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 opacity-0 animate-fade-in-up" style={{ animationDelay: '900ms' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mockActivity.map((item, i) => {
              const Icon = activityIcons[item.type];
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 text-sm p-3 rounded-lg border-l-[3px] transition-all duration-200 hover:translate-x-0.5 ${activityColors[item.type]} opacity-0 animate-fade-in-up`}
                  style={{ animationDelay: `${950 + i * 80}ms` }}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${item.type === 'error' ? 'text-destructive' : item.type === 'alert' ? 'text-[hsl(var(--status-warning))]' : 'text-[hsl(var(--status-accepted))]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground">{item.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{relativeTime(item.timestamp)}</p>
                  </div>
                  {item.shipmentId && (
                    <Link to={`/shipments/${item.shipmentId}`} className="text-primary hover:underline text-xs shrink-0 font-medium">
                      View <ArrowUpRight className="inline h-3 w-3" />
                    </Link>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 opacity-0 animate-fade-in-up" style={{ animationDelay: '1000ms' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockShipments
              .filter(s => s.status === 'draft' || s.status === 'submitted')
              .sort((a, b) => new Date(a.filingDeadline).getTime() - new Date(b.filingDeadline).getTime())
              .map(s => {
                const totalWindow = new Date(s.filingDeadline).getTime() - new Date(s.createdAt).getTime();
                const elapsed = Date.now() - new Date(s.createdAt).getTime();
                const progress = Math.min(Math.max(elapsed / totalWindow, 0), 1);
                const daysLeft = Math.ceil((new Date(s.filingDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const barColor = daysLeft <= 3 ? 'bg-destructive' : daysLeft <= 7 ? 'bg-[hsl(var(--status-warning))]' : 'bg-[hsl(var(--status-accepted))]';
                return (
                  <div key={s.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <Link to={`/shipments/${s.id}`} className="font-medium hover:underline text-foreground">{s.shipmentInfo.billOfLading}</Link>
                        <p className="text-[11px] text-muted-foreground">{s.importerName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={s.status} />
                        <span className={`text-xs font-semibold ${daysLeft <= 3 ? 'text-destructive' : daysLeft <= 7 ? 'text-[hsl(var(--status-warning))]' : 'text-muted-foreground'}`}>
                          {daysLeft}d left
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} origin-left animate-progress-fill`}
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
