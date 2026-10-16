import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminApi } from '@/api/client';
import type { AdminOrganization } from '@/api/client';

/**
 * Set a client's CBP identity (native go-live Phase 2). This is what makes
 * their filings legal to transmit: their own filer code (never S7P), and the
 * date their CBP client rep added our queue as their service center.
 */
export function CbpSetupDialog({ org, onClose }: { org: AdminOrganization | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [filerCode, setFilerCode] = useState('');
  const [gateway, setGateway] = useState<'NATIVE' | 'CC'>('NATIVE');
  const [isfDefault, setIsfDefault] = useState<'SIGMA' | 'CLIENT'>('SIGMA');
  const [approvedAt, setApprovedAt] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!org) return;
    setFilerCode(org.cbp?.filerCode ?? '');
    setGateway(org.cbp?.gateway ?? 'NATIVE');
    setIsfDefault(org.cbp?.isfFilerModeDefault ?? 'SIGMA');
    setApprovedAt(org.cbp?.serviceCenterApprovedAt ? org.cbp.serviceCenterApprovedAt.slice(0, 10) : '');
    setApprovedBy(org.cbp?.serviceCenterApprovedBy ?? '');
    setNotes(org.cbp?.notes ?? '');
  }, [org]);

  const code = filerCode.trim().toUpperCase();
  const codeError =
    code && !/^[A-Z0-9]{3}$/.test(code) ? 'Three letters or digits'
    : code === 'S7P' ? "S7P is Sigma's own filer code"
    : undefined;
  const clientModeBlocked = isfDefault === 'CLIENT' && (!code || !approvedAt);

  const save = useMutation({
    mutationFn: () =>
      adminApi.setCbpSetup(org!.id, {
        gateway,
        filerCode: code || null,
        isfFilerModeDefault: isfDefault,
        serviceCenterApprovedAt: approvedAt || null,
        serviceCenterApprovedBy: approvedBy.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success(`CBP setup saved for ${org!.name}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      onClose();
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not save CBP setup'),
  });

  return (
    <Dialog open={!!org} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>CBP setup · {org?.name}</DialogTitle>
          <DialogDescription>
            Entries, and ISF filed under the client&apos;s own code, transmit only with a filer code and an
            approved service-center queue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cbp-filer">Client filer code</Label>
              <Input
                id="cbp-filer"
                value={filerCode}
                onChange={(e) => setFilerCode(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="e.g. ABC"
                className="font-mono uppercase"
                aria-invalid={codeError ? true : undefined}
              />
              {codeError && <p className="text-xs text-red-600">{codeError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Gateway</Label>
              <Select value={gateway} onValueChange={(v) => setGateway(v as 'NATIVE' | 'CC')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NATIVE">Native (our CBP connection)</SelectItem>
                  <SelectItem value="CC">CustomsCity (fallback)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cbp-approved">Rep approved our queue on</Label>
              <Input id="cbp-approved" type="date" value={approvedAt} onChange={(e) => setApprovedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cbp-approver">Approved by (CBP rep)</Label>
              <Input id="cbp-approver" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Name or email" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Default ISF filer</Label>
            <Select value={isfDefault} onValueChange={(v) => setIsfDefault(v as 'SIGMA' | 'CLIENT')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SIGMA">Sigma files as ISF filer (S7P)</SelectItem>
                <SelectItem value="CLIENT">Client files under their own code</SelectItem>
              </SelectContent>
            </Select>
            {clientModeBlocked && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Filing under the client&apos;s code needs a filer code and an approval date.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cbp-notes">Notes</Label>
            <Textarea id="cbp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="LOI sent, rep contact, anything worth keeping" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !!codeError || clientModeBlocked}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
