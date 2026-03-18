const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/portal/my-modules
// Returns modules + features the current user is permitted to view
router.get('/my-modules', async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        portalRoleId: true,
        portalRole: {
          select: {
            id: true,
            name: true,
            permissions: {
              where: { canView: true },
              select: {
                featureId: true,
                canView: true,
                canCreate: true,
                canEdit: true,
                canDelete: true,
                feature: {
                  select: {
                    id: true,
                    key: true,
                    name: true,
                    route: true,
                    description: true,
                    order: true,
                    moduleId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Admin (legacy role) gets all modules
    const isAdmin = req.user.role === 'admin';

    let modules;
    if (isAdmin && !user?.portalRoleId) {
      // Legacy admin: return all modules with all features
      modules = await prisma.portalModule.findMany({
        orderBy: { order: 'asc' },
        include: {
          features: { orderBy: { order: 'asc' } },
        },
      });
      // Wrap each feature with full permissions
      modules = modules.map((m) => ({
        ...m,
        features: m.features.map((f) => ({
          ...f,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        })),
      }));
    } else if (!user?.portalRole) {
      // No role assigned: no access
      modules = [];
    } else {
      // Build module map from permitted features
      const permMap = {};
      for (const perm of user.portalRole.permissions) {
        const f = perm.feature;
        if (!permMap[f.moduleId]) permMap[f.moduleId] = [];
        permMap[f.moduleId].push({
          ...f,
          canView: perm.canView,
          canCreate: perm.canCreate,
          canEdit: perm.canEdit,
          canDelete: perm.canDelete,
        });
      }

      if (Object.keys(permMap).length === 0) {
        modules = [];
      } else {
        const dbModules = await prisma.portalModule.findMany({
          where: { id: { in: Object.keys(permMap) } },
          orderBy: { order: 'asc' },
        });
        modules = dbModules.map((m) => ({
          ...m,
          features: (permMap[m.id] || []).sort((a, b) => a.order - b.order),
        }));
      }
    }

    res.json(modules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/permissions
// Returns a flat map { featureKey: { canView, canCreate, canEdit, canDelete } }
router.get('/permissions', async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        portalRoleId: true,
        portalRole: {
          select: {
            permissions: {
              select: {
                canView: true,
                canCreate: true,
                canEdit: true,
                canDelete: true,
                feature: { select: { key: true } },
              },
            },
          },
        },
      },
    });

    if (isAdmin && !user?.portalRoleId) {
      // Legacy admin: fetch all feature keys and grant full access
      const features = await prisma.portalFeature.findMany({ select: { key: true } });
      const map = {};
      for (const f of features) {
        map[f.key] = { canView: true, canCreate: true, canEdit: true, canDelete: true };
      }
      return res.json(map);
    }

    const map = {};
    if (user?.portalRole?.permissions) {
      for (const perm of user.portalRole.permissions) {
        map[perm.feature.key] = {
          canView: perm.canView,
          canCreate: perm.canCreate,
          canEdit: perm.canEdit,
          canDelete: perm.canDelete,
        };
      }
    }
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/modules (all modules for admin setup)
router.get('/modules', async (req, res) => {
  try {
    const modules = await prisma.portalModule.findMany({
      orderBy: { order: 'asc' },
      include: { features: { orderBy: { order: 'asc' } } },
    });
    res.json(modules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
