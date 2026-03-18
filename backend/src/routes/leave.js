const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { createNotification, notifyApproversOfUser } = require('../services/notifications');

const prisma = new PrismaClient();

// GET /api/leave/requests
router.get('/requests', async (req, res) => {
  try {
    const { userId, status, year, managerId, ccLeaderId } = req.query;
    const where = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (year) {
      const y = parseInt(year);
      where.startDate = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
    }
    if (managerId) {
      const teams = await prisma.team.findMany({
        where: { leaderId: managerId },
        include: { members: { select: { userId: true } } },
      });
      const memberIds = [...new Set(teams.flatMap(t => t.members.map(m => m.userId)))];
      where.userId = { in: memberIds };
    }
    if (ccLeaderId) {
      const ccs = await prisma.competenceCenter.findMany({
        where: { headId: ccLeaderId },
        include: { teams: { include: { members: { select: { userId: true } } } } },
      });
      const memberIds = [...new Set(ccs.flatMap(cc => cc.teams.flatMap(t => t.members.map(m => m.userId))))];
      where.userId = { in: memberIds };
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leave/requests/:id
router.get('/requests/:id', async (req, res) => {
  try {
    const req_ = await prisma.leaveRequest.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true } },
      },
    });
    if (!req_) return res.status(404).json({ error: 'Not found' });
    res.json(req_);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leave/requests
router.post('/requests', async (req, res) => {
  try {
    const { userId, type, startDate, endDate, halfDay, halfDayPart, comment } = req.body;
    const request = await prisma.leaveRequest.create({
      data: {
        userId: userId || req.user.id,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        halfDay: halfDay || false,
        halfDayPart: halfDayPart || null,
        comment: comment || null,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    await notifyApproversOfUser(
      request.userId,
      'leave_submitted',
      'Urlaubsantrag gestellt',
      `${request.user.name} hat einen Abwesenheitsantrag gestellt.`,
      '/leave',
    );
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/leave/requests/:id/pre-approve — team leader pre-approves
router.put('/requests/:id/pre-approve', async (req, res) => {
  try {
    const lr = await prisma.leaveRequest.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!lr) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin') {
      const membership = await prisma.teamMember.findFirst({
        where: { userId: lr.userId, team: { leaderId: req.user.id } },
      });
      if (!membership) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const request = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status: 'pre_approved', approvedById: req.user.id, approvedAt: new Date(), approverComment: req.body.comment || null },
    });
    await createNotification(request.userId, 'leave_pre_approved', 'Urlaubsantrag vorgeprüft', 'Dein Urlaubsantrag wurde vom Team-Leiter vorgeprüft.', '/leave');
    // Notify CC leaders
    const ccs = await prisma.competenceCenter.findMany({
      where: { teams: { some: { members: { some: { userId: request.userId } } } } },
      select: { headId: true },
    });
    for (const cc of ccs) {
      if (cc.headId && cc.headId !== request.userId) {
        await createNotification(cc.headId, 'leave_pre_approved', 'Urlaubsantrag bereit zur Genehmigung', 'Ein Urlaubsantrag wurde vorgeprüft und wartet auf finale Genehmigung.', '/leave');
      }
    }
    res.json(request);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/leave/requests/:id/approve — CC leader final-approves
router.put('/requests/:id/approve', async (req, res) => {
  try {
    const lr = await prisma.leaveRequest.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!lr) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin') {
      const ccMatch = await prisma.competenceCenter.findFirst({
        where: { headId: req.user.id, teams: { some: { members: { some: { userId: lr.userId } } } } },
      });
      if (!ccMatch) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const request = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status: 'approved', approvedById: req.user.id, approvedAt: new Date(), approverComment: req.body.comment || null },
    });
    await createNotification(request.userId, 'leave_approved', 'Urlaubsantrag genehmigt', 'Dein Urlaubsantrag wurde genehmigt.', '/leave');
    res.json(request);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/leave/requests/:id/reject — CC leader rejects
router.put('/requests/:id/reject', async (req, res) => {
  try {
    const lr = await prisma.leaveRequest.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!lr) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin') {
      const ccMatch = await prisma.competenceCenter.findFirst({
        where: { headId: req.user.id, teams: { some: { members: { some: { userId: lr.userId } } } } },
      });
      if (!ccMatch) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const request = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status: 'rejected', approvedById: req.user.id, approvedAt: new Date(), approverComment: req.body.comment || null },
    });
    await createNotification(request.userId, 'leave_rejected', 'Urlaubsantrag abgelehnt',
      req.body.comment ? `Grund: ${req.body.comment}` : 'Dein Urlaubsantrag wurde abgelehnt.', '/leave');
    res.json(request);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/leave/requests/:id
router.delete('/requests/:id', async (req, res) => {
  try {
    const existing = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be deleted' });
    await prisma.leaveRequest.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leave/balances
router.get('/balances', async (req, res) => {
  try {
    const { userId, year } = req.query;
    const where = {};
    if (userId) where.userId = userId;
    if (year) where.year = parseInt(year);

    const balances = await prisma.leaveBalance.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ year: 'desc' }, { type: 'asc' }],
    });
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/leave/balances
router.put('/balances', async (req, res) => {
  try {
    const { userId, year, type, entitlement, used } = req.body;
    const balance = await prisma.leaveBalance.upsert({
      where: { userId_year_type: { userId, year: parseInt(year), type } },
      update: {
        ...(entitlement !== undefined && { entitlement: parseFloat(entitlement) }),
        ...(used !== undefined && { used: parseFloat(used) }),
      },
      create: {
        userId,
        year: parseInt(year),
        type,
        entitlement: entitlement ? parseFloat(entitlement) : 30,
        used: used ? parseFloat(used) : 0,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    res.json(balance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leave/calendar
router.get('/calendar', async (req, res) => {
  try {
    const { year, month } = req.query;
    const where = { status: 'approved' };
    if (year && month) {
      const y = parseInt(year), m = parseInt(month) - 1;
      where.startDate = { lte: new Date(y, m + 1, 0) };
      where.endDate = { gte: new Date(y, m, 1) };
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startDate: 'asc' },
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leave/holidays
router.get('/holidays', async (req, res) => {
  try {
    const { region } = req.query;
    const where = {};
    if (region) where.region = region;
    const holidays = await prisma.publicHoliday.findMany({ where, orderBy: { date: 'asc' } });
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leave/holidays
router.post('/holidays', async (req, res) => {
  try {
    const { name, date, region } = req.body;
    const holiday = await prisma.publicHoliday.create({
      data: { name, date: new Date(date), region: region || null },
    });
    res.status(201).json(holiday);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/leave/holidays/:id
router.delete('/holidays/:id', async (req, res) => {
  try {
    await prisma.publicHoliday.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leave/report
router.get('/report', async (req, res) => {
  try {
    const { year } = req.query;
    const y = year ? parseInt(year) : new Date().getFullYear();

    const requests = await prisma.leaveRequest.findMany({
      where: {
        status: 'approved',
        startDate: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) },
      },
      include: { user: { select: { id: true, name: true } } },
    });

    const byUser = {};
    requests.forEach(r => {
      if (!byUser[r.userId]) byUser[r.userId] = { user: r.user, vacation: 0, sick: 0, training: 0, other: 0 };
      const days = Math.ceil((r.endDate - r.startDate) / (1000 * 60 * 60 * 24)) + 1;
      const d = r.halfDay ? 0.5 : days;
      byUser[r.userId][r.type] = (byUser[r.userId][r.type] || 0) + d;
    });

    res.json(Object.values(byUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
