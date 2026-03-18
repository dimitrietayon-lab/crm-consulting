const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Only pass known Prisma fields — prevents "Unknown arg" errors from form extra fields
const ALLOWED_FIELDS = [
  'companyName', 'institutionType', 'country', 'website', 'notes',
  'numberOfEmployees', 'aum', 'annualRevenue',
  'regulatoryFrameworks', 'tags',
  'assignedConsultantId', 'isKeyAccount',
  'bankingLicense', 'regulatoryStatus', 'coreBankingSystem', 'baselIVStatus',
  'insuranceType', 'solvencyIIStatus', 'policySystem',
];

function sanitize(body) {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

// GET /api/accounts
router.get('/', async (req, res) => {
  try {
    const { q, institutionType, country, isKeyAccount, assignedConsultantId } = req.query;

    const where = {};

    if (q) {
      where.companyName = { contains: q, mode: 'insensitive' };
    }
    if (institutionType) {
      where.institutionType = institutionType;
    }
    if (country) {
      where.country = country;
    }
    if (isKeyAccount !== undefined) {
      where.isKeyAccount = isKeyAccount === 'true';
    }
    if (assignedConsultantId) {
      where.assignedConsultantId = assignedConsultantId;
    }

    const accounts = await prisma.account.findMany({
      where,
      include: {
        assignedConsultant: {
          select: { id: true, name: true },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts
router.post('/', async (req, res) => {
  try {
    const account = await prisma.account.create({ data: sanitize(req.body) });
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/accounts/:id
router.get('/:id', async (req, res) => {
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.params.id },
      include: {
        assignedConsultant: true,
        contacts: {
          include: {
            contact: true,
          },
          orderBy: [
            { contact: { hierarchyLevel: 'asc' } },
          ],
        },
        projects: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            account: { select: { companyName: true } },
          },
        },
        deals: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            account: { select: { companyName: true } },
            assignedTo: { select: { name: true } },
          },
        },
        activities: {
          take: 10,
          orderBy: { date: 'desc' },
          include: {
            createdBy: { select: { name: true } },
            participants: {
              include: {
                contact: { select: { name: true } },
              },
            },
          },
        },
        ndas: true,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/accounts/:id
router.put('/:id', async (req, res) => {
  try {
    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: sanitize(req.body),
    });
    res.json(account);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.account.delete({ where: { id: req.params.id } });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/:id/ndas
router.post('/:id/ndas', async (req, res) => {
  try {
    const nda = await prisma.nDA.create({
      data: {
        accountId: req.params.id,
        ...req.body,
        signingDate: req.body.signingDate ? new Date(req.body.signingDate) : null,
        expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
      },
    });
    res.status(201).json(nda);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/ndas/:ndaId
router.delete('/ndas/:ndaId', async (req, res) => {
  try {
    await prisma.nDA.delete({ where: { id: req.params.ndaId } });
    res.json({ message: 'NDA deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
