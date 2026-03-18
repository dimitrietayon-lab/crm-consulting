const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `RE-${year}-` } },
  });
  return `RE-${year}-${String(count + 1).padStart(4, '0')}`;
}

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const { accountId, status, month, ccLeaderId, managerId } = req.query;
    const where = {};
    if (accountId) where.accountId = accountId;
    if (status) where.status = status;
    if (ccLeaderId) {
      const ccs = await prisma.competenceCenter.findMany({ where: { headId: ccLeaderId }, select: { id: true } });
      const ccIds = ccs.map(c => c.id);
      where.project = { competenceCenterId: { in: ccIds } };
    }
    if (managerId) {
      const teams = await prisma.team.findMany({
        where: { leaderId: managerId },
        select: { competenceCenterId: true },
      });
      const ccIds = [...new Set(teams.map(t => t.competenceCenterId).filter(Boolean))];
      if (ccIds.length > 0) where.project = { competenceCenterId: { in: ccIds } };
    }
    if (month) {
      const d = new Date(month);
      where.issueDate = {
        gte: new Date(d.getFullYear(), d.getMonth(), 1),
        lte: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        account: { select: { id: true, companyName: true } },
        project: { select: { id: true, name: true } },
        lineItems: true,
        creditNotes: true,
      },
      orderBy: { issueDate: 'desc' },
    });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const all = await prisma.invoice.findMany({
      where: { issueDate: { gte: startOfYear } },
      select: { status: true, total: true, paidAmount: true, dueDate: true, issueDate: true },
    });

    const stats = {
      total: all.reduce((s, i) => s + i.total, 0),
      paid: all.filter(i => i.status === 'paid').reduce((s, i) => s + i.paidAmount, 0),
      outstanding: all.filter(i => ['sent', 'partially_paid'].includes(i.status)).reduce((s, i) => s + (i.total - i.paidAmount), 0),
      overdue: all.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.total - i.paidAmount), 0),
    };

    // Monthly data for chart (last 6 months)
    const monthly = [];
    for (let m = 5; m >= 0; m--) {
      const mo = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const moEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59, 59);
      const moInvoices = all.filter(i => i.issueDate >= mo && i.issueDate <= moEnd);
      monthly.push({
        month: mo.toISOString().slice(0, 7),
        total: moInvoices.reduce((s, i) => s + i.total, 0),
        paid: moInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.paidAmount, 0),
      });
    }

    res.json({ stats, monthly });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/mark-overdue
