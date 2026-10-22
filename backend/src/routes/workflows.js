const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { executeWorkflow } = require('../services/workflowExecutor');

const prisma = new PrismaClient();

// ─── GET /api/workflows/stats ──────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, active, totalRuns, successRuns, recentRuns, byDomain] = await Promise.all([
      prisma.workflow.count(),
      prisma.workflow.count({ where: { isActive: true } }),
      prisma.workflowRun.count(),
      prisma.workflowRun.count({ where: { status: 'success' } }),
      prisma.workflowRun.findMany({
        where: { startedAt: { gte: thirtyDaysAgo } },
        orderBy: { startedAt: 'asc' },
        select: { status: true, startedAt: true, finishedAt: true },
      }),
      prisma.workflow.groupBy({ by: ['domain'], _count: { id: true } }),
    ]);

    // Build last-7-days chart data
    const dailyMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { date: key, success: 0, failed: 0, skipped: 0 };
    }
    recentRuns.forEach((r) => {
      const key = new Date(r.startedAt).toISOString().split('T')[0];
      if (dailyMap[key]) dailyMap[key][r.status] = (dailyMap[key][r.status] || 0) + 1;
    });

    const durations = recentRuns
      .filter((r) => r.status === 'success' && r.finishedAt)
      .map((r) => new Date(r.finishedAt) - new Date(r.startedAt));
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    res.json({
      total,
      active,
      totalRuns,
      successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 100,
      avgDurationMs: avgDuration,
      dailyActivity: Object.values(dailyMap),
      domainDistribution: byDomain.map((d) => ({ domain: d.domain, count: d._count.id })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/workflows ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const workflows = await prisma.workflow.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { runs: true } },
        runs: { orderBy: { startedAt: 'desc' }, take: 5, select: { status: true, startedAt: true } },
      },
    });
    res.json(workflows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/workflows/runs ───────────────────────────────────────────────────
router.get('/runs', async (req, res) => {
  try {
    const runs = await prisma.workflowRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: parseInt(req.query.limit) || 100,
      include: { workflow: { select: { id: true, name: true, domain: true } } },
    });
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/workflows ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, description, domain, trigger, triggerConfig, conditions, actions, actionType, actionConfig } = req.body;
    if (!name) return res.status(400).json({ error: 'Name erforderlich' });
    if (!actions?.length && !actionType) return res.status(400).json({ error: 'Mindestens eine Aktion erforderlich' });

    const workflow = await prisma.workflow.create({
      data: {
        name, description: description || null,
        domain: domain || 'general',
        trigger: trigger || 'manual',
        triggerConfig: triggerConfig || {},
        conditions: conditions || [],
        actions: actions || [],
        actionType: actionType || null,
        actionConfig: actionConfig || null,
        createdById: req.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { runs: true } },
        runs: { orderBy: { startedAt: 'desc' }, take: 5, select: { status: true, startedAt: true } },
      },
    });
    res.status(201).json(workflow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/workflows/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { runs: true } },
        runs: { orderBy: { startedAt: 'desc' }, take: 5, select: { status: true, startedAt: true } },
      },
    });
    if (!workflow) return res.status(404).json({ error: 'Workflow nicht gefunden' });
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/workflows/:id ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, description, domain, trigger, triggerConfig, conditions, actions, actionType, actionConfig, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (domain !== undefined) data.domain = domain;
    if (trigger !== undefined) data.trigger = trigger;
    if (triggerConfig !== undefined) data.triggerConfig = triggerConfig;
    if (conditions !== undefined) data.conditions = conditions;
    if (actions !== undefined) data.actions = actions;
    if (actionType !== undefined) data.actionType = actionType;
    if (actionConfig !== undefined) data.actionConfig = actionConfig;
    if (isActive !== undefined) data.isActive = isActive;

    const workflow = await prisma.workflow.update({
      where: { id: req.params.id },
      data,
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { runs: true } },
        runs: { orderBy: { startedAt: 'desc' }, take: 5, select: { status: true, startedAt: true } },
      },
    });
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/workflows/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await prisma.workflow.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/workflows/:id/run ───────────────────────────────────────────────
router.post('/:id/run', async (req, res) => {
  let runId;
  try {
    const workflow = await prisma.workflow.findUnique({ where: { id: req.params.id } });
    if (!workflow) return res.status(404).json({ error: 'Workflow nicht gefunden' });
    if (!workflow.isActive) return res.status(400).json({ error: 'Workflow ist deaktiviert' });

    const run = await prisma.workflowRun.create({
      data: { workflowId: workflow.id, triggeredBy: req.user.id, status: 'running' },
    });
    runId = run.id;

    const result = await executeWorkflow(workflow, req.user.id);

    const finishedRun = await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: result.skipped ? 'skipped' : 'success',
        summary: result.summary,
        details: result,
        finishedAt: new Date(),
      },
    });
    await prisma.workflow.update({ where: { id: workflow.id }, data: { lastRunAt: new Date() } });

    res.json({ run: finishedRun, result });
  } catch (err) {
    if (runId) {
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'failed', summary: err.message, finishedAt: new Date() },
      }).catch(() => {});
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
