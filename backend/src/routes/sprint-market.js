const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { toText, toInt, toBool } = require('../lib/validate');

const prisma = new PrismaClient();

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return toText(value);
}

function priority(value) {
  return toInt(value, { min: 1, max: 5, defaultValue: 3 });
}

// GET /api/sprint-market — komplette Marktkonfiguration
router.get('/', async (req, res) => {
  try {
    const [regions, wzMappings, packages, segments] = await Promise.all([
      prisma.sprintRegion.findMany({ orderBy: [{ priority: 'asc' }, { bundesland: 'asc' }] }),
      prisma.sprintWzMapping.findMany({ orderBy: [{ priority: 'asc' }, { wzCode: 'asc' }] }),
      prisma.sprintPackageInfo.findMany({ orderBy: { price: 'asc' } }),
      prisma.sprintSegment.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    ]);
    res.json({ regions, wzMappings, packages, segments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-market/regions — Bundesländer-Priorisierung ersetzen
router.put('/regions', async (req, res) => {
  try {
    const rows = asArray(req.body?.regions);
    const byName = new Map();
    for (const r of rows) {
      const bundesland = text(r.bundesland);
      if (!bundesland) continue;
      byName.set(bundesland, {
        bundesland,
        priority: priority(r.priority),
        note: text(r.note),
        active: toBool(r.active, { defaultValue: true }),
      });
    }
    if (byName.size === 0) return res.status(400).json({ error: 'Keine gültigen Regionen übergeben' });

    await prisma.$transaction([
      prisma.sprintRegion.deleteMany({ where: { bundesland: { notIn: [...byName.keys()] } } }),
      ...Array.from(byName.values()).map((row) =>
        prisma.sprintRegion.upsert({
          where: { bundesland: row.bundesland },
          create: row,
          update: row,
        })
      ),
    ]);

    const regions = await prisma.sprintRegion.findMany({
      orderBy: [{ priority: 'asc' }, { bundesland: 'asc' }],
    });
    res.json(regions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-market/wz-mappings — WZ-Zuordnung ersetzen
router.put('/wz-mappings', async (req, res) => {
  try {
    const rows = asArray(req.body?.wzMappings);
    const byCode = new Map();
    for (const m of rows) {
      const wzCode = text(m.wzCode);
      const segment = text(m.segment);
      if (!wzCode || !segment) continue;
      byCode.set(wzCode, {
        wzCode,
        segment,
        priority: priority(m.priority),
        note: text(m.note),
      });
    }
    if (byCode.size === 0) return res.status(400).json({ error: 'Keine gültigen WZ-Zuordnungen übergeben' });

    await prisma.$transaction([
      prisma.sprintWzMapping.deleteMany({ where: { wzCode: { notIn: [...byCode.keys()] } } }),
      ...Array.from(byCode.values()).map((row) =>
        prisma.sprintWzMapping.upsert({
          where: { wzCode: row.wzCode },
          create: row,
          update: row,
        })
      ),
    ]);

    const wzMappings = await prisma.sprintWzMapping.findMany({
      orderBy: [{ priority: 'asc' }, { wzCode: 'asc' }],
    });
    res.json(wzMappings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-market/packages — Pakete ersetzen
router.put('/packages', async (req, res) => {
  try {
    const rows = asArray(req.body?.packages);
    const byKey = new Map();
    for (const p of rows) {
      const key = text(p.key);
      const label = text(p.label);
      if (!key || !label) continue;
      const price = Number(p.price);
      byKey.set(key, {
        key,
        label,
        price: Number.isFinite(price) ? price : 0,
        description: text(p.description),
        active: toBool(p.active, { defaultValue: true }),
      });
    }
    if (byKey.size === 0) return res.status(400).json({ error: 'Keine gültigen Pakete übergeben' });

    await prisma.$transaction([
      prisma.sprintPackageInfo.deleteMany({ where: { key: { notIn: [...byKey.keys()] } } }),
      ...Array.from(byKey.values()).map((row) =>
        prisma.sprintPackageInfo.upsert({
          where: { key: row.key },
          create: row,
          update: row,
        })
      ),
    ]);

    const packages = await prisma.sprintPackageInfo.findMany({ orderBy: { price: 'asc' } });
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-market/segments — Segmente ersetzen
router.put('/segments', async (req, res) => {
  try {
    const names = asArray(req.body?.segments)
      .map((s) => (typeof s === 'string' ? s : s?.name))
      .map(text)
      .filter(Boolean);
    const unique = [...new Set(names)];
    if (unique.length === 0) return res.status(400).json({ error: 'Keine gültigen Segmente übergeben' });

    await prisma.$transaction([
      prisma.sprintSegment.deleteMany({ where: { name: { notIn: unique } } }),
      ...unique.map((name, index) =>
        prisma.sprintSegment.upsert({
          where: { name },
          create: { name, sortOrder: index + 1 },
          update: { sortOrder: index + 1 },
        })
      ),
    ]);

    const segments = await prisma.sprintSegment.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
