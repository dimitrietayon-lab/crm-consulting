// Definierbare Akquise-Pipelines: DB-gestützt mit In-Memory-Cache.
// Es gibt mehrere Workflows (AcquisitionPipeline); ein Zielkunde löst seinen
// Workflow über target.pipelineId → target.campaign.pipelineId → Default auf.
// Fällt auf die kanonischen Seed-Daten zurück, falls die DB (noch) leer ist.

const { PrismaClient } = require('@prisma/client');
const { PIPELINE, STAGES, STEPS, TRANSITIONS } = require('../../prisma/pipeline-data');

const prisma = new PrismaClient();

// ─── Cache ───────────────────────────────────────────────────────────────────
let pipelines = new Map();   // id -> built
let byKey = new Map();       // key -> id
let defaultId = null;
let seedBuilt = null;
let campaignIndex = new Map(); // campaignId -> pipelineId
let loaded = false;

function slugifyStatus(value) {
  const map = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
  return String(value || '')
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => map[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function build(pipeline, stages, steps, transitions) {
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  const stageById = new Map(sortedStages.map((s) => [s.id, s]));
  const byStatus = new Map();

  const normalizedSteps = [...steps]
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const stage =
        (typeof s.stage === 'object' && s.stage) ||
        stageById.get(s.stageId) ||
        sortedStages.find((st) => st.key === s.stage) ||
        null;
      const step = { ...s, stage };
      byStatus.set(step.status, step);
      return step;
    });

  // Steps je Stage (für die sequenzielle Freischaltung)
  const stepsByStage = new Map();
  for (const stage of sortedStages) stepsByStage.set(stage.key, []);
  for (const step of normalizedSteps) {
    const key = step.stage?.key;
    if (key && stepsByStage.has(key)) stepsByStage.get(key).push(step);
  }

  const flags = (predicate) => normalizedSteps.filter(predicate).map((s) => s.status);

  return {
    id: pipeline.id,
    key: pipeline.key,
    name: pipeline.name,
    description: pipeline.description || null,
    active: pipeline.active !== false,
    isDefault: pipeline.isDefault === true,
    stages: sortedStages,
    steps: normalizedSteps,
    transitions,
    statuses: normalizedSteps.map((s) => s.status),
    statusSet: new Set(normalizedSteps.map((s) => s.status)),
    byStatus,
    bySlug: new Map(normalizedSteps.map((s) => [s.slug, s])),
    stepsByStage,
    activeStatuses: flags((s) => !s.isEarly && !s.isClosing),
    inTalkStatuses: flags((s) => s.isInTalk),
    offerStatuses: flags((s) => s.isOffer),
    offerSentStatuses: flags((s) => s.isOfferSent),
    wonStatuses: flags((s) => s.isWon),
    lostStatuses: flags((s) => s.isLost),
    earlyStatuses: flags((s) => s.isEarly),
    wildcardStatuses: flags((s) => s.isWildcard),
  };
}

function defaultPipeline() {
  if (!seedBuilt) seedBuilt = build(PIPELINE, STAGES, STEPS, TRANSITIONS);
  return seedBuilt;
}

