import { useState } from 'react';
import { Copy, Check, Download } from '@/components/icons';
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
      toast.error('Could not copy. Select the codes and copy them manually.');
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
      <p className="rounded-lg bg-soon-tint px-4 py-3 text-[13px] leading-relaxed text-soon">
        Save these recovery codes somewhere safe. Each one works <strong>once</strong> if you lose
        access to your authenticator app. This is the only time they will be shown.
      </p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-4 py-3">
        {codes.map((c) => (
          <div key={c} className="py-1 text-center font-mono text-[13px] tracking-wide tabular-nums text-foreground">
            {c}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1 cursor-pointer" onClick={handleCopy}>
          {copied ? <Check weight="bold" className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
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
          <span className="text-[13px] text-foreground">
            I have saved these recovery codes somewhere safe.
          </span>
        </label>
      )}

      {onDone && (
        <Button
          type="button"
          size="lg"
          className="w-full cursor-pointer"
          disabled={requireConfirm && !saved}
          onClick={onDone}
        >
          {doneLabel}
        </Button>
      )}
    </div>
  );
}
