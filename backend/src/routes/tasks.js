const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { createNotification } = require('../services/notifications');
const multer = require('multer');
const path = require('path');

const prisma = new PrismaClient();

// Multer setup for optional file uploads on task create/update
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

function normalizeNullable(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    const { status, priority, assignedToId, q, view } = req.query;

    const where = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = assignedToId;
    if (q) {
      where.title = { contains: q, mode: 'insensitive' };
    }

    if (view === 'overdue') {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['Done', 'Completed', 'Cancelled'] };
    }

    // Restrict visibility: non-admins only see tasks from projects where they are members
    if (req.user?.role !== 'admin') {
      where.project = {
        members: {
          some: { userId: req.user.id },
        },
      };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        account: { select: { id: true, companyName: true } },
        deal: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        collaborators: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }],
    });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', upload.array('files'), async (req, res) => {
  try {
    const body = req.body || {};
    const data = {
      title: body.title,
      description: normalizeNullable(body.description),
      status: body.status || 'Open',
      priority: body.priority || 'Medium',
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      recurring: normalizeNullable(body.recurring),
      assignedToId: normalizeNullable(body.assignedToId),
      accountId: normalizeNullable(body.accountId),
      projectId: normalizeNullable(body.projectId),
      contactId: normalizeNullable(body.contactId),
      createdById: req.user?.id || null,
    };

    const created = await prisma.task.create({ data });

    // Optional initial collaborators (sent as JSON string under key 'collaboratorIds' or as array)
    try {
      const collabIds = await (async () => {
        if (Array.isArray(body.collaboratorIds)) return body.collaboratorIds.filter(Boolean);
        if (typeof body.collaboratorIds === 'string') {
          try { const arr = JSON.parse(body.collaboratorIds); if (Array.isArray(arr)) return arr.filter(Boolean); } catch (e) {}
        }
        return [];
      })();
      if (collabIds.length > 0) {
        await Promise.all(
          collabIds.map((userId) =>
            prisma.taskCollaborator.upsert({
              where: { taskId_userId: { taskId: created.id, userId } },
              create: { taskId: created.id, userId },
              update: {},
            })
          )
        );

        // Notify collaborators they were added to the task
        const taskTitle = created.title || 'Aufgabe';
        await Promise.all(
          collabIds.map((userId) =>
            createNotification(
              userId,
              'Task',
              'Als Mitwirkender hinzugefügt',
              `Du wurdest als Mitwirkender zur Aufgabe "${taskTitle}" hinzugefügt.`,
              `/tasks?taskId=${created.id}`
            )
          )
        );
      }
    } catch (_) {}

    // Optional initial checklist (sent as JSON string in multipart under key 'checklist')
    if (body.checklist) {
      try {
        const items = JSON.parse(body.checklist);
        if (Array.isArray(items) && items.length > 0) {
          const prepared = items
            .map((it, idx) => ({
              title: String(it.title || '').trim(),
              done: !!it.done,
              order: Number.isFinite(it.order) ? Number(it.order) : idx,
            }))
            .filter((it) => it.title.length > 0)
            .map((it) => ({ taskId: created.id, title: it.title, done: it.done, order: it.order }));
          if (prepared.length > 0) {
            await prisma.taskChecklistItem.createMany({ data: prepared });
          }
        }
      } catch (e) {
        // ignore malformed checklist payload
      }
    }

    // Persist uploaded documents if any
    if (Array.isArray(req.files) && req.files.length > 0) {
      await Promise.all(
        req.files.map((f) =>
          prisma.document.create({
            data: {
              name: f.originalname,
              category: 'Task',
              filePath: f.path.replace(/\\/g, '/'),
              fileSize: f.size,
              mimeType: f.mimetype,
              uploadedById: req.user?.id || null,
              taskId: created.id,
              accountId: created.accountId || null,
              projectId: created.projectId || null,
              contactId: created.contactId || null,
              dealId: created.dealId || null,
            },
          })
        )
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: created.id },
      include: {
        assignedTo: { select: { id: true, name: true } },
        account: { select: { id: true, companyName: true } },
        deal: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        documents: { orderBy: { createdAt: 'desc' } },
        checklistItems: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
        collaborators: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { addedAt: 'asc' } },
      },
    });

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id
router.put('/:id', upload.array('files'), async (req, res) => {
  try {
    const body = req.body || {};
    const data = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = normalizeNullable(body.description);
    if (body.status !== undefined) data.status = body.status;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.recurring !== undefined) data.recurring = normalizeNullable(body.recurring);
    if (body.assignedToId !== undefined) data.assignedToId = normalizeNullable(body.assignedToId);
    if (body.accountId !== undefined) data.accountId = normalizeNullable(body.accountId);
    if (body.projectId !== undefined) data.projectId = normalizeNullable(body.projectId);
    if (body.contactId !== undefined) data.contactId = normalizeNullable(body.contactId);

    const previous = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!previous) return res.status(404).json({ error: 'Task not found' });

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data,
      include: {
        assignedTo: { select: { id: true, name: true } },
        account: { select: { id: true, companyName: true } },
        deal: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // If files uploaded on update, create linked Document rows
    if (Array.isArray(req.files) && req.files.length > 0) {
      await Promise.all(
        req.files.map((f) =>
          prisma.document.create({
            data: {
              name: f.originalname,
              category: 'Task',
              filePath: f.path.replace(/\\/g, '/'),
              fileSize: f.size,
              mimeType: f.mimetype,
              uploadedById: req.user?.id || null,
              taskId: task.id,
              accountId: task.accountId || null,
              projectId: task.projectId || null,
              contactId: task.contactId || null,
              dealId: task.dealId || null,
            },
          })
        )
      );
    }

    // When task is marked Done, handle recurring and auto-follow-up
    if (data.status === 'Done' && previous.status !== 'Done') {
      const baseDate = previous.dueDate ? new Date(previous.dueDate) : new Date();

      // Recurring logic
      if (task.recurring) {
        let nextDue = new Date(baseDate);
        if (task.recurring === 'Daily') nextDue.setDate(nextDue.getDate() + 1);
        else if (task.recurring === 'Weekly') nextDue.setDate(nextDue.getDate() + 7);
        else if (task.recurring === 'Monthly') nextDue.setMonth(nextDue.getMonth() + 1);
        else if (task.recurring === 'Quarterly') nextDue.setMonth(nextDue.getMonth() + 3);

        await prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: 'Open',
            recurring: task.recurring,
            dueDate: nextDue,
            assignedToId: task.assignedToId,
            accountId: task.accountId,
            projectId: task.projectId,
          },
        });
      }

      // Auto-follow-up
      const followUpDue = new Date();
      followUpDue.setDate(followUpDue.getDate() + 3);
      await prisma.task.create({
        data: {
          title: `Follow-up: ${task.title}`,
          priority: 'Medium',
          status: 'Open',
          dueDate: followUpDue,
          assignedToId: task.assignedToId,
          accountId: task.accountId,
          projectId: task.projectId,
        },
      });
    }

    // Re-read to include latest documents
    const updatedTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        assignedTo: { select: { id: true, name: true } },
        account: { select: { id: true, companyName: true } },
        deal: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        documents: { orderBy: { createdAt: 'desc' } },
        collaborators: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { addedAt: 'asc' } },
      },
    });

    res.json(updatedTask);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
 
