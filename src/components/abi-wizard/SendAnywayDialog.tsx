/**
 * "Send anyway?" for CBP warnings (foreign IOR rule, ES 894): the server
 * answers 409 CBP_WARNINGS_UNACKNOWLEDGED when CBP will likely reject the
 * entry for CTPAT. The user can go back and fix it, or send anyway, which
 * the server records in the audit log.
 */
import { useState } from 'react';
import { AlertTriangle } from '@/components/icons';
import type { CbpWarning } from '@/api/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

/** The warnings in a failed send, or null when it failed for another reason. */
export function cbpWarningsFrom(err: unknown): CbpWarning[] | null {
  const body = (err as { body?: { code?: string; warnings?: CbpWarning[] } } | null)?.body;
  return body?.code === 'CBP_WARNINGS_UNACKNOWLEDGED' && Array.isArray(body.warnings) ? body.warnings : null;
}

export function SendAnywayDialog({
  warnings,
  onCancel,
  onSendAnyway,
}: {
  warnings: CbpWarning[] | null;
  onCancel: () => void;
  onSendAnyway: () => void;
}) {
  const [sure, setSure] = useState(false);
  return (
    <AlertDialog
      open={warnings !== null}
      onOpenChange={(open) => {
        if (!open) {
          setSure(false);
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-soon" />
            CBP will likely reject this entry
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {warnings?.map((w) => (
                <p key={w.code}>{w.message}</p>
              ))}
              <p>
                CBP checks CTPAT itself. If your CTPAT answers are out of date, fix them on the Importer step or in
                Settings instead.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-start gap-3">
          <Checkbox id="send-anyway" checked={sure} onCheckedChange={(c) => setSure(c === true)} className="mt-0.5 rounded-[4px]" />
          <Label htmlFor="send-anyway" className="cursor-pointer text-sm font-normal leading-snug">
            I understand, send it anyway. This is recorded.
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Go back</AlertDialogCancel>
          <AlertDialogAction
            disabled={!sure}
            onClick={() => {
              setSure(false);
              onSendAnyway();
            }}
          >
            Send anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
