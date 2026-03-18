const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function computeHealthScore(account) {
  let score = 0
  const now = new Date()

  // Last activity points
  const activities = account.activities || []
  if (activities.length > 0) {
    const latest = activities.reduce((a, b) => (a.date > b.date ? a : b))
    const daysDiff = (now - new Date(latest.date)) / (1000 * 60 * 60 * 24)
    if (daysDiff <= 30) score += 25
    else if (daysDiff <= 90) score += 15
  }

  // Open deals
  const openDeals = (account.deals || []).filter(
    (d) => !['Won', 'Lost'].includes(d.stage)
  )
  if (openDeals.length > 0) score += 20

  // Active projects
  const activeProjects = (account.projects || []).filter((p) => p.status === 'Active')
  if (activeProjects.length > 0) score += 20

  // Latest NPS
  const npsScores = account.npsScores || []
  if (npsScores.length > 0) {
    const latestNps = npsScores.reduce((a, b) => (a.date > b.date ? a : b))
    if (latestNps.score >= 8) score += 20
    else if (latestNps.score >= 6) score += 10
  }

  // Won deal value last 12 months
  const twelveMonthsAgo = new Date(now)
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  const wonValue = (account.deals || [])
    .filter((d) => d.stage === 'Won' && new Date(d.updatedAt) >= twelveMonthsAgo)
    .reduce((sum, d) => sum + (d.value || 0), 0)
  if (wonValue > 0) score += 15

  return Math.min(score, 100)
}

// GET /api/key-accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { isKeyAccount: true },
      include: {
        activities: { orderBy: { date: 'desc' }, take: 5, select: { date: true } },
        deals: { select: { stage: true, value: true, updatedAt: true } },
        projects: { select: { status: true } },
        npsScores: { orderBy: { date: 'desc' }, take: 1 },
        assignedConsultant: { select: { id: true, name: true } },
      },
    })

    const result = accounts.map((acc) => {
      const healthScore = computeHealthScore(acc)
      const lastActivity =
        acc.activities.length > 0 ? acc.activities[0].date : null
      const openPipeline = acc.deals
        .filter((d) => !['Won', 'Lost'].includes(d.stage))
        .reduce((sum, d) => sum + (d.value || 0), 0)

      return {
        id: acc.id,
        companyName: acc.companyName,
        institutionType: acc.institutionType,
        country: acc.country,
        healthScore,
        lastActivity,
        openPipeline,
        assignedConsultant: acc.assignedConsultant,
        latestNps: acc.npsScores[0]?.score ?? null,
      }
    })

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/key-accounts/:id/plan
router.get('/:id/plan', async (req, res) => {
  try {
    const { id } = req.params
    let plan = await prisma.accountPlan.findUnique({
      where: { accountId: id },
      include: {
        actions: {
          include: { owner: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!plan) {
      plan = await prisma.accountPlan.create({
        data: { accountId: id },
        include: { actions: true },
      })
    }
    res.json(plan)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/key-accounts/:id/plan
router.put('/:id/plan', async (req, res) => {
  try {
    const { id } = req.params
    const { strategicGoals, ourPositioning } = req.body
    const plan = await prisma.accountPlan.upsert({
      where: { accountId: id },
      create: { accountId: id, strategicGoals, ourPositioning },
      update: { strategicGoals, ourPositioning },
    })
    res.json(plan)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/key-accounts/:id/plan/actions
router.post('/:id/plan/actions', async (req, res) => {
  try {
    const { id } = req.params
    const { description, ownerId, dueDate } = req.body
    if (!description) return res.status(400).json({ error: 'description required' })

    let plan = await prisma.accountPlan.findUnique({ where: { accountId: id } })
    if (!plan) {
      plan = await prisma.accountPlan.create({ data: { accountId: id } })
    }

    const action = await prisma.accountPlanAction.create({
      data: {
        accountPlanId: plan.id,
        description,
        ownerId: ownerId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { owner: { select: { id: true, name: true } } },
    })
    res.status(201).json(action)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/key-accounts/:id/plan/actions/:actionId
router.put('/:id/plan/actions/:actionId', async (req, res) => {
  try {
    const { actionId } = req.params
    const { done, description, ownerId, dueDate } = req.body
    const action = await prisma.accountPlanAction.update({
      where: { id: actionId },
      data: {
        ...(done !== undefined && { done }),
        ...(description !== undefined && { description }),
        ...(ownerId !== undefined && { ownerId }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
      include: { owner: { select: { id: true, name: true } } },
    })
    res.json(action)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/key-accounts/:id/plan/actions/:actionId
router.delete('/:id/plan/actions/:actionId', async (req, res) => {
  try {
    await prisma.accountPlanAction.delete({ where: { id: req.params.actionId } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/key-accounts/:id/nps
router.post('/:id/nps', async (req, res) => {
  try {
    const { id } = req.params
    const { score, comment } = req.body
    if (score === undefined || score < 0 || score > 10) {
      return res.status(400).json({ error: 'score must be 0–10' })
    }
    const nps = await prisma.npsScore.create({
      data: { accountId: id, score: parseInt(score), comment },
    })
    res.status(201).json(nps)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/key-accounts/:id/nps
router.get('/:id/nps', async (req, res) => {
  try {
    const scores = await prisma.npsScore.findMany({
      where: { accountId: req.params.id },
      orderBy: { date: 'asc' },
    })
    res.json(scores)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
