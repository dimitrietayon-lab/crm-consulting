const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { sendPdf } = require('../lib/pdf');
const { buildOfferPdf } = require('../lib/pdf/sprint-offer');
const { normalizeCompany, contactBlockReason } = require('../lib/sprintCompliance');
const { linkAccountOnWin } = require('../lib/sprintAccount');

const prisma = new PrismaClient();

const VALID_STATUS = new Set(['draft', 'sent', 'accepted', 'rejected', 'expired']);

const TARGET_SELECT = {
  id: true,
  companyName: true,
  location: true,
  segment: true,
  status: true,
  contactName: true,
  contactEmail: true,
  bafaStatus: true,
  bafaDate: true,
  bafaApprovedAmount: true,
};

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sanitizeItems(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && String(item.description || '').trim())
    .map((item, index) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
      const price = Number.isFinite(unitPrice) ? unitPrice : 0;
      return {
        position: index + 1,
        description: String(item.description).trim(),
        quantity: q,
        unitPrice: price,
        total: Math.round(q * price * 100) / 100,
      };
    });
}

function sumValue(items) {
  return Math.round(items.reduce((sum, item) => sum + (item.total || 0), 0) * 100) / 100;
}

// Atomare Nummernvergabe je Jahr — keine count()+1-Race
async function nextOfferNumber(tx) {
  const year = new Date().getFullYear();
  const rows = await tx.$queryRaw`
    INSERT INTO "SprintOfferSequence" ("year", "lastNumber")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastNumber" = "SprintOfferSequence"."lastNumber" + 1
    RETURNING "lastNumber"
  `;
  const n = Number(rows[0]?.lastNumber || 1);
  return `SP-${year}-${String(n).padStart(4, '0')}`;
}

