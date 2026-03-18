const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/contracts
router.get('/', async (req, res) => {
  try {
    const contracts = await prisma.contract.findMany({
      include: {
        proposal: {
          select: { id: true, title: true, version: true, totalAmount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch account names
    const accountIds = [...new Set(contracts.map((c) => c.accountId).filter(Boolean))];
    const accounts = accountIds.length
      ? await prisma.account.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, companyName: true },
        })
      : [];
    const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.companyName]));

    res.json(contracts.map((c) => ({ ...c, accountName: accountMap[c.accountId] || null })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contracts/:id
router.get('/:id', async (req, res) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        proposal: {
          include: {
            lineItems: { include: { service: true }, orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const [account, documents] = await Promise.all([
      contract.accountId
        ? prisma.account.findUnique({
            where: { id: contract.accountId },
            select: { id: true, companyName: true, country: true, institutionType: true },
          })
        : null,
      prisma.document.findMany({
        where: { accountId: contract.accountId || undefined },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    res.json({ ...contract, account, documents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/contracts/:id
router.put('/:id', async (req, res) => {
  try {
    const { startDate, endDate, value, renewalReminder } = req.body;
    const data = {};
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (value !== undefined) data.value = value !== '' ? parseFloat(value) : null;
    if (renewalReminder !== undefined) data.renewalReminder = renewalReminder ? new Date(renewalReminder) : null;

    const contract = await prisma.contract.update({
      where: { id: req.params.id },
      data,
      include: {
        proposal: { select: { id: true, title: true, version: true } },
      },
    });

    res.json(contract);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Contract not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contracts/:id/sign
router.post('/:id/sign', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const contract = await prisma.contract.update({
      where: { id: req.params.id },
      data: { signedPdfPath: req.file.path.replace(/\\/g, '/') },
      include: {
        proposal: { select: { id: true, title: true, version: true } },
      },
    });

    res.json(contract);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Contract not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