// ─── Laden ───────────────────────────────────────────────────────────────────
async function loadPipelines() {
  try {
    const rawPipelines = await prisma.acquisitionPipeline.findMany();
    if (!rawPipelines.length) {
      pipelines = new Map();
      byKey = new Map();
      defaultId = null;
      loaded = true;
      return getPipeline();
    }

    const ids = rawPipelines.map((p) => p.id);
    const [stages, steps, transitions] = await Promise.all([
      prisma.acquisitionPipelineStage.findMany({ where: { pipelineId: { in: ids } } }),
      prisma.acquisitionPipelineStep.findMany({ where: { pipelineId: { in: ids }, active: true } }),
      prisma.acquisitionPipelineTransition.findMany({ where: { pipelineId: { in: ids } } }),
    ]);

    const group = (rows) => {
      const map = new Map();
      for (const row of rows) {
        if (!map.has(row.pipelineId)) map.set(row.pipelineId, []);
        map.get(row.pipelineId).push(row);
      }
      return map;
    };
    const stagesBy = group(stages);
    const stepsBy = group(steps);
    const transitionsBy = group(transitions);

    pipelines = new Map();
    byKey = new Map();
    for (const raw of rawPipelines) {
      const pipelineSteps = stepsBy.get(raw.id) || [];
      if (!pipelineSteps.length) continue; // leere Workflows nicht als auflösbar cachen
      const built = build(
        raw,
        stagesBy.get(raw.id) || [],
        pipelineSteps,
        transitionsBy.get(raw.id) || [],
      );
      pipelines.set(raw.id, built);
      byKey.set(raw.key, raw.id);
    }

    const defaultRaw =
      rawPipelines.find((p) => p.isDefault && pipelines.has(p.id)) ||
      rawPipelines.find((p) => p.key === 'default' && pipelines.has(p.id)) ||
      rawPipelines.find((p) => pipelines.has(p.id)) ||
      null;
    defaultId = defaultRaw ? defaultRaw.id : null;
    loaded = true;
    return getPipeline();
  } catch {
    // DB (noch) nicht erreichbar → Seed-Fallback
    pipelines = new Map();
    byKey = new Map();
    defaultId = null;
    return defaultPipeline();
  }
}

async function loadCampaignIndex() {
  try {
    const rows = await prisma.acquisitionCampaign.findMany({
      select: { id: true, pipelineId: true },
    });
    campaignIndex = new Map(rows.map((r) => [r.id, r.pipelineId]));
  } catch {
    campaignIndex = new Map();
  }
  return campaignIndex;
}

// ─── Zugriff ─────────────────────────────────────────────────────────────────
function getPipeline(idOrKey) {
  if (!loaded) {
    // noch nicht geladen → synchron Seed als Fallback
    return defaultPipeline();
  }
  if (idOrKey == null) {
    return (defaultId && pipelines.get(defaultId)) ||
      pipelines.values().next().value ||
      defaultPipeline();
  }
  if (pipelines.has(idOrKey)) return pipelines.get(idOrKey);
  if (byKey.has(idOrKey)) return pipelines.get(byKey.get(idOrKey));
  return (defaultId && pipelines.get(defaultId)) ||
    pipelines.values().next().value ||
    defaultPipeline();
}

// Auflösungskette: target.pipelineId → target.campaign.pipelineId →
// (campaignId im Index) → Default. Sync, nutzt nur den Cache.
function getPipelineForTarget(target) {
  if (!target) return getPipeline();
  if (target.pipelineId && pipelines.has(target.pipelineId)) {
    return pipelines.get(target.pipelineId);
  }
  const campaignPipelineId =
    (target.campaign && target.campaign.pipelineId) ||
    (target.campaignId ? campaignIndex.get(target.campaignId) : null);
  if (campaignPipelineId && pipelines.has(campaignPipelineId)) {
    return pipelines.get(campaignPipelineId);
  }
  return getPipeline();
}

function getAllPipelines() {
  return [...pipelines.values()];
}

function getCampaignPipelineId(campaignId) {
  return campaignIndex.get(campaignId) || null;
}

// ─── Flags ───────────────────────────────────────────────────────────────────
const FLAG_FIELDS = {
  early: 'earlyStatuses',
  inTalk: 'inTalkStatuses',
  offer: 'offerStatuses',
  offerSent: 'offerSentStatuses',
  won: 'wonStatuses',
  lost: 'lostStatuses',
  wildcard: 'wildcardStatuses',
};

function statusesForFlag(pipelineOrId, flag) {
  const p = pipelineOrId && typeof pipelineOrId === 'object'
    ? pipelineOrId
    : getPipeline(pipelineOrId);
  const field = FLAG_FIELDS[flag];
  return field ? (p[field] || []) : [];
}