// ─── Checklist Endpoints ───────────────────────────────────────────────────────

// GET /api/tasks/:id/checklist
router.get('/:id/checklist', async (req, res) => {
  try {
    const items = await prisma.taskChecklistItem.findMany({
      where: { taskId: req.params.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/checklist
router.post('/:id/checklist', async (req, res) => {
  try {
    const { title } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

    // Compute next order value
    const maxItem = await prisma.taskChecklistItem.findFirst({
      where: { taskId: req.params.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxItem?.order ?? -1) + 1;

    const item = await prisma.taskChecklistItem.create({
      data: { taskId: req.params.id, title: title.trim(), order: nextOrder },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/checklist/:itemId
router.patch('/:id/checklist/:itemId', async (req, res) => {
  try {
    const data = {};
    if (req.body.title !== undefined) data.title = req.body.title?.trim?.() || '';
    if (req.body.done !== undefined) data.done = !!req.body.done;
    if (req.body.order !== undefined) data.order = Number(req.body.order) || 0;

    const item = await prisma.taskChecklistItem.update({
      where: { id: req.params.itemId },
      data,
    });
    res.json(item);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Checklist item not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id/checklist/:itemId
router.delete('/:id/checklist/:itemId', async (req, res) => {
  try {
    await prisma.taskChecklistItem.delete({ where: { id: req.params.itemId } });
    res.json({ message: 'Checklist item deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Checklist item not found' });
    res.status(500).json({ error: err.message });
  }
});

// ─── Collaborators Endpoints ───────────────────────────────────────────────────

// Helper to parse collaboratorIds from body (JSON string or array)
async function parseCollaboratorIds(body) {
  if (!body) return [];
  if (Array.isArray(body.collaboratorIds)) return body.collaboratorIds.filter(Boolean);
  if (typeof body.collaboratorIds === 'string') {
    try {
      const arr = JSON.parse(body.collaboratorIds);
      if (Array.isArray(arr)) return arr.filter(Boolean);
    } catch (e) {}
  }
  return [];
}

// Attach collaborators right after creation (augment existing POST handler via middleware-like block)
// Note: This block relies on created.id; so we implement at top by monkey-patching router.post above is not trivial.
// Instead, expose explicit endpoint for adding multiple collaborators.

// POST /api/tasks/:id/collaborators (bulk add)
router.post('/:id/collaborators', async (req, res) => {
  try {
    const ids = await parseCollaboratorIds(req.body);
    const rows = [];
    if (ids.length === 0) return res.status(201).json(rows);

    // Fetch task title for notification context
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { title: true } });
    const taskTitle = task?.title || 'Aufgabe';

    // Determine which collaborators are new to avoid duplicate notifications
    const existing = await prisma.taskCollaborator.findMany({
      where: { taskId: req.params.id },
      select: { userId: true },
    });
    const existingSet = new Set(existing.map((r) => r.userId));

    for (const userId of ids) {
      const isNew = !existingSet.has(userId);
      try {
        let row;
        if (isNew) {
          row = await prisma.taskCollaborator.create({
            data: { taskId: req.params.id, userId },
            include: { user: { select: { id: true, name: true, email: true } } },
          });
          existingSet.add(userId);
          // Notify newly added collaborator
          await createNotification(
            userId,
            'Task',
            'Als Mitwirkender hinzugefügt',
            `Du wurdest als Mitwirkender zur Aufgabe "${taskTitle}" hinzugefügt.`,
            `/tasks?taskId=${req.params.id}`
          );
        } else {
          // Already exists: return existing row with user included
          row = await prisma.taskCollaborator.findUnique({
            where: { taskId_userId: { taskId: req.params.id, userId } },
            include: { user: { select: { id: true, name: true, email: true } } },
          });
        }
        rows.push(row);
      } catch {}
    }
    res.status(201).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id/collaborators
router.get('/:id/collaborators', async (req, res) => {
  try {
    const rows = await prisma.taskCollaborator.findMany({
      where: { taskId: req.params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { addedAt: 'asc' },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id/collaborators/:userId
router.delete('/:id/collaborators/:userId', async (req, res) => {
  try {
    await prisma.taskCollaborator.delete({ where: { taskId_userId: { taskId: req.params.id, userId: req.params.userId } } });
    res.json({ message: 'Collaborator removed' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Collaborator not found' });
    res.status(500).json({ error: err.message });
  }
});
