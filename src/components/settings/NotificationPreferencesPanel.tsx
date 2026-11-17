import { useEffect, useMemo, useState } from 'react';
import { Save, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/useFilings';
import type { NotificationPreference } from '@/types/notification';
import { cn } from '@/lib/utils';
import { FILL, TINT } from '@/components/dashboard/tones';
import { toast } from 'sonner';

// ─── Friendly labels + grouping for the matrix ───────────────────────
// Source of truth for what shows up in Settings. Adding a new kind
// requires touching this file (so every new kind gets a human label and
// an explicit group), not just the backend KNOWN_KINDS list.

interface KindMeta {
  kind: string;
  label: string;
  /** One-line description so the user knows when this fires. */
  desc: string;
  /** When critical: render the row with the urgent tint to call out
   *  that turning it off is risky (filing rejected, payment failed). */
  critical?: boolean;
}

interface Group {
  id: string;
  title: string;
  desc: string;
  kinds: KindMeta[];
}

const GROUPS: Group[] = [
  {
    id: 'filings',
    title: 'ISF filings',
    desc: 'Lifecycle events for ISF filings you create.',
    kinds: [
      { kind: 'filing_submitted', label: 'Sent',               desc: 'A filing you started has been transmitted to CBP.' },
      { kind: 'filing_accepted',  label: 'Accepted by CBP',    desc: 'CBP accepted the filing.' },
      { kind: 'filing_rejected',  label: 'Rejected by CBP',    desc: 'CBP rejected the filing. It needs your attention.', critical: true },
      { kind: 'filing_on_hold',   label: 'On hold',            desc: 'CBP placed the filing on hold.', critical: true },
      { kind: 'filing_amended',   label: 'Amended',            desc: 'An amendment for a filing was sent.' },
      { kind: 'filing_cancelled', label: 'Cancelled',          desc: 'A filing was cancelled.' },
      { kind: 'filing_stale',     label: 'No CBP response',    desc: 'No CBP response after 72h on a sent filing.' },
    ],
  },
  {
    id: 'deadlines',
    title: 'Deadlines',
    desc: 'Time-pressure reminders for upcoming and missed filings.',
    kinds: [
      { kind: 'deadline_warning', label: 'Approaching deadline', desc: '72h, 48h, or 24h before the ISF deadline.' },
      { kind: 'deadline_overdue', label: 'Overdue',              desc: 'Filing deadline has passed. Penalties may apply.', critical: true },
    ],
  },
  {
    id: 'entries',
    title: 'CBP entries (7501 / 3461)',
    desc: 'Entry-summary lifecycle events.',
    kinds: [
      { kind: 'entry_submitted', label: 'Sent',              desc: 'An entry you sent to CBP is awaiting acceptance.' },
      { kind: 'entry_accepted',  label: 'Accepted by CBP',   desc: 'CBP accepted the entry.' },
      { kind: 'entry_rejected',  label: 'Rejected by CBP',   desc: 'CBP rejected the entry. It needs your attention.', critical: true },
    ],
  },
  {
    id: 'manifests',
    title: 'Manifest queries',
    desc: 'Personal lookups against CBP manifest data.',
    kinds: [
      { kind: 'manifest_query_complete', label: 'Results ready', desc: 'A manifest query has returned data.' },
      { kind: 'manifest_query_failed',   label: 'Failed',         desc: 'A manifest query timed out or failed.' },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    desc: 'Subscription state and payment events. Admins and owners only.',
    kinds: [
      { kind: 'billing_subscription_changed',  label: 'Subscription activated', desc: 'A new plan is now active for the org.' },
      { kind: 'billing_subscription_canceled', label: 'Subscription canceled',  desc: 'The org has been downgraded to Starter.' },
      { kind: 'billing_payment_failed',        label: 'Payment failed',          desc: 'A subscription invoice failed to charge.', critical: true },
    ],
  },
  {
    id: 'team',
    title: 'Team',
    desc: 'Member invitations and joins.',
    kinds: [
      { kind: 'team_member_joined', label: 'New member joined', desc: 'Someone accepted an invite and joined the org.' },
    ],
  },
  {
    id: 'system',
    title: 'System',
    desc: 'Operational alerts about the platform itself.',
    kinds: [
      { kind: 'api_error', label: 'API connection error', desc: 'A connection to a filing or data service failed.', critical: true },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────

type PrefsMap = Record<string, { inApp: boolean; email: boolean }>;

function toMap(prefs: NotificationPreference[]): PrefsMap {
  const map: PrefsMap = {};
  for (const p of prefs) map[p.kind] = { inApp: p.inApp, email: p.email };
  return map;
}

function isDifferent(a: PrefsMap, b: PrefsMap, kinds: string[]): boolean {
  for (const k of kinds) {
    const av = a[k] ?? { inApp: true, email: true };
    const bv = b[k] ?? { inApp: true, email: true };
    if (av.inApp !== bv.inApp || av.email !== bv.email) return true;
  }
  return false;
}

const ALL_KINDS = GROUPS.flatMap(g => g.kinds.map(k => k.kind));

export function NotificationPreferencesPanel() {
  const { data, isLoading } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const [draft, setDraft] = useState<PrefsMap>({});
  const initial = useMemo<PrefsMap>(() => toMap(data?.data ?? []), [data]);

  // Hydrate the draft from server state on first load + on refetch.
  useEffect(() => {
    if (data?.data) setDraft(toMap(data.data));
  }, [data]);

  const dirty = isDifferent(initial, draft, ALL_KINDS);

  function toggle(kind: string, channel: 'inApp' | 'email', value: boolean) {
    setDraft(prev => {
      const current = prev[kind] ?? { inApp: true, email: true };
      return { ...prev, [kind]: { ...current, [channel]: value } };
    });
  }

  function handleSave() {
    const payload: NotificationPreference[] = ALL_KINDS.map(kind => {
      const v = draft[kind] ?? { inApp: true, email: true };
      return { kind, inApp: v.inApp, email: v.email };
    });
    update.mutate(payload, {
      onSuccess: () => toast.success('Notification preferences saved'),
      onError:   (err: any) => toast.error(err?.message ?? 'Failed to save preferences'),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="text-[13px]">
      {/* ── Column header ── */}
      <div aria-hidden className="flex items-center justify-end gap-4 pb-1 text-[12px] font-medium text-muted-foreground">
        <span className="w-12 text-center">In-app</span>
        <span className="w-12 text-center">Email</span>
      </div>

      {/* ── Groups ── */}
      <div className="divide-y divide-border/70">
        {GROUPS.map(group => (
          <section key={group.id} aria-labelledby={`notif-${group.id}`} className="py-4 first:pt-0">
            <h3 id={`notif-${group.id}`} className="text-[14px] font-semibold">{group.title}</h3>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{group.desc}</p>

            <div className="mt-2 divide-y divide-border/60">
              {group.kinds.map(meta => {
                const v = draft[meta.kind] ?? { inApp: true, email: true };
                const muted = !!meta.critical && (!v.inApp || !v.email);
                return (
                  <div
                    key={meta.kind}
                    className={cn(
                      '-mx-2 flex items-start gap-4 rounded-md px-2 py-2.5 transition-colors duration-150',
                      muted && 'bg-urgent-tint',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-foreground">
                        {meta.label}
                        {meta.critical && (
                          <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium', TINT.urgent)}>
                            <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL.urgent)} />
                            Critical
                          </span>
                        )}
                      </p>
                      <p className={cn('mt-0.5 text-[12.5px] leading-snug', muted ? 'text-foreground/75' : 'text-muted-foreground')}>{meta.desc}</p>
                    </div>

                    <label className="mt-0.5 flex w-12 cursor-pointer items-center justify-center">
                      <Checkbox
                        checked={v.inApp}
                        onCheckedChange={(c) => toggle(meta.kind, 'inApp', c === true)}
                        aria-label={`${meta.label}, in-app`}
                      />
                    </label>
                    <label className="mt-0.5 flex w-12 cursor-pointer items-center justify-center">
                      <Checkbox
                        checked={v.email}
                        onCheckedChange={(c) => toggle(meta.kind, 'email', c === true)}
                        aria-label={`${meta.label}, email`}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ── Save bar ── */}
      <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
        <p className="text-[12.5px] text-muted-foreground" aria-live="polite">
          {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </p>
        <Button onClick={handleSave} disabled={!dirty || update.isPending}>
          {update.isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Save aria-hidden />}
          Save preferences
        </Button>
      </div>
    </div>
  );
}
