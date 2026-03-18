const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/activities
router.get('/', async (req, res) => {
  try {
    const { type, accountId, dealId, projectId, createdById, dateFrom, dateTo, upcoming, limit } = req.query;

    const where = {};

    if (type) where.type = type;
    if (accountId) where.accountId = accountId;
    if (dealId) where.dealId = dealId;
    if (projectId) where.projectId = projectId;
    if (createdById) where.createdById = createdById;

    if (upcoming === 'true') {
      where.date = { gte: new Date() };
    } else if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        account: { select: { id: true, companyName: true } },
        deal: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        participants: {
          include: {
            contact: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: upcoming === 'true' ? 'asc' : 'desc' },
      ...(limit ? { take: parseInt(limit, 10) } : {}),
    });

    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/activities
router.post('/', async (req, res) => {
  try {
    const { participantIds, ...activityData } = req.body;

    const activity = await prisma.activity.create({
      data: {
        ...activityData,
        date: new Date(activityData.date),
      },
    });

    if (participantIds && Array.isArray(participantIds) && participantIds.length > 0) {
      await prisma.activityParticipant.createMany({
        data: participantIds.map((contactId) => ({
          activityId: activity.id,
          contactId,
        })),
        skipDuplicates: true,
      });
    }

    const fullActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        account: { select: { id: true, companyName: true } },
        deal: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        participants: {
          include: {
            contact: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.status(201).json(fullActivity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/activities/:id
router.get('/:id', async (req, res) => {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        account: true,
        deal: { select: { id: true, title: true, stage: true } },
        project: { select: { id: true, name: true, status: true } },
        participants: {
          include: {
            contact: true,
          },
        },
        tasks: { orderBy: { dueDate: 'asc' } },
      },
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/activities/:id
router.put('/:id', async (req, res) => {
  try {
    const { participantIds, ...activityData } = req.body;

    const updateData = { ...activityData };
    if (updateData.date) updateData.date = new Date(updateData.date);

    const activity = await prisma.activity.update({
      where: { id: req.params.id },
      data: updateData,
    });

    if (participantIds !== undefined && Array.isArray(participantIds)) {
      await prisma.activityParticipant.deleteMany({ where: { activityId: req.params.id } });
      if (participantIds.length > 0) {
        await prisma.activityParticipant.createMany({
          data: participantIds.map((contactId) => ({
            activityId: req.params.id,
            contactId,
          })),
          skipDuplicates: true,
        });
      }
    }

    const updatedActivity = await prisma.activity.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        account: { select: { id: true, companyName: true } },
        deal: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        participants: {
          include: {
            contact: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json(updatedActivity);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Activity not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/activities/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.activity.delete({ where: { id: req.params.id } });
    res.json({ message: 'Activity deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Activity not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
