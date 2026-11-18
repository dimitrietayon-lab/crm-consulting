// Kampagnen: Workflow (Pipeline) + Dienstleistung + Paket + Zeitraum.
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { toText, toBool, toDate } = require('../lib/validate');
const requireAdmin = require('../middleware/requireAdmin');
const { slugifyStatus, loadCampaignIndex } = require('../lib/acquisitionPipeline');

const prisma = new PrismaClient();

const INCLUDE = {
  pipeline: { select: { id: true, key: true, name: true } },
  service: { select: { id: true, name: true } },
  _count: { select: { targets: true } },
};

function serialize(c) {
  return {
    id: c.id,
    key: c.key,
    name: c.name,
    description: c.description,
    pipelineId: c.pipelineId,
    pipeline: c.pipeline || null,
    serviceId: c.serviceId,
    service: c.service || null,
    package: c.package,
    startDate: c.startDate,
    endDate: c.endDate,
    active: c.active,
    isDefault: c.isDefault,
    targetCount: c._count?.targets ?? 0,
  };
}

function parseBody(body) {
  return {
    name: toText(body?.name),
    description: toText(body?.description) || null,
    pipelineId: toText(body?.pipelineId),
    serviceId: toText(body?.serviceId) || null,
    package: toText(body?.package) || null,
    startDate: toDate(body?.startDate),
    endDate: toDate(body?.endDate),
    active: toBool(body?.active, { defaultValue: true }),
  };
}

async function ensurePipeline(pipelineId) {
  if (!pipelineId) return false;
  const p = await prisma.acquisitionPipeline.findUnique({ where: { id: pipelineId }, select: { id: true } });
  return Boolean(p);
}

// GET /api/acquisition-campaigns
router.get('/', async (req, res) => {
  try {
    const rows = await prisma.acquisitionCampaign.findMany({
      include: INCLUDE,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    res.json(rows.map(serialize));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/acquisition-campaigns/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await prisma.acquisitionCampaign.findUnique({
      where: { id: req.params.id },
      include: INCLUDE,
    });
    if (!row) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
    res.json(serialize(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition-campaigns
router.post('/', requireAdmin, async (req, res) => {
  try {
    const data = parseBody(req.body || {});
    if (!data.name) return res.status(400).json({ error: 'Name ist erforderlich' });
    if (!await ensurePipeline(data.pipelineId)) {
      return res.status(400).json({ error: 'Gültiger Workflow (pipelineId) ist erforderlich' });
    }
    const key = toText(req.body?.key) || slugifyStatus(data.name);
    const exists = await prisma.acquisitionCampaign.findUnique({ where: { key } });
    if (exists) return res.status(409).json({ error: 'Eine Kampagne mit diesem Key existiert bereits' });

    const isDefault = toBool(req.body?.isDefault, { defaultValue: false });
    const campaign = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.acquisitionCampaign.updateMany({ data: { isDefault: false } });
      return tx.acquisitionCampaign.create({
        data: { key, ...data, isDefault },
        include: INCLUDE,
      });
    });
    await loadCampaignIndex();
    res.status(201).json(serialize(campaign));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/acquisition-campaigns/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.acquisitionCampaign.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Kampagne nicht gefunden' });

    const data = parseBody(req.body || {});
    if (data.pipelineId && !await ensurePipeline(data.pipelineId)) {
      return res.status(400).json({ error: 'Gültiger Workflow (pipelineId) ist erforderlich' });
    }
    if (!data.pipelineId) data.pipelineId = existing.pipelineId;
    if (!data.name) data.name = existing.name;

    const isDefault = req.body?.isDefault !== undefined
      ? toBool(req.body.isDefault, { defaultValue: false })
      : existing.isDefault;

    const campaign = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.acquisitionCampaign.updateMany({
          where: { id: { not: existing.id } },
          data: { isDefault: false },
        });
      }
      return tx.acquisitionCampaign.update({
        where: { id: existing.id },
        data: { ...data, isDefault },
        include: INCLUDE,
      });
    });
    await loadCampaignIndex();
    res.json(serialize(campaign));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition-campaigns/:id/set-default
router.post('/:id/set-default', requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.acquisitionCampaign.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
    const campaign = await prisma.$transaction(async (tx) => {
      await tx.acquisitionCampaign.updateMany({
        where: { id: { not: existing.id } },
        data: { isDefault: false },
      });
      return tx.acquisitionCampaign.update({
        where: { id: existing.id },
        data: { isDefault: true },
        include: INCLUDE,
      });
    });
    await loadCampaignIndex();
    res.json(serialize(campaign));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/acquisition-campaigns/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.acquisitionCampaign.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { targets: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
    if ((existing._count?.targets || 0) > 0) {
      return res.status(409).json({ error: 'Kampagne wird von Zielkunden verwendet' });
    }
    await prisma.acquisitionCampaign.delete({ where: { id: existing.id } });
    await loadCampaignIndex();
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
