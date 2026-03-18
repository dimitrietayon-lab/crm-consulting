/**
 * Notification Service
 * Creates in-app notifications for key CRM events.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createNotification(userId, type, title, message, link = null) {
  if (!userId) return;
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, link },
    });
  } catch (err) {
    console.error('[Notifications] Failed to create:', err.message);
  }
}

/**
 * Notify team leaders and CC leaders of a user about a new submission.
 * Deduplicates so a CC head who is also a team leader only gets one notification.
 */
async function notifyApproversOfUser(submitterId, type, title, message, link = null) {
  try {
    const notified = new Set();

    // Team leaders
    const teams = await prisma.team.findMany({
      where: { members: { some: { userId: submitterId } } },
      select: { leaderId: true },
    });
    for (const t of teams) {
      if (t.leaderId && t.leaderId !== submitterId) {
        await createNotification(t.leaderId, type, title, message, link);
        notified.add(t.leaderId);
      }
    }

    // CC leaders
    const ccs = await prisma.competenceCenter.findMany({
      where: { teams: { some: { members: { some: { userId: submitterId } } } } },
      select: { headId: true },
    });
    for (const cc of ccs) {
      if (cc.headId && cc.headId !== submitterId && !notified.has(cc.headId)) {
        await createNotification(cc.headId, type, title, message, link);
      }
    }
  } catch (err) {
    console.error('[Notifications] notifyApproversOfUser failed:', err.message);
  }
}

module.exports = { createNotification, notifyApproversOfUser };
