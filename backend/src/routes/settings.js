const express = require('express')
const router  = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { callLlm } = require('../lib/llm')

function maskKey(key) {
  if (!key || key.length < 8) return '••••••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

function sanitize(cfg) {
  return { ...cfg, apiKey: maskKey(cfg.apiKey) }
}

const ALLOWED_GROUPS = [
  'institutionTypes', 'regulatoryFrameworks', 'projectTypes', 'projectStatuses',
  'dealServiceTypes', 'crossSellingTypes', 'dealStages', 'dealSources', 'lossReasons',
  'activityTypes', 'taskPriorities', 'taskStatuses', 'proposalStatuses',
  'leaveTypes', 'serviceCategories',
]

// GET /api/settings/categories
// Returns all groups as { groupKey: [{ id, value, order }] }
router.get('/categories', async (req, res) => {
  try {
    const rows = await prisma.systemCategory.findMany({
      orderBy: [{ group: 'asc' }, { order: 'asc' }, { value: 'asc' }],
    })
    const grouped = {}
    for (const g of ALLOWED_GROUPS) grouped[g] = []
    for (const row of rows) {
      if (!grouped[row.group]) grouped[row.group] = []
      grouped[row.group].push({ id: row.id, value: row.value, order: row.order })
    }
    res.json(grouped)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/settings/categories/:group
// Body: { value }
router.post('/categories/:group', async (req, res) => {
  try {
    const { group } = req.params
    if (!ALLOWED_GROUPS.includes(group)) {
      return res.status(400).json({ error: 'Ungültige Gruppe' })
    }
    const { value } = req.body
    if (!value?.trim()) return res.status(400).json({ error: 'Wert ist pflicht' })

    const existing = await prisma.systemCategory.count({ where: { group } })
    const item = await prisma.systemCategory.create({
      data: { group, value: value.trim(), order: existing },
    })
    res.status(201).json(item)
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Dieser Wert existiert bereits in der Gruppe' })
    }
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/settings/categories/:id
// Body: { value }
router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { value } = req.body
    if (!value?.trim()) return res.status(400).json({ error: 'Wert ist pflicht' })

    const item = await prisma.systemCategory.update({
      where: { id },
      data: { value: value.trim() },
    })
    res.json(item)
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Dieser Wert existiert bereits in der Gruppe' })
    }
    if (err.code === 'P2025') return res.status(404).json({ error: 'Nicht gefunden' })
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/settings/categories/:id
router.delete('/categories/:id', async (req, res) => {
  try {
    await prisma.systemCategory.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Nicht gefunden' })
    res.status(500).json({ error: err.message })
  }
})

// ─── LLM Config CRUD ─────────────────────────────────────────────────────────

// GET /api/settings/llm
router.get('/llm', async (req, res) => {
  try {
    const configs = await prisma.llmConfig.findMany({ orderBy: { createdAt: 'asc' } })
    res.json(configs.map(sanitize))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/settings/llm
router.post('/llm', async (req, res) => {
  try {
    const { provider, name, apiKey, model, endpoint, deploymentName, apiVersion } = req.body
    if (!provider || !name || !apiKey) {
      return res.status(400).json({ error: 'provider, name und apiKey sind pflicht' })
    }
    const cfg = await prisma.llmConfig.create({
      data: { provider, name, apiKey, model: model || null, endpoint: endpoint || null,
              deploymentName: deploymentName || null, apiVersion: apiVersion || null },
    })
    res.status(201).json(sanitize(cfg))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/settings/llm/:id
router.put('/llm/:id', async (req, res) => {
  try {
    const { provider, name, apiKey, model, endpoint, deploymentName, apiVersion } = req.body
    const existing = await prisma.llmConfig.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Nicht gefunden' })

    const cfg = await prisma.llmConfig.update({
      where: { id: req.params.id },
      data: {
        ...(provider          && { provider }),
        ...(name              && { name }),
        // Only overwrite apiKey if a new one was actually sent (not the masked placeholder)
        ...(apiKey && !apiKey.includes('••') && { apiKey }),
        model:          model          ?? existing.model,
        endpoint:       endpoint       ?? existing.endpoint,
        deploymentName: deploymentName ?? existing.deploymentName,
        apiVersion:     apiVersion     ?? existing.apiVersion,
      },
    })
    res.json(sanitize(cfg))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/settings/llm/:id
router.delete('/llm/:id', async (req, res) => {
  try {
    await prisma.llmConfig.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Nicht gefunden' })
    res.status(500).json({ error: err.message })
  }
})

// POST /api/settings/llm/:id/activate — set one config active, deactivate all others
router.post('/llm/:id/activate', async (req, res) => {
  try {
    await prisma.llmConfig.updateMany({ data: { isActive: false } })
    const cfg = await prisma.llmConfig.update({
      where: { id: req.params.id },
      data: { isActive: true },
    })
    res.json(sanitize(cfg))
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Nicht gefunden' })
    res.status(500).json({ error: err.message })
  }
})

// POST /api/settings/llm/:id/test — send a test prompt and return the response
router.post('/llm/:id/test', async (req, res) => {
  try {
    const cfg = await prisma.llmConfig.findUnique({ where: { id: req.params.id } })
    if (!cfg) return res.status(404).json({ error: 'Nicht gefunden' })

    const text = await callLlm(
      cfg,
      'Antworte auf Deutsch in einem einzigen kurzen Satz: Was ist deine Aufgabe?',
      150
    )
    res.json({ success: true, response: text })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

module.exports = router
