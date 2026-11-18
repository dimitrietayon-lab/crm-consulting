// Schritt-Bibliothek: wiederverwendbare Standard-/Custom-Schritte (Templates).
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { toText, toBool } = require('../lib/validate');
const requireAdmin = require('../middleware/requireAdmin');
const { slugifyStatus } = require('../lib/acquisitionPipeline');

const prisma = new PrismaClient();

function serialize(t) {
  return {
    id: t.id,
    key: t.key,
    label: t.label,
    shortLabel: t.shortLabel,
    activityType: t.activityType,
    title: t.title,
    description: t.description,
    guide: Array.isArray(t.guide) ? t.guide : [],
    exitCriteria: Array.isArray(t.exitCriteria) ? t.exitCriteria : [],
    requiredFields: Array.isArray(t.requiredFields) ? t.requiredFields : [],
    isEarly: t.isEarly,
    isInTalk: t.isInTalk,
    isOffer: t.isOffer,
    isOfferSent: t.isOfferSent,
    isWon: t.isWon,
    isLost: t.isLost,
    isWildcard: t.isWildcard,
    isClosing: t.isClosing,
    outcome: t.outcome,
    isStandard: t.isStandard,
    ownerPipelineId: t.ownerPipelineId,
    active: t.active,
    usageCount: t._count?.steps ?? undefined,
  };
}

function parseFlags(body) {
  return {
    isEarly: toBool(body?.isEarly, { defaultValue: false }),
    isInTalk: toBool(body?.isInTalk, { defaultValue: false }),
    isOffer: toBool(body?.isOffer, { defaultValue: false }),
    isOfferSent: toBool(body?.isOfferSent, { defaultValue: false }),
    isWon: toBool(body?.isWon, { defaultValue: false }),
    isLost: toBool(body?.isLost, { defaultValue: false }),
    isWildcard: toBool(body?.isWildcard, { defaultValue: false }),
    isClosing: toBool(body?.isClosing, { defaultValue: false }),
  };
}

function parseMetadata(body) {
  return {
    label: toText(body?.label),
    shortLabel: toText(body?.shortLabel) || null,
    activityType: toText(body?.activityType) || 'Note',
    title: toText(body?.title) || null,
    description: toText(body?.description) || null,
    guide: Array.isArray(body?.guide) ? body.guide.filter((g) => typeof g === 'string') : [],
    exitCriteria: Array.isArray(body?.exitCriteria)
      ? body.exitCriteria
        .filter((e) => e && typeof e.t === 'string')
        .map((e) => ({ k: toText(e.k) || toText(e.t), t: toText(e.t), ...(toText(e.auto) ? { auto: toText(e.auto) } : {}) }))
      : [],
    requiredFields: Array.isArray(body?.requiredFields) ? body.requiredFields : [],
    outcome: toText(body?.outcome) || null,
  };
}

// GET /api/acquisition-steps — Bibliothek (?q=&standard=1|0)
router.get('/', async (req, res) => {
  try {
    const q = toText(req.query.q);
    const standard = req.query.standard;
    const where = {};
    if (standard === '1' || standard === 'true') where.isStandard = true;
    if (standard === '0' || standard === 'false') where.isStandard = false;
    if (q) {
      where.OR = [
        { label: { contains: q, mode: 'insensitive' } },
        { key: { contains: q, mode: 'insensitive' } },
      ];
    }
    const rows = await prisma.acquisitionStepTemplate.findMany({
      where,
      orderBy: [{ isStandard: 'desc' }, { label: 'asc' }],
      include: { _count: { select: { steps: true } } },
    });
    res.json(rows.map(serialize));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition-steps — Custom-Schritt anlegen (Admin)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const label = toText(body.label);
    if (!label) return res.status(400).json({ error: 'Label ist erforderlich' });
    const baseKey = toText(body.key) || slugifyStatus(label);
    if (!baseKey) return res.status(400).json({ error: 'Key ist erforderlich' });

    // Eindeutigen Key bilden
    let key = baseKey;
    let suffix = 1;
    while (await prisma.acquisitionStepTemplate.findUnique({ where: { key } })) {
      suffix += 1;
      key = `${baseKey}-${suffix}`;
    }

    const template = await prisma.acquisitionStepTemplate.create({
      data: {
        key,
        isStandard: false,
        ownerPipelineId: toText(body.ownerPipelineId) || null,
        active: toBool(body.active, { defaultValue: true }),
        ...parseFlags(body),
        ...parseMetadata({ ...body, label }),
      },
      include: { _count: { select: { steps: true } } },
    });
    res.status(201).json(serialize(template));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/acquisition-steps/:id — Metadaten bearbeiten (Admin)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.acquisitionStepTemplate.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { steps: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Schritt nicht gefunden' });

    const body = req.body || {};
    const meta = parseMetadata(body);
    const data = {
      ...parseFlags(body),
      active: toBool(body.active, { defaultValue: existing.active }),
    };
    if (meta.label) data.label = meta.label;
    data.shortLabel = meta.shortLabel;
    data.activityType = meta.activityType;
    data.title = meta.title;
    data.description = meta.description;
    data.guide = meta.guide;
    data.exitCriteria = meta.exitCriteria;
    data.requiredFields = meta.requiredFields;
    data.outcome = meta.outcome;

    // Key nur ändern, wenn der Schritt nicht verwendet wird
    if (body.key !== undefined && toText(body.key) && toText(body.key) !== existing.key) {
      if (existing.isStandard) {
        return res.status(400).json({ error: 'Der Key eines Standard-Schritts ist gesperrt' });
      }
      if ((existing._count?.steps || 0) > 0) {
        return res.status(409).json({ error: 'Key kann nicht geändert werden – Schritt wird verwendet' });
      }
      data.key = toText(body.key);
    }

    const template = await prisma.acquisitionStepTemplate.update({
      where: { id: existing.id },
      data,
      include: { _count: { select: { steps: true } } },
    });
    res.json(serialize(template));
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Key bereits vergeben' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/acquisition-steps/:id — Custom löschen (Admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.acquisitionStepTemplate.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { steps: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Schritt nicht gefunden' });
    if (existing.isStandard) {
      return res.status(409).json({ error: 'Standard-Schritte können nicht gelöscht werden' });
    }
    if ((existing._count?.steps || 0) > 0) {
      return res.status(409).json({ error: 'Schritt wird von einem Workflow verwendet' });
    }
    await prisma.acquisitionStepTemplate.delete({ where: { id: existing.id } });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
