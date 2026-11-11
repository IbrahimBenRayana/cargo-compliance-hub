/**
 * The list's filters, sort and page live in the URL, so Back from a shipment
 * returns to the same page and a filtered view can be linked to.
 */
import { useSearchParams } from 'react-router-dom';
import { endOfDay, isValid, parse, startOfDay } from 'date-fns';
import type { FilingListParams } from '@/api/client';
import { isTab, TABS, type Tab } from './status';

export const PAGE_SIZE = 25;

const SORTS = ['createdAt', 'masterBol', 'importerName', 'status', 'estimatedDeparture', 'filingDeadline'] as const;
export type Sort = (typeof SORTS)[number];

export interface ListState {
  tab: Tab;
  q: string;
  origins: string[];
  /** Local calendar days, yyyy-MM-dd. */
  from: string | null;
  to: string | null;
  sort: Sort;
  dir: 'asc' | 'desc';
  page: number;
}

const DEFAULTS: ListState = { tab: 'all', q: '', origins: [], from: null, to: null, sort: 'createdAt', dir: 'desc', page: 1 };

export const toDay = (day: string) => parse(day, 'yyyy-MM-dd', new Date());
const day = (v: string | null) => (v && isValid(toDay(v)) ? v : null);

export function readState(params: URLSearchParams): ListState {
  const tab = params.get('tab');
  const sort = params.get('sort');
  return {
    tab: isTab(tab) ? tab : DEFAULTS.tab,
    q: params.get('q') ?? '',
    origins: (params.get('origin') ?? '').split(',').filter((c) => /^[A-Z]{2}$/.test(c)),
    from: day(params.get('from')),
    to: day(params.get('to')),
    sort: (SORTS as readonly string[]).includes(sort ?? '') ? (sort as Sort) : DEFAULTS.sort,
    dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, parseInt(params.get('page') ?? '', 10) || 1),
  };
}

function writeState(s: ListState): URLSearchParams {
  const out = new URLSearchParams();
  if (s.tab !== DEFAULTS.tab) out.set('tab', s.tab);
  if (s.q) out.set('q', s.q);
  if (s.origins.length) out.set('origin', s.origins.join(','));
  if (s.from) out.set('from', s.from);
  if (s.to) out.set('to', s.to);
  if (s.sort !== DEFAULTS.sort || s.dir !== DEFAULTS.dir) {
    out.set('sort', s.sort);
    out.set('dir', s.dir);
  }
  if (s.page > 1) out.set('page', String(s.page));
  return out;
}

export const hasFilters = (s: ListState) => !!(s.q || s.origins.length || s.from || s.to);

/** What the filters ask the server, without status, sort or page. */
export function facetQuery(s: ListState) {
  return {
    search: s.q || undefined,
    origin: s.origins.join(',') || undefined,
    etdFrom: s.from ? startOfDay(toDay(s.from)).toISOString() : undefined,
    etdTo: s.to ? endOfDay(toDay(s.to)).toISOString() : undefined,
  };
}

export function listQuery(s: ListState): FilingListParams {
  const statuses = TABS.find((t) => t.key === s.tab)!.statuses;
  return {
    ...facetQuery(s),
    status: statuses.join(',') || undefined,
    sortBy: s.sort,
    sortOrder: s.dir,
    page: s.page,
    limit: PAGE_SIZE,
  };
}

export function useListState() {
  const [params, setParams] = useSearchParams();
  const state = readState(params);
  /** Any change but the page itself starts again at page 1. */
  const update = (patch: Partial<ListState>) =>
    setParams(writeState({ ...state, ...patch, page: patch.page ?? 1 }), { replace: true });
  const clearFilters = () => update({ q: '', origins: [], from: null, to: null });
  return { state, update, clearFilters };
}
