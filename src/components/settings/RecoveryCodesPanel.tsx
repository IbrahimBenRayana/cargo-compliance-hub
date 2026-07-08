import { useState } from 'react';
import { Copy, Check, Download, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

/**
 * Recovery-codes screen — shared by MFA enrollment (step c) and the
 * "regenerate recovery codes" dialog. Shows the 10 single-use codes in a
 * 2×5 monospace grid, offers copy-all + download, and (optionally) gates a
 * finish button behind a "I have saved these codes" checkbox.
 *
 * Codes are shown exactly once by the server, so we make saving them the
 * deliberate, hard-to-skip step.
 */
export function RecoveryCodesPanel({
  codes,
  onDone,
  doneLabel = 'Done',
  requireConfirm = true,
}: {
  codes: string[];
  onDone?: () => void;
  doneLabel?: string;
  requireConfirm?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const asText = codes.join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(asText);
      setCopied(true);
      toast.success('Recovery codes copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  };

  const handleDownload = () => {
    const blob = new Blob(
      [
        'MyCargoLens — two-factor recovery codes\n',
        'Keep these somewhere safe. Each code works once.\n\n',
        asText + '\n',
      ],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mycargolens-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3.5 py-3">
        <KeyRound className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-200">
          Save these recovery codes somewhere safe. Each one works <strong>once</strong> if you lose
          access to your authenticator app. This is the only time they'll be shown.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
        {codes.map((c) => (
          <div
            key={c}
            className="font-mono text-[13px] tracking-wide text-slate-800 dark:text-slate-200 text-center py-1.5 rounded bg-white dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800"
          >
            {c}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1 cursor-pointer" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
          {copied ? 'Copied' : 'Copy all'}
        </Button>
        <Button type="button" variant="outline" size="sm" className="flex-1 cursor-pointer" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Download .txt
        </Button>
      </div>

      {requireConfirm && (
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <Checkbox
            checked={saved}
            onCheckedChange={(v) => setSaved(v === true)}
            className="mt-0.5"
          />
          <span className="text-[13px] text-slate-700 dark:text-slate-300">
            I have saved these recovery codes somewhere safe.
          </span>
        </label>
      )}

      {onDone && (
        <Button
          type="button"
          size="lg"
          className="w-full font-semibold cursor-pointer"
          disabled={requireConfirm && !saved}
          onClick={onDone}
        >
          {doneLabel}
        </Button>
      )}
    </div>
  );
}
