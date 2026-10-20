import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { abiDocumentsApi } from '@/api/client';

/**
 * "Would CBP accept this?" (audit FNA-21, CAP-06): runs the same native
 * build and CATAIR validation the transmit runs, on the last saved version,
 * and lists every issue before the user sends anything.
 */
export function CbpPreflightCard({ docId }: { docId: string }) {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['abi', docId, 'preflight'],
    queryFn: () => abiDocumentsApi.preflight(docId),
    staleTime: 0,
  });

  return (
    <Card className={data ? (data.ready ? 'border-green-200 dark:border-green-900' : 'border-amber-300 dark:border-amber-800') : ''}>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center gap-2">
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : data?.ready ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-amber-600" />
          )}
          <span className="text-sm font-medium">
            {isFetching ? 'Checking against CBP rules…' : data?.ready ? 'Ready for CBP' : 'Fix these before sending to CBP'}
          </span>
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-check
          </Button>
        </div>
        {data && !data.ready && (
          <div className="space-y-2 text-sm">
            {data.error && <p>{data.error}</p>}
            {data.issues && data.issues.length > 0 && (
              <ul className="space-y-1.5">
                {data.issues.map((i, k) => (
                  <li key={k} className="rounded-md border bg-muted/30 px-3 py-2">
                    {i.field && <span className="font-mono text-xs text-muted-foreground mr-2">{i.field}</span>}
                    {i.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {data?.ready && (
          <p className="text-xs text-muted-foreground">
            Files under {data.filerCode}{data.releaseRequested ? ', certified for cargo release' : ''}.
            {data.conversions && data.conversions.length > 0 && (
              <> Converted at CBP&apos;s certified rates: {data.conversions.map((c) => `${c.amount.toLocaleString()} ${c.currency} = $${c.usd.toLocaleString()} (rate ${c.rate}, ${c.rateDate})`).join('; ')}.</>
            )}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">Checks the last saved version of this entry.</p>
      </CardContent>
    </Card>
  );
}
