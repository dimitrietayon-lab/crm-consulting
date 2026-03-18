const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function monthKey(d) { return new Date(d).toISOString().slice(0, 7); }

function last6Months() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: d.toISOString().slice(0, 7), start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59) };
  });
}

// GET /api/buchhaltung/overview
router.get('/overview', async (req, res) => {
  try {
    const months = last6Months();
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);

    const [expenses, materialCosts, incomingInvoices] = await Promise.all([
      prisma.expenseReport.findMany({
        select: { status: true, totalAmount: true, createdAt: true },
      }),
      prisma.materialCost.findMany({
        select: { status: true, totalAmount: true, date: true },
      }),
      prisma.incomingInvoice.findMany({
        select: { status: true, amount: true, amountEur: true, invoiceDate: true, dueDate: true, paidAt: true },
      }),
    ]);

    // ── Expenses ──────────────────────────────────────────────────────────────
    const expApproved = expenses.filter(e => ['approved', 'reimbursed'].includes(e.status)).reduce((s, e) => s + e.totalAmount, 0);
    const expPending  = expenses.filter(e => ['submitted', 'pre_approved'].includes(e.status)).reduce((s, e) => s + e.totalAmount, 0);

    // ── Material costs ─────────────────────────────────────────────────────────
    const matApproved = materialCosts.filter(m => m.status === 'approved').reduce((s, m) => s + m.totalAmount, 0);
    const matPending  = materialCosts.filter(m => ['submitted', 'pre_approved'].includes(m.status)).reduce((s, m) => s + m.totalAmount, 0);

    // ── Incoming invoices ──────────────────────────────────────────────────────
    const eur = inv => inv.amountEur || inv.amount;
    const now = new Date();
    const invAll      = incomingInvoices;
    const invPaid     = invAll.filter(i => i.status === 'paid').reduce((s, i) => s + eur(i), 0);
    const invOpen     = invAll.filter(i => ['pending', 'approved'].includes(i.status)).reduce((s, i) => s + eur(i), 0);
    const invOverdue  = invAll.filter(i => ['pending', 'approved'].includes(i.status) && i.dueDate && new Date(i.dueDate) < now).reduce((s, i) => s + eur(i), 0);
    const invYtd      = invAll.filter(i => i.status === 'paid' && i.paidAt && new Date(i.paidAt) >= startOfYear).reduce((s, i) => s + eur(i), 0);

    // ── Monthly breakdown (last 6 months) ─────────────────────────────────────
    const monthly = months.map(({ key, start, end }) => {
      const inRange = (d) => d && new Date(d) >= start && new Date(d) <= end;
      return {
        month: key,
        expenses:      expenses.filter(e => ['approved','reimbursed'].includes(e.status) && inRange(e.createdAt)).reduce((s, e) => s + e.totalAmount, 0),
        materialCosts: materialCosts.filter(m => m.status === 'approved' && inRange(m.date)).reduce((s, m) => s + m.totalAmount, 0),
        incomingInvoices: incomingInvoices.filter(i => inRange(i.invoiceDate)).reduce((s, i) => s + eur(i), 0),
      };
    });

    // ── Totals ─────────────────────────────────────────────────────────────────
    const totalCosts = expApproved + matApproved + invAll.reduce((s, i) => s + eur(i), 0);

    res.json({
      expenses:         { approved: expApproved, pending: expPending, total: expenses.reduce((s, e) => s + e.totalAmount, 0) },
      materialCosts:    { approved: matApproved, pending: matPending, total: materialCosts.reduce((s, m) => s + m.totalAmount, 0) },
      incomingInvoices: { paid: invPaid, open: invOpen, overdue: invOverdue, ytd: invYtd, total: invAll.reduce((s, i) => s + eur(i), 0) },
      totalCosts,
      monthly,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
