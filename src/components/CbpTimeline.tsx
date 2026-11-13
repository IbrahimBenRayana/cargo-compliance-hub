import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, Loader2, Send, AlertTriangle, Info } from 'lucide-react';
import { TINT, type Tone } from '@/components/dashboard/tones';
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

/** Each answer in the app's colours: green accepted, red rejected, blue sent, amber unknown. */
const STATUS_LOOK: Record<string, { icon: typeof Send; tone: Tone }> = {
  ACCEPTED: { icon: CheckCircle2, tone: 'done' },
  REJECTED: { icon: XCircle, tone: 'urgent' },
  FAILED: { icon: XCircle, tone: 'urgent' },
  UNKNOWN: { icon: AlertTriangle, tone: 'soon' },
  SENT: { icon: Clock, tone: 'info' },
  CONDITIONAL: { icon: Info, tone: 'info' },
  QUEUED: { icon: Send, tone: 'calm' },
};

const STATUS_TEXT: Record<string, string> = {
  QUEUED: 'Preparing',
  SENT: 'Sent, waiting for CBP',
  ACCEPTED: 'Accepted by CBP',
  REJECTED: 'Rejected by CBP',
  CONDITIONAL: 'CBP responded',
  FAILED: 'Not sent',
  UNKNOWN: 'Outcome unknown, waiting for CBP',
};

const PILL = 'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium';

function Condition({ c }: { c: CbpConditionView }) {
  const tone: Tone = c.blocking ? 'urgent' : 'info';
  const Icon = c.blocking ? XCircle : Info;
  return (
    <li className={cn('rounded-lg p-3 text-[13px]', c.blocking ? 'bg-urgent-tint' : 'bg-info-tint')}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', c.blocking ? 'text-urgent' : 'text-info')} aria-hidden />
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            <span className={cn('mr-1.5 rounded px-1 py-px font-mono text-[11.5px]', TINT[tone])}>{c.code}</span>
            {c.narrative}
          </p>
          {c.explanation && <p className="mt-1 text-[12.5px] text-muted-foreground">{c.explanation}</p>}
          {c.guidance && <p className="mt-1 text-[12.5px] text-foreground">{c.guidance}</p>}
          {c.audience === 'operations' && (
            <p className="mt-1 text-[12.5px] text-muted-foreground">This is about our connection, not your data. MyCargoLens has been alerted.</p>
          )}
        </div>
      </div>
    </li>
  );
}

/** The shared card: transmissions newest first, each with CBP's answer, on a coloured line. */
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
  const noAnswer = transmissions.some((t) => t.overdue);
  return (
    <section aria-labelledby="cbp-activity-title" className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="cbp-activity-title" className="text-[14px] font-semibold">CBP activity</h2>
        {badges}
        {pending && !noAnswer && (
          <span className={cn(PILL, TINT.info)}>
            <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden /> Waiting for CBP
          </span>
        )}
        {noAnswer && (
          <span className={cn(PILL, TINT.soon)}>
            <AlertTriangle className="h-3 w-3" aria-hidden /> No answer from CBP
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">Every message sent to CBP and CBP&apos;s answer, newest first.</p>
      <ol className="mt-4">
        {transmissions.map((t, i) => {
          const responses = t.inbound.filter((m) => m.parsed && m.parsed.verdict !== 'INFO');
          const advisories = t.inbound.filter((m) => m.parsed?.verdict === 'INFO' && m.parsed.conditions.length > 0);
          const conditions = [...responses.flatMap((m) => m.parsed!.conditions), ...advisories.flatMap((m) => m.parsed!.conditions)];
          const { icon: Icon, tone } = STATUS_LOOK[t.status] ?? STATUS_LOOK.QUEUED;
          const last = i === transmissions.length - 1;
          return (
            <li key={t.id} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && <span aria-hidden className="absolute bottom-0 left-[15px] top-9 w-0.5 rounded-full bg-border" />}
              <span className={cn('relative grid h-8 w-8 shrink-0 place-items-center rounded-full', TINT[tone])}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13.5px] font-semibold">{subject(t)}</span>
                  <span className={cn(PILL, TINT[tone])}>{STATUS_TEXT[t.status] ?? t.status}</span>
                  <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">{fmt(t.respondedAt ?? t.sentAt ?? t.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Filer <span className="font-mono">{t.filerCode}</span>{t.environment !== 'PROD' ? ` · CBP ${t.environment}` : ''}{t.sentAt ? ` · sent ${fmt(t.sentAt)}` : ''}
                </p>
                {t.lastError && t.status !== 'SENT' && <p className="mt-2 text-[12.5px] text-urgent">{t.lastError}</p>}
                {t.overdue && (
                  <div role="alert" className="mt-2 rounded-lg bg-soon-tint p-3 text-[12.5px] text-foreground">
                    <p className="font-semibold text-soon">No answer from CBP yet.</p>
                    <p className="mt-0.5">
                      If you file under your own filer code, check with your CBP client representative that our queue is approved for filer code {t.filerCode}.
                      MyCargoLens support has been alerted. Watch your ISF deadline.
                    </p>
                  </div>
                )}
                {conditions.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {conditions.map((c, k) => <Condition key={k} c={c} />)}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function LoadingCard() {
  return (
    <div role="status" aria-label="Loading CBP activity" className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <div className="dash-sk h-4 w-28" />
      <div className="dash-sk mt-4 h-12 w-full" />
    </div>
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
  // When CBP's answer lands, refresh the shipment itself (status, lifecycle,
  // actions) and the lists that show it, not just this card (BUG-020).
  const queryClient = useQueryClient();
  const wasPending = useRef(false);
  const pendingNow = !!data?.filing.pendingAction;
  useEffect(() => {
    if (wasPending.current && !pendingNow) {
      queryClient.invalidateQueries({ queryKey: ['filing', filingId] });
      queryClient.invalidateQueries({ queryKey: ['filings'] });
    }
    wasPending.current = pendingNow;
  }, [pendingNow, filingId, queryClient]);
  if (isLoading || !data) return <LoadingCard />;
  const { filing } = data;
  return (
    <CbpActivityCard
      transmissions={data.transmissions}
      pending={!!filing.pendingAction}
      badges={filing.cbpTransactionId && <span className={cn(PILL, 'bg-muted font-mono text-[11.5px] text-foreground')}>ISF {filing.cbpTransactionId}</span>}
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
            <span className={cn(PILL, 'bg-muted text-foreground')}>Summary {PART_TEXT[entry.entrySummaryStatus] ?? entry.entrySummaryStatus.toLowerCase()}</span>
          )}
          {entry.releaseRequested && entry.cargoReleaseStatus && (
            <span className={cn(PILL, 'bg-muted text-foreground')}>Release {PART_TEXT[entry.cargoReleaseStatus] ?? entry.cargoReleaseStatus.toLowerCase()}</span>
          )}
        </>
      }
      subject={(t) => `Entry summary ${ACTION_LABEL[t.action ?? ''] ?? t.action}`}
    />
  );
}
