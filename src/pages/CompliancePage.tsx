import { useState, useMemo } from 'react';
import { mockShipments } from '@/data/mock-data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertTriangle, AlertCircle, Info, ShieldCheck, Search, X,
  Filter, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';

type Severity = 'critical' | 'warning' | 'info';
type SortField = 'shipment' | 'field' | 'severity';
type SortDir = 'asc' | 'desc';

interface Issue {
  shipmentId: string;
  importerName: string;
  field: string;
  severity: Severity;
  message: string;
}

function generateIssues(): Issue[] {
  const result: Issue[] = [];
  mockShipments.forEach(s => {
    if (s.status !== 'draft') return;
    const check = (val: string, field: string, severity: Severity = 'critical') => {
      if (!val) result.push({ shipmentId: s.id, importerName: s.importerName, field, severity, message: `Missing ${field}` });
    };
    check(s.parties.manufacturer, 'Manufacturer');
    check(s.parties.shipToParty, 'Ship-to Party');
    check(s.shipmentInfo.vesselName, 'Vessel Name', 'warning');
    check(s.shipmentInfo.voyageNumber, 'Voyage Number', 'warning');
    check(s.productInfo.htsCode, 'HTS Code');
    check(s.logistics.containerStuffingLocation, 'Container Stuffing Location', 'warning');
    check(s.logistics.consolidator, 'Consolidator', 'info');
  });
  return result;
}

const allIssues = generateIssues();

const severityConfig: Record<Severity, { icon: typeof AlertCircle; color: string; badge: string; bg: string; border: string; label: string }> = {
  critical: {
    icon: AlertCircle,
    color: 'text-destructive',
    badge: 'bg-destructive/15 text-destructive border-transparent',
    bg: 'bg-destructive/5',
    border: 'border-destructive/20 hover:border-destructive/40',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-[hsl(var(--status-warning))]',
    badge: 'bg-[hsl(var(--status-warning))]/15 text-[hsl(var(--status-warning))] border-transparent',
    bg: 'bg-[hsl(var(--status-warning))]/5',
    border: 'border-[hsl(var(--status-warning))]/20 hover:border-[hsl(var(--status-warning))]/40',
    label: 'Warning',
  },
  info: {
    icon: Info,
    color: 'text-primary',
    badge: 'bg-primary/15 text-primary border-transparent',
    bg: 'bg-primary/5',
    border: 'border-primary/20 hover:border-primary/40',
    label: 'Info',
  },
};

const severityOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
const severities: Severity[] = ['critical', 'warning', 'info'];

