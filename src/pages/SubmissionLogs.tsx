/**
 * Submission logs: each call made for this account's filings and lookups,
 * newest first, with what was sent and what came back. Status checks run in
 * the background by the thousand, so they are left out unless asked for.
 */
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { submissionLogsApi } from '@/api/client';
import { Pagination } from '@/components/dashboard/Pagination';
import { FILL, TINT, type Tone } from '@/components/dashboard/tones';
import { ChevronDown } from '@/components/icons';
import { stamp } from '@/components/shipment-detail/summary';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ApiSubmissionLog } from '@/types/shipment';

const PAGE_SIZE = 25;
const PAGE = 'mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-12';
const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';
const TH = 'px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground';

/** What a call was for, in the app's words. Anything unlisted shows its address. */
const WHAT: Array<[RegExp, string]> = [
  [/^\/api\/abi\/send/, 'Entry sent'],
  [/^\/api\/send/, 'ISF sent'],
  [/^\/api\/duty-calculation-tool-ai/, 'Duty calculation, classified by AI'],
  [/^\/api\/duty-calculation-tool/, 'Duty calculation'],
  [/^\/api\/manifest-query$/i, 'Manifest query'],
  [/^\/api\/ManifestQueryByID/i, 'Manifest query answer'],
  [/^\/api\/(document-status|messages|abi\/documents)/, 'Status check'],
];
const whatOf = (log: ApiSubmissionLog) => WHAT.find(([re]) => re.test(log.url))?.[1] ?? null;

function resultOf(log: ApiSubmissionLog): { tone: Tone; word: string } {
  if (log.errorMessage) return { tone: 'urgent', word: log.responseStatus ? `Failed ${log.responseStatus}` : 'Failed' };
  if (!log.responseStatus) return { tone: 'soon', word: 'No answer' };
  return log.responseStatus < 400 ? { tone: 'done', word: `OK ${log.responseStatus}` } : { tone: 'urgent', word: `Failed ${log.responseStatus}` };
}

const pretty = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));

function Payload({ label, children }: { label: string; children: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <pre className="mt-1 max-h-72 overflow-auto rounded-lg border border-border/70 bg-card p-3 font-mono text-[12px] leading-5">{children}</pre>
    </div>
  );
}

function Row({ log, open, onToggle }: { log: ApiSubmissionLog; open: boolean; onToggle: () => void }) {
  const result = resultOf(log);
  const what = whatOf(log);
  const by = [log.user?.firstName, log.user?.lastName].filter(Boolean).join(' ');
  return (
    <Fragment>
      <tr className={cn('transition-colors duration-150', open ? 'bg-muted/50' : 'can-hover:hover:bg-muted/40')}>
        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
          <time dateTime={log.createdAt}>{stamp(log.createdAt)}</time>
        </td>
        <td className="px-4 py-2.5">
          <button
            type="button" onClick={onToggle} aria-expanded={open}
            className="flex items-center gap-1.5 rounded-md text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150', !open && '-rotate-90')} aria-hidden />
            {what ?? <span className="font-mono text-[12.5px] font-normal">{log.method} {log.url}</span>}
          </button>
        </td>
        <td className="px-4 py-2.5">
          {log.filing && (
            <Link to={`/shipments/${log.filing.id}`} className="font-mono underline-offset-2 outline-none focus-visible:underline can-hover:hover:underline">
              {log.filing.masterBol || log.filing.id.slice(0, 8)}
            </Link>
          )}
        </td>
        <td className="px-4 py-2.5 text-muted-foreground max-md:hidden">{by}</td>
        <td className="px-4 py-2.5">
          <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-medium tabular-nums', TINT[result.tone])}>
            <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[result.tone])} />{result.word}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground max-sm:hidden">{log.latencyMs ? `${log.latencyMs.toLocaleString()} ms` : ''}</td>
      </tr>
      {open && (
        <tr className="bg-muted/50">
          <td colSpan={6} className="px-4 pb-4 pt-1">
            {what && <p className="font-mono text-[12px] text-muted-foreground">{log.method} {log.url}</p>}
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
              <Payload label="Sent">{log.requestPayload ? pretty(log.requestPayload) : 'Nothing was sent with this call.'}</Payload>
              <Payload label="Came back">{log.responseBody ? pretty(log.responseBody) : log.errorMessage || 'No answer was recorded.'}</Payload>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export default function SubmissionLogs() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [sendsOnly, setSendsOnly] = useState(true);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['submissionLogs', { sendsOnly, page }],
    queryFn: () => submissionLogsApi.list({ limit: PAGE_SIZE, page, sends: sendsOnly ? '1' : undefined }),
    placeholderData: keepPreviousData,
  });
  const logs = (data?.data ?? []) as ApiSubmissionLog[];
  const total = data?.pagination?.total ?? 0;

  const show = (sends: boolean) => { setSendsOnly(sends); setPage(1); setOpenId(null); };

  return (
    <div className={PAGE}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">Submission logs</h1>
          <p className="text-[13px] text-muted-foreground">What was sent for your filings and lookups, and what came back. Newest first.</p>
        </div>
        <div role="radiogroup" aria-label="Which calls to show" className="flex rounded-lg bg-muted p-0.5">
          {([[true, 'Sends and lookups'], [false, 'Include status checks']] as const).map(([value, label]) => (
            <button
              key={label} type="button" role="radio" aria-checked={sendsOnly === value} onClick={() => show(value)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
                sendsOnly === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground can-hover:hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <section aria-label="Calls" className={PANEL}>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : isError ? (
          <p role="alert" className="px-5 py-8 text-center text-[13px] text-muted-foreground">
            The logs could not load. <button type="button" onClick={() => refetch()} className="text-foreground underline underline-offset-2">Retry</button>
          </p>
        ) : logs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[14px] font-medium">Nothing logged yet.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Each filing you send and each lookup you run is recorded here with its answer.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border/70">
                    <th scope="col" className={TH}>When</th>
                    <th scope="col" className={TH}>What</th>
                    <th scope="col" className={TH}>Filing</th>
                    <th scope="col" className={cn(TH, 'max-md:hidden')}>By</th>
                    <th scope="col" className={TH}>Result</th>
                    <th scope="col" className={cn(TH, 'text-right max-sm:hidden')}>Took</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {logs.map((log) => (
                    <Row key={log.id} log={log} open={openId === log.id} onToggle={() => setOpenId(openId === log.id ? null : log.id)} />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} pageSize={PAGE_SIZE}
              onChange={(p) => { setPage(p); setOpenId(null); }} label="Log pages" layoutId="logs-page"
            />
          </>
        )}
      </section>
    </div>
  );
}
