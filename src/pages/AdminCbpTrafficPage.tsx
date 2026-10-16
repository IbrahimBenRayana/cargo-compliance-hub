import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Activity, Loader2 } from 'lucide-react';
import { cbpTrafficApi } from '@/api/client';
import type { CbpInboundRow, CbpTransmissionRow } from '@/api/client';

/**
 * CBP traffic console (platform admins): what crossed the wire. Transmissions
 * as sent, every CBP message as received (including the unmatched ones no
 * filing claimed), and the connection's environment and health.
 */

const fmt = (ts: string | null | undefined) => (ts ? new Date(ts).toLocaleString() : '—');

const TX_STATUS_CLASS: Record<string, string> = {
  ACCEPTED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  UNKNOWN: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  FAILED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

function ConnectionCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['cbp', 'connection'],
    queryFn: () => cbpTrafficApi.connection(),
    refetchInterval: 30_000,
  });
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">Connection</CardTitle>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {data && (
            <>
              <Badge variant="secondary">CBP {data.environment}</Badge>
              <Badge variant="outline" className="font-mono text-[11px]">
                {data.transport}{data.health.qmgr ? ` · ${data.health.qmgr}` : ''}
              </Badge>
              <Badge variant={data.health.ok ? 'secondary' : 'destructive'} className="text-[11px]">
                {data.health.ok ? 'healthy' : data.health.detail ?? 'unhealthy'}
              </Badge>
            </>
          )}
        </div>
        <CardDescription>
          Responses are pulled every minute, stored before they leave CBP&apos;s queue, then matched to filings.
        </CardDescription>
      </CardHeader>
      {data && (
        <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Stat label="Last message" value={fmt(data.lastInboundAt)} />
          <Stat label="Waiting to match" value={data.counts.pendingDispatch} />
          <Stat label="Unmatched" value={data.counts.unmatched} attention={data.counts.unmatched > 0} />
          <Stat label="Unknown outcome" value={data.counts.unknownOutcome} attention={data.counts.unknownOutcome > 0} />
        </CardContent>
      )}
    </Card>
  );
}

function Stat({ label, value, attention }: { label: string; value: string | number; attention?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-medium tabular-nums ${attention ? 'text-amber-700 dark:text-amber-300' : ''}`}>{value}</div>
    </div>
  );
}

function RawBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">{text}</pre>
    </div>
  );
}

function InboundDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['cbp', 'inbound', id],
    queryFn: () => cbpTrafficApi.inboundMessage(id!),
    enabled: !!id,
  });
  const m = data?.message;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>CBP message {m?.application ? `· ${m.application}` : ''}</SheetTitle>
          <SheetDescription>Received {fmt(m?.receivedAt)}. Stored exactly as received.</SheetDescription>
        </SheetHeader>
        {m && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              {m.userDataTag && <Badge variant="outline" className="font-mono">{m.userDataTag}</Badge>}
              <Badge variant="secondary">{m.matchedEntityType ? `matched: ${m.matchedEntityType}` : 'unmatched'}</Badge>
              {m.parseError && <Badge variant="destructive">{m.parseError}</Badge>}
            </div>
            <RawBlock label="Raw message" text={m.rawText} />
            {m.parsed != null && <RawBlock label="Parsed" text={JSON.stringify(m.parsed, null, 2)} />}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InboundTable({ filter }: { filter: 'all' | 'unmatched' | 'pending' }) {
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['cbp', 'inbound-list', filter],
    queryFn: () => cbpTrafficApi.inbound(filter),
    refetchInterval: 30_000,
  });
  const rows: CbpInboundRow[] = data?.messages ?? [];
  if (isLoading) return <Loader2 className="m-6 h-5 w-5 animate-spin text-muted-foreground" />;
  if (rows.length === 0) return <p className="p-6 text-sm text-muted-foreground">No messages.</p>;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Received</TableHead>
            <TableHead>App</TableHead>
            <TableHead>Tag</TableHead>
            <TableHead>Matched</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r.id)}>
              <TableCell className="whitespace-nowrap tabular-nums">{fmt(r.receivedAt)}</TableCell>
              <TableCell className="font-mono">{r.application ?? '—'}</TableCell>
              <TableCell className="font-mono text-xs">{r.userDataTag ?? '—'}</TableCell>
              <TableCell className="text-xs">
                {r.parseError ? <span className="text-red-600">{r.parseError}</span>
                  : !r.dispatchedAt ? 'waiting'
                  : r.matchedEntityType ?? <span className="text-amber-700 dark:text-amber-300">unmatched</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <InboundDetail id={open} onClose={() => setOpen(null)} />
    </>
  );
}

function TransmissionDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['cbp', 'transmission', id],
    queryFn: () => cbpTrafficApi.transmission(id!),
    enabled: !!id,
  });
  const t = data?.transmission;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Transmission {t ? `· ${t.application} ${t.action ?? ''}` : ''}</SheetTitle>
          <SheetDescription>{t ? `${t.status} · sent ${fmt(t.sentAt)} · tag ${t.userDataTag}` : ''}</SheetDescription>
        </SheetHeader>
        {t && (
          <div className="mt-4 space-y-4">
            {t.lastError && <p className="text-sm text-red-600">{t.lastError}</p>}
            <RawBlock label="Wire as sent" text={t.wireText} />
            {t.inbound.map((m) => (
              <RawBlock key={m.id} label={`CBP ${m.application ?? ''} · ${fmt(m.receivedAt)}`} text={m.rawText} />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TransmissionsTable() {
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['cbp', 'transmissions'],
    queryFn: () => cbpTrafficApi.transmissions(),
    refetchInterval: 30_000,
  });
  const rows: CbpTransmissionRow[] = data?.transmissions ?? [];
  if (isLoading) return <Loader2 className="m-6 h-5 w-5 animate-spin text-muted-foreground" />;
  if (rows.length === 0) return <p className="p-6 text-sm text-muted-foreground">No native transmissions yet.</p>;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Created</TableHead>
            <TableHead>App</TableHead>
            <TableHead>Filer</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Responses</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r.id)}>
              <TableCell className="whitespace-nowrap tabular-nums">{fmt(r.createdAt)}</TableCell>
              <TableCell className="font-mono">{r.application}{r.action ? ` ${r.action}` : ''}</TableCell>
              <TableCell className="font-mono">{r.filerCode}</TableCell>
              <TableCell className="font-mono text-xs">{r.isfTransactionNumber ?? r.entryNumber ?? '—'}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={`text-[11px] ${TX_STATUS_CLASS[r.status] ?? ''}`}>{r.status}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{r._count.inbound}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TransmissionDetail id={open} onClose={() => setOpen(null)} />
    </>
  );
}

export function AdminCbpTrafficPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CBP Traffic</h1>
          <p className="text-muted-foreground">Every transmission and CBP message, exactly as it crossed the wire.</p>
        </div>
      </div>
      <ConnectionCard />
      <Card>
        <Tabs defaultValue="inbound">
          <CardHeader className="pb-0">
            <TabsList>
              <TabsTrigger value="inbound">CBP messages</TabsTrigger>
              <TabsTrigger value="unmatched">Unmatched</TabsTrigger>
              <TabsTrigger value="transmissions">Transmissions</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-4">
            <TabsContent value="inbound"><InboundTable filter="all" /></TabsContent>
            <TabsContent value="unmatched"><InboundTable filter="unmatched" /></TabsContent>
            <TabsContent value="transmissions"><TransmissionsTable /></TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
