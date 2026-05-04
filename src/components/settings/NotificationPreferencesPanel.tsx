import { useEffect, useMemo, useState } from 'react';
import { Bell, Mail, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/useFilings';
import type { NotificationPreference } from '@/types/notification';
import { cn } from '@/lib/utils';
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
  /** When critical: render the row with a subtle rose tint to call out
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
    title: 'ISF Filings',
    desc: 'Lifecycle events for ISF filings you create.',
    kinds: [
      { kind: 'filing_submitted', label: 'Submitted',          desc: 'A filing you started has been transmitted to CBP.' },
      { kind: 'filing_accepted',  label: 'Accepted by CBP',    desc: 'CBP accepted the filing.' },
      { kind: 'filing_rejected',  label: 'Rejected by CBP',    desc: 'CBP rejected the filing — needs your attention.', critical: true },
      { kind: 'filing_on_hold',   label: 'On hold',            desc: 'CBP placed the filing on hold.', critical: true },
      { kind: 'filing_amended',   label: 'Amended',            desc: 'An amendment for a filing was submitted.' },
      { kind: 'filing_cancelled', label: 'Cancelled',          desc: 'A filing was cancelled.' },
      { kind: 'filing_stale',     label: 'No CBP response',    desc: 'No CBP response after 72h on a submitted filing.' },
    ],
  },
  {
    id: 'deadlines',
    title: 'Deadlines',
    desc: 'Time-pressure reminders for upcoming and missed filings.',
    kinds: [
      { kind: 'deadline_warning', label: 'Approaching deadline', desc: '72h, 48h, or 24h before the ISF deadline.' },
      { kind: 'deadline_overdue', label: 'Overdue',              desc: 'Filing deadline has passed — penalties may apply.', critical: true },
    ],
  },
  {
    id: 'entries',
    title: 'CBP Entries (7501 / 3461)',
    desc: 'Entry-summary lifecycle events.',
    kinds: [
      { kind: 'entry_submitted', label: 'Submitted',         desc: 'An entry you sent to CBP is awaiting acceptance.' },
      { kind: 'entry_accepted',  label: 'Accepted by CBP',   desc: 'CBP accepted the entry.' },
      { kind: 'entry_rejected',  label: 'Rejected by CBP',   desc: 'CBP rejected the entry — needs your attention.', critical: true },
    ],
  },
  {
    id: 'manifests',
    title: 'Manifest Queries',
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
      { kind: 'api_error', label: 'API connection error', desc: 'A platform API call failed (e.g. CC unavailable).', critical: true },
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
    <div className="space-y-8">
      {/* ── Column header ── */}
      <div className="flex items-center justify-end gap-8 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
        <span className="inline-flex items-center gap-1.5">
          <Bell className="h-3 w-3" />
          In-app
        </span>
        <span className="inline-flex items-center gap-1.5 w-12 justify-center">
          <Mail className="h-3 w-3" />
          Email
        </span>
      </div>

      {/* ── Groups ── */}
      {GROUPS.map(group => (
        <section key={group.id} className="space-y-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{group.title}</h3>
            <p className="text-[12px] text-muted-foreground/80 mt-0.5">{group.desc}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
            {group.kinds.map(meta => {
              const v = draft[meta.kind] ?? { inApp: true, email: true };
              return (
                <div
                  key={meta.kind}
                  className={cn(
                    'flex items-start gap-4 px-4 py-3 transition-colors',
                    meta.critical && (!v.inApp || !v.email) && 'bg-red-500/[0.025]',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      'text-[13px] font-medium text-foreground',
                      meta.critical && (!v.inApp || !v.email) && 'text-red-700 dark:text-red-400',
                    )}>
                      {meta.label}
                      {meta.critical && (
                        <span className="ml-2 inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600 dark:text-red-400">
                          critical
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-muted-foreground/80 mt-0.5 leading-snug">{meta.desc}</p>
                  </div>

                  <label className="flex items-center justify-center w-12 cursor-pointer mt-0.5">
                    <Checkbox
                      checked={v.inApp}
                      onCheckedChange={(c) => toggle(meta.kind, 'inApp', c === true)}
                      aria-label={`${meta.label} — in-app`}
                    />
                  </label>
                  <label className="flex items-center justify-center w-12 cursor-pointer mt-0.5">
                    <Checkbox
                      checked={v.email}
                      onCheckedChange={(c) => toggle(meta.kind, 'email', c === true)}
                      aria-label={`${meta.label} — email`}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* ── Save bar ── */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-[12px] text-muted-foreground/80">
          {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </p>
        <Button
          onClick={handleSave}
          disabled={!dirty || update.isPending}
          className="gap-1.5 h-9 px-4 rounded-lg font-medium"
        >
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save preferences
        </Button>
      </div>
    </div>
  );
}
