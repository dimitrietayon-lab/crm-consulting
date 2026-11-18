const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { toText, toInt, toBool } = require('../lib/validate');
const requireAdmin = require('../middleware/requireAdmin');
const {
  getPipeline, getAllPipelines, loadPipelines, invalidatePipelines, slugifyStatus,
} = require('../lib/acquisitionPipeline');

const prisma = new PrismaClient();

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function serialize(pipeline) {
  return {
    id: pipeline.id,
    key: pipeline.key,
    name: pipeline.name,
    description: pipeline.description || null,
    active: pipeline.active,
    isDefault: pipeline.isDefault === true,
    stages: pipeline.stages.map((s) => ({
      id: s.id, key: s.key, label: s.label, order: s.order, color: s.color || null,
    })),
    steps: pipeline.steps.map((s) => ({
      id: s.id, stageId: s.stageId, stageKey: s.stage?.key || null, templateId: s.templateId || null,
      status: s.status, slug: s.slug, label: s.label, shortLabel: s.shortLabel,
      order: s.order, activityType: s.activityType, title: s.title, description: s.description,
      requiredFields: s.requiredFields || [],
      guide: Array.isArray(s.guide) ? s.guide : [],
      exitCriteria: Array.isArray(s.exitCriteria) ? s.exitCriteria : [],
      isClosing: s.isClosing, outcome: s.outcome, isWildcard: s.isWildcard, isInTalk: s.isInTalk,
      isOffer: s.isOffer, isOfferSent: s.isOfferSent, isWon: s.isWon, isLost: s.isLost,
      isEarly: s.isEarly, active: s.active,
    })),
    transitions: pipeline.transitions.map((t) => ({
      id: t.id, fromStatus: t.fromStatus, toStatus: t.toStatus,
    })),
  };
}

// Findet eine Pipeline in Cache oder DB (id ODER key).
async function findRawPipeline(idOrKey) {
  if (!idOrKey) return null;
  return prisma.acquisitionPipeline.findFirst({
    where: { OR: [{ id: idOrKey }, { key: idOrKey }] },
  });
}

function parseStages(body) {
  const stages = asArray(body.stages).map((s, index) => {
    const key = toText(s?.key) || slugifyStatus(s?.label) || `stage-${index + 1}`;
    const label = toText(s?.label) || key;
    return { key, label, order: toInt(s?.order, { defaultValue: index + 1 }), color: toText(s?.color) };
  });
  return stages;
}

function parseSteps(body, stages, statusSet) {
  const stageKeys = new Set(stages.map((s) => s.key));
  const seenStatus = new Set();
  const seenSlug = new Set();
  return asArray(body.steps)
    .map((s, index) => {
      const status = toText(s?.status);
      if (!status) return null;
      if (seenStatus.has(status)) return { __duplicate: `Status "${status}" ist doppelt` };
      const slug = toText(s?.slug) || slugifyStatus(status);
      if (seenSlug.has(slug)) return { __duplicate: `Slug "${slug}" ist doppelt` };
      seenStatus.add(status);
      seenSlug.add(slug);
      const order = toInt(s?.order, { defaultValue: index + 1 });
      return {
        status,
        slug,
        stageKey: stageKeys.has(toText(s?.stageKey)) ? toText(s.stageKey) : stages[0]?.key,
        templateId: toText(s?.templateId) || null,
        label: toText(s?.label) || status,
        shortLabel: toText(s?.shortLabel) || null,
        order,
        activityType: toText(s?.activityType) || 'Note',
        title: toText(s?.title) || null,
        description: toText(s?.description) || null,
        requiredFields: Array.isArray(s?.requiredFields) ? s.requiredFields : [],
        guide: Array.isArray(s?.guide) ? s.guide.filter((g) => typeof g === 'string') : [],
        exitCriteria: Array.isArray(s?.exitCriteria)
          ? s.exitCriteria
            .filter((e) => e && typeof e.t === 'string')
            .map((e) => ({ k: toText(e.k) || toText(e.t), t: toText(e.t), ...(toText(e.auto) ? { auto: toText(e.auto) } : {}) }))
          : [],
        isClosing: toBool(s?.isClosing, { defaultValue: false }),
        outcome: toText(s?.outcome) || null,
        isWildcard: toBool(s?.isWildcard, { defaultValue: false }),
        isInTalk: toBool(s?.isInTalk, { defaultValue: false }),
        isOffer: toBool(s?.isOffer, { defaultValue: false }),
        isOfferSent: toBool(s?.isOfferSent, { defaultValue: false }),
        isWon: toBool(s?.isWon, { defaultValue: false }),
        isLost: toBool(s?.isLost, { defaultValue: false }),
        isEarly: toBool(s?.isEarly, { defaultValue: false }),
        active: toBool(s?.active, { defaultValue: true }),
      };
    })
    .filter(Boolean);
}

