/**
 * Data Export Routes
 *
 * Export filings as CSV or PDF.
 * - CSV: Flat tabular export of all filings (filterable)
 * - PDF: Single-filing detail report or multi-filing summary
 */

import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import logger from '../config/logger.js';

const router = Router();
router.use(authMiddleware);

// ─── Helper: format date ──────────────────────────────────
function fmtDate(d: Date | string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(d: Date | string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── GET /api/v1/export/csv — Export filings as CSV ───────
router.get('/csv', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, filingType } = req.query;

    const where: any = { orgId: req.user!.orgId };
    if (status && typeof status === 'string') where.status = status;
    if (filingType && typeof filingType === 'string') where.filingType = filingType;

    const filings = await prisma.filing.findMany({
      where,
      include: {
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    // CSV header
    const headers = [
      'ID', 'Filing Type', 'Status', 'Master BOL', 'House BOL',
      'Importer Name', 'Carrier SCAC', 'Vessel', 'Voyage',
      'Port of Lading', 'Port of Delivery', 'ETA',
      'Filing Deadline', 'CC Filing ID', 'CBP Transaction ID',
      'Created By', 'Created At', 'Updated At',
      'Commodities Count', 'Containers Count',
    ];

    const escCsv = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = filings.map(f => {
      const commodities = Array.isArray(f.commodities) ? f.commodities : [];
      const containers = Array.isArray(f.containers) ? f.containers : [];
      return [
        f.id,
        f.filingType,
        f.status,
        f.masterBol,
        f.houseBol,
        f.importerName,
        f.scacCode,
        f.vesselName,
        f.voyageNumber,
        f.foreignPortOfUnlading,
        f.placeOfDelivery,
        fmtDate(f.estimatedArrival),
        fmtDate(f.filingDeadline),
        f.ccFilingId,
        f.cbpTransactionId,
        f.createdBy ? `${f.createdBy.firstName || ''} ${f.createdBy.lastName || ''}`.trim() : '',
        fmtDateTime(f.createdAt),
        fmtDateTime(f.updatedAt),
        commodities.length,
        containers.length,
      ].map(escCsv).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\r\n');

    const filename = `mycargolens-filings-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel compatibility
  } catch (err: any) {
    logger.error({ err: err.message }, '[Export] CSV error:');
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// ─── GET /api/v1/export/pdf/:id — Single filing PDF ──────
router.get('/pdf/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const filing = await prisma.filing.findFirst({
      where: { id: filingId, orgId: req.user!.orgId },
      include: {
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!filing) {
      res.status(404).json({ error: 'Filing not found' });
      return;
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    const filename = `ISF-${filing.houseBol || filing.masterBol || filing.id.slice(0, 8)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // ─── Header ───
    doc.fontSize(20).font('Helvetica-Bold').text('MyCargoLens', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#666666').text('ISF Filing Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#e0e0e0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.8);

    // ─── Filing Overview ───
    doc.fillColor('#000000');
    const sectionTitle = (title: string) => {
      doc.moveDown(0.3);
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a56db').text(title);
      doc.moveDown(0.3);
      doc.fillColor('#000000');
    };

    const field = (label: string, value: string | null | undefined) => {
      doc.fontSize(9).font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value || '—');
    };

    sectionTitle('Filing Overview');
    field('Filing Type', filing.filingType);
    field('Status', filing.status.toUpperCase());
    field('Master BOL', filing.masterBol);
    field('House BOL', filing.houseBol);
    field('CC Filing ID', filing.ccFilingId);
    field('CBP Transaction', filing.cbpTransactionId);
    field('Created', fmtDateTime(filing.createdAt));
    field('Created By', filing.createdBy ? `${filing.createdBy.firstName} ${filing.createdBy.lastName}` : '—');

    // ─── Parties ───
    sectionTitle('Parties');
    field('Importer', filing.importerName);

    const partyFields: { label: string; data: any }[] = [
      { label: 'Seller', data: filing.seller },
      { label: 'Buyer', data: filing.buyer },
      { label: 'Manufacturer', data: filing.manufacturer },
      { label: 'Ship To', data: filing.shipToParty },
      { label: 'Container Stuffing', data: filing.containerStuffingLocation },
      { label: 'Consolidator', data: filing.consolidator },
    ];
    for (const { label, data } of partyFields) {
      if (data) {
        const p = typeof data === 'object' ? data : {};
        const name = typeof data === 'string' ? data : (p.name || '');
        if (name) field(label, name);
      }
    }

    // ─── Shipping ───
    sectionTitle('Shipping Details');
    field('Carrier SCAC', filing.scacCode);
    field('Vessel', filing.vesselName);
    field('Voyage', filing.voyageNumber);
    field('Port of Lading', filing.foreignPortOfUnlading);
    field('Port of Delivery', filing.placeOfDelivery);
    field('ETA', fmtDate(filing.estimatedArrival));
    field('Filing Deadline', fmtDate(filing.filingDeadline));

    // ─── Commodities ───
    const commodities = Array.isArray(filing.commodities) ? filing.commodities : [];
    if (commodities.length > 0) {
      sectionTitle(`Commodities (${commodities.length})`);
      commodities.forEach((c: any, i: number) => {
        doc.fontSize(9).font('Helvetica-Bold').text(`  ${i + 1}. `, { continued: true });
        doc.font('Helvetica').text(
          `${c.description || 'No description'} — HTS: ${c.htsCode || '—'} — Origin: ${c.countryOfOrigin || '—'}${c.quantity ? ` — Qty: ${c.quantity}` : ''}`
        );
      });
    }

    // ─── Containers ───
    const containers = Array.isArray(filing.containers) ? filing.containers : [];
    if (containers.length > 0) {
      sectionTitle(`Containers (${containers.length})`);
      containers.forEach((c: any, i: number) => {
        doc.fontSize(9).font('Helvetica-Bold').text(`  ${i + 1}. `, { continued: true });
        doc.font('Helvetica').text(`${c.number || '—'}${c.type ? ` (${c.type})` : ''}${c.sealNumber ? ` — Seal: ${c.sealNumber}` : ''}`);
      });
    }

    // ─── Status History ───
    if (filing.statusHistory && filing.statusHistory.length > 0) {
      sectionTitle('Status History');
      filing.statusHistory.forEach((h: any) => {
        doc.fontSize(9).font('Helvetica').text(
          `  ${fmtDateTime(h.createdAt)}  →  ${h.status.toUpperCase()}${h.message ? `  (${h.message})` : ''}`
        );
      });
    }

    // ─── Footer ───
    doc.moveDown(2);
    doc.strokeColor('#e0e0e0').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(7).fillColor('#999999').text(
      `Generated by MyCargoLens on ${new Date().toLocaleString('en-US')} — This document is for internal use only.`,
      { align: 'center' }
    );

    doc.end();
  } catch (err: any) {
    logger.error({ err: err.message }, '[Export] PDF error:');
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ─── GET /api/v1/export/pdf-summary — Multi-filing summary PDF ─
router.get('/pdf-summary', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, filingType } = req.query;
    const where: any = { orgId: req.user!.orgId };
    if (status && typeof status === 'string') where.status = status;
    if (filingType && typeof filingType === 'string') where.filingType = filingType;

    const filings = await prisma.filing.findMany({
      where,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, bufferPages: true });
    const filename = `mycargolens-summary-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text('MyCargoLens — Filing Summary Report', { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#666666').text(
      `Generated ${new Date().toLocaleString('en-US')} · ${filings.length} filing(s)`, { align: 'center' }
    );
    doc.moveDown(0.8);

    // Table header
    const cols = [
      { label: 'BOL', x: 40, w: 100 },
      { label: 'Type', x: 140, w: 50 },
      { label: 'Status', x: 190, w: 65 },
      { label: 'Importer', x: 255, w: 110 },
      { label: 'Carrier', x: 365, w: 50 },
      { label: 'Port Lading', x: 415, w: 65 },
      { label: 'ETA', x: 480, w: 75 },
      { label: 'Deadline', x: 555, w: 75 },
      { label: 'Created By', x: 630, w: 90 },
      { label: 'Created', x: 720, w: 80 },
    ];

    const drawTableHeader = () => {
      doc.fillColor('#1a56db');
      cols.forEach(c => {
        doc.fontSize(7).font('Helvetica-Bold').text(c.label, c.x, doc.y, { width: c.w });
      });
      doc.moveDown(0.3);
      doc.strokeColor('#ccc').lineWidth(0.5).moveTo(40, doc.y).lineTo(800, doc.y).stroke();
      doc.moveDown(0.2);
      doc.fillColor('#000000');
    };

    drawTableHeader();

    filings.forEach((f, i) => {
      if (doc.y > 540) {
        doc.addPage();
        drawTableHeader();
      }

      const y = doc.y;
      const bg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
      doc.rect(40, y - 2, 760, 14).fill(bg);
      doc.fillColor('#000000');

      const vals = [
        f.houseBol || f.masterBol || f.id.slice(0, 8),
        f.filingType,
        f.status,
        (f.importerName || '').slice(0, 20),
        f.scacCode || '',
        (f.foreignPortOfUnlading || '').slice(0, 12),
        fmtDate(f.estimatedArrival),
        fmtDate(f.filingDeadline),
        f.createdBy ? `${f.createdBy.firstName || ''} ${f.createdBy.lastName || ''}`.trim().slice(0, 15) : '',
        fmtDate(f.createdAt),
      ];

      cols.forEach((c, ci) => {
        doc.fontSize(7).font('Helvetica').text(vals[ci], c.x, y, { width: c.w, lineBreak: false });
      });

      doc.y = y + 14;
    });

    // Footer
    doc.moveDown(1);
    doc.fontSize(7).fillColor('#999999').text(
      `MyCargoLens — ISF Filing Platform · ${filings.length} records`,
      { align: 'center' }
    );

    doc.end();
  } catch (err: any) {
    logger.error({ err: err.message }, '[Export] PDF Summary error:');
    res.status(500).json({ error: 'Failed to generate summary PDF' });
  }
});

export default router;
