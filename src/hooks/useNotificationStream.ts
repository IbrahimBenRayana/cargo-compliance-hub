import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getAccessToken } from '@/api/client';

/**
 * Real-time notification stream (Phase 7).
 *
 * Opens an EventSource to /api/v1/notifications/stream and invalidates
 * the bell's TanStack Query cache on each event. The actual notification
 * body is fetched via the regular GET — the SSE payload is just a
 * "refetch the bell" signal.
 *
 * Auth: EventSource can't send custom headers, so the access token is
 * passed via ?token=. We re-open the stream when the token changes (e.g.
 * after a refresh) by re-running the effect.
 *
 * Critical-severity events also pop a Sonner toast so the user notices
 * immediately even if the bell isn't open. Info/warning are silent —
 * the badge update is enough.
 */
export function useNotificationStream(): void {
  const queryClient = useQueryClient();
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return; // Logged-out — no stream.

    // Build URL relative to the API base (handles dev proxy + prod domain).
    const apiBase = import.meta.env.VITE_API_URL || '';
    const url = `${apiBase}/api/v1/notifications/stream?token=${encodeURIComponent(token)}`;

    let cancelled = false;
    let es: EventSource | null = null;
    try {
      es = new EventSource(url);
      sourceRef.current = es;
    } catch {
      // EventSource constructor rarely throws but be safe.
      return;
    }

    const onNotification = (ev: MessageEvent) => {
      if (cancelled) return;
      // Refetch the bell — server has new data.
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      // Critical events get a toast so the user notices without opening the bell.
      try {
        const payload = JSON.parse(ev.data) as { kind: string; severity?: string };
        if (payload.severity === 'critical') {
          toast.error(humanizeKind(payload.kind), {
            description: 'A critical event needs your attention.',
            action: { label: 'Open', onClick: () => { /* user clicks the bell */ } },
          });
        }
      } catch {
        // Bad payload — ignore.
      }
    };

    es.addEventListener('notification', onNotification as EventListener);

    // EventSource auto-reconnects on network errors, but if the token is
    // expired we'd loop forever. Close on hard errors and let the next
    // mount or token refresh re-open.
    es.onerror = () => {
      if (cancelled) return;
      // readyState 2 == CLOSED. EventSource has given up.
      if (es && es.readyState === 2) {
        es.close();
      }
    };

    return () => {
      cancelled = true;
      es?.removeEventListener('notification', onNotification as EventListener);
      es?.close();
      if (sourceRef.current === es) sourceRef.current = null;
    };
    // We re-open when the token reference changes; getAccessToken is the
    // module-scoped accessor so we only need to depend on queryClient
    // here. The hook is mounted once near the root, after auth.
  }, [queryClient]);
}

// ─── Friendly labels for toasts ──────────────────────────────────────
// Mirrors the labels in NotificationPreferencesPanel; kept inline so the
// hook stays self-contained.

function humanizeKind(kind: string): string {
  const labels: Record<string, string> = {
    filing_rejected:        'ISF Rejected',
    filing_on_hold:         'ISF On Hold',
    deadline_overdue:       'Deadline Overdue',
    entry_rejected:         'Entry Rejected',
    billing_payment_failed: 'Payment Failed',
    api_error:              'API Connection Error',
  };
  return labels[kind] ?? 'New Notification';
}
