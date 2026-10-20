import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, Loader2, Send, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { abiDocumentsApi, filingsApi } from '@/api/client';
import type { CbpConditionView, CbpTransmissionView, EntryCbpActivity, FilingCbpActivity } from '@/api/client';
import { cn } from '@/lib/utils';

/**
 * Live CBP activity for a native ISF or entry (audit UFF-06, FNA-09): what was
 * transmitted, when, and what CBP answered, in CBP's own words. No timers
 * and no simulated steps; it refreshes only while CBP's answer is pending.
 */

const ACTION_LABEL: Record<string, string> = { A: 'Add', R: 'Replace', D: 'Delete' };

const fmt = (ts: string | null) => (ts ? new Date(ts).toLocaleString() : '');

function StatusIcon({ status }: { status: string }) {
  if (status === 'ACCEPTED') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === 'REJECTED' || status === 'FAILED') return <XCircle className="h-4 w-4 text-red-600" />;
  if (status === 'UNKNOWN') return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  if (status === 'SENT') return <Clock className="h-4 w-4 text-primary" />;
  return <Send className="h-4 w-4 text-muted-foreground" />;
}

const STATUS_TEXT: Record<string, string> = {
  QUEUED: 'Preparing',
  SENT: 'Sent, waiting for CBP',
  ACCEPTED: 'Accepted by CBP',
  REJECTED: 'Rejected by CBP',
  CONDITIONAL: 'CBP responded',
  FAILED: 'Not sent',
  UNKNOWN: 'Outcome unknown, waiting for CBP',
};

function Condition({ c }: { c: CbpConditionView }) {
  return (
    <li className={cn('rounded-md border p-2.5 text-sm', c.blocking ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30' : 'bg-muted/30')}>
      <div className="flex items-start gap-2">
        {c.blocking ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0">
          <div className="font-medium">
            <span className="font-mono text-xs text-muted-foreground mr-1.5">{c.code}</span>
            {c.narrative}
          </div>
          {c.explanation && <p className="mt-0.5 text-xs text-muted-foreground">{c.explanation}</p>}
          {c.audience === 'operations' && (
            <p className="mt-0.5 text-xs text-muted-foreground">This is about our connection, not your data. MyCargoLens has been alerted.</p>
          )}
        </div>
      </div>
    </li>
  );
}

/** The shared card: transmissions newest first, each with CBP's answer. */
function CbpActivityCard({
  transmissions,
  pending,
  badges,
  subject,
}: {
  transmissions: CbpTransmissionView[];
  pending: boolean;
  badges?: React.ReactNode;
  subject: (t: CbpTransmissionView) => string;
}) {
  if (transmissions.length === 0) return null;
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base font-semibold">CBP activity</CardTitle>
          {badges}
          {pending && (
            <Badge variant="secondary" className="text-[11px]">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Waiting for CBP
            </Badge>
          )}
        </div>
        <CardDescription>
          Every transmission to CBP and CBP&apos;s answer. CBP usually responds within a few minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {transmissions.map((t) => {
            const responses = t.inbound.filter((m) => m.parsed && m.parsed.verdict !== 'INFO');
            const advisories = t.inbound.filter((m) => m.parsed?.verdict === 'INFO' && m.parsed.conditions.length > 0);
            return (
              <li key={t.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusIcon status={t.status} />
                  <span className="font-medium">{subject(t)}</span>
                  <span className="text-muted-foreground">{STATUS_TEXT[t.status] ?? t.status}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{fmt(t.respondedAt ?? t.sentAt ?? t.createdAt)}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Filer {t.filerCode}{t.environment !== 'PROD' ? ` · CBP ${t.environment}` : ''}{t.sentAt ? ` · sent ${fmt(t.sentAt)}` : ''}
                </div>
                {t.lastError && t.status !== 'SENT' && <p className="mt-2 text-xs text-red-600">{t.lastError}</p>}
                {responses.flatMap((m) => m.parsed!.conditions).length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {responses.flatMap((m) => m.parsed!.conditions).map((c, i) => <Condition key={i} c={c} />)}
                  </ul>
                )}
                {advisories.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {advisories.flatMap((m) => m.parsed!.conditions).map((c, i) => <Condition key={`a${i}`} c={c} />)}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent>
    </Card>
  );
}

/** CBP activity for a native ISF. */
export function CbpTimeline({ filingId }: { filingId: string }) {
  const { data, isLoading } = useQuery<FilingCbpActivity>({
    queryKey: ['filing', filingId, 'cbp'],
    queryFn: () => filingsApi.cbpActivity(filingId),
    // Refresh only while CBP's answer is pending.
    refetchInterval: (q) => (q.state.data?.filing.pendingAction ? 10_000 : false),
  });
  if (isLoading || !data) return <LoadingCard />;
  const { filing } = data;
  return (
    <CbpActivityCard
      transmissions={data.transmissions}
      pending={!!filing.pendingAction}
      badges={filing.cbpTransactionId && <Badge variant="outline" className="font-mono text-[11px]">ISF {filing.cbpTransactionId}</Badge>}
      subject={(t) => `ISF ${ACTION_LABEL[t.action ?? ''] ?? t.action}`}
    />
  );
}

const PART_TEXT: Record<string, string> = { ACCEPTED: 'accepted', REJECTED: 'rejected' };

/** CBP activity for a native entry: the summary (AX) and release (SX) answers. */
export function EntryCbpTimeline({ entryId }: { entryId: string }) {
  const { data, isLoading } = useQuery<EntryCbpActivity>({
    queryKey: ['abi-document', entryId, 'cbp'],
    queryFn: () => abiDocumentsApi.cbpActivity(entryId),
    refetchInterval: (q) => (q.state.data?.entry.pendingAction ? 10_000 : false),
  });
  // When CBP's answer lands, refresh the entry itself (status, actions).
  const queryClient = useQueryClient();
  const wasPending = useRef(false);
  const pendingNow = !!data?.entry.pendingAction;
  useEffect(() => {
    if (wasPending.current && !pendingNow) {
      queryClient.invalidateQueries({ queryKey: ['abi-documents', entryId] });
    }
    wasPending.current = pendingNow;
  }, [pendingNow, entryId, queryClient]);
  if (isLoading || !data) return <LoadingCard />;
  const { entry } = data;
  return (
    <CbpActivityCard
      transmissions={data.transmissions}
      pending={!!entry.pendingAction}
      badges={
        <>
          {entry.entrySummaryStatus && (
            <Badge variant="outline" className="text-[11px]">Summary {PART_TEXT[entry.entrySummaryStatus] ?? entry.entrySummaryStatus.toLowerCase()}</Badge>
          )}
          {entry.releaseRequested && entry.cargoReleaseStatus && (
            <Badge variant="outline" className="text-[11px]">Release {PART_TEXT[entry.cargoReleaseStatus] ?? entry.cargoReleaseStatus.toLowerCase()}</Badge>
          )}
        </>
      }
      subject={(t) => `Entry summary ${ACTION_LABEL[t.action ?? ''] ?? t.action}`}
    />
  );
}
