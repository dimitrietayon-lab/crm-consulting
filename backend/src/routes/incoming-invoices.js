const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { notifyApproversOfUser } = require('../services/notifications');

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

// GET /api/incoming-invoices
router.get('/', async (req, res) => {
  try {
    const { status, projectId, vendorId, dueWithin } = req.query;
    const where = {};
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;
    if (vendorId) where.vendorId = vendorId;
    if (dueWithin) {
      const days = parseInt(dueWithin);
      where.dueDate = { lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000) };
      where.status = { notIn: ['paid', 'rejected'] };
    }

    const invoices = await prisma.incomingInvoice.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incoming-invoices/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const all = await prisma.incomingInvoice.findMany({
      where: { invoiceDate: { gte: startOfYear } },
      select: { status: true, amount: true, amountEur: true, dueDate: true, category: true, invoiceDate: true },
    });

    const totalCost = all.reduce((s, i) => s + (i.amountEur || i.amount), 0);
    const pending = all.filter(i => ['pending', 'approved'].includes(i.status)).reduce((s, i) => s + (i.amountEur || i.amount), 0);
    const paid = all.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amountEur || i.amount), 0);

    // Upcoming payments (next 30 days)
    const upcoming = all.filter(i =>
      i.dueDate && !['paid', 'rejected'].includes(i.status) &&
      i.dueDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    ).length;

    // By category
    const byCategory = {};
    all.forEach(i => {
      byCategory[i.category] = (byCategory[i.category] || 0) + (i.amountEur || i.amount);
    });

    res.json({ totalCost, pending, paid, upcoming, byCategory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incoming-invoices/vendors
router.get('/vendors', async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({ orderBy: { name: 'asc' } });
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/incoming-invoices/vendors
router.post('/vendors', async (req, res) => {
  try {
    const { name, email, phone, address, vatNumber, iban } = req.body;
    const vendor = await prisma.vendor.create({
      data: { name, email: email || null, phone: phone || null, address: address || null, vatNumber: vatNumber || null, iban: iban || null },
    });
    res.status(201).json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/incoming-invoices/vendors/:id
router.put('/vendors/:id', async (req, res) => {
  try {
    const { name, email, phone, address, vatNumber, iban } = req.body;
    const vendor = await prisma.vendor.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(vatNumber !== undefined && { vatNumber }),
        ...(iban !== undefined && { iban }),
      },
    });
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incoming-invoices/report
router.get('/report', async (req, res) => {
  try {
    const { projectId, year } = req.query;
    const where = {};
    if (projectId) where.projectId = projectId;
    if (year) {
      const y = parseInt(year);
      where.invoiceDate = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
    }

    const invoices = await prisma.incomingInvoice.findMany({
      where,
      include: { project: { select: { id: true, name: true } } },
    });

    // Group by project
    const byProject = {};
    invoices.forEach(i => {
      const key = i.projectId || '__none__';
      const label = i.project?.name || 'Kein Projekt';
      if (!byProject[key]) byProject[key] = { project: label, total: 0, count: 0 };
      byProject[key].total += i.amountEur || i.amount;
      byProject[key].count += 1;
    });

    res.json(Object.values(byProject));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incoming-invoices/export/csv
router.get('/export/csv', async (req, res) => {
  try {
    const { year } = req.query;
    const where = {};
    if (year) {
      const y = parseInt(year);
      where.invoiceDate = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
    }

    const invoices = await prisma.incomingInvoice.findMany({
      where,
      include: { vendor: { select: { name: true } }, project: { select: { name: true } } },
      orderBy: { invoiceDate: 'asc' },
    });

    const lines = ['Lieferant,Rechnungsnummer,Rechnungsdatum,Fälligkeitsdatum,Betrag,Währung,Betrag (EUR),Kategorie,Projekt,Status'];
    invoices.forEach(i => {
      lines.push([
        (i.vendor?.name || i.vendorName).replace(/,/g, ';'),
        i.invoiceNumber || '',
        i.invoiceDate.toISOString().split('T')[0],
        i.dueDate ? i.dueDate.toISOString().split('T')[0] : '',
        i.amount.toFixed(2),
        i.currency,
        (i.amountEur || i.amount).toFixed(2),
        i.category,
        i.project?.name || '',
        i.status,
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eingangsrechnungen-${year || 'export'}.csv"`);
    res.send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incoming-invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const invoice = await prisma.incomingInvoice.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: true,
        project: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    });
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/incoming-invoices
router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    const { vendorId, vendorName, invoiceNumber, invoiceDate, dueDate, amount, vatAmount, vatRate, currency, amountEur, category, projectId, description } = req.body;

    const invoice = await prisma.incomingInvoice.create({
      data: {
        vendorId: vendorId || null,
        vendorName: vendorName || '',
        invoiceNumber: invoiceNumber || null,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        amount: parseFloat(amount),
        vatAmount: vatAmount ? parseFloat(vatAmount) : 0,
        vatRate: vatRate ? parseFloat(vatRate) : 19,
        currency: currency || 'EUR',
        amountEur: amountEur ? parseFloat(amountEur) : parseFloat(amount),
        category,
        projectId: projectId || null,
        description: description || null,
        pdfPath: req.file ? req.file.path.replace(/\\/g, '/') : null,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
    if (req.user?.id) {
      const vendor = invoice.vendor?.name || invoice.vendorName || 'Lieferant';
      await notifyApproversOfUser(
        req.user.id,
        'incoming_invoice_submitted',
        'Eingangsrechnung eingereicht',
        `Eine Eingangsrechnung von "${vendor}" wurde eingereicht.`,
        '/incoming-invoices',
      );
    }
    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/incoming-invoices/:id
router.put('/:id', async (req, res) => {
  try {
    const { vendorName, invoiceNumber, invoiceDate, dueDate, amount, vatAmount, currency, amountEur, category, projectId, description, vendorId } = req.body;
    const invoice = await prisma.incomingInvoice.update({
      where: { id: req.params.id },
      data: {
        ...(vendorId !== undefined && { vendorId }),
        ...(vendorName !== undefined && { vendorName }),
        ...(invoiceNumber !== undefined && { invoiceNumber }),
        ...(invoiceDate !== undefined && { invoiceDate: new Date(invoiceDate) }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(vatAmount !== undefined && { vatAmount: parseFloat(vatAmount) }),
        ...(currency !== undefined && { currency }),
        ...(amountEur !== undefined && { amountEur: parseFloat(amountEur) }),
        ...(category !== undefined && { category }),
        ...(projectId !== undefined && { projectId }),
        ...(description !== undefined && { description }),
      },
    });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/incoming-invoices/:id/approve
router.put('/:id/approve', async (req, res) => {
  try {
    const invoice = await prisma.incomingInvoice.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        approvedById: req.user.id,
        approvedAt: new Date(),
        approverComment: req.body.comment || null,
      },
    });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/incoming-invoices/:id/reject
router.put('/:id/reject', async (req, res) => {
  try {
    const invoice = await prisma.incomingInvoice.update({
      where: { id: req.params.id },
      data: {
        status: 'rejected',
        approvedById: req.user.id,
        approvedAt: new Date(),
        approverComment: req.body.comment || null,
      },
    });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/incoming-invoices/:id/mark-paid
router.put('/:id/mark-paid', async (req, res) => {
  try {
    const invoice = await prisma.incomingInvoice.update({
      where: { id: req.params.id },
      data: { status: 'paid', paidAt: new Date() },
    });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
