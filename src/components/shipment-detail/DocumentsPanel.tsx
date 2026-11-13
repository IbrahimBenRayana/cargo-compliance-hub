/** Paperwork kept with the shipment: bills of lading, invoices, packing lists. */
import { useState } from 'react';
import { ArrowDownToLine, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteDocument, useDownloadDocument, useFilingDocuments, useUploadDocuments } from '@/hooks/useFilings';

export function DocumentsPanel({ filingId }: { filingId: string }) {
  const { data: docsData, isLoading: docsLoading } = useFilingDocuments(filingId);
  const uploadDocs = useUploadDocuments();
  const downloadDoc = useDownloadDocument();
  const deleteDoc = useDeleteDocument();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadDocType, setUploadDocType] = useState('bol');
  const count = docsData?.data?.length ?? 0;

  return (
    <section aria-labelledby="documents-title" className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 id="documents-title" className="flex items-center gap-2 text-[15px] font-semibold">
            Documents
            {count > 0 && <span className="rounded-md bg-muted px-1.5 py-px text-[11.5px] font-medium tabular-nums text-muted-foreground">{count}</span>}
          </h2>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-8">
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>
                  Attach BOL copies, commercial invoices, packing lists, or other documents.
                  Max 10 MB per file. Up to 5 files at once.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={uploadDocType} onValueChange={setUploadDocType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bol">Bill of Lading</SelectItem>
                      <SelectItem value="commercial_invoice">Commercial Invoice</SelectItem>
                      <SelectItem value="packing_list">Packing List</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Files</Label>
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      setUploadFiles(files);
                    }}
                  />
                  {uploadFiles.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {uploadFiles.length} file(s) selected ({(uploadFiles.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setUploadDialogOpen(false); setUploadFiles([]); }}>Cancel</Button>
                <Button
                  disabled={uploadFiles.length === 0 || uploadDocs.isPending}
                  onClick={async () => {
                    try {
                      await uploadDocs.mutateAsync({ filingId: filingId, files: uploadFiles, documentType: uploadDocType });
                      toast.success(`${uploadFiles.length} file(s) uploaded`);
                      setUploadFiles([]);
                      setUploadDialogOpen(false);
                    } catch (err: any) {
                      toast.error(err.body?.error || err.message || 'Upload failed');
                    }
                  }}
                >
                  {uploadDocs.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      <div className="mt-3">
        {docsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        ) : !docsData?.data?.length ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-[13px] font-medium">No documents yet.</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Upload the bill of lading, invoice or packing list.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docsData.data.map((doc: any) => {
              const docTypeLabels: Record<string, string> = {
                bol: 'Bill of Lading',
                commercial_invoice: 'Commercial Invoice',
                packing_list: 'Packing List',
                other: 'Other',
              };
              const sizeKb = (doc.fileSizeBytes / 1024).toFixed(0);
              const sizeMb = (doc.fileSizeBytes / 1024 / 1024).toFixed(1);
              const sizeStr = doc.fileSizeBytes > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

              return (
                <div key={doc.id} className="group flex items-center justify-between rounded-lg border border-border/60 p-3 transition-colors duration-150 can-hover:hover:bg-muted/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{doc.fileName}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {docTypeLabels[doc.documentType] || doc.documentType} · {sizeStr} ·{' '}
                        {doc.uploadedBy?.firstName} {doc.uploadedBy?.lastName} ·{' '}
                        {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:focus-within:opacity-100">
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      title="Download"
                      disabled={downloadDoc.isPending}
                      onClick={() => downloadDoc.mutate({ filingId: filingId, docId: doc.id })}
                    >
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete document?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{doc.fileName}" will be permanently deleted. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={async () => {
                              try {
                                await deleteDoc.mutateAsync({ filingId: filingId, docId: doc.id });
                                toast.success('Document deleted');
                              } catch {
                                toast.error('Failed to delete document');
                              }
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
