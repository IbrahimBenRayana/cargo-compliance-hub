/**
 * Manifest query: ask what CBP has on file for a bill, read the answer, and
 * start an ISF or an entry from it. The open answer lives in the address
 * (?id=), so other pages can link straight to one.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { ManifestQueryRecord } from '@/api/client';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, Hourglass, Loader2, RefreshCw, Search, ShieldAlert } from '@/components/icons';
import type { IconType } from '@/components/icons';
import { Pagination } from '@/components/dashboard/Pagination';
import { BAND, FILL, TINT, type Tone } from '@/components/dashboard/tones';
import { stamp } from '@/components/shipment-detail/summary';
import { isUsPort, usePortName } from '@/components/shipment-detail/usePortName';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getDispositionInfo, type DispositionInfo } from '@/data/dispositionCodes';
import { useCapabilities } from '@/hooks/useBilling';
import { useCreateManifestQuery, useManifestQueries, useManifestQuery, usePollManifestQuery } from '@/hooks/useManifestQuery';
import { CAPABILITIES } from '@/lib/planMeta';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;
const PAGE = 'mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-12';
const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';
const TH = 'px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground';

type BillType = 'BOLNUMBER' | 'AWBNUMBER';

interface Disposition { dispositionCode: string; entryNumber?: string }
interface House {
  hawbNumber?: string; awbNumber?: string; flightNumber?: string; importingCarrierCode?: string;
  scheduledArrivalDate?: string; manifestQty?: string | number; manifestedPort?: string; dispositionMsg?: Disposition[];
}
interface Manifest {
  errorMessage?: string; carrierCode?: string; conveyanceName?: string; voyageFlightTripNo?: string;
  scheduledArrivalDate?: string; modeOfTransport?: string; manifestedPortOfUnlading?: string; houses?: House[];
}
type QueryRecord = ManifestQueryRecord;

const SEVERITY_TONE: Record<DispositionInfo['severity'], Tone> = { success: 'done', info: 'info', warning: 'soon', error: 'urgent' };

/** The answer's body, whichever of its two shapes it arrived in. */
function manifestOf(q: QueryRecord): Manifest | null {
  const raw = (q.response as { data?: { response?: Manifest | Manifest[] } } | null)?.data?.response;
  return (Array.isArray(raw) ? raw[0] : raw) ?? null;
}

