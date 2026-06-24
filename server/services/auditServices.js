const { prisma } = require('../config/PrismaConfig')

exports.createAuditLog = async ({
  actorId = null,
  actorType = ActorType.USER,
  targetId = null,
  targetType = null,
  action,
  metadata = null,
  ip = null,
  userAgent = null,
  trigger = TriggerType.USER_ACTION
}, client = prisma) => {
  return await client.auditLog.create({
    data: {
      actorId,
      actorType,
      targetId,
      targetType,
      action,
      metadata,
      ip,
      userAgent,
      trigger
    }
  })
}

exports.findAuditLogs = async () => {
  
}