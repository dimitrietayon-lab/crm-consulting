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

// Pakete inklusive ihrer enthaltenen Leistungen (mit Umfang)
const PACKAGE_INCLUDE = {
  services: {
    include: {
      service: {
        select: { id: true, name: true, category: true, unit: true, dayRate: true, fixedFee: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
};

function loadPackages() {
  return prisma.sprintPackageInfo.findMany({ include: PACKAGE_INCLUDE, orderBy: { price: 'asc' } });
}

// GET /api/sprint-market — komplette Marktkonfiguration
router.get('/', async (req, res) => {
  try {
    const [regions, wzMappings, packages, segments] = await Promise.all([
      prisma.sprintRegion.findMany({ orderBy: [{ priority: 'asc' }, { bundesland: 'asc' }] }),
      prisma.sprintWzMapping.findMany({ orderBy: [{ priority: 'asc' }, { wzCode: 'asc' }] }),
      loadPackages(),
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

// PUT /api/sprint-market/packages — Pakete inkl. Leistungen ersetzen
router.put('/packages', async (req, res) => {
  try {
    const rows = asArray(req.body?.packages);
    const byKey = new Map();
    for (const p of rows) {
      const key = text(p.key);
      const label = text(p.label);
      if (!key || !label) continue;
      const price = Number(p.price);

      // Leistungen mit Umfang (Menge) – Dubletten werden zusammengefasst
      const services = [];
      const seenServices = new Set();
      for (const s of asArray(p.services)) {
        const serviceId = text(s?.serviceId || s?.id);
        if (!serviceId || seenServices.has(serviceId)) continue;
        seenServices.add(serviceId);
        services.push({
          serviceId,
          quantity: Math.max(1, toInt(s?.quantity, { defaultValue: 1 })),
        });
      }

      byKey.set(key, {
        key,
        label,
        price: Number.isFinite(price) ? price : 0,
        description: text(p.description),
        active: toBool(p.active, { defaultValue: true }),
        services,
      });
    }
    if (byKey.size === 0) return res.status(400).json({ error: 'Keine gültigen Pakete übergeben' });

    const keys = [...byKey.keys()];
    await prisma.$transaction(async (tx) => {
      // Entfernte Pakete löschen (Leistungen via FK-Cascade, Rollen explizit)
      await tx.sprintPackageInfo.deleteMany({ where: { key: { notIn: keys } } });
      await tx.sprintPackageRole.deleteMany({ where: { package: { notIn: keys } } });

      for (const row of byKey.values()) {
        const { services, ...info } = row;
        await tx.sprintPackageInfo.upsert({
          where: { key: row.key },
          create: info,
          update: info,
        });

        const serviceIds = services.map((s) => s.serviceId);
        await tx.sprintPackageService.deleteMany({
          where: { package: row.key, serviceId: { notIn: serviceIds } },
        });
        for (const s of services) {
          await tx.sprintPackageService.upsert({
            where: { package_serviceId: { package: row.key, serviceId: s.serviceId } },
            create: { package: row.key, serviceId: s.serviceId, quantity: s.quantity },
            update: { quantity: s.quantity },
          });
        }
      }
    });

    res.json(await loadPackages());
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