// GET /api/sprint-offers
router.get('/', async (req, res) => {
  try {
    const { status, sprintTargetId, q, page, pageSize } = req.query;
    const where = {};
    if (status) where.status = status;
    if (sprintTargetId) where.sprintTargetId = sprintTargetId;
    if (q) {
      where.OR = [
        { offerNumber: { contains: q, mode: 'insensitive' } },
        { sprintTarget: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const shouldPaginate = page !== undefined || pageSize !== undefined;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50));

    const [total, data] = await Promise.all([
      prisma.sprintOffer.count({ where }),
      prisma.sprintOffer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(shouldPaginate ? { skip: (pageNum - 1) * size, take: size } : {}),
        include: {
          sprintTarget: { select: TARGET_SELECT },
          _count: { select: { items: true } },
        },
      }),
    ]);

    if (shouldPaginate) {
      return res.json({ data, total, page: pageNum, pageSize: size, totalPages: Math.max(1, Math.ceil(total / size)) });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-offers
router.post('/', async (req, res) => {
  try {
    const { sprintTargetId, package: pkg, validUntil, notes } = req.body || {};
    if (!sprintTargetId) return res.status(400).json({ error: 'sprintTargetId ist erforderlich' });

    const target = await prisma.sprintTarget.findUnique({
      where: { id: sprintTargetId },
      select: { id: true, companyName: true, status: true },
    });
    if (!target) return res.status(404).json({ error: 'Zielkunde nicht gefunden' });

    const blockReason = await contactBlockReason(prisma, target);
    if (blockReason) {
      return res.status(409).json({
        error: `Kontaktsperre (DSGVO Art. 21): ${blockReason}. Für diesen Zielkunden darf kein Angebot mehr erstellt werden.`,
        blocked: true,
      });
    }

    const items = sanitizeItems(req.body.items);
    const value = sumValue(items);

    const offer = await prisma.$transaction(async (tx) => {
      const offerNumber = await nextOfferNumber(tx);
      return tx.sprintOffer.create({
        data: {
          offerNumber,
          sprintTargetId,
          package: pkg || null,
          status: 'draft',
          value,
          validUntil: toDate(validUntil),
          notes: notes || null,
          items: { create: items },
        },
        include: { items: true, sprintTarget: { select: TARGET_SELECT } },
      });
    });

    res.status(201).json(offer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint-offers/:id
router.get('/:id', async (req, res) => {
  try {
    const offer = await prisma.sprintOffer.findUnique({
      where: { id: req.params.id },
      include: {
        items: { orderBy: { position: 'asc' } },
        sprintTarget: { select: TARGET_SELECT },
      },
    });
    if (!offer) return res.status(404).json({ error: 'Angebot nicht gefunden' });
    res.json(offer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sprint-offers/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.sprintOffer.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Angebot nicht gefunden' });

    const { package: pkg, status, validUntil, notes } = req.body || {};
    const data = {};
    if (pkg !== undefined) data.package = pkg || null;
    if (status !== undefined) {
      if (!VALID_STATUS.has(status)) return res.status(400).json({ error: 'Ungültiger Status' });
      data.status = status;
    }
    if (validUntil !== undefined) data.validUntil = toDate(validUntil);
    if (notes !== undefined) data.notes = notes || null;

    let items = null;
    if (Array.isArray(req.body.items)) {
      items = sanitizeItems(req.body.items);
      data.value = sumValue(items);
    }

    const offer = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.sprintOfferItem.deleteMany({ where: { offerId: req.params.id } });
        if (items.length) {
          await tx.sprintOfferItem.createMany({
            data: items.map((item) => ({ ...item, offerId: req.params.id })),
          });
        }
      }
      return tx.sprintOffer.update({
        where: { id: req.params.id },
        data,
        include: {
          items: { orderBy: { position: 'asc' } },
          sprintTarget: { select: TARGET_SELECT },
        },
      });
    });

    res.json(offer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sprint-offers/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.sprintOffer.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Angebot nicht gefunden' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-offers/:id/send
router.post('/:id/send', async (req, res) => {
  try {
    const offer = await prisma.sprintOffer.findUnique({
      where: { id: req.params.id },
      include: { sprintTarget: { select: TARGET_SELECT } },
    });
    if (!offer) return res.status(404).json({ error: 'Angebot nicht gefunden' });
    if (offer.status === 'accepted' || offer.status === 'rejected') {
      return res.status(409).json({ error: 'Abgeschlossene Angebote können nicht erneut versendet werden' });
    }

    const blockReason = await contactBlockReason(prisma, offer.sprintTarget);
    if (blockReason) {
      return res.status(409).json({
        error: `Kontaktsperre (DSGVO Art. 21): ${blockReason}. Das Angebot darf nicht versendet werden.`,
        blocked: true,
      });
    }

    const settings = await prisma.sprintSetting.findUnique({ where: { id: 'singleton' } });
    const validityDays = settings?.offerValidityDays || 21;
    const now = new Date();
    const validUntil = offer.validUntil && offer.validUntil > now
      ? offer.validUntil
      : new Date(now.getTime() + validityDays * 86400000);

    const [updated] = await prisma.$transaction([
      prisma.sprintOffer.update({
        where: { id: offer.id },
        data: { status: 'sent', sentAt: now, validUntil },
        include: { items: true, sprintTarget: { select: TARGET_SELECT } },
      }),
      prisma.sprintTarget.update({
        where: { id: offer.sprintTargetId },
        data: {
          status: 'Angebot versendet',
          offerPackage: offer.package,
          offerValue: offer.value,
          offerDate: now,
          offerValidUntil: validUntil,
        },
      }),
    ]);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-offers/:id/accept
router.post('/:id/accept', async (req, res) => {
  try {
    const offer = await prisma.sprintOffer.findUnique({ where: { id: req.params.id } });
    if (!offer) return res.status(404).json({ error: 'Angebot nicht gefunden' });

    const now = new Date();
    const [updated] = await prisma.$transaction([
      prisma.sprintOffer.update({
        where: { id: offer.id },
        data: { status: 'accepted', acceptedAt: now },
        include: { items: true, sprintTarget: { select: TARGET_SELECT } },
      }),
      prisma.sprintTarget.update({
        where: { id: offer.sprintTargetId },
        data: {
          status: 'gewonnen',
          result: 'gewonnen',
          offerPackage: offer.package,
          offerValue: offer.value,
          offerDate: offer.sentAt || now,
          offerValidUntil: offer.validUntil,
        },
      }),
    ]);

    // Abschluss → CRM-Account anlegen/verknüpfen
    const wonTarget = await prisma.sprintTarget.findUnique({
      where: { id: offer.sprintTargetId },
      select: { id: true, companyName: true, segment: true, website: true, numberOfEmployees: true, accountId: true, status: true },
    });
    await linkAccountOnWin(prisma, wonTarget);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-offers/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    const lossReason = (req.body?.lossReason || '').trim();
    if (!lossReason) return res.status(400).json({ error: 'Verlustgrund ist erforderlich' });

    const offer = await prisma.sprintOffer.findUnique({
      where: { id: req.params.id },
      include: { sprintTarget: { select: TARGET_SELECT } },
    });
    if (!offer) return res.status(404).json({ error: 'Angebot nicht gefunden' });

    const now = new Date();
    const [updated] = await prisma.$transaction([
      prisma.sprintOffer.update({
        where: { id: offer.id },
        data: { status: 'rejected', rejectedAt: now },
        include: { items: true, sprintTarget: { select: TARGET_SELECT } },
      }),
      prisma.sprintTarget.update({
        where: { id: offer.sprintTargetId },
        data: { status: 'kein Interesse', result: 'verloren', lossReason },
      }),
    ]);

    // Sperrliste synchron halten (wie beim Statuswechsel über den Zielkunden)
    let blocklisted = false;
    const normalizedName = normalizeCompany(offer.sprintTarget?.companyName);
    if (normalizedName) {
      const existing = await prisma.sprintBlocklist.findFirst({
        where: { normalizedName },
        select: { id: true },
      });
      if (!existing) {
        await prisma.sprintBlocklist.create({
          data: {
            companyName: offer.sprintTarget.companyName,
            normalizedName,
            reason: lossReason,
            contactName: offer.sprintTarget.contactName || null,
            notes: 'Automatisch gesperrt über Angebots-Ablehnung',
          },
        });
        blocklisted = true;
      }
    }

    res.json({ ...updated, blocklisted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sprint-offers/:id/extend
router.post('/:id/extend', async (req, res) => {
  try {
    const offer = await prisma.sprintOffer.findUnique({ where: { id: req.params.id } });
    if (!offer) return res.status(404).json({ error: 'Angebot nicht gefunden' });

    const settings = await prisma.sprintSetting.findUnique({ where: { id: 'singleton' } });
    const days = Number(req.body?.days) || settings?.offerValidityDays || 21;
    const base = offer.validUntil && offer.validUntil > new Date() ? offer.validUntil : new Date();
    const validUntil = new Date(base.getTime() + days * 86400000);

    const updated = await prisma.sprintOffer.update({
      where: { id: offer.id },
      data: {
        validUntil,
        status: offer.status === 'expired' || offer.status === 'draft' ? 'sent' : offer.status,
        sentAt: offer.sentAt || new Date(),
      },
      include: { items: true, sprintTarget: { select: TARGET_SELECT } },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint-offers/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const offer = await prisma.sprintOffer.findUnique({
      where: { id: req.params.id },
      include: {
        items: { orderBy: { position: 'asc' } },
        sprintTarget: {
          select: {
            ...TARGET_SELECT,
            bafaSubmittedAt: true,
          },
        },
      },
    });
    if (!offer) return res.status(404).json({ error: 'Angebot nicht gefunden' });

    // Paketbezeichnung aus der Paketverwaltung (freie Pakete), Fallback = Key
    if (offer.package) {
      const pkg = await prisma.sprintPackageInfo.findUnique({
        where: { key: offer.package },
        select: { label: true },
      });
      if (pkg) offer.packageLabel = pkg.label;
    }

    const doc = buildOfferPdf(offer);
    const company = offer.sprintTarget?.companyName || 'Zielkunde';
    sendPdf(res, doc, `Angebot-${offer.offerNumber}-${company}.pdf`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
