const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function logAction(userId, action, entity, entityId, changes) {
  return prisma.auditLog.create({
    data: {
      userId: userId || null,
      action,
      entity,
      entityId: entityId ? String(entityId) : null,
      changes: changes || null,
    },
  }).catch((err) => {
    console.error('AuditLog write error:', err.message)
  })
}

module.exports = { logAction }
