const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { validate, sendInvalid } = require('../lib/validate');

const prisma = new PrismaClient();

const CHANNELS = new Set(['E-Mail', 'LinkedIn', 'Telefon']);

const TEMPLATE_FIELDS = {
  name: { type: 'string', nullable: false, maxLength: 200, label: 'Bezeichnung' },
  channel: { type: 'enum', values: CHANNELS, nullable: false, label: 'Kanal' },
  subject: { type: 'string', maxLength: 300, label: 'Betreff' },
  body: { type: 'string', nullable: false, maxLength: 20000, label: 'Text' },
  notes: { type: 'string', maxLength: 2000, label: 'Notiz' },
  active: { type: 'boolean', label: 'Aktiv' },
};

const TEMPLATE_CREATE_SCHEMA = {
  ...TEMPLATE_FIELDS,
  name: { ...TEMPLATE_FIELDS.name, required: true },
  body: { ...TEMPLATE_FIELDS.body, required: true },
  channel: { ...TEMPLATE_FIELDS.channel, default: 'E-Mail' },
  active: { ...TEMPLATE_FIELDS.active, default: true },
};

// GET /api/sprint-outreach/templates
router.get('/templates', async (req, res) => {
  try {
    const { q, channel, active, limit } = req.query;
    const where = {};
    if (channel) where.channel = channel;
    if (active === 'true') where.active = true;
    if (active === 'false') where.active = false;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const templates = await prisma.sprintOutreachTemplate.findMany({
      where,
      orderBy: [{ channel: 'asc' }, { name: 'asc' }],
      take: Math.min(500, Math.max(1, parseInt(limit, 10) || 200)),
    });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-outreach/templates
router.post('/templates', async (req, res) => {
  try {
    const { value, errors } = validate(req.body || {}, TEMPLATE_CREATE_SCHEMA);
    if (sendInvalid(res, errors)) return;

    const template = await prisma.sprintOutreachTemplate.create({
      data: {
        name: value.name,
        channel: value.channel || 'E-Mail',
        subject: value.subject ?? null,
        body: value.body,
        notes: value.notes ?? null,
        active: value.active !== false,
      },
    });
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-outreach/templates/:id
router.put('/templates/:id', async (req, res) => {
  try {
    const { value, errors } = validate(req.body || {}, TEMPLATE_FIELDS);
    if (sendInvalid(res, errors)) return;

    const template = await prisma.sprintOutreachTemplate.update({
      where: { id: req.params.id },
      data: value,
    });
    res.json(template);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sprint-outreach/templates/:id
router.delete('/templates/:id', async (req, res) => {
  try {
    await prisma.sprintOutreachTemplate.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-outreach/templates/:id/use — Nutzung zählen
router.post('/templates/:id/use', async (req, res) => {
  try {
    const template = await prisma.sprintOutreachTemplate.update({
      where: { id: req.params.id },
      data: { usageCount: { increment: 1 } },
    });
    res.json(template);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
