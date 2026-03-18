const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { createNotification } = require('../services/notifications');

const prisma = new PrismaClient();

// GET /api/timesheets
router.get('/', async (req, res) => {
  try {
    const { userId, status, weekStart, managerId, ccLeaderId } = req.query;
    const where = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (weekStart) where.weekStart = new Date(weekStart);
    if (managerId) {
      // Only return timesheets of users who are in a team led by this manager
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

    const timesheets = await prisma.timesheet.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true } },
        entries: { include: { project: { select: { id: true, name: true } } } },
      },
      orderBy: { weekStart: 'desc' },
    });
    res.json(timesheets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timesheets/report
router.get('/report', async (req, res) => {
  try {
    const { userId, projectId, month, managerId, ccLeaderId } = req.query;
    const where = {};
    if (userId) where.userId = userId;
    if (projectId) where.projectId = projectId;
    if (month) {
      const d = new Date(month);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
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

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    const billable = entries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0);
    const nonBillable = entries.filter(e => !e.billable).reduce((s, e) => s + e.hours, 0);

    // Group by user
    const byUser = {};
    entries.forEach(e => {
      if (!byUser[e.userId]) byUser[e.userId] = { user: e.user, billable: 0, nonBillable: 0, total: 0 };
      if (e.billable) byUser[e.userId].billable += e.hours;
      else byUser[e.userId].nonBillable += e.hours;
      byUser[e.userId].total += e.hours;
    });

    res.json({ billable, nonBillable, total: billable + nonBillable, byUser: Object.values(byUser) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timesheets/export
router.get('/export', async (req, res) => {
  try {
    const { userId, month } = req.query;
    const where = {};
    if (userId) where.userId = userId;
    if (month) {
      const d = new Date(month);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    });

    const lines = ['Datum,Mitarbeiter,Projekt,Phase,Beschreibung,Stunden,Abrechenbar'];
    entries.forEach(e => {
      lines.push([
        e.date.toISOString().split('T')[0],
        e.user.name,
        e.project.name,
        e.phase || '',
        (e.description || '').replace(/,/g, ';'),
        e.hours,
        e.billable ? 'Ja' : 'Nein',
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="zeiterfassung-${month || 'export'}.csv"`);
    res.send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timesheets/:id
router.get('/:id', async (req, res) => {
  try {
    const ts = await prisma.timesheet.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true } },
        entries: {
          include: { project: { select: { id: true, name: true } } },
          orderBy: { date: 'asc' },
        },
      },
    });
    if (!ts) return res.status(404).json({ error: 'Not found' });
    res.json(ts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timesheets – create/upsert for userId + weekStart
router.post('/', async (req, res) => {
  try {
    const { userId, weekStart, comment } = req.body;
    if (!userId || !weekStart) return res.status(400).json({ error: 'userId and weekStart required' });

    const ts = await prisma.timesheet.upsert({
      where: { userId_weekStart: { userId, weekStart: new Date(weekStart) } },
      update: { comment },
      create: { userId, weekStart: new Date(weekStart), comment },
      include: {
        user: { select: { id: true, name: true } },
        entries: true,
      },
    });
    res.status(201).json(ts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/timesheets/:id/submit
router.put('/:id/submit', async (req, res) => {
  try {
    const ts = await prisma.timesheet.update({
      where: { id: req.params.id },
      data: { status: 'submitted', submittedAt: new Date() },
      include: { user: { select: { name: true } } },
    });

    // Notify team leaders of the submitter
    const memberships = await prisma.teamMember.findMany({
      where: { userId: ts.userId },
      include: { team: { select: { leaderId: true } } },
    });
    const leaderIds = [...new Set(
      memberships.map(m => m.team.leaderId).filter(id => id && id !== ts.userId)
    )];
    for (const leaderId of leaderIds) {
      await createNotification(
        leaderId, 'timesheet_submitted',
        'Zeiterfassung eingereicht',
        `${ts.user.name} hat eine Zeiterfassung zur Genehmigung eingereicht.`,
        '/timesheets'
      );
    }

    // Also notify CC head if the submitter is a team leader in a CC
    const ledTeams = await prisma.team.findMany({
      where: { leaderId: ts.userId },
      include: { competenceCenter: { select: { headId: true } } },
    });
    const ccHeadIds = [...new Set(
      ledTeams.map(t => t.competenceCenter?.headId).filter(id => id && id !== ts.userId)
    )];
    for (const headId of ccHeadIds) {
      await createNotification(
        headId, 'timesheet_submitted',
        'Teamleiter-Zeiterfassung eingereicht',
        `${ts.user.name} hat eine Zeiterfassung zur Genehmigung eingereicht.`,
        '/timesheets'
      );
    }

    res.json(ts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Returns true if the requester may review (approve/return) the given timesheet
async function canReviewTimesheet(requester, timesheetId) {
  if (requester.role === 'admin') return true;

  const ts = await prisma.timesheet.findUnique({ where: { id: timesheetId }, select: { userId: true } });
  if (!ts) return false;

  // Team leader: can review timesheets of their team members
  const membership = await prisma.teamMember.findFirst({
    where: { userId: ts.userId, team: { leaderId: requester.id } },
  });
  if (membership) return true;

  // CC head: can review timesheets of team leaders in their CC
  const ccWithLeader = await prisma.competenceCenter.findFirst({
    where: {
      headId: requester.id,
      teams: { some: { leaderId: ts.userId } },
    },
  });
  return !!ccWithLeader;
}

// PUT /api/timesheets/:id/pre-approve — team leader pre-approves a team member's timesheet
router.put('/:id/pre-approve', async (req, res) => {
  try {
    const ts = await prisma.timesheet.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!ts) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin') {
      const membership = await prisma.teamMember.findFirst({
        where: { userId: ts.userId, team: { leaderId: req.user.id } },
      });
      if (!membership) return res.status(403).json({ error: 'Keine Berechtigung zur Vorgenehmigung' });
    }
    const updated = await prisma.timesheet.update({
      where: { id: req.params.id },
      data: { status: 'pre_approved', reviewedById: req.user.id, reviewedAt: new Date(), comment: req.body.comment || null },
    });
    // Notify employee
    await createNotification(updated.userId, 'timesheet_pre_approved', 'Zeiterfassung vorgeprüft', 'Deine Zeiterfassung wurde vom Team-Leiter vorgeprüft.', '/timesheets');
    // Notify CC leaders
    const ccs = await prisma.competenceCenter.findMany({
      where: { teams: { some: { members: { some: { userId: updated.userId } } } } },
      select: { headId: true },
    });
    for (const cc of ccs) {
      if (cc.headId && cc.headId !== updated.userId) {
        await createNotification(cc.headId, 'timesheet_pre_approved', 'Zeiterfassung bereit zur Genehmigung', 'Eine Zeiterfassung wurde vorgeprüft und wartet auf finale Genehmigung.', '/timesheets');
      }
    }
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/timesheets/:id/approve — CC leader final-approves
router.put('/:id/approve', async (req, res) => {
  try {
    const ts = await prisma.timesheet.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!ts) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin') {
      const ccMatch = await prisma.competenceCenter.findFirst({
        where: { headId: req.user.id, teams: { some: { members: { some: { userId: ts.userId } } } } },
      });
      if (!ccMatch) return res.status(403).json({ error: 'Keine Berechtigung zur Genehmigung' });
    }
    const updated = await prisma.timesheet.update({
      where: { id: req.params.id },
      data: { status: 'approved', reviewedById: req.user.id, reviewedAt: new Date(), comment: req.body.comment || null },
    });
    await createNotification(updated.userId, 'timesheet_approved', 'Zeiterfassung genehmigt', 'Deine Zeiterfassung wurde genehmigt.', '/timesheets');
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/timesheets/:id/return
router.put('/:id/return', async (req, res) => {
  try {
    if (!await canReviewTimesheet(req.user, req.params.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung zur Rückgabe' });
    }
    const ts = await prisma.timesheet.update({
      where: { id: req.params.id },
      data: {
        status: 'returned',
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        comment: req.body.comment || null,
      },
    });
    await createNotification(ts.userId, 'timesheet_returned', 'Zeiterfassung zurückgegeben',
      req.body.comment ? `Kommentar: ${req.body.comment}` : 'Deine Zeiterfassung wurde zur Korrektur zurückgegeben.', '/timesheets');
    res.json(ts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timesheets/:id/entries
router.post('/:id/entries', async (req, res) => {
  try {
    const { projectId, date, hours, billable, description, phase, startTime, endTime, breakMinutes } = req.body;
    const ts = await prisma.timesheet.findUnique({ where: { id: req.params.id } });
    if (!ts) return res.status(404).json({ error: 'Timesheet not found' });

    const entry = await prisma.timeEntry.create({
      data: {
        projectId,
        userId: ts.userId,
        date: new Date(date),
        hours: parseFloat(hours),
        billable: billable !== false,
        description,
        phase,
        startTime: startTime || null,
        endTime: endTime || null,
        breakMinutes: parseInt(breakMinutes) || 0,
        timesheetId: req.params.id,
      },
      include: { project: { select: { id: true, name: true } } },
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/timesheets/entries/:entryId
router.put('/entries/:entryId', async (req, res) => {
  try {
    const { hours, billable, description, phase, startTime, endTime, breakMinutes, date } = req.body;
    const entry = await prisma.timeEntry.update({
      where: { id: req.params.entryId },
      data: {
        ...(hours !== undefined && { hours: parseFloat(hours) }),
        ...(billable !== undefined && { billable }),
        ...(description !== undefined && { description }),
        ...(phase !== undefined && { phase }),
        ...(startTime !== undefined && { startTime: startTime || null }),
        ...(endTime !== undefined && { endTime: endTime || null }),
        ...(breakMinutes !== undefined && { breakMinutes: parseInt(breakMinutes) || 0 }),
        ...(date !== undefined && { date: new Date(date) }),
      },
      include: { project: { select: { id: true, name: true } } },
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/timesheets/entries/:entryId
router.delete('/entries/:entryId', async (req, res) => {
  try {
    await prisma.timeEntry.delete({ where: { id: req.params.entryId } });
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
