const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET /api/segments/analytics
// Grouped stats per institutionType
router.get('/analytics', async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        deals: { select: { value: true, stage: true } },
        projects: { select: { status: true } },
      },
    })

    const grouped = {}
    for (const acc of accounts) {
      const type = acc.institutionType || 'Other'
      if (!grouped[type]) {
        grouped[type] = { segment: type, count: 0, pipelineValue: 0, activeProjects: 0 }
      }
      grouped[type].count++
      for (const deal of acc.deals) {
        if (deal.stage !== 'Lost') {
          grouped[type].pipelineValue += deal.value || 0
        }
      }
      for (const proj of acc.projects) {
        if (proj.status === 'Active') grouped[type].activeProjects++
      }
    }

    res.json(Object.values(grouped).sort((a, b) => b.count - a.count))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/segments/categories
router.get('/categories', async (req, res) => {
  try {
    const cats = await prisma.accountCategory.findMany({ orderBy: { name: 'asc' } })
    res.json(cats)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/segments/categories
router.post('/categories', async (req, res) => {
  try {
    const { name, description } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const cat = await prisma.accountCategory.create({ data: { name, description } })
    res.status(201).json(cat)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Kategorie existiert bereits' })
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/segments/categories/:id
router.put('/categories/:id', async (req, res) => {
  try {
    const { name, description } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const cat = await prisma.accountCategory.update({
      where: { id: req.params.id },
      data: { name, ...(description !== undefined && { description }) },
    })
    res.json(cat)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Kategorie existiert bereits' })
    if (err.code === 'P2025') return res.status(404).json({ error: 'Nicht gefunden' })
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/segments/categories/:id
router.delete('/categories/:id', async (req, res) => {
  try {
    await prisma.accountCategory.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
