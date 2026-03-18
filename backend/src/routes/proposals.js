const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const prisma = new PrismaClient();

const STATUS_LABELS = {
  Draft: 'Entwurf', Sent: 'Gesendet',
  'Under Review': 'In Prüfung', Accepted: 'Angenommen', Rejected: 'Abgelehnt',
};

function fmtCurrency(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function wrapText(str, maxWidth, font, size) {
  if (!str) return [''];
  const words = String(str).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

async function buildProposalPDF(proposal, accountName, authorName) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28, H = 841.89, M = 50, CW = W - 2 * M;
  const C = {
    blue: rgb(0.07, 0.35, 0.82),
    dark: rgb(0.1, 0.1, 0.1),
    mid: rgb(0.4, 0.4, 0.4),
    light: rgb(0.65, 0.65, 0.65),
    bg: rgb(0.96, 0.97, 0.99),
    white: rgb(1, 1, 1),
    border: rgb(0.85, 0.88, 0.93),
    altRow: rgb(0.97, 0.97, 0.98),
  };

  let page = doc.addPage([W, H]);
  let y = H - M;

  function addPage() {
    page = doc.addPage([W, H]);
    y = H - M;
  }
  function ensureSpace(needed) {
    if (y - needed < M + 40) addPage();
  }
  function txt(str, x, yy, { font = regular, size = 10, color = C.dark } = {}) {
    page.drawText(String(str ?? ''), { x, y: yy, size, font, color });
  }
  function box(x, yy, w, h, { fill, stroke } = {}) {
    page.drawRectangle({
      x, y: yy, width: w, height: h,
      ...(fill ? { color: fill } : {}),
      ...(stroke ? { borderColor: stroke, borderWidth: 0.5 } : {}),
    });
  }
  function line(x1, y1, x2, y2) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: C.border });
  }

  // ── HEADER ──────────────────────────────────────────────────
  box(0, H - 72, W, 72, { fill: C.blue });
  txt('ANGEBOT', M, H - 32, { font: bold, size: 22, color: C.white });
  txt(`Ref: ${proposal.id.slice(-8).toUpperCase()}`, M, H - 52, { size: 9, color: rgb(0.75, 0.83, 1) });
  const accW = bold.widthOfTextAtSize(accountName, 12);
  txt(accountName, W - M - accW, H - 35, { font: bold, size: 12, color: C.white });
  const dStr = fmtDate(proposal.createdAt);
  txt(dStr, W - M - regular.widthOfTextAtSize(dStr, 9), H - 52, { size: 9, color: rgb(0.75, 0.83, 1) });

  y = H - 88;

  // ── TITLE ───────────────────────────────────────────────────
  txt(proposal.title || '', M, y, { font: bold, size: 15, color: C.dark });
  y -= 10;
  const statusLabel = STATUS_LABELS[proposal.status] || proposal.status;
  const statusColor = { Draft: C.mid, Sent: C.blue, 'Under Review': rgb(0.7, 0.5, 0), Accepted: rgb(0.1, 0.55, 0.2), Rejected: rgb(0.75, 0.1, 0.1) }[proposal.status] || C.mid;
  const sW = bold.widthOfTextAtSize(statusLabel, 8) + 12;
  box(M, y - 14, sW, 15, { fill: statusColor });
  txt(statusLabel, M + 6, y - 10, { font: bold, size: 8, color: C.white });
  y -= 28;

  // ── INFO BOX ────────────────────────────────────────────────
  const infoRows = [
    ['Account', accountName], ['Version', `v${proposal.version || 1}`],
    ['Erstellt von', authorName], ['Erstellt am', fmtDate(proposal.createdAt)],
  ];
  if (proposal.sentAt) infoRows.push(['Gesendet am', fmtDate(proposal.sentAt)]);
  const infoH = Math.ceil(infoRows.length / 2) * 18 + 14;
  box(M, y - infoH, CW, infoH, { fill: C.bg, stroke: C.border });
  y -= 8;
  for (let i = 0; i < infoRows.length; i++) {
    const col = i % 2 === 0 ? M + 8 : M + CW / 2 + 8;
    if (i % 2 === 0 && i > 0) y -= 18;
    txt(infoRows[i][0] + ':', col, y, { font: bold, size: 8, color: C.mid });
    txt(infoRows[i][1], col + 85, y, { size: 8, color: C.dark });
    if (i % 2 === 1) y -= 18;
  }
  if (infoRows.length % 2 === 1) y -= 18;
  y -= 14;

  // ── COVER TEXT ──────────────────────────────────────────────
  if (proposal.coverText) {
    txt('Anschreiben', M, y, { font: bold, size: 11, color: C.dark });
    y -= 14;
    for (const ln of wrapText(proposal.coverText, CW, regular, 9)) {
      ensureSpace(14);
      txt(ln, M, y, { size: 9, color: C.mid });
      y -= 13;
    }
    y -= 8;
  }

  // ── LINE ITEMS TABLE ────────────────────────────────────────
  ensureSpace(60);
  txt('Leistungspositionen', M, y, { font: bold, size: 11, color: C.dark });
  y -= 14;

  const COL = { desc: M, qty: M + 255, unit: M + 305, price: M + 370, total: M + 450 };
  const RH = 20;

  // Header row
  box(M, y - RH, CW, RH, { fill: C.blue });
  txt('Beschreibung', COL.desc + 5, y - 13, { font: bold, size: 8, color: C.white });
  txt('Menge', COL.qty + 2, y - 13, { font: bold, size: 8, color: C.white });
  txt('Einheit', COL.unit + 2, y - 13, { font: bold, size: 8, color: C.white });
  txt('Einzelpreis', COL.price, y - 13, { font: bold, size: 8, color: C.white });
  txt('Gesamt', COL.total, y - 13, { font: bold, size: 8, color: C.white });
  y -= RH;

  for (let i = 0; i < proposal.lineItems.length; i++) {
    const item = proposal.lineItems[i];
    const descLines = wrapText(item.description || '', 240, regular, 8);
    const itemH = Math.max(RH, descLines.length * 12 + 8);
    ensureSpace(itemH + 5);
    if (i % 2 === 1) box(M, y - itemH, CW, itemH, { fill: C.altRow });
    let dy = y - (itemH - descLines.length * 12) / 2 - 10;
    for (const dl of descLines) { txt(dl, COL.desc + 5, dy, { size: 8 }); dy -= 12; }
    const mid = y - itemH / 2 - 4;
    txt(String(item.quantity ?? ''), COL.qty + 2, mid, { size: 8 });
    txt(item.unit || '', COL.unit + 2, mid, { size: 8 });
    txt(fmtCurrency(item.unitPrice), COL.price, mid, { size: 8 });
    txt(fmtCurrency(item.total), COL.total, mid, { font: bold, size: 8 });
    y -= itemH;
    line(M, y, M + CW, y);
  }

  // Total row
  y -= 4;
  ensureSpace(28);
  box(COL.price - 10, y - 28, CW - (COL.price - 10 - M), 28, { fill: C.blue });
  txt('Gesamtbetrag', COL.price - 4, y - 11, { font: bold, size: 9, color: C.white });
  const totalStr = fmtCurrency(proposal.totalAmount);
  txt(totalStr, M + CW - bold.widthOfTextAtSize(totalStr, 12) - 4, y - 12, { font: bold, size: 12, color: C.white });
  y -= 36;

  // ── SCOPE OF WORK ───────────────────────────────────────────
  if (proposal.scopeOfWork) {
    y -= 8;
    ensureSpace(40);
    txt('Leistungsumfang', M, y, { font: bold, size: 11, color: C.dark });
    y -= 14;
    for (const ln of wrapText(proposal.scopeOfWork, CW, regular, 9)) {
      ensureSpace(14);
      txt(ln, M, y, { size: 9, color: C.mid });
      y -= 13;
    }
  }

  // ── FOOTER on every page ────────────────────────────────────
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawLine({ start: { x: M, y: 35 }, end: { x: W - M, y: 35 }, thickness: 0.5, color: C.border });
    p.drawText('Vertraulich – Nur für den adressierten Empfänger', { x: M, y: 22, size: 7, font: regular, color: C.light });
    const pn = `Seite ${i + 1} von ${pages.length}`;
    p.drawText(pn, { x: W - M - regular.widthOfTextAtSize(pn, 7), y: 22, size: 7, font: regular, color: C.light });
  }

  return doc.save();
}