// Ersetzt Stages/Steps/Transitions einer Pipeline vollständig.
async function replaceStructure(pipelineId, stages, steps, transitions) {
  await prisma.$transaction(async (tx) => {
    const stageKeysList = stages.map((s) => s.key);
    await tx.acquisitionPipelineStage.deleteMany({
      where: { pipelineId, key: { notIn: stageKeysList } },
    });
    const stageIdByKey = {};
    for (const stage of stages) {
      const row = await tx.acquisitionPipelineStage.upsert({
        where: { pipelineId_key: { pipelineId, key: stage.key } },
        update: { label: stage.label, order: stage.order, color: stage.color || null },
        create: { pipelineId, key: stage.key, label: stage.label, order: stage.order, color: stage.color || null },
      });
      stageIdByKey[stage.key] = row.id;
    }

    const statusList = steps.map((s) => s.status);
    await tx.acquisitionPipelineStep.deleteMany({
      where: { pipelineId, status: { notIn: statusList } },
    });
    for (const step of steps) {
      const data = {
        pipelineId,
        stageId: stageIdByKey[step.stageKey],
        templateId: step.templateId,
        slug: step.slug,
        label: step.label,
        shortLabel: step.shortLabel,
        order: step.order,
        activityType: step.activityType,
        title: step.title,
        description: step.description,
        requiredFields: step.requiredFields,
        guide: step.guide,
        exitCriteria: step.exitCriteria,
        isClosing: step.isClosing,
        outcome: step.outcome,
        isWildcard: step.isWildcard,
        isInTalk: step.isInTalk,
        isOffer: step.isOffer,
        isOfferSent: step.isOfferSent,
        isWon: step.isWon,
        isLost: step.isLost,
        isEarly: step.isEarly,
        active: step.active,
      };
      await tx.acquisitionPipelineStep.upsert({
        where: { pipelineId_status: { pipelineId, status: step.status } },
        update: data,
        create: { status: step.status, ...data },
      });
    }

    await tx.acquisitionPipelineTransition.deleteMany({ where: { pipelineId } });
    for (const t of transitions) {
      await tx.acquisitionPipelineTransition.create({
        data: { pipelineId, fromStatus: t.fromStatus, toStatus: t.toStatus },
      });
    }
  });
}

