const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONTACT_FIELDS = [
  'name', 'title', 'hierarchyLevel', 'department',
  'email', 'phone', 'linkedIn', 'notes',
];

function sanitizeContact(body) {
  const data = {};
  for (const field of CONTACT_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field] || null;
  }
  // Ensure name is always set
  if (body.name) data.name = body.name;
  return data;
}

// GET /api/contacts
router.get('/', async (req, res) => {
  try {
    const { q, hierarchyLevel, department, accountId } = req.query;

    const where = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (hierarchyLevel) {
      where.hierarchyLevel = hierarchyLevel;
    }
    if (department) {
      where.department = { contains: department, mode: 'insensitive' };
    }
    if (accountId) {
      where.accounts = { some: { accountId } };
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        accounts: {
          orderBy: { isPrimary: 'desc' },
          include: {
            account: { select: { id: true, companyName: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const contactsWithAccount = contacts.map((c) => {
      const primaryCA = c.accounts.find((a) => a.isPrimary) || c.accounts[0];
      return {
        ...c,
        primaryAccount: primaryCA ? {
          id: primaryCA.accountId,
          companyName: primaryCA.account?.companyName || '—',
        } : null,
      };
    });

    res.json(contactsWithAccount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts
router.post('/', async (req, res) => {
  try {
    const { accountIds } = req.body;

    const contact = await prisma.contact.create({ data: sanitizeContact(req.body) });

    if (accountIds && Array.isArray(accountIds) && accountIds.length > 0) {
      await prisma.contactAccount.createMany({
        data: accountIds.map((accountId, idx) => ({
          contactId: contact.id,
          accountId,
          isPrimary: idx === 0,
        })),
        skipDuplicates: true,
      });
    }

    const fullContact = await prisma.contact.findUnique({
      where: { id: contact.id },
      include: {
        accounts: {
          orderBy: { isPrimary: 'desc' },
          include: { account: { select: { id: true, companyName: true } } },
        },
      },
    });

    const primaryCA = fullContact?.accounts?.find((a) => a.isPrimary) || fullContact?.accounts?.[0];
    res.status(201).json({
      ...fullContact,
      primaryAccount: primaryCA ? {
        id: primaryCA.accountId,
        companyName: primaryCA.account?.companyName || '—',
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/:id
router.get('/:id', async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        accounts: {
          include: {
            account: true,
          },
        },
        activities: {
          take: 10,
          include: {
            activity: {
              include: {
                account: { select: { companyName: true } },
                createdBy: { select: { name: true } },
              },
            },
          },
          orderBy: { activity: { date: 'desc' } },
        },
        deals: {
          take: 5,
          include: {
            deal: {
              include: {
                account: { select: { companyName: true } },
              },
            },
          },
          orderBy: { deal: { createdAt: 'desc' } },
        },
        projects: {
          take: 5,
          include: {
            project: {
              include: {
                account: { select: { companyName: true } },
              },
            },
          },
          orderBy: { project: { createdAt: 'desc' } },
        },
        tasks: {
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/contacts/:id
router.put('/:id', async (req, res) => {
  try {
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: sanitizeContact(req.body),
    });

    res.json(contact);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ message: 'Contact deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/:id/accounts
router.post('/:id/accounts', async (req, res) => {
  try {
    const { accountId, isPrimary } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    const link = await prisma.contactAccount.upsert({
      where: {
        contactId_accountId: {
          contactId: req.params.id,
          accountId,
        },
      },
      update: { isPrimary: isPrimary || false },
      create: {
        contactId: req.params.id,
        accountId,
        isPrimary: isPrimary || false,
      },
    });

    res.status(201).json(link);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id/accounts/:accountId
router.delete('/:id/accounts/:accountId', async (req, res) => {
  try {
    await prisma.contactAccount.delete({
      where: {
        contactId_accountId: {
          contactId: req.params.id,
          accountId: req.params.accountId,
        },
      },
    });

    res.json({ message: 'Contact unlinked from account' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Link not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
