import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from '@/components/icons';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { organizationApi } from '@/api/client';
import { FILL, TINT, type Tone } from '@/components/dashboard/tones';
import { cn } from '@/lib/utils';

const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';
const LABEL = 'text-[12px] text-muted-foreground';
const VALUE = 'mt-0.5 text-[14px] font-medium';

function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium', TINT[tone])}>
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[tone])} />
      {children}
    </span>
  );
}

/**
 * The org's CBP identity (native go-live Phase 2): who files their ISF and
 * entries, and whether CBP has approved MyCargoLens as their service center.
 * Filer code and approval are set by MyCargoLens with the client; owners and
 * admins choose the default ISF filer.
 */
export function CbpIdentityCard({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['org', 'cbp'],
    queryFn: () => organizationApi.cbpIdentity(),
  });
  const cbp = data?.cbp;
  const approved = !!cbp?.serviceCenterApprovedAt;
  const clientReady = !!cbp?.filerCode && approved;

  const setDefault = useMutation({
    mutationFn: (mode: 'SIGMA' | 'CLIENT') => organizationApi.setIsfFilerDefault(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org', 'cbp'] });
      toast.success('Default ISF filer saved');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not save'),
  });

  return (
    <section aria-labelledby="cbp-identity-title" className={PANEL}>
      <div className="px-5 py-3.5">
        <h2 id="cbp-identity-title" className="text-[14px] font-semibold">CBP identity</h2>
        <p className="text-[13px] text-muted-foreground">Who files your ISF and entries with US Customs and Border Protection.</p>
      </div>
      <div className="space-y-5 border-t border-border/70 px-5 py-4 text-[13px]">
        {isLoading || !cbp ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Loading" />
        ) : (
          <>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <dt className={LABEL}>Your filer code</dt>
                <dd className={cn(VALUE, cbp.filerCode ? 'font-mono' : 'text-muted-foreground')}>{cbp.filerCode ?? 'Not assigned yet'}</dd>
              </div>
              <div>
                <dt className={LABEL}>MyCargoLens as your service center</dt>
                <dd className="mt-1">
                  {approved ? (
                    <StatusPill tone="done">
                      Approved <span className="tabular-nums">{new Date(cbp.serviceCenterApprovedAt!).toLocaleDateString()}</span>
                    </StatusPill>
                  ) : (
                    <StatusPill tone="soon">Awaiting CBP approval</StatusPill>
                  )}
                </dd>
              </div>
              <div>
                <dt className={LABEL}>Connection</dt>
                <dd className={VALUE}>{cbp.gateway === 'NATIVE' ? 'MyCargoLens ABI' : 'Not on MyCargoLens ABI yet'}</dd>
              </div>
            </dl>

            {!approved && (
              <p className="rounded-lg bg-soon-tint px-4 py-3 text-[13px]">
                To file entries, or ISF under your own filer code, ask your CBP client representative to add
                MyCargoLens (Sigma Technology Partners, LLC) as your service center. Until then, MyCargoLens can
                file your ISF as ISF filer under <span className="font-mono">{cbp.sigmaFilerCode}</span>.
              </p>
            )}

            <div>
              <h3 className="text-[13px] font-medium">Default ISF filer</h3>
              <RadioGroup
                value={cbp.isfFilerModeDefault}
                onValueChange={(v) => setDefault.mutate(v as 'SIGMA' | 'CLIENT')}
                disabled={!canEdit || setDefault.isPending}
                className="mt-1 gap-0 divide-y divide-border/60"
              >
                <label className="flex cursor-pointer items-start gap-3 py-2.5">
                  <RadioGroupItem value="SIGMA" id="isf-sigma" className="mt-0.5" />
                  <span>
                    <Label htmlFor="isf-sigma" className="cursor-pointer text-[13px]">
                      MyCargoLens files as ISF filer (<span className="font-mono">{cbp.sigmaFilerCode}</span>)
                    </Label>
                    <span className="mt-0.5 block text-[12.5px] text-muted-foreground">No filer code of your own needed.</span>
                  </span>
                </label>
                <label className={cn('flex items-start gap-3 py-2.5', clientReady ? 'cursor-pointer' : 'opacity-60')}>
                  <RadioGroupItem value="CLIENT" id="isf-client" className="mt-0.5" disabled={!clientReady} />
                  <span>
                    <Label htmlFor="isf-client" className={cn('text-[13px]', clientReady && 'cursor-pointer')}>
                      We file under our own code{cbp.filerCode ? <> (<span className="font-mono">{cbp.filerCode}</span>)</> : ''}
                    </Label>
                    <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                      {clientReady ? 'Uses your filer code through our approved service-center queue.' : 'Available once your filer code is set up and CBP approves our queue.'}
                    </span>
                  </span>
                </label>
              </RadioGroup>
              <p className="mt-1 text-[12px] text-muted-foreground">You can still choose per filing.</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
