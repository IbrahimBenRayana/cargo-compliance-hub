import { mockShipments } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Issue {
  shipmentId: string;
  field: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

const issues: Issue[] = [];
mockShipments.forEach(s => {
  if (s.status !== 'draft') return;
  const empty = (val: string, field: string) => {
    if (!val) issues.push({ shipmentId: s.id, field, severity: 'critical', message: `Missing ${field}` });
  };
  empty(s.parties.manufacturer, 'Manufacturer');
  empty(s.parties.shipToParty, 'Ship-to Party');
  empty(s.shipmentInfo.vesselName, 'Vessel Name');
  empty(s.shipmentInfo.voyageNumber, 'Voyage Number');
  empty(s.productInfo.htsCode, 'HTS Code');
  empty(s.logistics.containerStuffingLocation, 'Container Stuffing Location');
  empty(s.logistics.consolidator, 'Consolidator');
});

const severityConfig = {
  critical: { icon: AlertCircle, color: 'text-destructive', badge: 'bg-destructive/15 text-destructive border-transparent' },
  warning: { icon: AlertTriangle, color: 'text-[hsl(var(--status-warning))]', badge: 'bg-[hsl(var(--status-warning))]/15 text-[hsl(var(--status-warning))] border-transparent' },
  info: { icon: Info, color: 'text-primary', badge: 'bg-primary/15 text-primary border-transparent' },
};

export default function CompliancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
        <p className="text-muted-foreground text-sm">Validation issues across draft filings</p>
      </div>

      {issues.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">All filings are complete. No issues found.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Validation Issues ({issues.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {issues.map((issue, i) => {
              const config = severityConfig[issue.severity];
              const Icon = config.icon;
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                  <div className="flex-1">
                    <Link to={`/shipments/${issue.shipmentId}`} className="font-medium hover:underline">{issue.shipmentId}</Link>
                    <span className="text-muted-foreground"> — {issue.message}</span>
                  </div>
                  <Badge className={`text-xs ${config.badge}`}>{issue.severity}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
