// Dünne Schicht um die Pipeline-Auflösung: liefert Flag-basierte Statuswerte
// pro Zielkunde (exakte Pipeline) bzw. aggregiert über alle Workflows (Rollups).

const {
  getPipeline,
  getPipelineForTarget,
  getAllPipelines,
  statusesForFlag,
  primaryWonStatus,
  primaryLostStatus,
  primaryOfferSentStatus,
  primaryOfferStatus,
  primaryBlockStatus,
} = require('./acquisitionPipeline');

function resolvePipelineForTarget(target) {
  return getPipelineForTarget(target);
}

function wonStatus(pipeline) {
  return primaryWonStatus(pipeline);
}
function lostStatus(pipeline) {
  return primaryLostStatus(pipeline);
}
function blockStatus(pipeline) {
  return primaryBlockStatus(pipeline);
}
function offerSentStatus(pipeline) {
  return primaryOfferSentStatus(pipeline);
}
function offerStatus(pipeline) {
  return primaryOfferStatus(pipeline);
}

function isWonStatus(status, pipeline) {
  return statusesForFlag(pipeline, 'won').includes(status);
}
function isLostStatus(status, pipeline) {
  return statusesForFlag(pipeline, 'lost').includes(status);
}
function isBlockStatus(status, pipeline) {
  return status === primaryBlockStatus(pipeline);
}
function isOfferSentStatus(status, pipeline) {
  return statusesForFlag(pipeline, 'offerSent').includes(status);
}
function isOfferStatus(status, pipeline) {
  return statusesForFlag(pipeline, 'offer').includes(status);
}
function isInTalkStatus(status, pipeline) {
  return statusesForFlag(pipeline, 'inTalk').includes(status);
}

function flagStatuses(pipeline, flag) {
  return statusesForFlag(pipeline, flag);
}

// Union der Flags ALLER gecachten Workflows. Für Reporting/Statistik/Dashboard/AI,
// wo Zielkunden kampagnenübergreifend aggregiert werden.
function aggregateFlagSets() {
  const all = getAllPipelines();
  const list = all.length ? all : [getPipeline()];

  const union = (field) => {
    const set = new Set();
    for (const p of list) for (const s of (p[field] || [])) set.add(s);
    return [...set];
  };

  const byStatus = new Map();
  const statusSet = new Set();
  for (const p of list) {
    for (const [status, step] of p.byStatus) {
      if (!byStatus.has(status)) byStatus.set(status, step);
      statusSet.add(status);
    }
  }

  return {
    statuses: [...statusSet],
    statusSet,
    byStatus,
    activeStatuses: union('activeStatuses'),
    inTalkStatuses: union('inTalkStatuses'),
    offerStatuses: union('offerStatuses'),
    offerSentStatuses: union('offerSentStatuses'),
    wonStatuses: union('wonStatuses'),
    lostStatuses: union('lostStatuses'),
    earlyStatuses: union('earlyStatuses'),
    wildcardStatuses: union('wildcardStatuses'),
  };
}

module.exports = {
  resolvePipelineForTarget,
  wonStatus,
  lostStatus,
  blockStatus,
  primaryBlockStatus,
  offerSentStatus,
  offerStatus,
  isWonStatus,
  isLostStatus,
  isBlockStatus,
  isOfferSentStatus,
  isOfferStatus,
  isInTalkStatus,
  flagStatuses,
  aggregateFlagSets,
};
