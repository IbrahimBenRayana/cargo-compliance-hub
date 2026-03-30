import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockShipments } from '@/data/mock-data';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Eye, Pencil } from 'lucide-react';
import { ShipmentStatus } from '@/types/shipment';

export default function ShipmentsList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = mockShipments.filter(s => {
    const matchSearch = !search || s.shipmentInfo.billOfLading.toLowerCase().includes(search.toLowerCase()) || s.importerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shipments</h1>
          <p className="text-muted-foreground text-sm">Manage your ISF filings</p>
        </div>
        <Button asChild>
          <Link to="/shipments/new"><Plus className="h-4 w-4 mr-1" /> Create New ISF</Link>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by BOL or importer…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill of Lading</TableHead>
              <TableHead>Importer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Filing Deadline</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.shipmentInfo.billOfLading}</TableCell>
                <TableCell>{s.importerName}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell>{new Date(s.departureDate).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(s.filingDeadline).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild><Link to={`/shipments/${s.id}`}><Eye className="h-4 w-4" /></Link></Button>
                    {s.status === 'draft' && <Button variant="ghost" size="icon" asChild><Link to={`/shipments/${s.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No shipments found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
