import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { filingsApi, type FilingCbpActivity } from '@/api/client';
import { rejectedChanges } from '@/lib/isfRejectedChanges';

/**
 * BUG-015: CBP rejected the last ISF changes and still holds the earlier
 * accepted version; the details on this page are the rejected edits.
 * Shares the CBP timeline's query, so it costs no extra request.
 */
export function IsfRejectedChangesBanner({ filingId }: { filingId: string }) {
  const { data } = useQuery<FilingCbpActivity>({
    queryKey: ['filing', filingId, 'cbp'],
    queryFn: () => filingsApi.cbpActivity(filingId),
  });
  const r = rejectedChanges(data);
  if (!r) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
      <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" aria-hidden />
      <div className="text-sm space-y-1">
        <p className="font-semibold">CBP rejected your last changes. It still has the version it accepted before.</p>
        <p>The details on this page are the changes CBP rejected. Fix them and amend again, or check the CBP activity below.</p>
        {r.reasons.length > 0 && (
          <ul className="list-disc pl-5">
            {r.reasons.map((x) => <li key={x}>{x}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
