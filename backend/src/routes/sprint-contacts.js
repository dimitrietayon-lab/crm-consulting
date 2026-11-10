const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { validate, sendInvalid } = require('../lib/validate');

const prisma = new PrismaClient();

const CONTACT_FIELDS = {
  name: { type: 'string', nullable: false, maxLength: 200, label: 'Name' },
  role: { type: 'string', maxLength: 200, label: 'Rolle' },
  email: { type: 'email', maxLength: 200, label: 'E-Mail' },
  phone: { type: 'string', maxLength: 100, label: 'Telefon' },
  linkedin: { type: 'string', maxLength: 300, label: 'LinkedIn' },
  isPrimary: { type: 'boolean', label: 'Hauptansprechpartner' },
  emailConsentAt: { type: 'date', label: 'E-Mail-Einwilligung' },
  callConsentAt: { type: 'date', label: 'Telefon-Einwilligung' },
  notes: { type: 'string', maxLength: 4000, label: 'Notizen' },
};

const CONTACT_CREATE_SCHEMA = {
  ...CONTACT_FIELDS,
  name: { ...CONTACT_FIELDS.name, required: true },
  sprintTargetId: { type: 'string', required: true, label: 'Zielkunde' },
};

const TARGET_SELECT = { id: true, companyName: true, status: true, segment: true };

// GET /api/sprint-contacts?q=&sprintTargetId=&limit=
router.get('/', async (req, res) => {
  try {
    const { q, sprintTargetId, limit } = req.query;
    const where = {};
    if (sprintTargetId) where.sprintTargetId = sprintTargetId;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { role: { contains: q, mode: 'insensitive' } },
        { sprintTarget: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const contacts = await prisma.sprintTargetContact.findMany({
      where,
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      take: Math.min(1000, Math.max(1, parseInt(limit, 10) || 300)),
      include: { sprintTarget: { select: TARGET_SELECT } },
    });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-contacts
router.post('/', async (req, res) => {
  try {
    const { value, errors } = validate(req.body || {}, CONTACT_CREATE_SCHEMA);
    if (sendInvalid(res, errors)) return;

    const target = await prisma.sprintTarget.findUnique({
      where: { id: value.sprintTargetId },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const contact = await prisma.sprintTargetContact.create({
      data: value,
      include: { sprintTarget: { select: TARGET_SELECT } },
    });
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-contacts/:id
router.put('/:id', async (req, res) => {
  try {
    const { value, errors } = validate(req.body || {}, CONTACT_FIELDS);
    if (sendInvalid(res, errors)) return;

    const contact = await prisma.sprintTargetContact.update({
      where: { id: req.params.id },
      data: value,
      include: { sprintTarget: { select: TARGET_SELECT } },
    });
    res.json(contact);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kontakt nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sprint-contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.sprintTargetContact.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kontakt nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
