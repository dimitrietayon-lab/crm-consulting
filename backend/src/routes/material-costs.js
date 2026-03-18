const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { notifyApproversOfUser } = require('../services/notifications');

const prisma = new PrismaClient();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const INCLUDE = {
  project: { select: { id: true, name: true } },
  user:    { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
};

// GET /api/material-costs
router.get('/', async (req, res) => {
  try {
    const { userId, projectId, status, ccLeaderId, managerId } = req.query;
    const where = {};
    if (userId)    where.userId    = userId;
    if (projectId) where.projectId = projectId;
    if (status)    where.status    = status;
    if (ccLeaderId) {
      const ccs = await prisma.competenceCenter.findMany({
        where: { headId: ccLeaderId },
        include: { teams: { include: { members: { select: { userId: true } } } } },
      });
      const memberIds = [...new Set(ccs.flatMap(cc => cc.teams.flatMap(t => t.members.map(m => m.userId))))];
      where.userId = { in: memberIds };
    }
    if (managerId) {
      const teams = await prisma.team.findMany({
        where: { leaderId: managerId },
        include: { members: { select: { userId: true } } },
      });
      const memberIds = [...new Set(teams.flatMap(t => t.members.map(m => m.userId)))];
      where.userId = { in: memberIds };
    }

    const items = await prisma.materialCost.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/material-costs
router.post('/', upload.single('receipt'), async (req, res) => {
  try {
    const { projectId, userId, date, description, category, quantity, unitPrice, supplier, notes } = req.body;
    if (!projectId || !userId || !date || !description || !unitPrice) {
      return res.status(400).json({ error: 'projectId, userId, date, description und unitPrice sind Pflichtfelder' });
    }
    const qty   = Number(quantity) || 1;
    const price = Number(unitPrice);
    const item = await prisma.materialCost.create({
      data: {
        projectId,
        userId,
        date:        new Date(date),
        description,
        category:    category || 'Sonstiges',
        quantity:    qty,
        unitPrice:   price,
        totalAmount: qty * price,
        supplier:    supplier || null,
        notes:       notes    || null,
        receiptPath: req.file ? req.file.path.replace(/\\/g, '/') : null,
      },
      include: INCLUDE,
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/material-costs/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.materialCost.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Nicht gefunden' });
    if (existing.status !== 'draft') return res.status(400).json({ error: 'Nur Entwürfe können bearbeitet werden' });

    const { date, description, category, quantity, unitPrice, supplier, notes } = req.body;
    const qty   = quantity   !== undefined ? Number(quantity)   : existing.quantity;
    const price = unitPrice  !== undefined ? Number(unitPrice)  : existing.unitPrice;

    const item = await prisma.materialCost.update({
      where: { id: req.params.id },
      data: {
        ...(date        && { date: new Date(date) }),
        ...(description && { description }),
        ...(category    && { category }),
        quantity:    qty,
        unitPrice:   price,
        totalAmount: qty * price,
        ...(supplier !== undefined && { supplier: supplier || null }),
        ...(notes    !== undefined && { notes:    notes    || null }),
      },
      include: INCLUDE,
    });
    res.json(item);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/material-costs/:id/submit
router.put('/:id/submit', async (req, res) => {
  try {
    const item = await prisma.materialCost.update({
      where: { id: req.params.id },
      data:  { status: 'submitted' },
      include: INCLUDE,
    });
    await notifyApproversOfUser(
      item.userId,
      'material_submitted',
      'Materialkosten eingereicht',
      `Materialkosten wurden zur Genehmigung eingereicht.`,
      '/material-costs',
    );
    res.json(item);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/material-costs/:id/pre-approve
router.put('/:id/pre-approve', async (req, res) => {
  try {
    const item = await prisma.materialCost.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!item) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role !== 'admin') {
      const teamMatch = await prisma.teamMember.findFirst({
        where: { userId: item.userId, team: { leaderId: req.user.id } },
      });
      if (!teamMatch) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const updated = await prisma.materialCost.update({
      where: { id: req.params.id },
      data: { status: 'pre_approved', approvedById: req.user.id, approvedAt: new Date(), approverComment: req.body.comment || null },
      include: { project: { select: { id: true, name: true } }, user: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/material-costs/:id/approve
router.put('/:id/approve', async (req, res) => {
  try {
    // Only admin or CC head of the item owner's CC can approve
    if (req.user.role !== 'admin') {
      const item = await prisma.materialCost.findUnique({ where: { id: req.params.id }, select: { userId: true } });
      const ccMatch = await prisma.competenceCenter.findFirst({
        where: { headId: req.user.id, teams: { some: { members: { some: { userId: item.userId } } } } },
      });
      if (!ccMatch) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { approvedById, approverComment } = req.body;
    const item = await prisma.materialCost.update({
      where: { id: req.params.id },
      data:  {
        status:          'approved',
        approvedById:    approvedById    || null,
        approverComment: approverComment || null,
        approvedAt:      new Date(),
      },
      include: INCLUDE,
    });
    res.json(item);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/material-costs/:id/reject
router.put('/:id/reject', async (req, res) => {
  try {
    // Only admin or CC head of the item owner's CC can reject
    if (req.user.role !== 'admin') {
      const item = await prisma.materialCost.findUnique({ where: { id: req.params.id }, select: { userId: true } });
      const ccMatch = await prisma.competenceCenter.findFirst({
        where: { headId: req.user.id, teams: { some: { members: { some: { userId: item.userId } } } } },
      });
      if (!ccMatch) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { approvedById, approverComment } = req.body;
    const item = await prisma.materialCost.update({
      where: { id: req.params.id },
      data:  {
        status:          'rejected',
        approvedById:    approvedById    || null,
        approverComment: approverComment || null,
        approvedAt:      new Date(),
      },
      include: INCLUDE,
    });
    res.json(item);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/material-costs/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.materialCost.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Nicht gefunden' });
    if (existing.status !== 'draft') return res.status(400).json({ error: 'Nur Entwürfe können gelöscht werden' });

    if (existing.receiptPath) {
      const abs = path.resolve(existing.receiptPath);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
    await prisma.materialCost.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
