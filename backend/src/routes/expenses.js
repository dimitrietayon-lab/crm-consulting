const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const Anthropic = require('@anthropic-ai/sdk');
const { createNotification, notifyApproversOfUser } = require('../services/notifications');

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
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function getLatestRate() {
  return prisma.mileageRate.findFirst({ orderBy: { validFrom: 'desc' } });
}

// GET /api/expenses
router.get('/', async (req, res) => {
  try {
    const { userId, status, projectId, ccLeaderId, managerId } = req.query;
    const where = {};
    if (userId)    where.userId    = userId;
    if (status)    where.status    = status;
    if (projectId) where.projectId = projectId;
    if (ccLeaderId) {
      const ccs = await prisma.competenceCenter.findMany({
        where: { headId: ccLeaderId },
        include: { teams: { include: { members: { select: { userId: true } } } } },
      });
      const memberIds = [...new Set(ccs.flatMap(cc => cc.teams.flatMap(t => t.members.map(m => m.userId))))];
      where.userId = { in: memberIds };
    }
    if (managerId) {
      const teams = await prisma.team.findMany({
        where: { leaderId: managerId },
        include: { members: { select: { userId: true } } },
      });
      const memberIds = [...new Set(teams.flatMap(t => t.members.map(m => m.userId)))];
      where.userId = { in: memberIds };
    }

    const reports = await prisma.expenseReport.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, projectType: true } },
        approver: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/mileage-rate
router.get('/mileage-rate', async (req, res) => {
  try {
    const rate = await getLatestRate();
    res.json(rate || { ratePerKm: 0.30 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/mileage-rate
router.put('/mileage-rate', async (req, res) => {
  try {
    // Only admins and CC heads can change the mileage rate
    if (req.user.role !== 'admin') {
      const ledCCs = await prisma.competenceCenter.findMany({ where: { headId: req.user.id }, select: { id: true } });
      if (ledCCs.length === 0) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { ratePerKm, region } = req.body;
    const rate = await prisma.mileageRate.create({
      data: { ratePerKm: parseFloat(ratePerKm), validFrom: new Date(), region: region || null },
    });
    res.json(rate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses/verify-receipt
router.post('/verify-receipt', memUpload.single('receipt'), async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'KI-Prüfung nicht konfiguriert (ANTHROPIC_API_KEY fehlt)' });
  }
  if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });

  try {
    const client = new Anthropic();
    const b64 = req.file.buffer.toString('base64');
    const mime = req.file.mimetype;

    const mediaContent = mime === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
      : { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } };

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          mediaContent,
          {
            type: 'text',
            text: `Analysiere diesen Beleg und antworte NUR mit einem JSON-Objekt (kein Markdown):
{
  "isValidReceipt": true oder false,
  "vendor": "Firmenname oder null",
  "date": "YYYY-MM-DD oder null",
  "amount": Betrag als Zahl oder null,
  "currency": "EUR" oder andere Währung oder null,
  "category": "transport" oder "hotel" oder "meals" oder "parking" oder "mileage" oder "other",
  "description": "kurze Beschreibung des Belegs",
  "notes": "Auffälligkeiten (unleserlich, unvollständig, etc.) oder null"
}`,
          },
        ],
      }],
    });

    const raw = message.content[0]?.text || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ isValidReceipt: false, notes: 'Keine strukturierte Antwort' });
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses/items/:itemId/verify  — verify a stored receipt with AI
router.post('/items/:itemId/verify', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'KI-Prüfung nicht konfiguriert (ANTHROPIC_API_KEY fehlt)' });
  }
  try {
    const item = await prisma.expenseItem.findUnique({ where: { id: req.params.itemId } });
    if (!item || !item.receiptPath) return res.status(404).json({ error: 'Kein Beleg für diese Position' });

    const fullPath = path.resolve(item.receiptPath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Beleg-Datei nicht gefunden' });

    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimeMap = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
    const mime = mimeMap[ext] || 'image/jpeg';
    const b64 = buffer.toString('base64');

    const client = new Anthropic();
    const mediaContent = mime === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
      : { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } };

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          mediaContent,
          {
            type: 'text',
            text: `Analysiere diesen Beleg und antworte NUR mit einem JSON-Objekt (kein Markdown):
{
  "isValidReceipt": true oder false,
  "vendor": "Firmenname oder null",
  "date": "YYYY-MM-DD oder null",
  "amount": Betrag als Zahl oder null,
  "currency": "EUR" oder andere Währung oder null,
  "category": "transport" oder "hotel" oder "meals" oder "parking" oder "mileage" oder "other",
  "description": "kurze Beschreibung des Belegs",
  "notes": "Auffälligkeiten (unleserlich, unvollständig, etc.) oder null"
}`,
          },
        ],
      }],
    });

    const raw = message.content[0]?.text || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ isValidReceipt: false, notes: 'Keine strukturierte Antwort' });
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/:id
router.get('/:id', async (req, res) => {
  try {
    const report = await prisma.expenseReport.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, projectType: true } },
        approver: { select: { id: true, name: true } },
        items: { orderBy: { date: 'asc' } },
      },
    });
    if (!report) return res.status(404).json({ error: 'Not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses
router.post('/', async (req, res) => {
  try {
    const { userId, projectId, title, destination, travelStart, travelEnd, purpose, currency } = req.body;
    const report = await prisma.expenseReport.create({
      data: {
        userId: userId || req.user.id,
        projectId: projectId || null,
        title,
        destination: destination || null,
        travelStart: travelStart ? new Date(travelStart) : null,
        travelEnd: travelEnd ? new Date(travelEnd) : null,
        purpose: purpose || null,
        currency: currency || 'EUR',
      },
      include: { user: { select: { id: true, name: true } } },
    });
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, destination, travelStart, travelEnd, purpose, currency, projectId } = req.body;
    const report = await prisma.expenseReport.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(destination !== undefined && { destination }),
        ...(travelStart !== undefined && { travelStart: travelStart ? new Date(travelStart) : null }),
        ...(travelEnd !== undefined && { travelEnd: travelEnd ? new Date(travelEnd) : null }),
        ...(purpose !== undefined && { purpose }),
        ...(currency !== undefined && { currency }),
        ...(projectId !== undefined && { projectId }),
      },
    });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id/submit
router.put('/:id/submit', async (req, res) => {
  try {
    const report = await prisma.expenseReport.update({
      where: { id: req.params.id },
      data: { status: 'submitted' },
    });
    await notifyApproversOfUser(
      report.userId,
      'expense_submitted',
      'Reisekosten eingereicht',
      `Ein Reisekostenbericht wurde zur Genehmigung eingereicht.`,
      '/expenses',
    );
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id/pre-approve
router.put('/:id/pre-approve', async (req, res) => {
  try {
    const report = await prisma.expenseReport.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!report) return res.status(404).json({ error: 'Nicht gefunden' });
    // Only team leader of the expense owner can pre-approve
    if (req.user.role !== 'admin') {
      const teamMatch = await prisma.teamMember.findFirst({
        where: { userId: report.userId, team: { leaderId: req.user.id } },
      });
      if (!teamMatch) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const updated = await prisma.expenseReport.update({
      where: { id: req.params.id },
      data: { status: 'pre_approved', approvedById: req.user.id, approvedAt: new Date(), approverComment: req.body.comment || null },
    });
    await createNotification(updated.userId, 'expense_pre_approved', 'Reisekosten vorgemerkt', 'Dein Reisekostenbericht wurde vom Team-Leiter vorgeprüft.', '/expenses');
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/expenses/:id/approve
router.put('/:id/approve', async (req, res) => {
  try {
    // Only admin or CC head of the expense owner's CC can approve
    if (req.user.role !== 'admin') {
      const report = await prisma.expenseReport.findUnique({ where: { id: req.params.id }, select: { userId: true } });
      const ccMatch = await prisma.competenceCenter.findFirst({
        where: { headId: req.user.id, teams: { some: { members: { some: { userId: report.userId } } } } },
      });
      if (!ccMatch) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const report = await prisma.expenseReport.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        approvedById: req.user.id,
        approvedAt: new Date(),
        approverComment: req.body.comment || null,
      },
    });
    await createNotification(report.userId, 'expense_approved', 'Reisekostenbericht genehmigt', `"${report.title}" wurde genehmigt.`, '/expenses');
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id/reject
router.put('/:id/reject', async (req, res) => {
  try {
    // Only admin or CC head of the expense owner's CC can reject
    if (req.user.role !== 'admin') {
      const report = await prisma.expenseReport.findUnique({ where: { id: req.params.id }, select: { userId: true } });
      const ccMatch = await prisma.competenceCenter.findFirst({
        where: { headId: req.user.id, teams: { some: { members: { some: { userId: report.userId } } } } },
      });
      if (!ccMatch) return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const report = await prisma.expenseReport.update({
      where: { id: req.params.id },
      data: {
        status: 'rejected',
        approvedById: req.user.id,
        approvedAt: new Date(),
        approverComment: req.body.comment || null,
      },
    });
    await createNotification(report.userId, 'expense_rejected', 'Reisekostenbericht abgelehnt',
      req.body.comment ? `Grund: ${req.body.comment}` : `"${report.title}" wurde abgelehnt.`, '/expenses');
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id/mark-paid
router.put('/:id/mark-paid', async (req, res) => {
  try {
    const report = await prisma.expenseReport.update({
      where: { id: req.params.id },
      data: { status: 'paid', paidAt: new Date() },
    });
    await createNotification(report.userId, 'expense_paid', 'Reisekosten ausgezahlt', `"${report.title}" wurde ausgezahlt.`, '/expenses');
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses/:id/items
router.post('/:id/items', upload.single('receipt'), async (req, res) => {
  try {
    const { category, description, date, amount, currency, km, perDiem } = req.body;

    let amountEur = parseFloat(amount);
    let computedKm = km ? parseFloat(km) : null;

    if (category === 'mileage' && computedKm) {
      const rate = await getLatestRate();
      amountEur = computedKm * (rate ? rate.ratePerKm : 0.30);
    }

    const item = await prisma.expenseItem.create({
      data: {
        reportId: req.params.id,
        category,
        description: description || null,
        date: new Date(date),
        amount: parseFloat(amount),
        currency: currency || 'EUR',
        amountEur,
        km: computedKm,
        receiptPath: req.file ? req.file.path.replace(/\\/g, '/') : null,
        perDiem: perDiem === 'true' || perDiem === true,
      },
    });

    // Recalculate total
    const allItems = await prisma.expenseItem.findMany({ where: { reportId: req.params.id } });
    const total = allItems.reduce((s, i) => s + (i.amountEur || i.amount), 0);
    await prisma.expenseReport.update({ where: { id: req.params.id }, data: { totalAmount: total } });

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id/items/:itemId
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { category, description, date, amount, currency, km } = req.body;
    const item = await prisma.expenseItem.update({
      where: { id: req.params.itemId },
      data: {
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(currency !== undefined && { currency }),
        ...(km !== undefined && { km: parseFloat(km) }),
      },
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:id/items/:itemId
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    await prisma.expenseItem.delete({ where: { id: req.params.itemId } });

    // Recalculate total
    const allItems = await prisma.expenseItem.findMany({ where: { reportId: req.params.id } });
    const total = allItems.reduce((s, i) => s + (i.amountEur || i.amount), 0);
    await prisma.expenseReport.update({ where: { id: req.params.id }, data: { totalAmount: total } });

    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/export/:id
router.get('/export/:id', async (req, res) => {
  try {
    const report = await prisma.expenseReport.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true } }, items: { orderBy: { date: 'asc' } } },
    });
    if (!report) return res.status(404).json({ error: 'Not found' });

    const lines = ['Datum,Kategorie,Beschreibung,Betrag (Original),Währung,Betrag (EUR),Km'];
    report.items.forEach(i => {
      lines.push([
        i.date.toISOString().split('T')[0],
        i.category,
        (i.description || '').replace(/,/g, ';'),
        i.amount,
        i.currency,
        i.amountEur || i.amount,
        i.km || '',
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reisekosten-${report.id}.csv"`);
    res.send(lines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
