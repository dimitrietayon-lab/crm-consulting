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
// DB-Felder des Akquise-Settings-Modells heißen name/startDate/endDate.
// Die bisherigen API-Felder (sprintName/sprintStart/sprintEnd) bleiben als Aliase erhalten.
const STRING_FIELDS = ['name'];
const DATE_FIELDS = ['startDate', 'endDate'];
const JSON_FIELDS = ['packages', 'segments', 'notifications', 'bafaParams', 'linkedin'];
const FIELD_ALIASES = { sprintName: 'name', sprintStart: 'startDate', sprintEnd: 'endDate' };

const DEFAULTS = {
  id: SINGLETON,
  linkedinQuota: 75,
  callsQuota: 100,
  hoursPerWeek: 8.4,
  offerValidityDays: 21,
  targetFirms: 878,
  teamCapacity: 10,
  revenueTarget: 500000,
  name: 'Akquise',
  startDate: null,
  endDate: null,
  packages: null,
  segments: null,
  notifications: null,
  bafaParams: null,
  linkedin: null,
};

function normalizeInput(body) {
  const input = { ...(body || {}) };
  for (const [legacy, current] of Object.entries(FIELD_ALIASES)) {
    if (input[current] === undefined && input[legacy] !== undefined) input[current] = input[legacy];
  }
  return input;
}

function sanitize(body) {
  const input = normalizeInput(body);
  const data = {};
  for (const f of NUMBER_FIELDS) {
    if (input[f] !== undefined && input[f] !== null && input[f] !== '') data[f] = Number(input[f]);
  }
  for (const f of STRING_FIELDS) {
    if (input[f] !== undefined) data[f] = input[f] === '' ? null : String(input[f]);
  }
  for (const f of DATE_FIELDS) {
    if (input[f] !== undefined) data[f] = input[f] ? new Date(input[f]) : null;
    if (data[f] instanceof Date && Number.isNaN(data[f].getTime())) delete data[f];
  }
  for (const f of JSON_FIELDS) {
    if (input[f] !== undefined) data[f] = input[f] === null ? null : input[f];
  }
  return data;
}

// Antwort um die bisherigen API-Feldnamen ergänzen (Frontend-Kompatibilität)
function toApi(settings) {
  if (!settings) return settings;
  return {
    ...settings,
    sprintName: settings.name ?? null,
    sprintStart: settings.startDate ?? null,
    sprintEnd: settings.endDate ?? null,
  };
}

async function ensureSettings() {
  const existing = await prisma.acquisitionSetting.findUnique({ where: { id: SINGLETON } });
  if (existing) return existing;
  return prisma.acquisitionSetting.create({ data: { id: SINGLETON } });
}

// GET /api/acquisition-settings
router.get('/', async (req, res) => {
  try {
    const settings = await ensureSettings();
    res.json(toApi(settings));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/acquisition-settings
router.put('/', async (req, res) => {
  try {
    await ensureSettings();
    const data = sanitize(req.body || {});
    const settings = await prisma.acquisitionSetting.update({
      where: { id: SINGLETON },
      data,
    });
    res.json(toApi(settings));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition-settings/reset — setzt auf Defaults zurück (nur Admin)
router.post('/reset', requireAdmin, async (req, res) => {
  try {
    await ensureSettings();
    const data = { ...DEFAULTS };
    delete data.id;
    const settings = await prisma.acquisitionSetting.update({ where: { id: SINGLETON }, data });
    res.json(toApi(settings));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
