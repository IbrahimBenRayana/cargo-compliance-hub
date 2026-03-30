import { useState } from 'react';
import { mockSubmissionLogs } from '@/data/mock-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  success: 'bg-[hsl(var(--status-accepted))]/15 text-[hsl(var(--status-accepted))] border-transparent',
  error: 'bg-destructive/15 text-destructive border-transparent',
  pending: 'bg-[hsl(var(--status-warning))]/15 text-[hsl(var(--status-warning))] border-transparent',
};

export default function SubmissionLogs() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Submission Logs</h1>
        <p className="text-muted-foreground text-sm">Track all API submissions to CustomsCity</p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Date</TableHead>
              <TableHead>Shipment</TableHead>
              <TableHead>Bill of Lading</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockSubmissionLogs.map(log => (
              <>
                <TableRow key={log.id} className="cursor-pointer" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                  <TableCell>{expanded === log.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                  <TableCell>{new Date(log.date).toLocaleString()}</TableCell>
                  <TableCell>
                    <Link to={`/shipments/${log.shipmentId}`} className="text-primary hover:underline font-medium">{log.shipmentId}</Link>
                  </TableCell>
                  <TableCell>{log.billOfLading}</TableCell>
                  <TableCell><Badge className={cn('text-xs font-medium', statusStyles[log.status])}>{log.status}</Badge></TableCell>
                </TableRow>
                {expanded === log.id && (
                  <TableRow key={`${log.id}-detail`}>
                    <TableCell colSpan={5} className="bg-muted/30">
                      <div className="grid gap-3 md:grid-cols-2 p-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Request Payload</p>
                          <pre className="text-xs bg-background p-3 rounded-md overflow-auto border">{JSON.stringify(JSON.parse(log.requestPayload), null, 2)}</pre>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Response</p>
                          <pre className="text-xs bg-background p-3 rounded-md overflow-auto border">{JSON.stringify(JSON.parse(log.responseData), null, 2)}</pre>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