/** The answer's dates are MMDDYY. */
function manifestDay(mmddyy: string | undefined): string | null {
  if (!mmddyy || !/^\d{6}$/.test(mmddyy)) return mmddyy || null;
  const d = new Date(2000 + Number(mmddyy.slice(4)), Number(mmddyy.slice(0, 2)) - 1, Number(mmddyy.slice(2, 4)));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Outcome { tone: Tone; icon: IconType; word: string; title: string; detail?: string }

/** One query in a sentence: still waiting, not on file, on file, or no answer. */
function outcomeOf(q: QueryRecord): Outcome {
  if (q.status === 'pending' || q.status === 'polling') {
    return { tone: 'info', icon: Hourglass, word: 'Checking', title: 'Checking the manifest.', detail: 'The answer shows here as soon as it arrives.' };
  }
  if (q.status !== 'completed') {
    return { tone: 'urgent', icon: AlertCircle, word: 'No answer', title: 'No answer came back.', detail: q.errorMessage ?? 'Ask again to retry.' };
  }
  const m = manifestOf(q);
  if (m?.errorMessage) {
    return { tone: 'soon', icon: AlertCircle, word: 'Not on file', title: 'CBP has no manifest on file for this bill.', detail: `CBP answered: ${m.errorMessage}` };
  }
  const houses = m?.houses ?? [];
  if (!m || (!houses.length && !m.carrierCode)) {
    return { tone: 'calm', icon: AlertCircle, word: 'Empty', title: 'The answer had no manifest details.' };
  }
  const held = houses.filter((h) => (h.dispositionMsg ?? []).some((d) => ['warning', 'error'].includes(getDispositionInfo(d.dispositionCode).severity))).length;
  const count = houses.length === 1 ? '1 house bill' : `${houses.length} house bills`;
  if (held) return { tone: 'soon', icon: ShieldAlert, word: 'Hold', title: 'On file with CBP, with a hold.', detail: `${count}, ${held} with a hold or exam code.` };
  return { tone: 'done', icon: CheckCircle2, word: 'On file', title: 'On file with CBP.', detail: houses.length ? `${count}.` : undefined };
}

function Fact({ label, sub, mono, children }: { label: string; sub?: string | null; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 truncate text-[14px] font-medium', mono && 'font-mono text-[13.5px]')}>
        {children || <span className="font-sans font-normal text-muted-foreground">Not in the answer</span>}
      </dd>
      {sub && <dd className="truncate text-[12px] text-muted-foreground">{sub}</dd>}
    </div>
  );
}

function PortFact({ code }: { code: string | undefined }) {
  const name = usePortName(code);
  return <Fact label={isUsPort(code) ? 'US port' : 'Port of unlading'} sub={name} mono>{code}</Fact>;
}

function Dispositions({ items }: { items: Disposition[] }) {
  if (!items.length) return <span className="text-[13px] text-muted-foreground">None yet</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((d, i) => {
        const info = getDispositionInfo(d.dispositionCode);
        return (
          <li key={i} title={info.description} className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium', TINT[SEVERITY_TONE[info.severity]])}>
            <span className="font-mono text-[11.5px]">{d.dispositionCode}</span>
            {info.label}
            {d.entryNumber && <span className="font-mono text-[11.5px] opacity-80">{d.entryNumber}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function Houses({ houses }: { houses: House[] }) {
  return (
    <div className="overflow-x-auto border-t border-border/70">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="border-b border-border/70">
            <th scope="col" className={TH}>House bill</th>
            <th scope="col" className={TH}>Carrier</th>
            <th scope="col" className={TH}>Arrival</th>
            <th scope="col" className={cn(TH, 'text-right')}>Quantity</th>
            <th scope="col" className={TH}>Port</th>
            <th scope="col" className={TH}>CBP status codes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {houses.map((h, i) => (
            <tr key={i}>
              <td className="px-4 py-2.5 font-mono font-medium">{h.hawbNumber ?? h.awbNumber ?? ''}</td>
              <td className="px-4 py-2.5 font-mono">{h.importingCarrierCode ?? ''}</td>
              <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{manifestDay(h.scheduledArrivalDate) ?? ''}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{h.manifestQty != null ? Number(h.manifestQty).toLocaleString() : ''}</td>
              <td className="px-4 py-2.5 font-mono">{h.manifestedPort ?? ''}</td>
              <td className="px-4 py-2.5"><Dispositions items={h.dispositionMsg ?? []} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Answer({ id, onAskAgain, asking }: { id: string; onAskAgain: (q: QueryRecord) => void; asking: boolean }) {
  const { data, isLoading, isError } = useManifestQuery(id);
  const poll = usePollManifestQuery();
  const { can } = useCapabilities();
  const q = data?.data;

  if (isLoading) return <Skeleton className="h-[72px] rounded-xl" />;
  if (isError || !q) {
    return <p role="alert" className={cn(PANEL, 'px-5 py-4 text-[13px] text-muted-foreground')}>That query could not be opened. Pick one from the list below.</p>;
  }

  const o = outcomeOf(q);
  const m = manifestOf(q);
  const waiting = o.word === 'Checking';
  const found = q.status === 'completed' && !!m && !m.errorMessage && o.tone !== 'calm';
  const houses = m?.houses ?? [];

  return (
    <section aria-label="Answer" aria-live="polite" className={PANEL}>
      <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4', BAND[o.tone])}>
        <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-white dark:text-background', FILL[o.tone])}>
          {waiting ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : <o.icon weight="duotone" className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-[16px] font-semibold leading-6">{o.title}</p>
          <p className="mt-0.5 text-[13px] text-foreground/75">
            <span className="font-mono">{q.bolNumber}</span>, asked {stamp(q.createdAt)}.{o.detail && ` ${o.detail}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {found && (
            <>
              <Button asChild size="sm" variant="outline" className="bg-card"><Link to={`/shipments/new?fromManifestQuery=${q.id}`}>Start ISF<ArrowRight aria-hidden /></Link></Button>
              {can(CAPABILITIES.ABI_ENTRY) && (
                <Button asChild size="sm"><Link to={`/abi-documents/new?fromManifest=${q.id}`}>Start entry<ArrowRight aria-hidden /></Link></Button>
              )}
            </>
          )}
          {(q.status === 'failed' || q.status === 'timeout') && (
            <Button
              size="sm" variant="outline" className="bg-card" disabled={poll.isPending}
              onClick={() => poll.mutate(q.id, { onError: (err: Error) => toast.error(err.message || 'Could not check again.') })}
            >
              {poll.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <RefreshCw aria-hidden />}Check again
            </Button>
          )}
          {q.status === 'completed' && !found && (
            <Button size="sm" variant="outline" className="bg-card" disabled={asking} onClick={() => onAskAgain(q)}>
              {asking ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <RefreshCw aria-hidden />}Ask again
            </Button>
          )}
        </div>
      </div>
      {found && m && (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-5">
            <Fact label="Carrier" mono>{m.carrierCode}</Fact>
            <Fact label={m.modeOfTransport === 'AIR' ? 'Flight' : 'Vessel'} sub={m.voyageFlightTripNo ? `Voyage ${m.voyageFlightTripNo}` : null}>{m.conveyanceName}</Fact>
            <Fact label="Scheduled arrival">{manifestDay(m.scheduledArrivalDate ?? houses[0]?.scheduledArrivalDate)}</Fact>
            <PortFact code={m.manifestedPortOfUnlading ?? houses[0]?.manifestedPort} />
            <Fact label="House bills">{houses.length ? String(houses.length) : null}</Fact>
          </dl>
          {houses.length > 0 && <Houses houses={houses} />}
        </>
      )}
    </section>
  );
}

function History({ openId, onOpen }: { openId: string | null; onOpen: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useManifestQueries({ page, limit: PAGE_SIZE });
  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <section aria-labelledby="history-title" className={PANEL}>
      <h2 id="history-title" className="px-5 py-3.5 text-[14px] font-semibold">Earlier queries</h2>
      {isLoading ? (
        <div className="space-y-2 border-t border-border/70 p-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : isError ? (
        <p role="alert" className="border-t border-border/70 px-5 py-6 text-[13px] text-muted-foreground">
          The list could not load. <button type="button" onClick={() => refetch()} className="text-foreground underline underline-offset-2">Retry</button>
        </p>
      ) : rows.length === 0 ? (
        <p className="border-t border-border/70 px-5 py-8 text-center text-[13px] text-muted-foreground">Nothing asked yet. Each bill you check is kept here with its answer.</p>
      ) : (
        <>
          <ul className="divide-y divide-border/60 border-t border-border/70">
            {rows.map((q) => {
              const o = outcomeOf(q);
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(q.id)}
                    aria-current={q.id === openId ? 'true' : undefined}
                    className={cn(
                      'grid w-full grid-cols-[minmax(0,1fr)_6.5rem_1rem] items-center gap-x-4 px-4 py-2.5 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_8rem_9.5rem_1rem]',
                      q.id === openId ? 'bg-muted/70' : 'can-hover:hover:bg-muted/50',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[13px] font-medium">{q.bolNumber}</span>
                      <span className="block text-[12px] text-muted-foreground">{q.bolType === 'AWBNUMBER' ? 'Air waybill' : 'Ocean bill'}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[13px]">
                      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[o.tone])} />{o.word}
                    </span>
                    <time dateTime={q.createdAt} className="text-[12.5px] tabular-nums text-muted-foreground max-sm:hidden">{stamp(q.createdAt)}</time>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} pageSize={PAGE_SIZE} onChange={setPage} label="Earlier queries pages" layoutId="manifest-page" />
        </>
      )}
    </section>
  );
}

export default function ManifestQueryPage() {
  const [params, setParams] = useSearchParams();
  const openId = params.get('id') ?? params.get('queryId');
  const [bill, setBill] = useState(params.get('bol') ?? '');
  const [type, setType] = useState<BillType>('BOLNUMBER');
  const create = useCreateManifestQuery();

  const open = (id: string) => setParams({ id }, { replace: true });
  useEffect(() => {
    if (openId) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [openId]);

  const ask = async (bolNumber: string, bolType: BillType) => {
    try {
      const result = await create.mutateAsync({ bolNumber, bolType });
      open(result.data.id);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'The query could not be sent. Try again.');
    }
  };

  return (
    <div className={PAGE}>
      <header>
        <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">Manifest query</h1>
        <p className="text-[13px] text-muted-foreground">See what CBP has on file for a bill before you file against it.</p>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); if (bill.trim()) ask(bill.trim(), type); }}
        className={cn(PANEL, 'flex flex-col gap-3 p-4 sm:flex-row sm:items-center')}
      >
        <div role="radiogroup" aria-label="Bill type" className="flex shrink-0 rounded-lg bg-muted p-0.5">
          {([['BOLNUMBER', 'Ocean bill'], ['AWBNUMBER', 'Air waybill']] as const).map(([value, label]) => (
            <button
              key={value} type="button" role="radio" aria-checked={type === value} onClick={() => setType(value)}
              className={cn(
                'flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
                type === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground can-hover:hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="manifest-bill" aria-label={type === 'AWBNUMBER' ? 'Air waybill number' : 'Master bill of lading number'}
            value={bill} onChange={(e) => setBill(e.target.value.toUpperCase())}
            placeholder={type === 'AWBNUMBER' ? 'Air waybill number' : 'Master bill number, with the carrier code, like MAEU123456789'}
            autoComplete="off" spellCheck={false} className="h-10 pl-9 font-mono placeholder:font-sans"
          />
        </div>
        <Button type="submit" disabled={create.isPending || !bill.trim()} className="h-10 shrink-0">
          {create.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Search aria-hidden />}Check manifest
        </Button>
      </form>

      {openId && <Answer key={openId} id={openId} asking={create.isPending} onAskAgain={(q) => ask(q.bolNumber, q.bolType === 'AWBNUMBER' ? 'AWBNUMBER' : 'BOLNUMBER')} />}

      <History openId={openId} onOpen={open} />
    </div>
  );
}
