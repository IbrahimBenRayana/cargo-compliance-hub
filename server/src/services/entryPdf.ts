/**
 * CBP Form 7501 (Entry Summary) PDF — the record document importers hand
 * to banks, auditors, and drawback claimants (19 CFR 163 retention).
 *
 * This is a faithful data reproduction of the 7501 block layout (blocks
 * 1–40), not a scan of the government form: numbered cells in the
 * official order, a 27–34 line-item table, and the 35/37–40 totals box
 * fed by the native duty engine's estimate. Non-accepted documents carry
 * a diagonal status watermark so a draft can never pass as a filed entry.
 */
import PDFDocument from 'pdfkit';
import { deriveMid } from '../abi-engine/payload/mid.js';
import type { AbiDocumentBody } from './abi/types.js';
import type { DutyEstimateResult } from './dutyEstimate.js';

// ─── Inputs ─────────────────────────────────────────────────────────

export interface Entry7501DocMeta {
  id: string;
  status: string;
  entryNumber: string | null;
  sentAt: Date | null;
}

export interface RenderEntry7501Args {
  doc: Entry7501DocMeta;
  /** The document payload (ABIDocumentBody, possibly partial). */
  body: unknown;
  estimate: DutyEstimateResult;
  /** Lookup for the HTS General-rate expression text ('3.4%', 'Free'). */
  rateText: (hts: string) => Promise<string | null>;
  orgName: string;
  /** Tests render uncompressed so content is grep-able. */
  compress?: boolean;
}

// ─── Formatting helpers ─────────────────────────────────────────────

const ENTRY_TYPE_LABELS: Record<string, string> = {
  '01': '01 - Consumption',
  '11': '11 - Informal',
  '86': '86 - Sec. 321 De Minimis',
};

function fmtDate(yyyymmdd?: string | null): string {
  if (!yyyymmdd || !/^\d{8}$/.test(yyyymmdd)) return '';
  return `${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(0, 4)}`;
}

function fmtCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDollars(dollars: number | null | undefined): string {
  if (dollars === null || dollars === undefined) return '—';
  return dollars.toLocaleString('en-US');
}

/** 8507600020 → 8507.60.0020 (display convention on the printed form). */
function fmtHts(hts: string): string {
  const flat = hts.replace(/\D/g, '');
  if (flat.length !== 10) return hts;
  return `${flat.slice(0, 4)}.${flat.slice(4, 6)}.${flat.slice(6)}`;
}

// ─── Layout constants ───────────────────────────────────────────────

const PAGE_LEFT = 36;
const PAGE_RIGHT = 576; // Letter (612) − 36
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;
const PAGE_BOTTOM = 740;

interface Cell {
  n: string;
  label: string;
  value: string;
  /** Relative width weight (default 1). */
  w?: number;
}

// ─── Renderer ───────────────────────────────────────────────────────