// GET /api/acquisition-pipeline — Default-Pipeline (Kompat)
router.get('/', async (req, res) => {
  try {
    await loadPipelines();
    res.json(serialize(getPipeline()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/acquisition-pipeline/all — alle Pipelines (?light=1 nur Liste)
router.get('/all', async (req, res) => {
  try {
    await loadPipelines();
    let list = getAllPipelines();
    if (!list.length) list = [getPipeline()];
    if (req.query.light === '1') {
      return res.json(list.map((p) => ({
        id: p.id, key: p.key, name: p.name, description: p.description || null,
        active: p.active, isDefault: p.isDefault === true,
      })));
    }
    res.json(list.map(serialize));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/acquisition-pipeline/list — schlanke Liste
router.get('/list', async (req, res) => {
  try {
    await loadPipelines();
    let list = getAllPipelines();
    if (!list.length) list = [getPipeline()];
    res.json(list.map((p) => ({
      id: p.id, key: p.key, name: p.name, active: p.active, isDefault: p.isDefault === true,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gemeinsame Erstell-Logik (mit optionalem Klonen) für POST / und /:id/clone
async function createPipeline(body) {
  const name = toText(body.name);
  if (!name) return { status: 400, error: 'Name ist erforderlich' };
  const key = toText(body.key) || slugifyStatus(name);
  if (!key) return { status: 400, error: 'Key ist erforderlich' };

  const exists = await prisma.acquisitionPipeline.findUnique({ where: { key } });
  if (exists) return { status: 409, error: 'Ein Workflow mit diesem Key existiert bereits' };

  const pipeline = await prisma.acquisitionPipeline.create({
    data: {
      key,
      name,
      description: toText(body.description) || null,
      active: toBool(body.active, { defaultValue: true }),
      isDefault: false,
    },
  });

  // Optional aus einer bestehenden Pipeline klonen
  if (body.copyFromId) {
    const source = await findRawPipeline(toText(body.copyFromId));
    if (source) {
      const [stages, steps, transitions] = await Promise.all([
        prisma.acquisitionPipelineStage.findMany({ where: { pipelineId: source.id } }),
        prisma.acquisitionPipelineStep.findMany({ where: { pipelineId: source.id } }),
        prisma.acquisitionPipelineTransition.findMany({ where: { pipelineId: source.id } }),
      ]);
      const stageKeyById = new Map(stages.map((s) => [s.id, s.key]));
      const clonedStages = stages.map((s) => ({ key: s.key, label: s.label, order: s.order, color: s.color }));
      const statusSet = new Set(steps.map((s) => s.status));
      const clonedSteps = steps.map((s) => ({
        status: s.status, slug: s.slug, stageKey: stageKeyById.get(s.stageId), templateId: s.templateId,
        label: s.label, shortLabel: s.shortLabel, order: s.order, activityType: s.activityType,
        title: s.title, description: s.description, requiredFields: s.requiredFields,
        guide: s.guide, exitCriteria: s.exitCriteria, isClosing: s.isClosing, outcome: s.outcome,
        isWildcard: s.isWildcard, isInTalk: s.isInTalk, isOffer: s.isOffer, isOfferSent: s.isOfferSent,
        isWon: s.isWon, isLost: s.isLost, isEarly: s.isEarly, active: s.active,
      }));
      const clonedTransitions = transitions
        .filter((t) => statusSet.has(t.fromStatus) && statusSet.has(t.toStatus))
        .map((t) => ({ fromStatus: t.fromStatus, toStatus: t.toStatus }));
      if (clonedStages.length && clonedSteps.length) {
        await replaceStructure(pipeline.id, clonedStages, clonedSteps, clonedTransitions);
      }
    }
  }

  invalidatePipelines();
  await loadPipelines();
  return { status: 201, pipeline: getPipeline(pipeline.id) };
}

// POST /api/acquisition-pipeline — neuen Workflow anlegen (Admin)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const result = await createPipeline(req.body || {});
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(serialize(result.pipeline));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/acquisition-pipeline/:id — Stages/Steps/Transitions dieser Pipeline ersetzen
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const pipeline = await findRawPipeline(req.params.id);
    if (!pipeline) return res.status(404).json({ error: 'Workflow nicht gefunden' });

    const name = toText(body.name) || pipeline.name;
    const description = body.description !== undefined ? (toText(body.description) || null) : pipeline.description;
    const active = body.active !== undefined ? toBool(body.active, { defaultValue: true }) : pipeline.active;

    const stages = parseStages(body);
    if (!stages.length) return res.status(400).json({ error: 'Mindestens eine Stage erforderlich' });

    const steps = parseSteps(body, stages, null);
    const dup = steps.find((s) => s && s.__duplicate);
    if (dup) return res.status(400).json({ error: dup.__duplicate });
    const cleanSteps = steps.filter((s) => s && !s.__duplicate);
    if (!cleanSteps.length) return res.status(400).json({ error: 'Mindestens ein Step erforderlich' });

    const statusSet = new Set(cleanSteps.map((s) => s.status));
    const transitions = asArray(body.transitions)
      .map((t) => ({ fromStatus: toText(t?.fromStatus), toStatus: toText(t?.toStatus) }))
      .filter((t) => statusSet.has(t.fromStatus) && statusSet.has(t.toStatus));

    await prisma.$transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx.acquisitionPipeline.updateMany({ where: { id: { not: pipeline.id } }, data: { isDefault: false } });
      }
      await tx.acquisitionPipeline.update({
        where: { id: pipeline.id },
        data: {
          name,
          description,
          active,
          ...(body.isDefault !== undefined ? { isDefault: toBool(body.isDefault, { defaultValue: false }) } : {}),
        },
      });
    });

    await replaceStructure(pipeline.id, stages, cleanSteps, transitions);

    invalidatePipelines();
    await loadPipelines();
    res.json(serialize(getPipeline(pipeline.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition-pipeline/:id/clone — Klon-Helfer
router.post('/:id/clone', requireAdmin, async (req, res) => {
  try {
    const source = await findRawPipeline(req.params.id);
    if (!source) return res.status(404).json({ error: 'Workflow nicht gefunden' });
    const body = {
      ...(req.body || {}),
      name: toText(req.body?.name) || `${source.name} (Kopie)`,
      key: toText(req.body?.key) || undefined,
      copyFromId: source.id,
    };
    const result = await createPipeline(body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(serialize(result.pipeline));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/acquisition-pipeline/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const pipeline = await findRawPipeline(req.params.id);
    if (!pipeline) return res.status(404).json({ error: 'Workflow nicht gefunden' });
    if (pipeline.isDefault) {
      return res.status(409).json({ error: 'Der Standard-Workflow kann nicht gelöscht werden' });
    }
    const campaignCount = await prisma.acquisitionCampaign.count({ where: { pipelineId: pipeline.id } });
    if (campaignCount > 0) {
      return res.status(409).json({ error: 'Workflow wird von einer Kampagne verwendet' });
    }
    await prisma.acquisitionPipeline.delete({ where: { id: pipeline.id } });
    invalidatePipelines();
    await loadPipelines();
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition-pipeline/reset — Default-Pipeline zurücksetzen (Admin)
router.post('/reset', requireAdmin, async (req, res) => {
  try {
    const pipeline = await findRawPipeline('default');
    if (pipeline) {
      await prisma.acquisitionPipeline.delete({ where: { id: pipeline.id } });
    }
    invalidatePipelines();
    await loadPipelines();
    res.json(serialize(getPipeline()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/acquisition-pipeline/:id/reset — Pipeline auf Seed zurücksetzen
router.post('/:id/reset', requireAdmin, async (req, res) => {
  try {
    const pipeline = await findRawPipeline(req.params.id);
    if (!pipeline) return res.status(404).json({ error: 'Workflow nicht gefunden' });
    if (pipeline.key === 'default') {
      await prisma.acquisitionPipeline.delete({ where: { id: pipeline.id } });
      invalidatePipelines();
      await loadPipelines();
      return res.json(serialize(getPipeline()));
    }
    return res.status(400).json({ error: 'Nur der Standard-Workflow kann auf den Seed zurückgesetzt werden' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/acquisition-pipeline/:id — eine Pipeline (muss zuletzt stehen)
router.get('/:id', async (req, res) => {
  try {
    await loadPipelines();
    const cached = getPipeline(req.params.id);
    if (cached && (cached.id === req.params.id || cached.key === req.params.id)) {
      return res.json(serialize(cached));
    }
    const raw = await findRawPipeline(req.params.id);
    if (!raw) return res.status(404).json({ error: 'Workflow nicht gefunden' });
    const [stages, steps, transitions] = await Promise.all([
      prisma.acquisitionPipelineStage.findMany({ where: { pipelineId: raw.id } }),
      prisma.acquisitionPipelineStep.findMany({ where: { pipelineId: raw.id } }),
      prisma.acquisitionPipelineTransition.findMany({ where: { pipelineId: raw.id } }),
    ]);
    res.json(serialize({
      id: raw.id, key: raw.key, name: raw.name, description: raw.description,
      active: raw.active, isDefault: raw.isDefault,
      stages,
      steps: steps.map((s) => ({
        ...s,
        stage: stages.find((st) => st.id === s.stageId) || null,
      })),
      transitions,
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
