const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEAL_FIELDS = [
  'title', 'accountId', 'stage', 'value', 'probability',
  'expectedClose', 'assignedToId', 'source', 'serviceType', 'lossReason', 'notes',
];

function toDateTime(val) {
  if (!val) return null;
  // If it's already a full ISO string, pass through; otherwise append time
  return val.includes('T') ? new Date(val) : new Date(`${val}T00:00:00.000Z`);
}

function sanitizeDeal(body) {
  const data = {};
  for (const field of DEAL_FIELDS) {
    if (body[field] !== undefined) {
      const val = body[field] ?? null;
      data[field] = val === '' ? null : val;
    }
  }
  // Handle frontend field name aliases
  if (data.assignedToId === undefined && body.assignedConsultantId !== undefined) {
    data.assignedToId = body.assignedConsultantId || null;
  }
  if (data.expectedClose === undefined && body.expectedCloseDate !== undefined) {
    data.expectedClose = body.expectedCloseDate || null;
  }
  // Convert date strings to Date objects for Prisma DateTime fields
  if (data.expectedClose !== undefined) {
    data.expectedClose = toDateTime(data.expectedClose);
  }
  return data;
}

// GET /api/deals/pipeline/summary - must be before /:id
router.get('/pipeline/summary', async (req, res) => {
  try {
    const deals = await prisma.deal.findMany({
      select: {
        stage: true,
        value: true,
        probability: true,
      },
    });

    const dealsByStage = {};
    let totalValue = 0;
    let weightedValue = 0;

    for (const deal of deals) {
      const val = deal.value || 0;
      const prob = deal.probability || 0;
      const wv = val * (prob / 100);

      totalValue += val;
      weightedValue += wv;

      if (!dealsByStage[deal.stage]) {
        dealsByStage[deal.stage] = { count: 0, totalValue: 0, weightedValue: 0 };
      }
      dealsByStage[deal.stage].count += 1;
      dealsByStage[deal.stage].totalValue += val;
      dealsByStage[deal.stage].weightedValue += wv;
    }

    res.json({ totalValue, weightedValue, dealsByStage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deals
router.get('/', async (req, res) => {
  try {
    const { stage, accountId, assignedToId, q } = req.query;

    const where = {};
    if (stage) where.stage = stage;
    if (accountId) where.accountId = accountId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (q) where.title = { contains: q, mode: 'insensitive' };

    const deals = await prisma.deal.findMany({
      where,
      include: {
        account: { select: { companyName: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const dealsWithWeighted = deals.map((d) => ({
      ...d,
      weightedValue:
        d.value && d.probability ? d.value * (d.probability / 100) : 0,
    }));

    res.json(dealsWithWeighted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deals
router.post('/', async (req, res) => {
  try {
    const deal = await prisma.deal.create({
      data: sanitizeDeal(req.body),
      include: {
        account: { select: { companyName: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    res.status(201).json({
      ...deal,
      weightedValue: deal.value && deal.probability ? deal.value * (deal.probability / 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deals/:id
router.get('/:id', async (req, res) => {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        account: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        contacts: {
          include: {
            contact: true,
          },
        },
        activities: {
          orderBy: { date: 'desc' },
          include: {
            createdBy: { select: { name: true } },
            participants: {
              include: { contact: { select: { name: true } } },
            },
          },
        },
        tasks: { orderBy: { dueDate: 'asc' } },
      },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    res.json({
      ...deal,
      weightedValue:
        deal.value && deal.probability ? deal.value * (deal.probability / 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/deals/:id
router.put('/:id', async (req, res) => {
  try {
    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: sanitizeDeal(req.body),
      include: {
        account: { select: { companyName: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    res.json({
      ...deal,
      weightedValue:
        deal.value && deal.probability ? deal.value * (deal.probability / 100) : 0,
    });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Deal not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/deals/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.deal.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deal deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Deal not found' });
    res.status(500).json({ error: err.message });
  }
});

// ── Contacts sub-routes ────────────────────────────────────────────────────────

// GET /api/deals/:id/contacts
router.get('/:id/contacts', async (req, res) => {
  try {
    const contacts = await prisma.dealContact.findMany({
      where: { dealId: req.params.id },
      include: { contact: { select: { id: true, name: true, email: true, title: true, phone: true } } },
    });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deals/:id/contacts
router.post('/:id/contacts', async (req, res) => {
  try {
    const { contactId, role } = req.body;
    const link = await prisma.dealContact.create({
      data: { dealId: req.params.id, contactId, role: role || null },
      include: { contact: { select: { id: true, name: true, email: true, title: true } } },
    });
    res.status(201).json(link);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Kontakt bereits zugewiesen' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/deals/:id/contacts/:contactId
router.delete('/:id/contacts/:contactId', async (req, res) => {
  try {
    await prisma.dealContact.deleteMany({
      where: { dealId: req.params.id, contactId: req.params.contactId },
    });
    res.json({ message: 'Entfernt' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Activities sub-routes ──────────────────────────────────────────────────────

// GET /api/deals/:id/activities
router.get('/:id/activities', async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { dealId: req.params.id },
      orderBy: { date: 'desc' },
      include: { createdBy: { select: { name: true } } },
    });
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deals/:id/activities
router.post('/:id/activities', async (req, res) => {
  try {
    const { type, date, duration, summary, nextSteps } = req.body;
    const activity = await prisma.activity.create({
      data: {
        type: type || 'Note',
        date: date ? new Date(date) : new Date(),
        duration: duration ? Number(duration) : null,
        summary,
        nextSteps: nextSteps || null,
        dealId: req.params.id,
        createdById: req.user?.id || null,
      },
      include: { createdBy: { select: { name: true } } },
    });
    res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Tasks sub-routes ───────────────────────────────────────────────────────────

// GET /api/deals/:id/tasks
router.get('/:id/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { dealId: req.params.id },
      orderBy: { createdAt: 'asc' },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    res.json(tasks.map(t => ({ ...t, completed: t.status === 'Done' })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deals/:id/tasks
router.post('/:id/tasks', async (req, res) => {
  try {
    const { title, description, dueDate, priority, assignedToId } = req.body;
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'Medium',
        status: 'Open',
        dealId: req.params.id,
        createdById: req.user?.id || null,
        assignedToId: assignedToId || null,
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    res.status(201).json({ ...task, completed: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/deals/:id/tasks/:taskId
router.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const { completed } = req.body;
    const task = await prisma.task.update({
      where: { id: req.params.taskId },
      data: { status: completed ? 'Done' : 'Open' },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    res.json({ ...task, completed: task.status === 'Done' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