export default function CompliancePage() {
  const [search, setSearch] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const allFields = useMemo(() => [...new Set(allIssues.map(i => i.field))].sort(), []);

  const toggleSeverity = (s: Severity) =>
    setSelectedSeverities(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const toggleField = (f: string) =>
    setSelectedFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const clearAllFilters = () => {
    setSearch('');
    setSelectedSeverities([]);
    setSelectedFields([]);
  };

  const activeFilterCount = selectedSeverities.length + selectedFields.length;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const filtered = useMemo(() => {
    let result = allIssues.filter(issue => {
      const matchSearch = !search ||
        issue.shipmentId.toLowerCase().includes(search.toLowerCase()) ||
        issue.importerName.toLowerCase().includes(search.toLowerCase()) ||
        issue.field.toLowerCase().includes(search.toLowerCase()) ||
        issue.message.toLowerCase().includes(search.toLowerCase());
      const matchSeverity = selectedSeverities.length === 0 || selectedSeverities.includes(issue.severity);
      const matchField = selectedFields.length === 0 || selectedFields.includes(issue.field);
      return matchSearch && matchSeverity && matchField;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'shipment': cmp = a.shipmentId.localeCompare(b.shipmentId); break;
        case 'field': cmp = a.field.localeCompare(b.field); break;
        case 'severity': cmp = severityOrder[a.severity] - severityOrder[b.severity]; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [search, selectedSeverities, selectedFields, sortField, sortDir]);

  const countBySeverity = (s: Severity) => allIssues.filter(i => i.severity === s).length;
  const totalShipments = new Set(allIssues.map(i => i.shipmentId)).size;
  const complianceRate = mockShipments.length > 0
    ? Math.round(((mockShipments.length - totalShipments) / mockShipments.length) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up" style={{ animationDelay: '0ms' }}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            Compliance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Validation issues across draft filings</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        {/* Compliance Rate */}
        <button className="group rounded-xl border-2 border-primary/20 hover:border-primary/40 bg-card p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md col-span-2 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{complianceRate}%</p>
              <p className="text-xs text-muted-foreground">Compliance Rate</p>
            </div>
          </div>
        </button>

        {/* Severity Cards */}
        {severities.map((sev) => {
          const config = severityConfig[sev];
          const Icon = config.icon;
          const count = countBySeverity(sev);
          const isActive = selectedSeverities.includes(sev);
          return (
            <button
              key={sev}
              onClick={() => toggleSeverity(sev)}
              className={`group rounded-xl border-2 p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isActive ? `${config.bg} ${config.border.replace('hover:', '')}` : `bg-card ${config.border}`}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-xs font-medium capitalize">{sev}</span>
                </div>
                <span className="text-xl font-bold tabular-nums">{count}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <Card className="animate-fade-in-up overflow-hidden" style={{ animationDelay: '200ms' }}>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shipment, field, or message…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-secondary/50 border-transparent focus:bg-card focus:border-input transition-all duration-300"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Field Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={`gap-1.5 transition-all duration-200 ${selectedFields.length > 0 ? 'border-primary/40 bg-primary/5 text-primary' : ''}`}>
                    <Filter className="h-3.5 w-3.5" />
                    Field
                    {selectedFields.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full bg-primary text-primary-foreground">
                        {selectedFields.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Filter by field</p>
                  {allFields.map(f => (
                    <label key={f} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer transition-colors">
                      <Checkbox checked={selectedFields.includes(f)} onCheckedChange={() => toggleField(f)} />
                      <span className="text-sm">{f}</span>
                    </label>
                  ))}
                </PopoverContent>
              </Popover>

              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground hover:text-foreground gap-1">
                  <X className="h-3.5 w-3.5" />
                  Clear ({activeFilterCount})
                </Button>
              )}
            </div>
          </div>

          {/* Active Filter Tags */}
          {(selectedSeverities.length > 0 || selectedFields.length > 0) && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Active:</span>
              {selectedSeverities.map(s => (
                <Badge key={s} variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-destructive/10 transition-colors capitalize" onClick={() => toggleSeverity(s)}>
                  {s} <X className="h-2.5 w-2.5" />
                </Badge>
              ))}
              {selectedFields.map(f => (
                <Badge key={f} variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => toggleField(f)}>
                  {f} <X className="h-2.5 w-2.5" />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <p className="text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filtered.length}</span> of{' '}
          <span className="font-medium text-foreground">{allIssues.length}</span> issues across{' '}
          <span className="font-medium text-foreground">{totalShipments}</span> shipments
        </p>
      </div>

      {/* Table */}
      <Card className="animate-fade-in-up overflow-hidden" style={{ animationDelay: '350ms' }}>
        {allIssues.length === 0 ? (
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-[hsl(var(--status-accepted))]/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-[hsl(var(--status-accepted))]" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-lg">All Clear!</p>
                <p className="text-sm text-muted-foreground mt-1">All filings are complete. No validation issues found.</p>
              </div>
            </div>
          </CardContent>
        ) : (
          <div className="rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('severity')}>
                    <div className="flex items-center text-xs uppercase tracking-wider font-semibold">
                      Severity <SortIcon field="severity" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('shipment')}>
                    <div className="flex items-center text-xs uppercase tracking-wider font-semibold">
                      Shipment <SortIcon field="shipment" />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="text-xs uppercase tracking-wider font-semibold">Importer</div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('field')}>
                    <div className="flex items-center text-xs uppercase tracking-wider font-semibold">
                      Field <SortIcon field="field" />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="text-xs uppercase tracking-wider font-semibold">Message</div>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="text-xs uppercase tracking-wider font-semibold">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((issue, i) => {
                  const config = severityConfig[issue.severity];
                  const Icon = config.icon;
                  return (
                    <TableRow
                      key={`${issue.shipmentId}-${issue.field}-${i}`}
                      className="group transition-all duration-200 hover:bg-primary/[0.03] animate-fade-in-up"
                      style={{ animationDelay: `${400 + i * 50}ms` }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-7 w-7 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                            <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                          </div>
                          <Badge className={`text-[11px] ${config.badge}`}>{config.label}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link to={`/shipments/${issue.shipmentId}`} className="font-semibold text-sm hover:text-primary transition-colors">
                          {issue.shipmentId}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{issue.importerName}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-normal">{issue.field}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{issue.message}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all" asChild>
                          <Link to={`/shipments/${issue.shipmentId}`}><ExternalLink className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && allIssues.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                          <Search className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">No matching issues</p>
                          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-1">Clear all filters</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
