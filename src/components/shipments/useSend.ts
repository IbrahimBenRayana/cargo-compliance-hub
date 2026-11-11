import { useState } from 'react';
import { toast } from 'sonner';
import { useSubmitFiling } from '@/hooks/useFilings';
import { CAPABILITIES, type Capability } from '@/lib/planMeta';
import type { Filing } from '@/types/shipment';
import { refOf } from './status';

/** Sending can be refused by the plan; that opens the upgrade prompt instead of an error. */
export function useSend(onPlanLimit: (p: { capability?: Capability }) => void) {
  const submit = useSubmitFiling();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const send = async (f: Filing) => {
    setSendingId(f.id);
    try {
      await submit.mutateAsync(f.id);
      toast.success(`${refOf(f)} sent to CBP.`);
    } catch (err: any) {
      const body = err.body || err;
      if (body?.code === 'subscription_required') onPlanLimit({});
      else if (body?.code === 'feature_not_in_plan') onPlanLimit({ capability: (body?.capability as Capability) ?? CAPABILITIES.ISF_FILING });
      else if (body?.validationErrors) {
        toast.error(`${refOf(f)} was not sent:\n${body.validationErrors.map((e: any) => `${e.field}: ${e.message}`).join('\n')}`, { duration: 8000 });
      } else toast.error(body?.error || `${refOf(f)} was not sent.`);
    } finally {
      setSendingId(null);
    }
  };
  return { send, sendingId };
}
