const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const USER_SELECT = { id: true, name: true, email: true, role: true };

const TEAM_INCLUDE = {
  leader: { select: USER_SELECT },
  competenceCenter: { select: { id: true, name: true } },
  members: {
    include: { user: { select: USER_SELECT } },
    orderBy: { joinedAt: 'asc' },
  },
};

// Helper: check if user is manager (has subordinates) or admin
async function isManagerOrAdmin(userId, role) {
  if (role === 'admin') return true;
  const count = await prisma.user.count({ where: { managerId: userId } });
  return count > 0;
}

// Helper: check if user is leader of a team
async function isTeamLeader(teamId, userId, role) {
  if (role === 'admin') return true;
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { leaderId: true } });
  return team?.leaderId === userId;
}

// GET /api/teams — all teams
router.get('/', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' },
      include: TEAM_INCLUDE,
    });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/my — teams the current user is a member of
router.get('/my', async (req, res) => {
  try {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: req.user.id },
      include: { team: { include: TEAM_INCLUDE } },
    });
    res.json(memberships.map((m) => m.team));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/led — teams the current user leads
router.get('/led', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      where: { leaderId: req.user.id },
      include: TEAM_INCLUDE,
    });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/led-cc — competence centers the current user heads
router.get('/led-cc', async (req, res) => {
  try {
    const ccs = await prisma.competenceCenter.findMany({
      where: { headId: req.user.id },
      include: {
        teams: {
          include: {
            leader: { select: { id: true, name: true } },
            members: { include: { user: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    res.json(ccs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams — create team (admin OR manager)
router.post('/', async (req, res) => {
  try {
    if (!(await isManagerOrAdmin(req.user.id, req.user.role))) {
      return res.status(403).json({ error: 'Nur Admins oder Vorgesetzte dürfen Teams erstellen' });
    }
    const { name, description, leaderId, competenceCenterId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name erforderlich' });

    // Non-admin managers can only set themselves as leader
    const effectiveLeaderId = req.user.role === 'admin'
      ? (leaderId || null)
      : req.user.id;

    const team = await prisma.team.create({
      data: { name, description, leaderId: effectiveLeaderId, competenceCenterId: competenceCenterId || null },
      include: TEAM_INCLUDE,
    });
    res.status(201).json(team);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Teamname bereits vergeben' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/teams/:id — update (admin OR team leader)
router.put('/:id', async (req, res) => {
  try {
    if (!(await isTeamLeader(req.params.id, req.user.id, req.user.role))) {
      return res.status(403).json({ error: 'Nur Admins oder der Team-Leiter dürfen das Team bearbeiten' });
    }
    const { name, description, leaderId, competenceCenterId } = req.body;
    const data = { name, description };
    if (req.user.role === 'admin') {
      data.leaderId = leaderId || null;
      data.competenceCenterId = competenceCenterId || null;
    }
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data,
      include: TEAM_INCLUDE,
    });
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:id (admin OR team leader)
router.delete('/:id', async (req, res) => {
  try {
    if (!(await isTeamLeader(req.params.id, req.user.id, req.user.role))) {
      return res.status(403).json({ error: 'Nur Admins oder der Team-Leiter dürfen das Team löschen' });
    }
    await prisma.team.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:id/members — add member (admin OR team leader)
// Non-admin leaders can only add their own subordinates
router.post('/:id/members', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId erforderlich' });

    if (!(await isTeamLeader(req.params.id, req.user.id, req.user.role))) {
      return res.status(403).json({ error: 'Nur Admins oder der Team-Leiter dürfen Mitglieder hinzufügen' });
    }

    // Non-admin: can only add own subordinates
    if (req.user.role !== 'admin') {
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { managerId: true } });
      if (!target || target.managerId !== req.user.id) {
        return res.status(403).json({ error: 'Sie dürfen nur Ihre eigenen Mitarbeiter hinzufügen' });
      }
    }

    const member = await prisma.teamMember.create({
      data: { teamId: req.params.id, userId },
      include: { user: { select: USER_SELECT } },
    });
    res.status(201).json(member);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Benutzer ist bereits Teammitglied' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:id/members/:userId (admin OR team leader)
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    if (!(await isTeamLeader(req.params.id, req.user.id, req.user.role))) {
      return res.status(403).json({ error: 'Nur Admins oder der Team-Leiter dürfen Mitglieder entfernen' });
    }
    await prisma.teamMember.deleteMany({
      where: { teamId: req.params.id, userId: req.params.userId },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/assign-project — manager assigns subordinate to project
router.post('/assign-project', async (req, res) => {
  try {
    const { userId, projectId, role } = req.body;
    if (!userId || !projectId) return res.status(400).json({ error: 'userId und projectId erforderlich' });

    if (req.user.role !== 'admin') {
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { managerId: true } });
      const isDirectManager = target?.managerId === req.user.id;
      if (!isDirectManager) {
        // Also allow team leaders to assign their own team members
        const leadsTeamWithUser = await prisma.team.findFirst({
          where: { leaderId: req.user.id, members: { some: { userId } } },
        });
        if (!leadsTeamWithUser) {
          return res.status(403).json({ error: 'Sie dürfen nur Ihre direkten Mitarbeiter oder Teammitglieder zuordnen' });
        }
      }
    }

    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId, role: role || null },
      update: { role: role || null },
      include: { user: { select: USER_SELECT } },
    });
    res.json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/overview — full overview for current user
router.get('/overview', async (req, res) => {
  try {
    const userId = req.user.id;

    const [user, myMemberships, myProjects, subordinates, ledTeams, ccs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          ...USER_SELECT,
          manager: { select: USER_SELECT },
          subordinates: {
            select: {
              ...USER_SELECT,
              projectMembers: {
                include: { project: { select: { id: true, name: true, status: true } } },
              },
              teamMemberships: {
                include: { team: { select: { id: true, name: true } } },
              },
            },
          },
        },
      }),
      // Teams I'm a member of
      prisma.teamMember.findMany({
        where: { userId },
        include: {
          team: {
            include: {
              leader: { select: USER_SELECT },
              competenceCenter: { select: { id: true, name: true } },
              members: { include: { user: { select: USER_SELECT } } },
            },
          },
        },
      }),
      // My projects
      prisma.projectMember.findMany({
        where: { userId },
        include: {
          project: {
            select: {
              id: true, name: true, status: true, projectType: true,
              account: { select: { id: true, companyName: true } },
              leadConsultant: { select: USER_SELECT },
            },
          },
        },
      }),
      // Subordinates
      prisma.user.findMany({
        where: { managerId: userId },
        select: {
          ...USER_SELECT,
          projectMembers: {
            include: { project: { select: { id: true, name: true, status: true } } },
          },
          teamMemberships: {
            include: { team: { select: { id: true, name: true } } },
          },
        },
      }),
      // Teams I lead
      prisma.team.findMany({
        where: { leaderId: userId },
        include: {
          competenceCenter: { select: { id: true, name: true } },
          members: { include: { user: { select: USER_SELECT } } },
        },
      }),
      // All CCs (for create-team dropdown)
      prisma.competenceCenter.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);

    res.json({
      user,
      teams: myMemberships.map((m) => m.team),
      projects: myProjects.map((m) => ({ ...m.project, memberRole: m.role })),
      subordinates,
      ledTeams,
      ccs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
