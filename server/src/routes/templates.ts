/**
 * Filing Templates CRUD Routes
 * 
 * GET    /api/v1/templates           — List all templates for the org
 * GET    /api/v1/templates/:id       — Get a single template
 * POST   /api/v1/templates           — Create a blank template
 * PATCH  /api/v1/templates/:id       — Update template name or data
 * DELETE /api/v1/templates/:id       — Delete a template
 * POST   /api/v1/templates/:id/apply — Create a new draft filing from template
 */

import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { writeAuditLog, getRequestMeta } from '../services/auditLog.js';

const router = Router();
router.use(authMiddleware);

const paramId = (req: AuthRequest): string => {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
};

// ─── GET /api/v1/templates — List org templates ───────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { filingType, search } = req.query as Record<string, string>;

  const where: any = { orgId: req.user!.orgId };
  if (filingType) where.filingType = filingType;
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const templates = await prisma.filingTemplate.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  res.json({ data: templates });
});

// ─── GET /api/v1/templates/:id — Get single template ──────
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const template = await prisma.filingTemplate.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
    include: {
      createdBy: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  res.json(template);
});

// ─── POST /api/v1/templates — Create template manually ────
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, filingType, templateData } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Template name is required' });
    return;
  }

  const template = await prisma.filingTemplate.create({
    data: {
      orgId: req.user!.orgId,
      createdById: req.user!.id,
      name: name.trim(),
      filingType: filingType || 'ISF-10',
      templateData: templateData || {},
    },
  });

  const meta = getRequestMeta(req);
  writeAuditLog({
    orgId: req.user!.orgId, userId: req.user!.id,
    action: 'template.created', entityType: 'filing_template', entityId: template.id,
    newValue: { name: template.name, filingType: template.filingType },
    ...meta,
  });

  res.status(201).json(template);
});

// ─── PATCH /api/v1/templates/:id — Update template ────────
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const template = await prisma.filingTemplate.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const { name, templateData } = req.body;
  const updateData: any = {};
  if (name && typeof name === 'string') updateData.name = name.trim();
  if (templateData) updateData.templateData = templateData;

  const updated = await prisma.filingTemplate.update({
    where: { id: template.id },
    data: updateData,
  });

  res.json(updated);
});

// ─── DELETE /api/v1/templates/:id — Delete template ────────
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const template = await prisma.filingTemplate.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  await prisma.filingTemplate.delete({ where: { id: template.id } });

  const meta = getRequestMeta(req);
  writeAuditLog({
    orgId: req.user!.orgId, userId: req.user!.id,
    action: 'template.deleted', entityType: 'filing_template', entityId: template.id,
    oldValue: { name: template.name },
    ...meta,
  });

  res.json({ success: true });
});

// ─── POST /api/v1/templates/:id/apply — Create filing from template ──
router.post('/:id/apply', async (req: AuthRequest, res: Response): Promise<void> => {
  const template = await prisma.filingTemplate.findFirst({
    where: { id: paramId(req), orgId: req.user!.orgId },
  });

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const data = template.templateData as any;

  // Create a new draft filing pre-filled from the template
  const filing = await prisma.filing.create({
    data: {
      orgId: req.user!.orgId,
      createdById: req.user!.id,
      filingType: template.filingType,
      status: 'draft',
      importerName: data.importerName ?? null,
      importerNumber: data.importerNumber ?? null,
      consigneeName: data.consigneeName ?? null,
      consigneeNumber: data.consigneeNumber ?? null,
      consigneeAddress: data.consigneeAddress ?? undefined,
      manufacturer: data.manufacturer ?? undefined,
      seller: data.seller ?? undefined,
      buyer: data.buyer ?? undefined,
      shipToParty: data.shipToParty ?? undefined,
      containerStuffingLocation: data.containerStuffingLocation ?? undefined,
      consolidator: data.consolidator ?? undefined,
      scacCode: data.scacCode ?? null,
      foreignPortOfUnlading: data.foreignPortOfUnlading ?? null,
      placeOfDelivery: data.placeOfDelivery ?? null,
      bondType: data.bondType ?? null,
      bondSuretyCode: data.bondSuretyCode ?? null,
      isf5Data: data.isf5Data ?? undefined,
      commodities: data.commodities ?? [],
      containers: [], // Always empty — user fills per shipment
      statusHistory: {
        create: {
          status: 'draft',
          message: `Created from template: ${template.name}`,
          changedById: req.user!.id,
        },
      },
    },
  });

  const meta = getRequestMeta(req);
  writeAuditLog({
    orgId: req.user!.orgId, userId: req.user!.id,
    action: 'filing.created_from_template', entityType: 'filing', entityId: filing.id,
    newValue: { templateId: template.id, templateName: template.name, filingType: template.filingType },
    ...meta,
  });

  res.status(201).json(filing);
});

export default router;
