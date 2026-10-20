import { useQuery } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { organizationApi } from '@/api/client';
import type { Filing } from '@/types/shipment';

/**
 * Confirm before anything reaches CBP (audit FPR-11): the action, who files
 * it (MyCargoLens under S7P or the org's own code), the CBP environment, and
 * that the shipment is charged when CBP accepts it.
 */
export function TransmitConfirmDialog({
  open, onOpenChange, filing, actionLabel, onConfirm, pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filing: Filing;
  actionLabel: string;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const { data } = useQuery({ queryKey: ['org', 'cbp'], queryFn: () => organizationApi.cbpIdentity(), enabled: open });
  const cbp = data?.cbp;
  const mode = filing.isfFilerMode || cbp?.isfFilerModeDefault || 'SIGMA';
  const filer = filing.isfFilerCode
    ?? (mode === 'CLIENT' ? cbp?.filerCode ?? 'your filer code' : cbp?.sigmaFilerCode ?? 'S7P');
  const environment = cbp?.environment === 'PROD' ? 'CBP production' : cbp?.environment === 'CERT' ? 'CBP certification (test)' : 'CBP';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{actionLabel}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>This sends the filing to U.S. Customs and Border Protection.</p>
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 rounded-md border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Bill</dt>
                <dd className="font-mono">{filing.houseBol || filing.masterBol || '—'}</dd>
                <dt className="text-muted-foreground">Importer</dt>
                <dd>{filing.importerName || '—'}{filing.importerNumber ? ` · ${filing.importerNumber}` : ''}</dd>
                <dt className="text-muted-foreground">Filed under</dt>
                <dd className="font-mono">{filer}{mode === 'SIGMA' && !filing.isfFilerCode ? ' (MyCargoLens as ISF filer)' : ''}</dd>
                <dt className="text-muted-foreground">Sent to</dt>
                <dd>{environment}</dd>
              </dl>
              <p className="text-xs text-muted-foreground">The shipment is charged under your plan when CBP accepts it.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); onConfirm(); }} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send to CBP
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
