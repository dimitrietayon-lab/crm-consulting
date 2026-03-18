const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── Users ────────────────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        portalRoleId: true,
        portalRole: { select: { id: true, name: true } },
        managerId: true,
        manager: { select: { id: true, name: true } },
        competenceCenterId: true,
        competenceCenter: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users — create new user
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role, portalRoleId, managerId, competenceCenterId } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'E-Mail wird bereits verwendet' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: role || 'consultant',
        portalRoleId: portalRoleId || null,
        managerId: managerId || null,
        competenceCenterId: competenceCenterId || null,
      },
      select: {
        id: true, name: true, email: true, role: true,
        portalRoleId: true,
        portalRole: { select: { id: true, name: true } },
        managerId: true,
        manager: { select: { id: true, name: true } },
        competenceCenterId: true,
        competenceCenter: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id — update user (role, portalRoleId, name, password)
router.put('/users/:id', async (req, res) => {
  try {
    const { name, role, portalRoleId, managerId, password, competenceCenterId } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = role;
    data.portalRoleId = portalRoleId || null;
    data.managerId = managerId || null;
    data.competenceCenterId = competenceCenterId || null;
    if (password && password.trim()) {
      data.password = await bcrypt.hash(password, 10);
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true, name: true, email: true, role: true,
        portalRoleId: true,
        portalRole: { select: { id: true, name: true } },
        managerId: true,
        manager: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Sie können sich nicht selbst löschen' });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Roles ────────────────────────────────────────────────────────────────────

// GET /api/admin/roles
router.get('/roles', async (req, res) => {
  try {
    const roles = await prisma.portalRole.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, permissions: true } },
      },
    });
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/roles
router.post('/roles', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const role = await prisma.portalRole.create({ data: { name, description } });
    res.status(201).json(role);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Role name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/roles/:id
router.put('/roles/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const role = await prisma.portalRole.update({
      where: { id: req.params.id },
      data: { name, description },
    });
    res.json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/roles/:id
router.delete('/roles/:id', async (req, res) => {
  try {
    const role = await prisma.portalRole.findUnique({ where: { id: req.params.id } });
    if (!role) return res.status(404).json({ error: 'Role not found' });
    if (role.isSystem) return res.status(400).json({ error: 'Cannot delete system role' });
    await prisma.portalRole.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Permissions ──────────────────────────────────────────────────────────────

// GET /api/admin/roles/:id/permissions
router.get('/roles/:id/permissions', async (req, res) => {
  try {
    const permissions = await prisma.portalRolePermission.findMany({
      where: { roleId: req.params.id },
      include: {
        feature: {
          include: { module: { select: { id: true, key: true, name: true } } },
        },
      },
    });

    // Also return all modules+features so frontend can build the matrix
    const modules = await prisma.portalModule.findMany({
      orderBy: { order: 'asc' },
      include: { features: { orderBy: { order: 'asc' } } },
    });

    // Build a lookup: featureId -> permission
    const permMap = {};
    for (const p of permissions) {
      permMap[p.featureId] = {
        canView: p.canView,
        canCreate: p.canCreate,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        canApprove: p.canApprove,
      };
    }

    res.json({ modules, permMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/roles/:id/permissions
// Body: { permissions: [{ featureId, canView, canCreate, canEdit, canDelete, canApprove }] }
router.put('/roles/:id/permissions', async (req, res) => {
  try {
    const roleId = req.params.id;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions array required' });
    }

    // Delete existing permissions for this role
    await prisma.portalRolePermission.deleteMany({ where: { roleId } });

    // Create new permissions (only those with at least one flag set)
    const toCreate = permissions
      .filter((p) => p.canView || p.canCreate || p.canEdit || p.canDelete || p.canApprove)
      .map((p) => ({
        roleId,
        featureId: p.featureId,
        canView: !!p.canView,
        canCreate: !!p.canCreate,
        canEdit: !!p.canEdit,
        canDelete: !!p.canDelete,
        canApprove: !!p.canApprove,
      }));

    if (toCreate.length > 0) {
      await prisma.portalRolePermission.createMany({ data: toCreate });
    }

    res.json({ updated: toCreate.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Competence Centers ────────────────────────────────────────────────────────

const CC_INCLUDE = {
  head: { select: { id: true, name: true, email: true } },
  teams: {
    include: {
      leader: { select: { id: true, name: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { name: 'asc' },
  },
};

// GET /api/admin/ccs
router.get('/ccs', async (req, res) => {
  try {
    const ccs = await prisma.competenceCenter.findMany({
      orderBy: { name: 'asc' },
      include: CC_INCLUDE,
    });
    res.json(ccs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/ccs
router.post('/ccs', async (req, res) => {
  try {
    const { name, description, headId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name erforderlich' });
    const cc = await prisma.competenceCenter.create({
      data: { name, description, headId: headId || null },
      include: CC_INCLUDE,
    });
    // If a head is assigned, automatically assign the user to this competence center
    if (headId) {
      try {
        await prisma.user.update({
          where: { id: headId },
          data: { competenceCenterId: cc.id },
        });
      } catch (e) {
        // Do not fail the whole request for this side-effect; log and continue
        console.error('Failed to auto-assign head to competence center:', e?.message || e);
      }
    }
    res.status(201).json(cc);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'CC-Name bereits vergeben' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/ccs/:id
router.get('/ccs/:id', async (req, res) => {
  try {
    const cc = await prisma.competenceCenter.findUnique({
      where: { id: req.params.id },
      include: CC_INCLUDE,
    });
    if (!cc) return res.status(404).json({ error: 'CC nicht gefunden' });
    res.json(cc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/ccs/:id
router.put('/ccs/:id', async (req, res) => {
  try {
    const { name, description, headId } = req.body;
    const cc = await prisma.competenceCenter.update({
      where: { id: req.params.id },
      data: { name, description, headId: headId || null },
      include: CC_INCLUDE,
    });
    // If a head is assigned, automatically assign the user to this competence center
    if (headId) {
      try {
        await prisma.user.update({
          where: { id: headId },
          data: { competenceCenterId: cc.id },
        });
      } catch (e) {
        console.error('Failed to auto-assign head to competence center on update:', e?.message || e);
      }
    }
    res.json(cc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/ccs/:id
router.delete('/ccs/:id', async (req, res) => {
  try {
    await prisma.team.updateMany({
      where: { competenceCenterId: req.params.id },
      data: { competenceCenterId: null },
    });
    await prisma.competenceCenter.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
