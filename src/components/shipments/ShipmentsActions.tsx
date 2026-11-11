import { useNavigate } from 'react-router-dom';
import { Bookmark, ChevronDown, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApplyTemplate, useExportCsv, useExportSummaryPdf, useTemplates } from '@/hooks/useFilings';

export function ExportMenu() {
  const csv = useExportCsv();
  const pdf = useExportSummaryPdf();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" aria-hidden />
          <span className="max-sm:sr-only">Export</span>
          <ChevronDown className="h-3 w-3 opacity-60 max-sm:hidden" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={csv.isPending} onClick={() => csv.mutate(undefined, { onSuccess: () => toast.success('CSV downloaded.'), onError: () => toast.error('CSV export failed.') })}>
          <FileText className="mr-2 h-3.5 w-3.5" aria-hidden />{csv.isPending ? 'Exporting…' : 'Export CSV'}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pdf.isPending} onClick={() => pdf.mutate(undefined, { onSuccess: () => toast.success('PDF downloaded.'), onError: () => toast.error('PDF export failed.') })}>
          <FileText className="mr-2 h-3.5 w-3.5" aria-hidden />{pdf.isPending ? 'Generating…' : 'Export summary PDF'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TemplateMenu() {
  const { data } = useTemplates();
  const apply = useApplyTemplate();
  const navigate = useNavigate();
  const templates = (data?.data ?? []) as { id: string; name: string; filingType: string }[];
  if (templates.length === 0) return null;
  const use = async (id: string) => {
    try {
      const filing = await apply.mutateAsync(id);
      navigate(`/shipments/${filing.id}/edit`);
    } catch (err: any) {
      toast.error(err.body?.error || 'Could not use that template.');
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 max-sm:hidden">
          <Bookmark className="h-3.5 w-3.5" aria-hidden />From template<ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Saved templates</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {templates.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => use(t.id)} className="flex items-center justify-between gap-2">
            <span className="truncate">{t.name}</span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{t.filingType}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