router.post('/mark-overdue', async (req, res) => {
  try {
    const { count } = await prisma.invoice.updateMany({
      where: {
        status: { in: ['sent', 'partially_paid'] },
        dueDate: { lt: new Date() },
      },
      data: { status: 'overdue' },
    });
    res.json({ updated: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/export/csv
router.get('/export/csv', async (req, res) => {
  try {
    const { month } = req.query;
    const where = {};
    if (month) {
      const d = new Date(month);
      where.issueDate = {
        gte: new Date(d.getFullYear(), d.getMonth(), 1),
        lte: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: { account: { select: { companyName: true } } },
      orderBy: { issueDate: 'asc' },
    });

    const lines = ['Rechnungsnummer,Kunde,Rechnungsdatum,Fälligkeitsdatum,Netto,MwSt,Brutto,Gezahlt,Status'];
    invoices.forEach(i => {
      lines.push([
        i.invoiceNumber,
        i.account.companyName,
        i.issueDate.toISOString().split('T')[0],
        i.dueDate.toISOString().split('T')[0],
        i.subtotal.toFixed(2),
        i.vatAmount.toFixed(2),
        i.total.toFixed(2),
        i.paidAmount.toFixed(2),
        i.status,
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rechnungen-${month || 'export'}.csv"`);
    res.send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        account: { select: { id: true, companyName: true } },
        project: { select: { id: true, name: true } },
        lineItems: { orderBy: { createdAt: 'asc' } },
        creditNotes: { orderBy: { issueDate: 'desc' } },
      },
    });
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices
router.post('/', async (req, res) => {
  try {
    const { accountId, projectId, dueDate, billingModel, vatRate, notes, paymentTerms } = req.body;
    const invoiceNumber = await generateInvoiceNumber();
    const vat = vatRate !== undefined ? parseFloat(vatRate) : 19;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        accountId,
        projectId: projectId || null,
        dueDate: new Date(dueDate),
        billingModel,
        vatRate: vat,
        notes: notes || null,
        paymentTerms: paymentTerms || null,
      },
      include: {
        account: { select: { id: true, companyName: true } },
        lineItems: true,
        creditNotes: true,
      },
    });
    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices/:id
router.put('/:id', async (req, res) => {
  try {
    const { dueDate, billingModel, notes, paymentTerms, vatRate } = req.body;
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        ...(billingModel !== undefined && { billingModel }),
        ...(notes !== undefined && { notes }),
        ...(paymentTerms !== undefined && { paymentTerms }),
        ...(vatRate !== undefined && { vatRate: parseFloat(vatRate) }),
      },
    });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status, paidAmount } = req.body;
    const data = { status };
    if (paidAmount !== undefined) data.paidAmount = parseFloat(paidAmount);
    const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/:id/items
router.post('/:id/items', async (req, res) => {
  try {
    const { description, quantity, unit, unitPrice, timesheetId } = req.body;
    const qty = parseFloat(quantity || 1);
    const price = parseFloat(unitPrice);
    const amount = qty * price;

    const item = await prisma.invoiceItem.create({
      data: {
        invoiceId: req.params.id,
        description,
        quantity: qty,
        unit: unit || null,
        unitPrice: price,
        amount,
        timesheetId: timesheetId || null,
      },
    });

    // Recalculate totals
    await recalcInvoice(req.params.id);

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices/:id/items/:itemId
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { description, quantity, unit, unitPrice } = req.body;
    const qty = quantity !== undefined ? parseFloat(quantity) : undefined;
    const price = unitPrice !== undefined ? parseFloat(unitPrice) : undefined;
    const amount = qty !== undefined && price !== undefined ? qty * price : undefined;

    const item = await prisma.invoiceItem.update({
      where: { id: req.params.itemId },
      data: {
        ...(description !== undefined && { description }),
        ...(qty !== undefined && { quantity: qty }),
        ...(unit !== undefined && { unit }),
        ...(price !== undefined && { unitPrice: price }),
        ...(amount !== undefined && { amount }),
      },
    });

    await recalcInvoice(req.params.id);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/invoices/:id/items/:itemId
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    await prisma.invoiceItem.delete({ where: { id: req.params.itemId } });
    await recalcInvoice(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/:id/credit-note
router.post('/:id/credit-note', async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const year = new Date().getFullYear();
    const count = await prisma.creditNote.count({ where: { number: { startsWith: `GS-${year}-` } } });
    const number = `GS-${year}-${String(count + 1).padStart(4, '0')}`;

    const creditNote = await prisma.creditNote.create({
      data: {
        invoiceId: req.params.id,
        number,
        amount: parseFloat(amount),
        reason: reason || null,
      },
    });
    res.status(201).json(creditNote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices/:id/pre-approve
router.put('/:id/pre-approve', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const inv = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { project: { select: { competenceCenterId: true } } } });
      const ccId = inv?.project?.competenceCenterId;
      if (!ccId) return res.status(403).json({ error: 'Keine Berechtigung' });
      const teamInCC = await prisma.team.findFirst({ where: { leaderId: req.user.id, competenceCenterId: ccId } });
      if (!teamInCC) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: 'pre_approved', approvedById: req.user.id, approvedAt: new Date(), approverComment: req.body.comment || null },
      include: { account: { select: { id: true, companyName: true } }, project: { select: { id: true, name: true } }, lineItems: true },
    });
    res.json(invoice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/invoices/:id/approve
router.put('/:id/approve', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const inv = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { project: { select: { competenceCenterId: true } } } });
      const ccId = inv?.project?.competenceCenterId;
      if (!ccId) return res.status(403).json({ error: 'Keine Berechtigung' });
      const cc = await prisma.competenceCenter.findFirst({ where: { id: ccId, headId: req.user.id } });
      if (!cc) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: 'approved', approvedById: req.user.id, approvedAt: new Date(), approverComment: req.body.comment || null },
      include: { account: { select: { id: true, companyName: true } }, project: { select: { id: true, name: true } }, lineItems: true },
    });
    res.json(invoice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/invoices/:id/reject
router.put('/:id/reject', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const inv = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { project: { select: { competenceCenterId: true } } } });
      const ccId = inv?.project?.competenceCenterId;
      if (!ccId) return res.status(403).json({ error: 'Keine Berechtigung' });
      const cc = await prisma.competenceCenter.findFirst({ where: { id: ccId, headId: req.user.id } });
      if (!cc) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: 'rejected', approvedById: req.user.id, approvedAt: new Date(), approverComment: req.body.comment || null },
      include: { account: { select: { id: true, companyName: true } }, project: { select: { id: true, name: true } }, lineItems: true },
    });
    res.json(invoice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

async function recalcInvoice(invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true },
  });
  const subtotal = invoice.lineItems.reduce((s, i) => s + i.amount, 0);
  const vatAmount = subtotal * (invoice.vatRate / 100);
  const total = subtotal + vatAmount;
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { subtotal, vatAmount, total },
  });
}

module.exports = router;
