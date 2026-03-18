const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const SERVICE_TYPES = [
  'Strategy',
  'Regulation',
  'IT',
  'Risk',
  'Audit',
  'Finance',
  'Operations',
  'HR',
  'Legal',
  'Digital',
]

// Helper: collect all service type coverage for an account from deals + projects
function getCoverage(acc) {
  const dealCounts    = {}
  const projectCounts = {}

  for (const deal of acc.deals || []) {
    if (deal.serviceType) {
      dealCounts[deal.serviceType] = (dealCounts[deal.serviceType] || 0) + 1
    }
  }
  for (const proj of acc.projects || []) {
    if (proj.projectType) {
      projectCounts[proj.projectType] = (projectCounts[proj.projectType] || 0) + 1
    }
  }

  const usedTypes = new Set([...Object.keys(dealCounts), ...Object.keys(projectCounts)])
  return { usedTypes, dealCounts, projectCounts }
}

// GET /api/cross-selling/service-map
// Per account: service type coverage from deals + projects
router.get('/service-map', async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        deals:    { select: { serviceType: true } },
        projects: { select: { projectType: true } },
      },
      orderBy: { companyName: 'asc' },
    })

    const result = accounts.map((acc) => {
      const { usedTypes, dealCounts, projectCounts } = getCoverage(acc)
      return {
        id: acc.id,
        companyName: acc.companyName,
        institutionType: acc.institutionType,
        usedTypes: Array.from(usedTypes),
        dealCounts,
        projectCounts,
      }
    })

    res.json({ serviceTypes: SERVICE_TYPES, accounts: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/cross-selling/white-space
// Accounts with < 3 distinct service types (deals + projects combined)
router.get('/white-space', async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        deals:    { select: { serviceType: true } },
        projects: { select: { projectType: true } },
      },
      orderBy: { companyName: 'asc' },
    })

    const result = accounts
      .map((acc) => {
        const { usedTypes } = getCoverage(acc)
        const usedArr      = Array.from(usedTypes)
        const missingTypes = SERVICE_TYPES.filter((t) => !usedTypes.has(t))
        return {
          id: acc.id,
          companyName: acc.companyName,
          institutionType: acc.institutionType,
          usedTypes: usedArr,
          missingTypes,
        }
      })
      .filter((acc) => acc.usedTypes.length < 3)

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/cross-selling/suggestions/:accountId
// Service types used by same-institutionType accounts that this account hasn't covered
router.get('/suggestions/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        deals:    { select: { serviceType: true } },
        projects: { select: { projectType: true } },
      },
    })
    if (!account) return res.status(404).json({ error: 'Account not found' })

    const { usedTypes: myTypes } = getCoverage(account)

    // Find similar accounts (same institutionType)
    const similar = await prisma.account.findMany({
      where: { institutionType: account.institutionType, id: { not: accountId } },
      include: {
        deals:    { select: { serviceType: true } },
        projects: { select: { projectType: true } },
      },
    })

    const peerTypeCounts = {}
    for (const acc of similar) {
      const { usedTypes } = getCoverage(acc)
      for (const t of usedTypes) {
        peerTypeCounts[t] = (peerTypeCounts[t] || 0) + 1
      }
    }

    const suggestions = Object.entries(peerTypeCounts)
      .filter(([type]) => !myTypes.has(type))
      .map(([type, count]) => ({ serviceType: type, peerCount: count }))
      .sort((a, b) => b.peerCount - a.peerCount)

    res.json({
      account: { id: account.id, companyName: account.companyName, institutionType: account.institutionType },
      usedTypes: Array.from(myTypes),
      suggestions,
      peerCount: similar.length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/cross-selling/create-deal
// Create a Deal tagged as Cross-Selling for a given account + serviceType
router.post('/create-deal', async (req, res) => {
  try {
    const { accountId, serviceType, title, value, notes } = req.body
    if (!accountId || !serviceType) {
      return res.status(400).json({ error: 'accountId und serviceType sind pflicht' })
    }
    const account = await prisma.account.findUnique({ where: { id: accountId } })
    if (!account) return res.status(404).json({ error: 'Account nicht gefunden' })

    const deal = await prisma.deal.create({
      data: {
        title: (title || '').trim() || `Cross-Selling: ${serviceType} – ${account.companyName}`,
        accountId,
        serviceType,
        source: 'Cross-Selling',
        stage: 'First Contact',
        value: value != null ? parseFloat(value) : null,
        notes: notes || null,
        assignedToId: req.user?.id || null,
      },
      include: {
        account: { select: { id: true, companyName: true, institutionType: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })
    res.status(201).json(deal)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/cross-selling/pipeline
// All deals tagged with source='Cross-Selling'
router.get('/pipeline', async (req, res) => {
  try {
    const deals = await prisma.deal.findMany({
      where: { source: 'Cross-Selling' },
      include: {
        account: { select: { id: true, companyName: true, institutionType: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(deals)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/cross-selling/pipeline/:dealId
// Update stage / value / notes of a cross-selling deal
router.patch('/pipeline/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params
    const { stage, value, notes } = req.body
    const deal = await prisma.deal.update({
      where: { id: dealId },
      data: {
        ...(stage !== undefined && { stage }),
        ...(value !== undefined && { value: value != null ? parseFloat(value) : null }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        account: { select: { id: true, companyName: true, institutionType: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })
    res.json(deal)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/cross-selling/pipeline/:dealId
router.delete('/pipeline/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params
    await prisma.deal.delete({ where: { id: dealId } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
