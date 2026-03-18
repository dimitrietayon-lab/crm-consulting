const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const { status, projectType, accountId, q, competenceCenterId, memberId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (projectType) where.projectType = projectType;
    if (accountId) where.accountId = accountId;
    if (q) where.name = { contains: q, mode: 'insensitive' };
    if (competenceCenterId) where.competenceCenterId = competenceCenterId;
    if (memberId) where.members = { some: { userId: memberId } };

    const projects = await prisma.project.findMany({
      where,
      include: {
        account: { select: { companyName: true } },
        leadConsultant: { select: { id: true, name: true } },
        competenceCenter: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const projectsWithBudget = projects.map((p) => {
      const budgetUsedPct =
        p.budgetPlanned && p.budgetPlanned > 0
          ? Math.round(((p.budgetActual || 0) / p.budgetPlanned) * 100)
          : 0;
      return { ...p, budgetUsedPct };
    });

    res.json(projectsWithBudget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects
router.post('/', async (req, res) => {
  try {
    const b = req.body || {}
    const toNull = (v) => (v === '' ? null : v)
    const toNum = (v) => (v === '' || v === undefined || v === null ? null : Number(v))

    const data = {
      name: b.name,
      accountId: b.accountId, // required
      projectType: toNull(b.projectType),
      status: b.status || 'Active',
      startDate: b.startDate ? new Date(b.startDate) : null,
      endDate: b.endDate ? new Date(b.endDate) : null,
      budgetPlanned: toNum(b.budgetPlanned),
      budgetActual: toNum(b.budgetActual),
      billingModel: toNull(b.billingModel),
      leadConsultantId: toNull(b.leadConsultantId),
      competenceCenterId: toNull(b.competenceCenterId),
      description: toNull(b.description),
    }

    if (!data.name || !String(data.name).trim()) {
      return res.status(400).json({ error: 'name is required' })
    }
    if (!data.accountId) {
      return res.status(400).json({ error: 'accountId is required' })
    }

    const project = await prisma.project.create({ data })
    res.status(201).json(project)
  } catch (err) {
    if (err.code === 'P2003') {
      // FK violation (e.g., invalid accountId or competenceCenterId)
      return res.status(400).json({ error: 'Invalid foreign key: accountId or competenceCenterId' })
    }
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Unique constraint violation' })
    }
    res.status(500).json({ error: err.message })
  }
})

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        account: true,
        leadConsultant: true,
        competenceCenter: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        phases: {
          orderBy: { order: 'asc' },
          include: {
            milestones: { orderBy: { dueDate: 'asc' } },
          },
        },
        timeEntries: {
          orderBy: { date: 'desc' },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        documents: { orderBy: { createdAt: 'desc' } },
        activities: {
          take: 10,
          orderBy: { date: 'desc' },
          include: {
            createdBy: { select: { name: true } },
            participants: {
              include: { contact: { select: { name: true } } },
            },
          },
        },
        tasks: { orderBy: { dueDate: 'asc' } },
        contacts: {
          include: {
            contact: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const budgetUsedPct =
      project.budgetPlanned && project.budgetPlanned > 0
        ? Math.round(((project.budgetActual || 0) / project.budgetPlanned) * 100)
        : 0;

    const totalHours = project.timeEntries.reduce((sum, e) => sum + e.hours, 0);

    res.json({ ...project, budgetUsedPct, totalHours });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id
const PROJECT_FIELDS = [
  'name', 'accountId', 'projectType', 'status', 'startDate', 'endDate',
  'budgetPlanned', 'budgetActual', 'billingModel', 'leadConsultantId', 'competenceCenterId', 'description',
];
router.put('/:id', async (req, res) => {
  try {
    const data = {};
    for (const f of PROJECT_FIELDS) {
      if (req.body[f] !== undefined) {
        const v = req.body[f];
        data[f] = v === '' ? null : v;
      }
    }
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const project = await prisma.project.update({ where: { id: req.params.id }, data });
    res.json(project);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Project not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Project not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/phases
router.post('/:id/phases', async (req, res) => {
  try {
    const { name, startDate, endDate, order } = req.body;

    const phase = await prisma.projectPhase.create({
      data: {
        projectId: req.params.id,
        name,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        order: order || 0,
      },
    });

    res.status(201).json(phase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id/phases/:phaseId
router.put('/:id/phases/:phaseId', async (req, res) => {
  try {
    const { milestones, ...phaseData } = req.body;

    const phase = await prisma.projectPhase.update({
      where: { id: req.params.phaseId },
      data: {
        ...(phaseData.name && { name: phaseData.name }),
        ...(phaseData.startDate !== undefined && { startDate: phaseData.startDate ? new Date(phaseData.startDate) : null }),
        ...(phaseData.endDate !== undefined && { endDate: phaseData.endDate ? new Date(phaseData.endDate) : null }),
        ...(phaseData.status && { status: phaseData.status }),
        ...(phaseData.order !== undefined && { order: phaseData.order }),
      },
    });

    if (milestones && Array.isArray(milestones)) {
      await prisma.milestone.deleteMany({ where: { phaseId: req.params.phaseId } });
      if (milestones.length > 0) {
        await prisma.milestone.createMany({
          data: milestones.map((m) => ({
            phaseId: req.params.phaseId,
            title: m.title,
            dueDate: m.dueDate ? new Date(m.dueDate) : null,
            completed: m.completed || false,
            deliverables: m.deliverables || [],
          })),
        });
      }
    }

    const updatedPhase = await prisma.projectPhase.findUnique({
      where: { id: req.params.phaseId },
      include: { milestones: true },
    });

    res.json(updatedPhase);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Phase not found' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/phases
router.get('/:id/phases', async (req, res) => {
  try {
    const phases = await prisma.projectPhase.findMany({
      where: { projectId: req.params.id },
      include: { milestones: { orderBy: { dueDate: 'asc' } } },
      orderBy: { order: 'asc' },
    });
    res.json(phases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/phases/:phaseId/milestones
router.post('/:id/phases/:phaseId/milestones', async (req, res) => {
  try {
    const { title, dueDate } = req.body;
    const milestone = await prisma.milestone.create({
      data: {
        phaseId: req.params.phaseId,
        title,
        dueDate: dueDate ? new Date(dueDate) : null,
        completed: false,
      },
    });
    res.status(201).json(milestone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id/phases/:phaseId/milestones/:milestoneId
router.put('/:id/phases/:phaseId/milestones/:milestoneId', async (req, res) => {
  try {
    const { title, dueDate, completed } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (completed !== undefined) data.completed = completed;
    const milestone = await prisma.milestone.update({
      where: { id: req.params.milestoneId },
      data,
    });
    res.json(milestone);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Milestone not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id/phases/:phaseId
router.delete('/:id/phases/:phaseId', async (req, res) => {
  try {
    await prisma.projectPhase.delete({ where: { id: req.params.phaseId } });
    res.json({ message: 'Phase deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Phase not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/time-entries
router.post('/:id/time-entries', async (req, res) => {
  try {
    const { userId, date, hours, billable, description } = req.body;

    const entry = await prisma.timeEntry.create({
      data: {
        projectId: req.params.id,
        userId,
        date: new Date(date),
        hours,
        billable: billable !== undefined ? billable : true,
        description,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id/time-entries/:entryId
router.delete('/:id/time-entries/:entryId', async (req, res) => {
  try {
    await prisma.timeEntry.delete({ where: { id: req.params.entryId } });
    res.json({ message: 'Time entry deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Time entry not found' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/time-entries
router.get('/:id/time-entries', async (req, res) => {
  try {
    const entries = await prisma.timeEntry.findMany({
      where: { projectId: req.params.id },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
    const billableHours = entries.filter((e) => e.billable).reduce((sum, e) => sum + e.hours, 0);

    res.json({ entries, totalHours, billableHours });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/members
router.get('/:id/members', async (req, res) => {
  try {
    const members = await prisma.projectMember.findMany({
      where: { projectId: req.params.id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/members
router.post('/:id/members', async (req, res) => {
  try {
    const { userId, role } = req.body;

    const member = await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: req.params.id,
          userId,
        },
      },
      update: { role },
      create: {
        projectId: req.params.id,
        userId,
        role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: req.params.id,
          userId: req.params.userId,
        },
      },
    });

    res.json({ message: 'Member removed from project' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Member not found' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/activities
router.get('/:id/activities', async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { projectId: req.params.id },
      orderBy: { date: 'desc' },
    });
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/activities
router.post('/:id/activities', async (req, res) => {
  try {
    const { type, date, summary, nextSteps } = req.body;
    const activity = await prisma.activity.create({
      data: {
        projectId: req.params.id,
        type: type || 'Note',
        date: date ? new Date(date) : new Date(),
        summary: summary || '',
        nextSteps: nextSteps || null,
        createdById: req.user?.id || null,
      },
    });
    res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/documents
router.get('/:id/documents', async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: { projectId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/documents
router.post('/:id/documents', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const document = await prisma.document.create({
      data: {
        name: req.file.originalname,
        category: req.body.category || 'General',
        filePath: req.file.path.replace(/\\/g, '/'),
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        projectId: req.params.id,
        uploadedById: req.user?.id || null,
      },
    });
    res.status(201).json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/tasks
router.get('/:id/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { projectId: req.params.id },
      include: { assignedTo: { select: { id: true, name: true } } },
      orderBy: { dueDate: 'asc' },
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/tasks
router.post('/:id/tasks', async (req, res) => {
  try {
    const { title, description, dueDate, priority, assignedToId } = req.body;
    const task = await prisma.task.create({
      data: {
        projectId: req.params.id,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'Medium',
        status: 'Open',
        assignedToId: assignedToId || null,
        createdById: req.user?.id || null,
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id/tasks/:taskId
router.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const { status, title, dueDate, priority, assignedToId } = req.body;
    const data = {};
    if (status !== undefined) data.status = status;
    if (title !== undefined) data.title = title;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (priority !== undefined) data.priority = priority;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    const task = await prisma.task.update({
      where: { id: req.params.taskId },
      data,
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    res.json(task);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