function primaryWonStatus(pipeline) {
  const p = pipeline || getPipeline();
  return p.wonStatuses[0] || 'gewonnen';
}

function primaryLostStatus(pipeline) {
  const p = pipeline || getPipeline();
  return p.lostStatuses[0] || 'Verlust';
}

function primaryOfferSentStatus(pipeline) {
  const p = pipeline || getPipeline();
  return p.offerSentStatuses[0] || 'Angebot versendet';
}

function primaryOfferStatus(pipeline) {
  const p = pipeline || getPipeline();
  return p.offerStatuses[0] || 'Angebot in Vorbereitung';
}

function primaryBlockStatus(pipeline) {
  const p = pipeline || getPipeline();
  const lost = p.lostStatuses;
  return (
    lost.find((s) => s === 'kein Interesse') ||
    lost.find((s) => p.byStatus.get(s)?.isWildcard) ||
    lost[lost.length - 1] ||
    'kein Interesse'
  );
}

// ─── Übergänge ───────────────────────────────────────────────────────────────
const stageIndexOf = (p, status) =>
  p.stages.findIndex((stage) => (p.stepsByStage.get(stage.key) || []).some((s) => s.status === status));

function isStatusTransitionAllowed(current, next, pipeline) {
  const p = pipeline || getPipeline();
  if (!next || !p.statusSet.has(next)) return false;
  if (next === current) return true;

  const nextStep = p.byStatus.get(next);
  if (nextStep?.isWildcard) return true;
  if (p.transitions.some((t) => t.fromStatus === current && t.toStatus === next)) return true;

  const ci = stageIndexOf(p, current);
  const ni = stageIndexOf(p, next);
  if (ni < 0) return false;

  // Unbekannter Ausgangsstatus: nur Einstieg in die erste Stage
  if (ci < 0) return ni === 0;

  // Rückschritt in eine frühere Stage ist immer erlaubt
  if (ni < ci) return true;

  if (ni === ci) {
    const list = p.stepsByStage.get(p.stages[ci].key) || [];
    const curIdx = list.findIndex((s) => s.status === current);
    const nextIdx = list.findIndex((s) => s.status === next);
    return nextIdx <= curIdx || nextIdx === curIdx + 1;
  }

  // Vorwärts: nur in die unmittelbar nächste Stage, nur am Ende der aktuellen
  const currentStage = p.stages[ci];
  const currentList = p.stepsByStage.get(currentStage.key) || [];
  const atStageEnd = current === currentList[currentList.length - 1]?.status;
  if (!(ni === ci + 1 && atStageEnd)) return false;

  // Abschluss-Stage: alle Ausgänge wählbar; Zwischen-Stages: nur ihr erster Step
  if (ni === p.stages.length - 1) return true;
  const nextList = p.stepsByStage.get(p.stages[ni].key) || [];
  return nextList[0]?.status === next;
}

function statusBySlug(slug, pipeline) {
  const p = pipeline || getPipeline();
  return p.bySlug.get(slug) || null;
}

// ─── Invalidierung ───────────────────────────────────────────────────────────
function invalidatePipelines() {
  loaded = false;
  pipelines = new Map();
  byKey = new Map();
  defaultId = null;
}

function invalidateCampaigns() {
  campaignIndex = new Map();
}

module.exports = {
  prisma,
  // Laden/Zugriff
  loadPipelines,
  loadPipeline: loadPipelines, // Alias für server.js
  loadCampaignIndex,
  getPipeline,
  getPipelineForTarget,
  getAllPipelines,
  getCampaignPipelineId,
  // Flags
  statusesForFlag,
  primaryWonStatus,
  primaryLostStatus,
  primaryOfferSentStatus,
  primaryOfferStatus,
  primaryBlockStatus,
  // Übergänge
  isStatusTransitionAllowed,
  statusBySlug,
  slugifyStatus,
  // Cache
  invalidatePipelines,
  invalidatePipeline: invalidatePipelines, // Alias
  invalidateCampaigns,
  defaultPipeline,
};
