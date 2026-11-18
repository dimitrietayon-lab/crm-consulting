import api from './api'
import { buildPipeline } from './pipelineLogic'
import { PIPELINE, STAGES, STEPS, TRANSITIONS } from './acquisitionPipelineSeed'

// In-Memory-Cache mehrerer Workflows. `getPipeline(idOrKey?)` ist synchron, damit
// Seiten ohne await rendern können; `primePipeline()` füllt den Cache im
// geschützten Layout, `refreshPipeline()` nach Admin-Änderungen.
let pipelines = new Map()      // id -> built
let byKey = new Map()          // key -> id
let defaultId = null
let campaignIndex = new Map()  // campaignId -> pipelineId
let seedBuilt = null
let loaded = false

const listeners = new Set()

function emit() {
  listeners.forEach((fn) => { try { fn() } catch {} })
}

export function defaultPipeline() {
  if (!seedBuilt) seedBuilt = buildPipeline({ ...PIPELINE, stages: STAGES, steps: STEPS, transitions: TRANSITIONS })
  return seedBuilt
}

function ingest(list) {
  pipelines = new Map()
  byKey = new Map()
  for (const raw of list) {
    if (!raw || !Array.isArray(raw.steps) || !raw.steps.length) continue
    const built = buildPipeline(raw)
    pipelines.set(built.id, built)
    byKey.set(built.key, built.id)
  }
  const def =
    list.find((p) => p.isDefault && pipelines.has(p.id)) ||
    list.find((p) => p.key === 'default' && pipelines.has(p.id)) ||
    list.find((p) => pipelines.has(p.id))
  defaultId = def ? def.id : null
  loaded = true
}

export function getPipeline(idOrKey) {
  if (!loaded) return defaultPipeline()
  if (idOrKey == null) {
    return (defaultId && pipelines.get(defaultId)) ||
      pipelines.values().next().value ||
      defaultPipeline()
  }
  if (pipelines.has(idOrKey)) return pipelines.get(idOrKey)
  if (byKey.has(idOrKey)) return pipelines.get(byKey.get(idOrKey))
  return (defaultId && pipelines.get(defaultId)) ||
    pipelines.values().next().value ||
    defaultPipeline()
}

export function getPipelines() {
  return loaded ? [...pipelines.values()] : [defaultPipeline()]
}

export function getPipelineList() {
  return getPipelines().map((p) => ({ id: p.id, key: p.key, name: p.name, active: p.active, isDefault: p.isDefault }))
}

// Auflösungskette: target.pipelineId → target.campaign.pipelineId → Kampagnen-Index → Default
export function getPipelineForTarget(target) {
  if (!target) return getPipeline()
  if (target.pipelineId && pipelines.has(target.pipelineId)) return pipelines.get(target.pipelineId)
  const campaignPipelineId =
    (target.campaign && target.campaign.pipelineId) ||
    (target.campaignId ? campaignIndex.get(target.campaignId) : null)
  if (campaignPipelineId && pipelines.has(campaignPipelineId)) return pipelines.get(campaignPipelineId)
  return getPipeline()
}

export function getCampaignPipelineId(campaignId) {
  return campaignIndex.get(campaignId) || null
}

export async function primePipeline() {
  try {
    const [all, campaigns] = await Promise.all([
      api.get('/acquisition-pipeline/all'),
      api.get('/acquisition-campaigns').catch(() => []),
    ])
    if (Array.isArray(campaigns)) {
      campaignIndex = new Map(campaigns.map((c) => [c.id, c.pipelineId]))
    }
    if (Array.isArray(all) && all.some((p) => Array.isArray(p.steps) && p.steps.length)) {
      ingest(all)
      emit()
      return getPipeline()
    }
  } catch {
    // Server nicht erreichbar → Seed-Fallback
  }
  return getPipeline()
}

export async function refreshPipeline() {
  loaded = false
  return primePipeline()
}

// Admin: Workflow speichern. `id` optional (Default = Standard-Workflow).
export async function savePipeline(payload, id) {
  const targetId = id || payload?.id || getPipeline().id
  const data = await api.put(`/acquisition-pipeline/${targetId}`, payload)
  await refreshPipeline()
  return data
}

export async function createPipeline(payload) {
  const data = await api.post('/acquisition-pipeline', payload)
  await refreshPipeline()
  return data
}

export async function deletePipeline(id) {
  const data = await api.delete(`/acquisition-pipeline/${id}`)
  await refreshPipeline()
  return data
}

export async function resetPipeline(id) {
  const data = id
    ? await api.post(`/acquisition-pipeline/${id}/reset`, {})
    : await api.post('/acquisition-pipeline/reset', {})
  await refreshPipeline()
  return data
}

export function subscribePipeline(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
