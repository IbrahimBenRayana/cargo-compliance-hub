import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { mockShipments } from '@/data/mock-data';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import {
  Plus, Search, Eye, Pencil, Filter, X, Ship, CalendarIcon,
  ArrowUpDown, ArrowUp, ArrowDown, Package, Globe, FileText, Clock
} from 'lucide-react';
import { ShipmentStatus } from '@/types/shipment';
import { format } from 'date-fns';

type SortField = 'bol' | 'importer' | 'status' | 'departure' | 'deadline' | 'origin';
type SortDir = 'asc' | 'desc';

const countries = [
  { code: 'CN', label: 'China', flag: '🇨🇳' },
  { code: 'JP', label: 'Japan', flag: '🇯🇵' },
  { code: 'VN', label: 'Vietnam', flag: '🇻🇳' },
  { code: 'IN', label: 'India', flag: '🇮🇳' },
  { code: 'DE', label: 'Germany', flag: '🇩🇪' },
];

const statusOptions: ShipmentStatus[] = ['draft', 'submitted', 'accepted', 'rejected'];

export default function ShipmentsList() {
  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<ShipmentStatus[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortField, setSortField] = useState<SortField>('deadline');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleStatus = (s: ShipmentStatus) =>
    setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const toggleCountry = (c: string) =>
    setSelectedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const clearAllFilters = () => {
    setSearch('');
    setSelectedStatuses([]);
    setSelectedCountries([]);
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const activeFilterCount = selectedStatuses.length + selectedCountries.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

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
    let result = mockShipments.filter(s => {
      const matchSearch = !search ||
        s.shipmentInfo.billOfLading.toLowerCase().includes(search.toLowerCase()) ||
        s.importerName.toLowerCase().includes(search.toLowerCase()) ||
        s.productInfo.description.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(s.status);
      const matchCountry = selectedCountries.length === 0 || selectedCountries.includes(s.productInfo.countryOfOrigin);
      const dep = new Date(s.departureDate);
      const matchDateFrom = !dateFrom || dep >= dateFrom;
      const matchDateTo = !dateTo || dep <= dateTo;
      return matchSearch && matchStatus && matchCountry && matchDateFrom && matchDateTo;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'bol': cmp = a.shipmentInfo.billOfLading.localeCompare(b.shipmentInfo.billOfLading); break;
        case 'importer': cmp = a.importerName.localeCompare(b.importerName); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'departure': cmp = new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime(); break;
        case 'deadline': cmp = new Date(a.filingDeadline).getTime() - new Date(b.filingDeadline).getTime(); break;
        case 'origin': cmp = a.productInfo.countryOfOrigin.localeCompare(b.productInfo.countryOfOrigin); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [search, selectedStatuses, selectedCountries, dateFrom, dateTo, sortField, sortDir]);

  const countByStatus = (s: ShipmentStatus) => mockShipments.filter(x => x.status === s).length;

  const getDeadlineUrgency = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'text-destructive';
    if (days <= 3) return 'text-[hsl(var(--status-warning))]';
    return 'text-muted-foreground';
  };

  const getCountryFlag = (code: string) => countries.find(c => c.code === code)?.flag || '🌍';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up" style={{ animationDelay: '0ms' }}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Ship className="h-5 w-5 text-primary" />
            </div>
            Shipments
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and track your ISF filings</p>
        </div>
        <Button asChild className="shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <Link to="/shipments/new"><Plus className="h-4 w-4 mr-1" /> Create New ISF</Link>
        </Button>
      </div>

      {/* Quick Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        {statusOptions.map((status, i) => {
          const count = countByStatus(status);
          const isActive = selectedStatuses.includes(status);
          const colors: Record<ShipmentStatus, string> = {
            draft: 'border-muted-foreground/20 hover:border-muted-foreground/40',
            submitted: 'border-primary/20 hover:border-primary/40',
            accepted: 'border-[hsl(var(--status-accepted))]/20 hover:border-[hsl(var(--status-accepted))]/40',
            rejected: 'border-destructive/20 hover:border-destructive/40',
          };
          const activeBg: Record<ShipmentStatus, string> = {
            draft: 'bg-muted-foreground/5 border-muted-foreground/40',
            submitted: 'bg-primary/5 border-primary/40',
            accepted: 'bg-[hsl(var(--status-accepted))]/5 border-[hsl(var(--status-accepted))]/40',
            rejected: 'bg-destructive/5 border-destructive/40',
          };
          return (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`group rounded-xl border-2 p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isActive ? activeBg[status] : `bg-card ${colors[status]}`}`}
              style={{ animationDelay: `${150 + i * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <StatusBadge status={status} />
                <span className="text-xl font-bold tabular-nums">{count}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters Bar */}
      <Card className="animate-fade-in-up overflow-hidden" style={{ animationDelay: '200ms' }}>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search BOL, importer, product, or ISF ID…"
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
              {/* Country Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={`gap-1.5 transition-all duration-200 ${selectedCountries.length > 0 ? 'border-primary/40 bg-primary/5 text-primary' : ''}`}>
                    <Globe className="h-3.5 w-3.5" />
                    Origin
                    {selectedCountries.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full bg-primary text-primary-foreground">
                        {selectedCountries.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Country of Origin</p>
                  {countries.map(c => (
                    <label key={c.code} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer transition-colors">
                      <Checkbox checked={selectedCountries.includes(c.code)} onCheckedChange={() => toggleCountry(c.code)} />
                      <span className="text-sm">{c.flag} {c.label}</span>
                    </label>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Date Range */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={`gap-1.5 transition-all duration-200 ${dateFrom || dateTo ? 'border-primary/40 bg-primary/5 text-primary' : ''}`}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateFrom || dateTo
                      ? `${dateFrom ? format(dateFrom, 'MMM d') : '…'} – ${dateTo ? format(dateTo, 'MMM d') : '…'}`
                      : 'Departure Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Departure range</p>
                  <div className="flex gap-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">From</p>
                      <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="rounded-md border" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">To</p>
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="rounded-md border" />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Clear */}
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground hover:text-foreground gap-1">
                  <X className="h-3.5 w-3.5" />
                  Clear ({activeFilterCount})
                </Button>
              )}
            </div>
          </div>

          {/* Active Filter Tags */}
          {(selectedStatuses.length > 0 || selectedCountries.length > 0) && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Active:</span>
              {selectedStatuses.map(s => (
                <Badge key={s} variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => toggleStatus(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                  <X className="h-2.5 w-2.5" />
                </Badge>
              ))}
              {selectedCountries.map(c => (
                <Badge key={c} variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => toggleCountry(c)}>
                  {getCountryFlag(c)} {c}
                  <X className="h-2.5 w-2.5" />
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
          <span className="font-medium text-foreground">{mockShipments.length}</span> shipments
        </p>
      </div>

      {/* Table */}
      <Card className="animate-fade-in-up overflow-hidden" style={{ animationDelay: '350ms' }}>
        <div className="rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('bol')}>
                  <div className="flex items-center text-xs uppercase tracking-wider font-semibold">
                    <FileText className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    Bill of Lading <SortIcon field="bol" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('importer')}>
                  <div className="flex items-center text-xs uppercase tracking-wider font-semibold">
                    Importer <SortIcon field="importer" />
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center text-xs uppercase tracking-wider font-semibold">
                    <Package className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    Product
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('origin')}>
                  <div className="flex items-center text-xs uppercase tracking-wider font-semibold">
                    <Globe className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    Origin <SortIcon field="origin" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                  <div className="flex items-center text-xs uppercase tracking-wider font-semibold">
                    Status <SortIcon field="status" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('departure')}>
                  <div className="flex items-center text-xs uppercase tracking-wider font-semibold">
                    <Ship className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    Departure <SortIcon field="departure" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('deadline')}>
                  <div className="flex items-center text-xs uppercase tracking-wider font-semibold">
                    <Clock className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    Deadline <SortIcon field="deadline" />
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <span className="text-xs uppercase tracking-wider font-semibold">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s, i) => (
                <TableRow
                  key={s.id}
                  className="group transition-all duration-200 hover:bg-primary/[0.03] animate-fade-in-up"
                  style={{ animationDelay: `${400 + i * 60}ms` }}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors duration-200">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{s.shipmentInfo.billOfLading}</p>
                        <p className="text-[11px] text-muted-foreground">{s.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{s.importerName}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{s.productInfo.description}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{getCountryFlag(s.productInfo.countryOfOrigin)} {s.productInfo.countryOfOrigin}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm tabular-nums">{new Date(s.departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm tabular-nums font-medium ${getDeadlineUrgency(s.filingDeadline)}`}>
                      {new Date(s.filingDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" asChild>
                        <Link to={`/shipments/${s.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      {s.status === 'draft' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" asChild>
                          <Link to={`/shipments/${s.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                        <Search className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">No shipments found</p>
                        <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
                      </div>
                      {activeFilterCount > 0 && (
                        <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-1">
                          Clear all filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
