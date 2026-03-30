import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockShipments, mockActivity } from '@/data/mock-data';
import { Ship, Clock, Send, AlertTriangle, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { Link } from 'react-router-dom';

const kpis = [
  { label: 'Total Shipments', value: mockShipments.length, icon: Ship, color: 'text-primary' },
  { label: 'Pending Filings', value: mockShipments.filter(s => s.status === 'draft').length, icon: Clock, color: 'text-[hsl(var(--status-warning))]' },
  { label: 'Submitted Today', value: mockShipments.filter(s => s.status === 'submitted').length, icon: Send, color: 'text-[hsl(var(--status-submitted))]' },
  { label: 'Rejections', value: mockShipments.filter(s => s.status === 'rejected').length, icon: AlertTriangle, color: 'text-destructive' },
];

const activityIcons = { submission: CheckCircle2, error: AlertCircle, alert: AlertTriangle };

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your ISF compliance operations</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockActivity.map(item => {
              const Icon = activityIcons[item.type];
              return (
                <div key={item.id} className="flex items-start gap-3 text-sm">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${item.type === 'error' ? 'text-destructive' : item.type === 'alert' ? 'text-[hsl(var(--status-warning))]' : 'text-[hsl(var(--status-accepted))]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground">{item.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</p>
                  </div>
                  {item.shipmentId && (
                    <Link to={`/shipments/${item.shipmentId}`} className="text-primary hover:underline text-xs shrink-0">
                      View <ArrowUpRight className="inline h-3 w-3" />
                    </Link>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockShipments
              .filter(s => s.status === 'draft' || s.status === 'submitted')
              .sort((a, b) => new Date(a.filingDeadline).getTime() - new Date(b.filingDeadline).getTime())
              .map(s => {
                const daysLeft = Math.ceil((new Date(s.filingDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <div>
                      <Link to={`/shipments/${s.id}`} className="font-medium hover:underline">{s.shipmentInfo.billOfLading}</Link>
                      <p className="text-xs text-muted-foreground">{s.importerName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={s.status} />
                      <span className={`text-xs font-medium ${daysLeft <= 3 ? 'text-destructive' : daysLeft <= 7 ? 'text-[hsl(var(--status-warning))]' : 'text-muted-foreground'}`}>
                        {daysLeft}d left
                      </span>
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
