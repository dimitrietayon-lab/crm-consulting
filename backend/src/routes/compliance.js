const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const DEFAULT_CHECKLIST_ITEMS = [
  'NDA unterzeichnet',
  'Datenschutzvereinbarung vorhanden',
  'Interessenkonflikt geprüft',
  'Interne Genehmigung eingeholt',
  'Onboarding-Dokumente vollständig',
]

// GET /api/compliance/ndas
router.get('/ndas', async (req, res) => {
  try {
    const ndas = await prisma.nDA.findMany({
      include: { account: { select: { id: true, companyName: true } } },
      orderBy: { expiryDate: 'asc' },
    })
    res.json(ndas)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/compliance/audit-log
router.get('/audit-log', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const entity = req.query.entity || undefined

    const where = entity ? { entity } : {}

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    res.json({ logs, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/compliance/conflict-check?accountId=id
router.get('/conflict-check', async (req, res) => {
  try {
    const { accountId } = req.query
    if (!accountId) return res.status(400).json({ error: 'accountId required' })

    const account = await prisma.account.findUnique({ where: { id: accountId } })
    if (!account) return res.status(404).json({ error: 'Account not found' })

    const sameType = await prisma.account.findMany({
      where: { institutionType: account.institutionType, id: { not: accountId } },
      include: {
        deals: { where: { stage: { notIn: ['Won', 'Lost'] } }, select: { id: true, title: true, stage: true } },
        projects: { where: { status: 'Active' }, select: { id: true, name: true, status: true } },
      },
    })

    const conflicts = sameType
      .filter((acc) => acc.deals.length > 0 || acc.projects.length > 0)
      .map((acc) => ({
        id: acc.id,
        companyName: acc.companyName,
        activeDeals: acc.deals,
        activeProjects: acc.projects,
      }))

    res.json({ account: { id: account.id, companyName: account.companyName, institutionType: account.institutionType }, conflicts })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/compliance/checklists/:projectId
router.get('/checklists/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params
    let checklist = await prisma.complianceChecklist.findUnique({
      where: { projectId },
      include: { items: { orderBy: { order: 'asc' } } },
    })

    if (!checklist) {
      checklist = await prisma.complianceChecklist.create({
        data: {
          projectId,
          items: {
            create: DEFAULT_CHECKLIST_ITEMS.map((name, i) => ({ name, order: i })),
          },
        },
        include: { items: { orderBy: { order: 'asc' } } },
      })
    }

    res.json(checklist)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/compliance/checklists/:projectId/items
router.post('/checklists/:projectId/items', async (req, res) => {
  try {
    const { projectId } = req.params
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })

    let checklist = await prisma.complianceChecklist.findUnique({ where: { projectId } })
    if (!checklist) {
      checklist = await prisma.complianceChecklist.create({
        data: {
          projectId,
          items: { create: DEFAULT_CHECKLIST_ITEMS.map((n, i) => ({ name: n, order: i })) },
        },
      })
    }

    const maxOrder = await prisma.complianceItem.aggregate({
      where: { checklistId: checklist.id },
      _max: { order: true },
    })

    const item = await prisma.complianceItem.create({
      data: {
        checklistId: checklist.id,
        name,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    })
    res.status(201).json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/compliance/checklists/:projectId/items/:itemId
router.put('/checklists/:projectId/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params
    const { done, name } = req.body
    const item = await prisma.complianceItem.update({
      where: { id: itemId },
      data: {
        ...(done !== undefined && { done }),
        ...(name !== undefined && { name }),
      },
    })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/compliance/checklists/:projectId/items/:itemId
router.delete('/checklists/:projectId/items/:itemId', async (req, res) => {
  try {
    await prisma.complianceItem.delete({ where: { id: req.params.itemId } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/compliance/gdpr-contacts
router.get('/gdpr-contacts', async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: {
        OR: [{ gdprDeleteRequested: true }, { gdprRestrictedProcessing: true }],
      },
      select: {
        id: true, name: true, email: true, title: true,
        gdprDeleteRequested: true, gdprRestrictedProcessing: true,
        accounts: { include: { account: { select: { companyName: true } } }, take: 1 },
      },
    })
    res.json(contacts)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/compliance/gdpr-contacts/:id
router.put('/gdpr-contacts/:id', async (req, res) => {
  try {
    const { gdprDeleteRequested, gdprRestrictedProcessing } = req.body
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        ...(gdprDeleteRequested !== undefined && { gdprDeleteRequested }),
        ...(gdprRestrictedProcessing !== undefined && { gdprRestrictedProcessing }),
      },
    })
    res.json(contact)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/compliance/gdpr-contacts/:id/anonymize
router.post('/gdpr-contacts/:id/anonymize', async (req, res) => {
  try {
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name: '[Anonymisiert]',
        email: null,
        phone: null,
        linkedIn: null,
        notes: null,
        title: null,
        gdprDeleteRequested: false,
        gdprRestrictedProcessing: false,
      },
    })
    res.json(contact)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
