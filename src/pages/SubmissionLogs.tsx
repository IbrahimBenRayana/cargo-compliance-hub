import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { submissionLogsApi } from '@/api/client';
import { ApiSubmissionLog } from '@/types/shipment';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

function getLogStatus(log: ApiSubmissionLog): 'success' | 'error' | 'pending' {
  if (log.errorMessage) return 'error';
  if (!log.responseStatus) return 'pending';
  return log.responseStatus < 400 ? 'success' : 'error';
}

const statusStyles: Record<string, string> = {
  success: 'bg-[hsl(var(--status-accepted))]/15 text-[hsl(var(--status-accepted))] border-transparent',
  error: 'bg-destructive/15 text-destructive border-transparent',
  pending: 'bg-[hsl(var(--status-warning))]/15 text-[hsl(var(--status-warning))] border-transparent',
};

export default function SubmissionLogs() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: logsResponse, isLoading } = useQuery({
    queryKey: ['submissionLogs'],
    queryFn: () => submissionLogsApi.list({ limit: 100 }),
  });

  const logs: ApiSubmissionLog[] = logsResponse?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Submission Logs</h1>
        <p className="text-muted-foreground text-sm">Track all API submissions to CustomsCity</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="font-medium">No submission logs yet</p>
          <p className="text-sm text-muted-foreground mt-1">Logs will appear here when filings are submitted to CustomsCity</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Filing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => {
                const logStatus = getLogStatus(log);
                return (
                  <>
                    <TableRow key={log.id} className="cursor-pointer" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                      <TableCell>{expanded === log.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell className="text-sm">{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs font-mono">{log.method}</Badge></TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">{log.url}</TableCell>
                      <TableCell>
                        {log.filing ? (
                          <Link to={`/shipments/${log.filing.id}`} className="text-primary hover:underline font-medium text-sm">
                            {log.filing.masterBol || log.filing.id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs font-medium', statusStyles[logStatus])}>
                          {log.responseStatus ?? logStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.latencyMs ? `${log.latencyMs}ms` : '—'}</TableCell>
                    </TableRow>
                    {expanded === log.id && (
                      <TableRow key={`${log.id}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <div className="grid gap-3 md:grid-cols-2 p-2">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Request Payload</p>
                              <pre className="text-xs bg-background p-3 rounded-md overflow-auto border max-h-60">
                                {log.requestPayload ? JSON.stringify(log.requestPayload, null, 2) : 'No payload'}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Response</p>
                              <pre className="text-xs bg-background p-3 rounded-md overflow-auto border max-h-60">
                                {log.responseBody ? JSON.stringify(log.responseBody, null, 2) : log.errorMessage || 'No response'}
                              </pre>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
