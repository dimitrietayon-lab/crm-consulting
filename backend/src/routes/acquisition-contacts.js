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
  acquisitionTargetId: { type: 'string', required: true, label: 'Zielkunde' },
};

const TARGET_SELECT = { id: true, companyName: true, status: true, segment: true };

// GET /api/acquisition-contacts?q=&acquisitionTargetId=&limit=
router.get('/', async (req, res) => {
  try {
    const { q, acquisitionTargetId, limit } = req.query;
    const where = {};
    if (acquisitionTargetId) where.acquisitionTargetId = acquisitionTargetId;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { role: { contains: q, mode: 'insensitive' } },
        { acquisitionTarget: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const contacts = await prisma.acquisitionTargetContact.findMany({
      where,
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      take: Math.min(1000, Math.max(1, parseInt(limit, 10) || 300)),
      include: { acquisitionTarget: { select: TARGET_SELECT } },
    });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition-contacts
router.post('/', async (req, res) => {
  try {
    const { value, errors } = validate(req.body || {}, CONTACT_CREATE_SCHEMA);
    if (sendInvalid(res, errors)) return;

    const target = await prisma.acquisitionTarget.findUnique({
      where: { id: value.acquisitionTargetId },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const contact = await prisma.acquisitionTargetContact.create({
      data: value,
      include: { acquisitionTarget: { select: TARGET_SELECT } },
    });
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/acquisition-contacts/:id
router.put('/:id', async (req, res) => {
  try {
    const { value, errors } = validate(req.body || {}, CONTACT_FIELDS);
    if (sendInvalid(res, errors)) return;

    const contact = await prisma.acquisitionTargetContact.update({
      where: { id: req.params.id },
      data: value,
      include: { acquisitionTarget: { select: TARGET_SELECT } },
    });
    res.json(contact);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kontakt nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/acquisition-contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.acquisitionTargetContact.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kontakt nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
