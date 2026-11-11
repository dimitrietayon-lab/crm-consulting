const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const requireAdmin = require('../middleware/requireAdmin');

const prisma = new PrismaClient();

const SINGLETON = 'singleton';

const NUMBER_FIELDS = [
  'linkedinQuota', 'callsQuota', 'hoursPerWeek', 'offerValidityDays',
  'targetFirms', 'teamCapacity', 'revenueTarget',
];
const STRING_FIELDS = ['sprintName'];
const DATE_FIELDS = ['sprintStart', 'sprintEnd'];
const JSON_FIELDS = ['packages', 'segments', 'notifications', 'bafaParams', 'linkedin'];

const DEFAULTS = {
  id: SINGLETON,
  linkedinQuota: 75,
  callsQuota: 100,
  hoursPerWeek: 8.4,
  offerValidityDays: 21,
  targetFirms: 878,
  teamCapacity: 10,
  revenueTarget: 500000,
  sprintName: 'Akquise',
  sprintStart: null,
  sprintEnd: null,
  packages: null,
  segments: null,
  notifications: null,
  bafaParams: null,
  linkedin: null,
};

function sanitize(body) {
  const data = {};
  for (const f of NUMBER_FIELDS) {
    if (body[f] !== undefined && body[f] !== null && body[f] !== '') data[f] = Number(body[f]);
  }
  for (const f of STRING_FIELDS) {
    if (body[f] !== undefined) data[f] = body[f] === '' ? null : String(body[f]);
  }
  for (const f of DATE_FIELDS) {
    if (body[f] !== undefined) data[f] = body[f] ? new Date(body[f]) : null;
    if (data[f] instanceof Date && Number.isNaN(data[f].getTime())) delete data[f];
  }
  for (const f of JSON_FIELDS) {
    if (body[f] !== undefined) data[f] = body[f] === null ? null : body[f];
  }
  return data;
}

async function ensureSettings() {
  const existing = await prisma.sprintSetting.findUnique({ where: { id: SINGLETON } });
  if (existing) return existing;
  return prisma.sprintSetting.create({ data: { id: SINGLETON } });
}

// GET /api/sprint-settings
router.get('/', async (req, res) => {
  try {
    const settings = await ensureSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-settings
router.put('/', async (req, res) => {
  try {
    await ensureSettings();
    const data = sanitize(req.body || {});
    const settings = await prisma.sprintSetting.update({
      where: { id: SINGLETON },
      data,
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-settings/reset — setzt auf Defaults zurück (nur Admin)
router.post('/reset', requireAdmin, async (req, res) => {
  try {
    await ensureSettings();
    const data = { ...DEFAULTS };
    delete data.id;
    const settings = await prisma.sprintSetting.update({ where: { id: SINGLETON }, data });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
