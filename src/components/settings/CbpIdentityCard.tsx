import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Landmark, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { organizationApi } from '@/api/client';

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
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          CBP identity
        </CardTitle>
        <CardDescription>Who files your ISF and entries with US Customs and Border Protection.</CardDescription>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">
        {isLoading || !cbp ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Your filer code</dt>
                <dd className="mt-1 font-mono font-semibold">{cbp.filerCode ?? 'Not assigned yet'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">MyCargoLens as your service center</dt>
                <dd className="mt-1">
                  {approved ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Approved {new Date(cbp.serviceCenterApprovedAt!).toLocaleDateString()}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      <Clock className="mr-1 h-3 w-3" />
                      Awaiting CBP approval
                    </Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Connection</dt>
                <dd className="mt-1">{cbp.gateway === 'NATIVE' ? 'MyCargoLens ABI' : 'Fallback gateway'}</dd>
              </div>
            </dl>

            {!approved && (
              <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                To file entries, or ISF under your own filer code, ask your CBP client representative to add
                MyCargoLens (Sigma Technology Partners, LLC) as your service center. Until then, MyCargoLens can
                file your ISF as ISF filer under {cbp.sigmaFilerCode}.
              </p>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium">Default ISF filer</div>
              <RadioGroup
                value={cbp.isfFilerModeDefault}
                onValueChange={(v) => setDefault.mutate(v as 'SIGMA' | 'CLIENT')}
                disabled={!canEdit || setDefault.isPending}
                className="gap-2"
              >
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <RadioGroupItem value="SIGMA" id="isf-sigma" className="mt-0.5" />
                  <span>
                    <Label htmlFor="isf-sigma" className="cursor-pointer">MyCargoLens files as ISF filer ({cbp.sigmaFilerCode})</Label>
                    <span className="block text-xs text-muted-foreground">No filer code of your own needed.</span>
                  </span>
                </label>
                <label className={`flex items-start gap-3 rounded-md border p-3 ${clientReady ? 'cursor-pointer' : 'opacity-60'}`}>
                  <RadioGroupItem value="CLIENT" id="isf-client" className="mt-0.5" disabled={!clientReady} />
                  <span>
                    <Label htmlFor="isf-client" className={clientReady ? 'cursor-pointer' : ''}>
                      We file under our own code{cbp.filerCode ? ` (${cbp.filerCode})` : ''}
                    </Label>
                    <span className="block text-xs text-muted-foreground">
                      {clientReady ? 'Uses your filer code through our approved service-center queue.' : 'Available once your filer code is set up and CBP approves our queue.'}
                    </span>
                  </span>
                </label>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">You can still choose per filing.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
