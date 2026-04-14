/**
 * Filing Documents Routes
 *
 * Upload, list, download, and delete file attachments for filings.
 * Supports: BOL copies, commercial invoices, packing lists, and other docs.
 * Storage: Local filesystem (uploads/ directory). Swap to S3 later via storagePath.
 */

import { Router, Response, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';
import logger from '../config/logger.js';

const router = Router();
router.use(authMiddleware);

// ─── Upload directory ─────────────────────────────────────
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ─── Multer config ────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}. Accepted: PDF, images, Word, Excel, CSV.`));
    }
  },
});

// ─── Helper: verify filing belongs to user's org ──────────
async function verifyFilingAccess(filingId: string, orgId: string) {
  return prisma.filing.findFirst({
    where: { id: filingId, orgId },
    select: { id: true, houseBol: true, masterBol: true },
  });
}

// ─── POST /api/v1/documents/:filingId — Upload file(s) ───
router.post('/:filingId', upload.array('files', 5), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filingId = Array.isArray(req.params.filingId) ? req.params.filingId[0] : req.params.filingId;
    const filing = await verifyFilingAccess(filingId, req.user!.orgId);
    if (!filing) {
      // Clean up uploaded files if filing not found
      const files = req.files as Express.Multer.File[];
      if (files) files.forEach(f => fs.unlinkSync(f.path));
      res.status(404).json({ error: 'Filing not found' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    // documentType comes from body (can be one string applied to all, or comma-separated per file)
    const docTypeRaw = (req.body.documentType as string) || 'other';
    const docTypes = docTypeRaw.split(',').map((t: string) => t.trim());

    const documents = await prisma.$transaction(
      files.map((file, i) =>
        prisma.filingDocument.create({
          data: {
            filingId,
            uploadedById: req.user!.id,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSizeBytes: file.size,
            storagePath: file.filename, // relative to UPLOAD_DIR
            documentType: docTypes[i] || docTypes[0] || 'other',
          },
        })
      )
    );

    res.status(201).json({
      data: documents,
      count: documents.length,
    });

    const meta = getRequestMeta(req as any);
    writeAuditLog({
      orgId: req.user!.orgId,
      userId: req.user!.id,
      action: 'document.uploaded',
      entityType: 'filing',
      entityId: filingId,
      newValue: { files: documents.map(d => ({ id: d.id, name: d.fileName, type: d.documentType })) },
      ...meta,
    });
  } catch (err: any) {
    if (err.message?.includes('File type not allowed')) {
      res.status(400).json({ error: err.message });
      return;
    }
    logger.error({ err: err.message }, '[Documents] Upload error:');
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// ─── GET /api/v1/documents/:filingId — List documents for a filing ─
router.get('/:filingId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filingId = Array.isArray(req.params.filingId) ? req.params.filingId[0] : req.params.filingId;
    const filing = await verifyFilingAccess(filingId, req.user!.orgId);
    if (!filing) {
      res.status(404).json({ error: 'Filing not found' });
      return;
    }

    const documents = await prisma.filingDocument.findMany({
      where: { filingId },
      include: {
        uploadedBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: documents });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Documents] List error:');
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// ─── GET /api/v1/documents/:filingId/:docId/download — Download file ─
router.get('/:filingId/:docId/download', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filingId = Array.isArray(req.params.filingId) ? req.params.filingId[0] : req.params.filingId;
    const docId = Array.isArray(req.params.docId) ? req.params.docId[0] : req.params.docId;

    const filing = await verifyFilingAccess(filingId, req.user!.orgId);
    if (!filing) {
      res.status(404).json({ error: 'Filing not found' });
      return;
    }

    const doc = await prisma.filingDocument.findFirst({
      where: { id: docId, filingId },
    });
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const filePath = path.join(UPLOAD_DIR, doc.storagePath);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    res.setHeader('Content-Type', doc.fileType);
    res.setHeader('Content-Length', doc.fileSizeBytes.toString());

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    logger.error({ err: err.message }, '[Documents] Download error:');
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// ─── DELETE /api/v1/documents/:filingId/:docId — Delete document ─
router.delete('/:filingId/:docId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filingId = Array.isArray(req.params.filingId) ? req.params.filingId[0] : req.params.filingId;
    const docId = Array.isArray(req.params.docId) ? req.params.docId[0] : req.params.docId;

    const filing = await verifyFilingAccess(filingId, req.user!.orgId);
    if (!filing) {
      res.status(404).json({ error: 'Filing not found' });
      return;
    }

    const doc = await prisma.filingDocument.findFirst({
      where: { id: docId, filingId },
    });
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Delete from disk
    const filePath = path.join(UPLOAD_DIR, doc.storagePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from DB
    await prisma.filingDocument.delete({ where: { id: docId } });

    res.json({ message: 'Document deleted' });

    const meta = getRequestMeta(req as any);
    writeAuditLog({
      orgId: req.user!.orgId,
      userId: req.user!.id,
      action: 'document.deleted',
      entityType: 'filing',
      entityId: filingId,
      oldValue: { id: doc.id, name: doc.fileName, type: doc.documentType },
      ...meta,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, '[Documents] Delete error:');
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
