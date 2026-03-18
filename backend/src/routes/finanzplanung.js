const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CATEGORIES = ['reisekosten', 'materialkosten', 'eingangsrechnungen', 'einnahmen'];

// Returns actuals for a given year, keyed by month (1–12) and category
async function fetchActuals(year) {
  const start = new Date(year, 0, 1);
  const end   = new Date(year, 11, 31, 23, 59, 59);

  const [expenses, materialCosts, incoming, outgoing] = await Promise.all([
    prisma.expenseReport.findMany({
      where: { status: { in: ['approved', 'reimbursed'] }, createdAt: { gte: start, lte: end } },
      select: { totalAmount: true, createdAt: true },
    }),
    prisma.materialCost.findMany({
      where: { status: 'approved', date: { gte: start, lte: end } },
      select: { totalAmount: true, date: true },
    }),
    prisma.incomingInvoice.findMany({
      where: { invoiceDate: { gte: start, lte: end } },
      select: { amount: true, amountEur: true, invoiceDate: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ['sent', 'paid', 'partially_paid'] }, issueDate: { gte: start, lte: end } },
      select: { total: true, issueDate: true },
    }),
  ]);

  // Build map: month (1–12) → category → amount
  const map = {};
  for (let m = 1; m <= 12; m++) {
    map[m] = { reisekosten: 0, materialkosten: 0, eingangsrechnungen: 0, einnahmen: 0 };
  }

  expenses.forEach(e => {
    const m = new Date(e.createdAt).getMonth() + 1;
    if (map[m]) map[m].reisekosten += e.totalAmount;
  });
  materialCosts.forEach(e => {
    const m = new Date(e.date).getMonth() + 1;
    if (map[m]) map[m].materialkosten += e.totalAmount;
  });
  incoming.forEach(e => {
    const m = new Date(e.invoiceDate).getMonth() + 1;
    if (map[m]) map[m].eingangsrechnungen += e.amountEur || e.amount;
  });
  outgoing.forEach(e => {
    const m = new Date(e.issueDate).getMonth() + 1;
    if (map[m]) map[m].einnahmen += e.total;
  });

  return map;
}

// GET /api/finanzplanung/overview?year=2025
router.get('/overview', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const [budgets, actuals] = await Promise.all([
      prisma.financialBudget.findMany({ where: { year } }),
      fetchActuals(year),
    ]);

    // Build planned map
    const planned = {};
    for (let m = 1; m <= 12; m++) {
      planned[m] = { reisekosten: 0, materialkosten: 0, eingangsrechnungen: 0, einnahmen: 0 };
    }
    budgets.forEach(b => {
      if (planned[b.month]) planned[b.month][b.category] = b.planned;
    });

    // Combine into monthly array
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const act = actuals[m];
      const pln = planned[m];
      const totalKosten    = act.reisekosten + act.materialkosten + act.eingangsrechnungen;
      const plannedKosten  = pln.reisekosten + pln.materialkosten + pln.eingangsrechnungen;
      return {
        month: m,
        actual:  { ...act, totalKosten },
        planned: { ...pln, totalKosten: plannedKosten },
      };
    });

    // Yearly totals
    const totals = months.reduce((acc, mo) => {
      CATEGORIES.forEach(c => {
        acc.actual[c]  = (acc.actual[c]  || 0) + mo.actual[c];
        acc.planned[c] = (acc.planned[c] || 0) + mo.planned[c];
      });
      acc.actual.totalKosten  += mo.actual.totalKosten;
      acc.planned.totalKosten += mo.planned.totalKosten;
      return acc;
    }, { actual: { totalKosten: 0 }, planned: { totalKosten: 0 } });

    res.json({ year, months, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finanzplanung/budgets?year=2025
router.get('/budgets', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const budgets = await prisma.financialBudget.findMany({ where: { year }, orderBy: [{ month: 'asc' }, { category: 'asc' }] });
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/finanzplanung/budgets  — upsert one entry
router.put('/budgets', async (req, res) => {
  try {
    const { year, month, category, planned, notes } = req.body;
    if (!year || !month || !category) return res.status(400).json({ error: 'year, month, category required' });

    const budget = await prisma.financialBudget.upsert({
      where: { year_month_category: { year: parseInt(year), month: parseInt(month), category } },
      update: { planned: parseFloat(planned) || 0, notes: notes || null },
      create: { year: parseInt(year), month: parseInt(month), category, planned: parseFloat(planned) || 0, notes: notes || null },
    });
    res.json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/finanzplanung/budgets/bulk  — save multiple entries at once
router.put('/budgets/bulk', async (req, res) => {
  try {
    const { year, entries } = req.body; // entries: [{ month, category, planned, notes }]
    if (!year || !Array.isArray(entries)) return res.status(400).json({ error: 'year and entries required' });

    const results = await Promise.all(entries.map(e =>
      prisma.financialBudget.upsert({
        where: { year_month_category: { year: parseInt(year), month: parseInt(e.month), category: e.category } },
        update: { planned: parseFloat(e.planned) || 0, notes: e.notes || null },
        create: { year: parseInt(year), month: parseInt(e.month), category: e.category, planned: parseFloat(e.planned) || 0, notes: e.notes || null },
      })
    ));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
