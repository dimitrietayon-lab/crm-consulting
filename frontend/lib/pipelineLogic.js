// Reine Pipeline-Logik (kein Netzwerk, kein React). Spiegelt
// backend/src/lib/acquisitionPipeline.js, damit Freischaltung und Anzeige
// zwischen Client und Server identisch sind.
//
// Eingabe ist immer ein "normalisiertes" Pipeline-Objekt (siehe buildPipeline).

export function slugifyStatus(value) {
  const map = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }
  return String(value || '')
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => map[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Baut abgeleitete Sichten (Maps/Sets) aus den drei Roh-Listen.
export function buildPipeline(raw) {
  const stages = [...(raw?.stages || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  const stageByKey = new Map(stages.map((s) => [s.key, s]))

  const steps = [...(raw?.steps || [])]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((s) => ({
      ...s,
      stageKey: s.stageKey || s.stage?.key || stageByKey.get(s.stage?.key)?.key || s.stage,
      stage: s.stage && typeof s.stage === 'object' ? s.stage : stageByKey.get(s.stageKey || s.stage) || null,
    }))

  const stepsByStage = new Map()
  for (const stage of stages) stepsByStage.set(stage.key, [])
  for (const step of steps) {
    if (step.stageKey && stepsByStage.has(step.stageKey)) stepsByStage.get(step.stageKey).push(step)
  }

  const statuses = steps.map((s) => s.status)
  const byStatus = new Map(steps.map((s) => [s.status, s]))
  const bySlug = new Map(steps.map((s) => [s.slug, s]))
  const flags = (pred) => steps.filter(pred).map((s) => s.status)

  return {
    id: raw?.id,
    key: raw?.key || 'default',
    name: raw?.name || 'Akquise-Pipeline',
    description: raw?.description || null,
    active: raw?.active !== false,
    isDefault: raw?.isDefault === true,
    stages,
    steps,
    transitions: raw?.transitions || [],
    statuses,
    statusSet: new Set(statuses),
    byStatus,
    bySlug,
    stepsByStage,
    activeStatuses: flags((s) => !s.isEarly && !s.isClosing),
    inTalkStatuses: flags((s) => s.isInTalk),
    offerStatuses: flags((s) => s.isOffer),
    offerSentStatuses: flags((s) => s.isOfferSent),
    wonStatuses: flags((s) => s.isWon),
    lostStatuses: flags((s) => s.isLost),
    earlyStatuses: flags((s) => s.isEarly),
    wildcardStatuses: flags((s) => s.isWildcard),
  }
}

export function stepByStatus(status, pipeline) {
  return pipeline?.byStatus?.get(status) || null
}

export function stepBySlug(slug, pipeline) {
  return pipeline?.bySlug?.get(slug) || null
}

export function statusLabel(status, pipeline) {
  return stepByStatus(status, pipeline)?.label || status || ''
}

export function stageOfStatus(status, pipeline) {
  const step = stepByStatus(status, pipeline)
  if (!step) return null
  return pipeline.stages.find((st) => st.key === step.stageKey) || null
}

function stageIndexOf(pipeline, status) {
  return pipeline.stages.findIndex((stage) =>
    (pipeline.stepsByStage.get(stage.key) || []).some((s) => s.status === status)
  )
}

// Darf von `current` nach `next` gewechselt werden?
// Gleiche Regeln wie serverseitig: Wildcard-Ziele immer, explizite Transitions,
// Rückschritt erlaubt, Vorwärts nur in die nächste Stage am Stage-Ende.
export function isStatusSelectable(current, next, pipeline) {
  if (!pipeline || !next || !pipeline.statusSet?.has(next)) return false
  if (next === current) return true

  const nextStep = pipeline.byStatus.get(next)
  if (nextStep?.isWildcard) return true
  if ((pipeline.transitions || []).some((t) => t.fromStatus === current && t.toStatus === next)) return true

  const ci = stageIndexOf(pipeline, current)
  const ni = stageIndexOf(pipeline, next)
  if (ni < 0) return false

  // Unbekannter Ausgangsstatus: nur Einstieg in die erste Stage
  if (ci < 0) return ni === 0

  // Rückschritt in eine frühere Stage ist immer erlaubt
  if (ni < ci) return true

  if (ni === ci) {
    const list = pipeline.stepsByStage.get(pipeline.stages[ci].key) || []
    const curIdx = list.findIndex((s) => s.status === current)
    const nextIdx = list.findIndex((s) => s.status === next)
    return nextIdx <= curIdx || nextIdx === curIdx + 1
  }

  // Vorwärts: nur in die unmittelbar nächste Stage, nur am Ende der aktuellen
  const currentList = pipeline.stepsByStage.get(pipeline.stages[ci].key) || []
  const atStageEnd = current === currentList[currentList.length - 1]?.status
  if (!(ni === ci + 1 && atStageEnd)) return false

  // Abschluss-Stage: alle Ausgänge wählbar; Zwischen-Stages: nur ihr erster Step
  if (ni === pipeline.stages.length - 1) return true
  const nextList = pipeline.stepsByStage.get(pipeline.stages[ni].key) || []
  return nextList[0]?.status === next
}

// Der Schritt, der nach `status` als nächster freigeschaltet ist (oder null).
export function nextUnlockedStatus(status, pipeline) {
  if (!pipeline) return null
  const currentIdx = pipeline.statuses.indexOf(status)
  const candidates = [
    ...pipeline.statuses.slice(currentIdx + 1),
    ...pipeline.statuses.slice(0, Math.max(currentIdx, 0)),
  ]
  return candidates.find((s) => isStatusSelectable(status, s, pipeline)) || null
}

// Fortschritt für Stepper/Progressbar.
export function processProgress(status, pipeline) {
  const stage = stageOfStatus(status, pipeline)
  const currentStageIndex = stage ? pipeline.stages.findIndex((st) => st.key === stage.key) : -1
  const stageList = pipeline.stepsByStage.get(stage?.key) || []
  const currentStepIndex = stageList.findIndex((s) => s.status === status)
  return {
    stage,
    currentStageIndex,
    stageCount: pipeline.stages.length,
    stepIndexInStage: currentStepIndex,
    stepsInStage: stageList.length,
    percent: stage ? Math.round(((currentStageIndex + (stageList.length ? (currentStepIndex + 1) / stageList.length : 1)) / pipeline.stages.length) * 100) : 0,
  }
}

// ─── Flag-basierte Helfer (ersetzen hartkodierte Status-Listen) ───────────────

// Statusliste eines Workflows für ein Flag (won/lost/offer/offerSent/inTalk/early/wildcard).
export function flagStatuses(pipeline, flag) {
  const map = {
    won: 'wonStatuses',
    lost: 'lostStatuses',
    offer: 'offerStatuses',
    offerSent: 'offerSentStatuses',
    inTalk: 'inTalkStatuses',
    early: 'earlyStatuses',
    wildcard: 'wildcardStatuses',
    active: 'activeStatuses',
  }
  const field = map[flag]
  return field ? (pipeline?.[field] || []) : []
}

export function isFlag(pipeline, status, flag) {
  return flagStatuses(pipeline, flag).includes(status)
}

// Primärer Sperr-Status eines Workflows (spiegelt backend primaryBlockStatus).
export function blockStatus(pipeline) {
  const lost = pipeline?.lostStatuses || []
  return (
    lost.find((s) => s === 'kein Interesse') ||
    lost.find((s) => pipeline?.byStatus?.get(s)?.isWildcard) ||
    lost[lost.length - 1] ||
    'kein Interesse'
  )
}

export function isBlockStatus(status, pipeline) {
  return status === blockStatus(pipeline)
}

// Erste zutreffende Flag-Kategorie eines Steps (in Prioritätsreihenfolge).
const FLAG_PRIORITY = ['isWon', 'isLost', 'isOfferSent', 'isOffer', 'isInTalk', 'isEarly', 'isWildcard']

export function stepFlagKey(step) {
  if (!step) return null
  for (const flag of FLAG_PRIORITY) if (step[flag]) return flag
  return null
}

// Farbklassen je Flag-Kategorie (Windfall für neue Workflows ohne feste Status-Farben).
const FLAG_STYLES = {
  isWon:       { header: 'bg-green-600 text-white',   badge: 'bg-green-100 text-green-700 border-green-200',  dot: 'bg-green-500',   border: 'border-green-200' },
  isLost:      { header: 'bg-red-600 text-white',     badge: 'bg-red-100 text-red-700 border-red-200',        dot: 'bg-red-500',     border: 'border-red-200' },
  isOfferSent: { header: 'bg-violet-700 text-white',  badge: 'bg-violet-100 text-violet-800 border-violet-200', dot: 'bg-violet-600', border: 'border-violet-200' },
  isOffer:     { header: 'bg-violet-500 text-white',  badge: 'bg-violet-50 text-violet-700 border-violet-200',  dot: 'bg-violet-400', border: 'border-violet-200' },
  isInTalk:    { header: 'bg-amber-600 text-white',   badge: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-500',   border: 'border-amber-200' },
  isEarly:     { header: 'bg-slate-600 text-white',   badge: 'bg-slate-100 text-slate-700 border-slate-200',   dot: 'bg-slate-500',   border: 'border-slate-200' },
  isWildcard:  { header: 'bg-rose-700 text-white',    badge: 'bg-rose-100 text-rose-700 border-rose-200',      dot: 'bg-rose-600',    border: 'border-rose-200' },
}
const DEFAULT_STYLE = { header: 'bg-blue-600 text-white', badge: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500', border: 'border-blue-200' }

export function styleForStep(step) {
  return FLAG_STYLES[stepFlagKey(step)] || DEFAULT_STYLE
}

export function stepColor(status, pipeline) {
  return styleForStep(stepByStatus(status, pipeline)).header
}

export function statusBadge(status, pipeline) {
  return styleForStep(stepByStatus(status, pipeline)).badge
}

export function statusDot(status, pipeline) {
  return styleForStep(stepByStatus(status, pipeline)).dot
}

// Suche einen Step per Slug in EINER ODER MEHREREN Pipelines.
// `pipelines` darf ein Array oder eine Map<id, built> sein.
export function stepBySlugAnywhere(slug, pipelines) {
  if (!slug || !pipelines) return null
  const list = pipelines instanceof Map ? [...pipelines.values()] : pipelines
  for (const p of list) {
    const step = p?.bySlug?.get(slug)
    if (step) return step
  }
  return null
}
