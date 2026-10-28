/**
 * Bulk line import dialog — Step 5 (Invoices).
 *
 * Flow: download template → drop/choose the filled CSV → server-side
 * dry-run validation (same schema as hand-typed items) → row-addressed
 * error report → "Import N rows" applies the validated items through
 * the wizard's own state, so autosave persists them like any edit.
 */
import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileUp, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { abiDocumentsApi } from '@/api/client';
import type { ABIItem, LineImportError } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  /** Draft document id (needed for the validation endpoint). */
  docId?: string;
  invoiceIndex: number;
  /** Called with the validated items; the caller appends them to state. */
  onImport: (items: ABIItem[]) => void;
}

type Report = {
  validRows: number;
  totalRows: number;
  errors: LineImportError[];
  items: ABIItem[];
  fileName: string;
};

export function ImportLinesDialog({ docId, invoiceIndex, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setReport(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleTemplate = async () => {
    try {
      const { blob, filename } = await abiDocumentsApi.downloadLineImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download the template');
    }
  };

  const handleFile = async (file: File) => {
    if (!docId) {
      toast.error('Save the draft first, then import lines.');
      return;
    }
    if (file.size > 1_000_000) {
      toast.error('File too large (1 MB max).');
      return;
    }
    setValidating(true);
    try {
      const text = await file.text();
      const { data } = await abiDocumentsApi.importLines(docId, {
        csv: text,
        invoiceIndex,
        dryRun: true,
      });
      setReport({
        validRows: data.validRows ?? 0,
        totalRows: data.totalRows,
        errors: data.errors,
        items: data.items ?? [],
        fileName: file.name,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleImport = () => {
    if (!report || report.items.length === 0) return;
    onImport(report.items);
    toast.success(
      `${report.items.length} line${report.items.length === 1 ? '' : 's'} imported` +
      (report.errors.length > 0 ? ` — ${report.errors.length} row(s) skipped (see report)` : ''),
    );
    setOpen(false);
    reset();
  };

  const handleErrorReport = () => {
    if (!report) return;
    const csv = ['row,column,problem',
      ...report.errors.map((e) => `${e.row},${e.field},"${e.message.replace(/"/g, '""')}"`),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'line-import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-3.5 w-3.5 mr-1" /> Import lines
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import line items from a spreadsheet</DialogTitle>
          <DialogDescription>
            Fill the CSV template (opens in Excel or Sheets) and upload it here.
            Every row is validated exactly like a hand-typed line.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="ghost" size="sm" className="px-2 -ml-2" onClick={handleTemplate}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download template
          </Button>

          <label
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer hover:bg-muted/40 transition-colors"
          >
            <FileUp className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {validating ? 'Validating…' : report ? report.fileName : 'Choose a .csv file'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={validating}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>

          {report && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {report.validRows} of {report.totalRows} rows ready
                </span>
                {report.errors.length > 0 && (
                  <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <AlertCircle className="h-4 w-4" />
                    {report.errors.length} problem{report.errors.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {report.errors.length > 0 && (
                <>
                  <ScrollArea className="max-h-40 rounded-md border">
                    <ul className="divide-y text-xs">
                      {report.errors.map((e, i) => (
                        <li key={i} className="px-3 py-1.5 flex gap-2">
                          <span className="font-mono text-muted-foreground shrink-0">
                            Row {e.row}
                          </span>
                          <span className="font-medium shrink-0">{e.field}</span>
                          <span className="text-muted-foreground">{e.message}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                  <Button variant="ghost" size="sm" className="px-2 -ml-2" onClick={handleErrorReport}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Download error report
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!report || report.items.length === 0 || validating}
          >
            {validating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import {report?.items.length ?? 0} row{(report?.items.length ?? 0) === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