function calcTotal(lineItems) {
  return lineItems.reduce((sum, item) => sum + (item.total || item.quantity * item.unitPrice), 0);
}

// GET /api/proposals/:id/pdf - must be before /:id to avoid conflict
router.get('/:id/pdf', async (req, res) => {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: req.params.id },
      include: { lineItems: { orderBy: { order: 'asc' } } },
    });
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const [account, author] = await Promise.all([
      prisma.account.findUnique({ where: { id: proposal.accountId }, select: { companyName: true } }),
      proposal.authorId ? prisma.user.findUnique({ where: { id: proposal.authorId }, select: { name: true } }) : null,
    ]);

    const pdfBytes = await buildProposalPDF(proposal, account?.companyName || '—', author?.name || '—');
    const filename = `Angebot-${proposal.id.slice(-8).toUpperCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/proposals/services - must be before /:id
router.get('/services', async (req, res) => {
  try {
    const services = await prisma.serviceCatalog.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/services
router.post('/services', async (req, res) => {
  try {
    const service = await prisma.serviceCatalog.create({ data: req.body });
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/proposals/services/:id
router.put('/services/:id', async (req, res) => {
  try {
    const service = await prisma.serviceCatalog.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(service);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Service not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/proposals/services/:id
router.delete('/services/:id', async (req, res) => {
  try {
    await prisma.serviceCatalog.delete({ where: { id: req.params.id } });
    res.json({ message: 'Service deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Service not found' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/proposals
router.get('/', async (req, res) => {
  try {
    const { status, accountId, q } = req.query;

    const where = {};
    if (status) where.status = status;
    if (accountId) where.accountId = accountId;
    if (q) where.title = { contains: q, mode: 'insensitive' };

    const proposals = await prisma.proposal.findMany({
      where,
      include: {
        lineItems: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const proposalIds = proposals.map((p) => p.accountId);
    const accounts = await prisma.account.findMany({
      where: { id: { in: proposalIds } },
      select: { id: true, companyName: true },
    });
    const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.companyName]));

    const authorIds = proposals.filter((p) => p.authorId).map((p) => p.authorId);
    let authorMap = {};
    if (authorIds.length > 0) {
      const authors = await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true },
      });
      authorMap = Object.fromEntries(authors.map((a) => [a.id, a.name]));
    }

    const enriched = proposals.map((p) => ({
      ...p,
      accountName: accountMap[p.accountId] || null,
      authorName: p.authorId ? authorMap[p.authorId] || null : null,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals
router.post('/', async (req, res) => {
  try {
    const { lineItems, ...proposalData } = req.body;

    const threshold = parseFloat(process.env.APPROVAL_THRESHOLD || '50000');

    const lineItemsData = (lineItems || []).map((item, idx) => ({
      serviceId: item.serviceId || null,
      description: item.description,
      quantity: item.quantity || 1,
      unit: item.unit || 'day',
      unitPrice: item.unitPrice,
      total: item.total || item.quantity * item.unitPrice,
      order: item.order !== undefined ? item.order : idx,
    }));

    const totalAmount = lineItemsData.reduce((sum, item) => sum + item.total, 0);
    const requiresApproval = totalAmount > threshold;

    const proposal = await prisma.proposal.create({
      data: {
        ...proposalData,
        totalAmount,
        requiresApproval,
        lineItems: {
          create: lineItemsData,
        },
      },
      include: {
        lineItems: {
          include: { service: true },
        },
      },
    });

    res.status(201).json(proposal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/proposals/:id
router.get('/:id', async (req, res) => {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: req.params.id },
      include: {
        lineItems: {
          include: { service: true },
          orderBy: { order: 'asc' },
        },
        contract: true,
      },
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const [account, author] = await Promise.all([
      prisma.account.findUnique({
        where: { id: proposal.accountId },
        select: { companyName: true },
      }),
      proposal.authorId
        ? prisma.user.findUnique({ where: { id: proposal.authorId }, select: { name: true } })
        : null,
    ]);

    res.json({
      ...proposal,
      accountName: account ? account.companyName : null,
      authorName: author ? author.name : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/proposals/:id
router.put('/:id', async (req, res) => {
  try {
    const { lineItems, ...proposalData } = req.body;

    const threshold = parseFloat(process.env.APPROVAL_THRESHOLD || '50000');

    const existing = await prisma.proposal.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Proposal not found' });

    let updateData = { ...proposalData, version: existing.version + 1 };

    if (lineItems !== undefined) {
      const lineItemsData = lineItems.map((item, idx) => ({
        serviceId: item.serviceId || null,
        description: item.description,
        quantity: item.quantity || 1,
        unit: item.unit || 'day',
        unitPrice: item.unitPrice,
        total: item.total || item.quantity * item.unitPrice,
        order: item.order !== undefined ? item.order : idx,
      }));

      const totalAmount = lineItemsData.reduce((sum, item) => sum + item.total, 0);
      updateData.totalAmount = totalAmount;
      updateData.requiresApproval = totalAmount > threshold;

      await prisma.proposalLineItem.deleteMany({ where: { proposalId: req.params.id } });
      await prisma.proposalLineItem.createMany({
        data: lineItemsData.map((item) => ({ ...item, proposalId: req.params.id })),
      });
    }

    const proposal = await prisma.proposal.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        lineItems: {
          include: { service: true },
          orderBy: { order: 'asc' },
        },
        contract: true,
      },
    });

    res.json(proposal);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proposal not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/proposals/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.proposal.delete({ where: { id: req.params.id } });
    res.json({ message: 'Proposal deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proposal not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/:id/version – copy proposal as new draft with incremented version
router.post('/:id/version', async (req, res) => {
  try {
    const original = await prisma.proposal.findUnique({
      where: { id: req.params.id },
      include: { lineItems: { orderBy: { order: 'asc' } } },
    });
    if (!original) return res.status(404).json({ error: 'Proposal not found' });

    const newProposal = await prisma.proposal.create({
      data: {
        title: original.title,
        accountId: original.accountId,
        version: original.version + 1,
        status: 'Draft',
        coverText: original.coverText,
        scopeOfWork: original.scopeOfWork,
        totalAmount: original.totalAmount,
        authorId: original.authorId,
        requiresApproval: original.requiresApproval,
        lineItems: {
          create: original.lineItems.map((item) => ({
            serviceId: item.serviceId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            total: item.total,
            order: item.order,
          })),
        },
      },
      include: {
        lineItems: { include: { service: true }, orderBy: { order: 'asc' } },
        contract: true,
      },
    });

    res.status(201).json(newProposal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/:id/approve
router.post('/:id/approve', async (req, res) => {
  try {
    const approverId = req.user?.id || req.body.approvedById;
    const proposal = await prisma.proposal.update({
      where: { id: req.params.id },
      data: {
        approvedById: approverId,
        approvedAt: new Date(),
      },
      include: {
        lineItems: { include: { service: true }, orderBy: { order: 'asc' } },
        contract: true,
      },
    });
    res.json(proposal);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proposal not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/:id/send
router.post('/:id/send', async (req, res) => {
  try {
    const proposal = await prisma.proposal.update({
      where: { id: req.params.id },
      data: { status: 'Sent', sentAt: new Date() },
    });
    res.json(proposal);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proposal not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/:id/accept
router.post('/:id/accept', async (req, res) => {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: req.params.id },
    });
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const updatedProposal = await prisma.proposal.update({
      where: { id: req.params.id },
      data: { status: 'Accepted' },
    });

    const existingContract = await prisma.contract.findUnique({
      where: { proposalId: req.params.id },
    });

    let contract;
    if (!existingContract) {
      contract = await prisma.contract.create({
        data: {
          proposalId: req.params.id,
          accountId: proposal.accountId,
          value: proposal.totalAmount,
        },
      });
    } else {
      contract = existingContract;
    }

    res.json({ proposal: updatedProposal, contract });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proposals/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    const proposal = await prisma.proposal.update({
      where: { id: req.params.id },
      data: { status: 'Rejected' },
    });
    res.json(proposal);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proposal not found' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
