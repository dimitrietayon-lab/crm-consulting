const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { linkAccountOnWin } = require('../lib/sprintAccount');

const prisma = new PrismaClient();

// 6-Punkte-Checkliste — IDs müssen mit dem Frontend übereinstimmen
const CHECKLIST_POINTS = [
  'zielkunde',
  'assessment',
  'angebot',
  'termine',
  'ansprechpartner',
  'datenzugang',
];

const FORMATS = new Set(['vor-ort', 'remote', 'hybrid']);

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Nur bekannte Punkte übernehmen, alles andere verwerfen (kein Freitext-JSON)
function sanitizeChecklist(input) {
  const source = input && typeof input === 'object' ? input : {};
  const result = {};
  for (const key of CHECKLIST_POINTS) {
    result[key] = Boolean(source[key]);
  }
  return result;
}

function countDone(checklist) {
  if (!checklist || typeof checklist !== 'object') return 0;
  return CHECKLIST_POINTS.filter((key) => checklist[key]).length;
}

async function ensureTarget(targetId) {
  const target = await prisma.sprintTarget.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      companyName: true,
      status: true,
      contactName: true,
      contactEmail: true,
      package: true,
      offerValue: true,
      handoverDate: true,
      segment: true,
      website: true,
      numberOfEmployees: true,
      accountId: true,
    },
  });
  return target;
}

// GET /api/sprint-handover/:targetId
router.get('/:targetId', async (req, res) => {
  try {
    const target = await ensureTarget(req.params.targetId);
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const handover = await prisma.sprintHandover.findUnique({
      where: { sprintTargetId: req.params.targetId },
      include: {
        emUser: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({
      target,
      handover,
      checklistPoints: CHECKLIST_POINTS,
      done: countDone(handover?.checklist),
      total: CHECKLIST_POINTS.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-handover/:targetId
router.put('/:targetId', async (req, res) => {
  try {
    const target = await ensureTarget(req.params.targetId);
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const body = req.body || {};
    const data = {};

    if (body.checklist !== undefined) data.checklist = sanitizeChecklist(body.checklist);
    if (body.kickoffDate !== undefined) data.kickoffDate = toDate(body.kickoffDate);
    if (body.firstWorkshopDate !== undefined) data.firstWorkshopDate = toDate(body.firstWorkshopDate);
    if (body.format !== undefined) {
      if (body.format && !FORMATS.has(body.format)) {
        return res.status(400).json({ error: 'Ungültiges Format' });
      }
      data.format = body.format || null;
    }
    if (body.participants !== undefined) data.participants = body.participants || null;
    if (body.emUserId !== undefined) data.emUserId = body.emUserId || null;
    if (body.notes !== undefined) data.notes = body.notes || null;

    if (data.emUserId) {
      const emUser = await prisma.user.findUnique({
        where: { id: data.emUserId },
        select: { id: true },
      });
      if (!emUser) return res.status(400).json({ error: 'Mitarbeiter nicht gefunden' });
    }

    const handover = await prisma.sprintHandover.upsert({
      where: { sprintTargetId: req.params.targetId },
      create: { sprintTargetId: req.params.targetId, ...data },
      update: data,
      include: {
        emUser: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({
      handover,
      done: countDone(handover.checklist),
      total: CHECKLIST_POINTS.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-handover/:targetId/confirm — validiert 6/6 Punkte
router.post('/:targetId/confirm', async (req, res) => {
  try {
    const target = await ensureTarget(req.params.targetId);
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const existing = await prisma.sprintHandover.findUnique({
      where: { sprintTargetId: req.params.targetId },
    });
    if (!existing) {
      return res.status(400).json({ error: 'Übergabe wurde noch nicht angelegt' });
    }

    const done = countDone(existing.checklist);
    if (done < CHECKLIST_POINTS.length) {
      return res.status(409).json({
        error: `Checkliste unvollständig (${done}/${CHECKLIST_POINTS.length})`,
        done,
        total: CHECKLIST_POINTS.length,
      });
    }

    const name = req.user?.name || req.user?.email || 'Unbekannt';
    const now = new Date();

    const [handover] = await prisma.$transaction([
      prisma.sprintHandover.update({
        where: { sprintTargetId: req.params.targetId },
        data: { confirmedAt: now, confirmedBy: name },
        include: { emUser: { select: { id: true, name: true, email: true } } },
      }),
      prisma.sprintTarget.update({
        where: { id: req.params.targetId },
        data: { status: 'gewonnen', result: 'gewonnen' },
      }),
    ]);

    // Abschluss → CRM-Account anlegen/verknüpfen
    await linkAccountOnWin(prisma, { ...target, status: 'gewonnen' });

    res.json({ handover, done, total: CHECKLIST_POINTS.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sprint-handover/:targetId — Übergabe zurücksetzen
router.delete('/:targetId', async (req, res) => {
  try {
    await prisma.sprintHandover.delete({ where: { sprintTargetId: req.params.targetId } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Übergabe nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
