const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const uploadDir = process.env.UPLOAD_DIR || './uploads';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// GET /api/documents
router.get('/', async (req, res) => {
  try {
    const { category, accountId, projectId, dealId, taskId, isInternal, q } = req.query;

    const where = {};
    if (category) where.category = category;
    if (accountId) where.accountId = accountId;
    if (projectId) where.projectId = projectId;
    if (dealId) where.dealId = dealId;
    if (taskId) where.taskId = taskId;
    if (isInternal !== undefined) where.isInternal = isInternal === 'true';
    if (q) where.name = { contains: q, mode: 'insensitive' };

    const documents = await prisma.document.findMany({
      where,
      include: {
        account: { select: { id: true, companyName: true } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name, category, accountId, projectId, dealId, contactId, isInternal, expiryDate, uploadedById } = req.body;

    const document = await prisma.document.create({
      data: {
        name: name || req.file.originalname,
        category: category || 'General',
        filePath: req.file.path.replace(/\\/g, '/'),
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        isInternal: isInternal !== undefined ? isInternal === 'true' : true,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        uploadedById: uploadedById || null,
        accountId: accountId || null,
        projectId: projectId || null,
        dealId: dealId || null,
        contactId: contactId || null,
      },
      include: {
        account: { select: { id: true, companyName: true } },
      },
    });

    res.status(201).json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/:id
router.get('/:id', async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        account: { select: { id: true, companyName: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/documents/:id
router.patch('/:id', async (req, res) => {
  try {
    const { name, category } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    const document = await prisma.document.update({
      where: { id: req.params.id },
      data,
    });
    res.json(document);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Document not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const absolutePath = path.resolve(document.filePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    await prisma.document.delete({ where: { id: req.params.id } });

    res.json({ message: 'Document deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Document not found' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/:id/versions
router.get('/:id/versions', async (req, res) => {
  try {
    const versions = await prisma.document.findMany({
      where: { parentId: req.params.id },
      orderBy: { version: 'desc' },
      include: {
        account: { select: { id: true, companyName: true } },
      },
    });
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/:id/new-version
router.post('/:id/new-version', upload.single('file'), async (req, res) => {
  try {
    const current = await prisma.document.findUnique({
      where: { id: req.params.id },
    });
    if (!current) return res.status(404).json({ error: 'Document not found' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { uploadedById } = req.body;

    const newDoc = await prisma.document.create({
      data: {
        name: current.name,
        category: current.category,
        filePath: req.file.path.replace(/\\/g, '/'),
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        version: current.version + 1,
        parentId: req.params.id,
        isInternal: current.isInternal,
        expiryDate: current.expiryDate,
        uploadedById: uploadedById || current.uploadedById,
        accountId: current.accountId,
        projectId: current.projectId,
        dealId: current.dealId,
        contactId: current.contactId,
      },
      include: {
        account: { select: { id: true, companyName: true } },
      },
    });

    res.status(201).json(newDoc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const absolutePath = path.resolve(document.filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const filename = document.name + (path.extname(document.filePath) || '');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    if (document.mimeType) {
      res.setHeader('Content-Type', document.mimeType);
    }

    const stream = fs.createReadStream(absolutePath);
    stream.pipe(res);

    stream.on('error', (err) => {
      res.status(500).json({ error: 'Error streaming file' });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