export async function renderEntry7501Pdf(args: RenderEntry7501Args): Promise<Buffer> {
  const body = (args.body ?? {}) as Partial<AbiDocumentBody>;
  const est = args.estimate;

  const manifest = body.manifest?.[0];
  const invoices = manifest?.invoices ?? [];
  const items = invoices.flatMap((inv) => (inv.items ?? []).map((item) => ({ inv, item })));

  // Block 10: single origin or MULTI.
  const origins = [...new Set(items.map(({ item }) => item.origin?.country).filter(Boolean))];
  const originLabel = origins.length === 1 ? String(origins[0]) : origins.length > 1 ? 'MULTI' : '';

  // Block 13: first manufacturer MID (derivation is best-effort here — the
  // engine enforces it strictly at build time).
  let manufacturerId = '';
  for (const { item } of items) {
    const mfr = (item.parties ?? []).find((p) => p.type === 'manufacturer');
    if (mfr?.name) {
      try {
        manufacturerId = deriveMid({
          name: mfr.name,
          address: mfr.address,
          city: mfr.city,
          countryCode: mfr.country ?? '',
          stateOrProvince: mfr.state,
        });
      } catch {
        manufacturerId = '';
      }
      break;
    }
  }

  // Rate expression per distinct HTS (display column 33).
  const rateByHts = new Map<string, string>();
  for (const { item } of items) {
    const hts = (item.htsNumber ?? '').replace(/\D/g, '');
    if (hts && !rateByHts.has(hts)) {
      rateByHts.set(hts, (await args.rateText(hts)) ?? '—');
    }
  }

  const estLines = est.estimable ? est.lines : [];
  const totals = est.estimable ? est.totals : null;
  // 38 Tax / 39 Other split: IR tax is "Tax"; everything that is neither
  // duty nor tax (MPF, HMF, informal fee, AD/CVD deposits…) lands in Other.
  const otherCents = totals
    ? totals.totalCents - totals.dutyCents - 0 /* IR tax not modelled in v1 */
    : null;

  const totalEnteredValue = items.reduce(
    (sum, { item }) => sum + (item.values?.totalValueOfGoods ?? 0),
    0
  );

  const pdf = new PDFDocument({
    size: 'LETTER',
    margin: 36,
    bufferPages: true,
    compress: args.compress ?? true,
  });
  const chunks: Buffer[] = [];
  pdf.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => pdf.on('end', () => resolve(Buffer.concat(chunks))));

  // ── Watermark (under content) — every page via pageAdded ──
  const watermark =
    args.doc.status === 'ACCEPTED'
      ? null
      : args.doc.status === 'REJECTED'
        ? 'REJECTED — NOT ACCEPTED'
        : args.doc.status === 'SENT' || args.doc.status === 'SENDING'
          ? 'TRANSMITTED — AWAITING CBP'
          : 'DRAFT — NOT FILED';

  const stampWatermark = () => {
    if (!watermark) return;
    pdf.save();
    pdf.rotate(-30, { origin: [306, 396] });
    pdf.font('Helvetica-Bold').fontSize(42).fillColor('#d1d5db').opacity(0.45);
    pdf.text(watermark, 36, 380, { width: 540, align: 'center' });
    pdf.restore();
    pdf.opacity(1).fillColor('#000000');
  };
  stampWatermark();
  pdf.on('pageAdded', stampWatermark);

  // ── Title ──
  pdf.font('Helvetica-Bold').fontSize(16).fillColor('#000000').text('ENTRY SUMMARY', PAGE_LEFT, 40);
  pdf.font('Helvetica').fontSize(8).fillColor('#555555')
    .text('U.S. Customs and Border Protection · CBP Form 7501 (data reproduction)', PAGE_LEFT, 60);
  pdf.font('Helvetica-Bold').fontSize(9).fillColor('#000000')
    .text(args.orgName, PAGE_LEFT, 44, { width: PAGE_WIDTH, align: 'right' });
  pdf.font('Helvetica').fontSize(7).fillColor('#555555')
    .text(`Generated by MyCargoLens · ${args.doc.status}`, PAGE_LEFT, 56, { width: PAGE_WIDTH, align: 'right' });
  pdf.fillColor('#000000');

  let y = 76;

  // ── Block cell helper ──
  const drawCellRow = (cells: Cell[], height = 30) => {
    const totalWeight = cells.reduce((s, c) => s + (c.w ?? 1), 0);
    let x = PAGE_LEFT;
    for (const cell of cells) {
      const width = (PAGE_WIDTH * (cell.w ?? 1)) / totalWeight;
      pdf.rect(x, y, width, height).lineWidth(0.5).strokeColor('#333333').stroke();
      pdf.font('Helvetica').fontSize(5.5).fillColor('#444444')
        .text(`${cell.n}. ${cell.label}`, x + 3, y + 3, { width: width - 6, lineBreak: false });
      pdf.font('Helvetica-Bold').fontSize(8).fillColor('#000000')
        .text(cell.value || '—', x + 3, y + 13, { width: width - 6, lineBreak: false });
      x += width;
    }
    y += height;
  };

  const summaryDate = args.doc.sentAt
    ? args.doc.sentAt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : '';

  drawCellRow([
    // Prefer the payload's hyphenated form over the denormalised column.
    { n: '1', label: 'Entry Number', value: body.entryNumber ?? args.doc.entryNumber ?? '', w: 1.6 },
    { n: '2', label: 'Entry Type', value: ENTRY_TYPE_LABELS[body.entryType ?? ''] ?? body.entryType ?? '', w: 1.3 },
    { n: '3', label: 'Summary Date', value: summaryDate },
    { n: '4', label: 'Surety No.', value: body.bond?.suretyCode ?? '', w: 0.8 },
    { n: '5', label: 'Bond Type', value: body.bond?.type ?? '', w: 0.7 },
    { n: '6', label: 'Port Code', value: body.location?.portOfEntry ?? '', w: 0.8 },
    { n: '7', label: 'Entry Date', value: fmtDate(body.dates?.entryDate) },
  ]);
  drawCellRow([
    { n: '8', label: 'Importing Carrier', value: manifest?.carrier?.code ?? '', w: 1.4 },
    { n: '9', label: 'Mode of Transport', value: body.modeOfTransport ?? '' },
    { n: '10', label: 'Country of Origin', value: originLabel },
    { n: '11', label: 'Import Date', value: fmtDate(body.dates?.importDate) },
  ]);
  drawCellRow([
    { n: '12', label: 'B/L or AWB No.', value: manifest?.bill?.mBOL ?? '', w: 1.6 },
    { n: '13', label: 'Manufacturer ID', value: manufacturerId, w: 1.2 },
    { n: '14', label: 'Exporting Country', value: invoices[0]?.countryOfExport ?? '' },
    { n: '15', label: 'Export Date', value: fmtDate(invoices[0]?.exportDate) },
  ]);
  drawCellRow([
    { n: '16', label: 'I.T. No.', value: '' },
    { n: '17', label: 'I.T. Date', value: '' },
    { n: '18', label: 'Missing Docs', value: '' },
    { n: '19', label: 'Foreign Port of Lading', value: '', w: 1.3 },
    { n: '20', label: 'U.S. Port of Unlading', value: manifest?.ports?.portOfUnlading ?? '', w: 1.3 },
  ]);
  drawCellRow([
    { n: '21', label: 'Location of Goods (FIRMS)', value: body.firms ?? '', w: 1.2 },
    { n: '22', label: 'Consignee No.', value: body.entryConsignee?.taxId ?? '' },
    { n: '23', label: 'Importer No.', value: body.ior?.number ?? '' },
    { n: '24', label: 'Reference No.', value: args.doc.id.slice(0, 8).toUpperCase() },
  ]);

  // Party boxes 25 / 26.
  const consigneeAddress = [
    body.entryConsignee?.name,
    body.entryConsignee?.address,
    [body.entryConsignee?.city, body.entryConsignee?.state, body.entryConsignee?.postalCode]
      .filter(Boolean).join(', '),
    body.entryConsignee?.country,
  ].filter(Boolean).join('\n');
  const partyBoxHeight = 52;
  const half = PAGE_WIDTH / 2;
  pdf.rect(PAGE_LEFT, y, half, partyBoxHeight).lineWidth(0.5).strokeColor('#333333').stroke();
  pdf.rect(PAGE_LEFT + half, y, half, partyBoxHeight).stroke();
  pdf.font('Helvetica').fontSize(5.5).fillColor('#444444')
    .text('25. Ultimate Consignee Name and Address', PAGE_LEFT + 3, y + 3)
    .text('26. Importer of Record Name and Address', PAGE_LEFT + half + 3, y + 3);
  pdf.font('Helvetica-Bold').fontSize(7.5).fillColor('#000000')
    .text(consigneeAddress || '—', PAGE_LEFT + 3, y + 12, { width: half - 6 })
    .text(
      [body.ior?.name, body.ior?.number].filter(Boolean).join('\n') || '—',
      PAGE_LEFT + half + 3, y + 12, { width: half - 6 }
    );
  y += partyBoxHeight;

  // ── Line-item table (27–34) ──
  y += 8;
  const COLS = [
    { label: '27. Line', width: 30 },
    { label: '28. Description of Merchandise', width: 150 },
    { label: '29. HTSUS No.', width: 72 },
    { label: '30. Gross Wt / Qty', width: 74 },
    { label: '31. Net Quantity', width: 62 },
    { label: '32. Entered Value ($)', width: 66 },
    { label: '33. Rate', width: 44 },
    { label: '34. Duty ($)', width: 42 },
  ];

  const drawLineTableHeader = () => {
    let x = PAGE_LEFT;
    pdf.rect(PAGE_LEFT, y, PAGE_WIDTH, 14).fillAndStroke('#f3f4f6', '#333333');
    pdf.fillColor('#000000').font('Helvetica-Bold').fontSize(6);
    for (const col of COLS) {
      pdf.text(col.label, x + 2, y + 4, { width: col.width - 4, lineBreak: false });
      x += col.width;
    }
    y += 14;
  };
  drawLineTableHeader();

  pdf.font('Helvetica').fontSize(7).fillColor('#000000');
  items.forEach(({ inv, item }, index) => {
    if (y > PAGE_BOTTOM - 30) {
      pdf.addPage();
      y = 40;
      drawLineTableHeader();
      pdf.font('Helvetica').fontSize(7).fillColor('#000000');
    }
    const rowHeight = 22;
    const flatHts = (item.htsNumber ?? '').replace(/\D/g, '');
    const estLine = estLines[index];
    const cells = [
      String(index + 1).padStart(3, '0'),
      `${item.description ?? ''}\n${item.sku ? `SKU ${item.sku}` : ''} · Inv ${inv.invoiceNumber ?? '—'}`,
      fmtHts(item.htsNumber ?? ''),
      `${item.weight?.gross ?? '—'} ${item.weight?.uom === 'L' ? 'LB' : 'KG'}`,
      `${item.quantity1 ?? '—'}`,
      fmtDollars(item.values?.totalValueOfGoods),
      rateByHts.get(flatHts) ?? '—',
      estLine ? fmtCents(estLine.dutyCents) : '—',
    ];
    let x = PAGE_LEFT;
    pdf.rect(PAGE_LEFT, y, PAGE_WIDTH, rowHeight).lineWidth(0.25).strokeColor('#666666').stroke();
    cells.forEach((text, i) => {
      pdf.text(text, x + 2, y + 3, { width: COLS[i].width - 4, height: rowHeight - 4 });
      x += COLS[i].width;
    });
    // Origin chip under line number column, e.g. "CN".
    pdf.fontSize(5.5).fillColor('#444444')
      .text(String(item.origin?.country ?? ''), PAGE_LEFT + 2, y + rowHeight - 8, { lineBreak: false });
    pdf.fontSize(7).fillColor('#000000');
    y += rowHeight;
  });

  if (items.length === 0) {
    pdf.rect(PAGE_LEFT, y, PAGE_WIDTH, 20).lineWidth(0.25).strokeColor('#666666').stroke();
    pdf.font('Helvetica-Oblique').fontSize(7).text('No line items entered yet.', PAGE_LEFT + 4, y + 6);
    y += 20;
  }

  // ── Totals (35, 37–40) ──
  y += 8;
  if (y > PAGE_BOTTOM - 120) {
    pdf.addPage();
    y = 40;
  }
  const totalsRows: Array<[string, string, string]> = [
    ['35', 'Total Entered Value ($)', fmtDollars(totalEnteredValue)],
    ['37', 'Duty ($)', totals ? fmtCents(totals.dutyCents) : '—'],
    ['38', 'Tax ($)', totals ? fmtCents(0) : '—'],
    ['39', 'Other — MPF, HMF, fees, AD/CVD ($)', otherCents !== null ? fmtCents(otherCents) : '—'],
    ['40', 'Total ($)', totals ? fmtCents(totals.totalCents) : '—'],
  ];
  const totalsWidth = 240;
  const totalsX = PAGE_RIGHT - totalsWidth;

  // Other Fee Summary (the itemized side of block 39): class code, name,
  // amount — MPF 499, HMF 501, informal 311, … exactly as filed.
  if (totals && totals.fees.length > 0) {
    let feeY = y;
    pdf.font('Helvetica-Bold').fontSize(6.5).fillColor('#444444')
      .text('Other Fee Summary (block 39 detail)', PAGE_LEFT, feeY);
    feeY += 10;
    pdf.font('Helvetica').fontSize(7).fillColor('#000000');
    for (const fee of totals.fees) {
      pdf.text(`${fee.classCode}  ${fee.label}`, PAGE_LEFT, feeY, { width: 180, lineBreak: false });
      pdf.text(fmtCents(fee.amountCents), PAGE_LEFT + 184, feeY, { width: 60, align: 'right', lineBreak: false });
      feeY += 10;
    }
    if (totals.adCvdCents > 0) {
      pdf.text('AD/CVD deposits', PAGE_LEFT, feeY, { width: 180, lineBreak: false });
      pdf.text(fmtCents(totals.adCvdCents), PAGE_LEFT + 184, feeY, { width: 60, align: 'right', lineBreak: false });
    }
  }

  for (const [n, label, value] of totalsRows) {
    pdf.rect(totalsX, y, totalsWidth, 16).lineWidth(0.5).strokeColor('#333333').stroke();
    pdf.font('Helvetica').fontSize(6).fillColor('#444444')
      .text(`${n}. ${label}`, totalsX + 3, y + 5, { width: totalsWidth - 80, lineBreak: false });
    pdf.font('Helvetica-Bold').fontSize(n === '40' ? 9 : 8).fillColor('#000000')
      .text(value, totalsX + totalsWidth - 76, y + 4, { width: 72, align: 'right', lineBreak: false });
    y += 16;
  }
  if (totals === null) {
    pdf.font('Helvetica-Oblique').fontSize(6.5).fillColor('#666666')
      .text('Amounts unavailable — the draft is not complete enough to price.', PAGE_LEFT, y - 60, { width: totalsX - PAGE_LEFT - 10 });
    pdf.fillColor('#000000');
  }

  // ── Footer ──
  y += 14;
  pdf.font('Helvetica').fontSize(6).fillColor('#666666').text(
    'Duty, fees, and totals are estimates computed by the MyCargoLens native duty engine from current USITC rates; ' +
    'CBP assesses final amounts at liquidation. This document reproduces CBP Form 7501 data for record-keeping ' +
    `(19 CFR 163) and is not the government form itself. Generated ${new Date().toLocaleString('en-US')}.`,
    PAGE_LEFT, Math.min(y, PAGE_BOTTOM + 8), { width: PAGE_WIDTH }
  );

  pdf.end();
  return done;
}
