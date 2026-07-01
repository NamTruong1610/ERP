const { prisma } = require('../config/PrismaConfig')
const { AuditAction, TargetType, TriggerType, ActorType, UserStatus } = require('@prisma/client')

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

exports.findAuditLogs = async ({ actorType, targetType, actorId, action, trigger, take = 50, from, to } = {}, client = prisma) => {
  const records = await client.auditLog.findMany({
    where: {
      ...(actorType && { actorType }),
      ...(targetType && { targetType }),
      ...(actorId && { actorId }),
      ...(action && { action }),
      ...(trigger && { trigger }),
      ...((to || from) && {
        createdAt: {
          ...(to && { lte: new Date(to) }),
          ...(from && { gte: new Date(from) })
        }
      })
    },
    take: take + 1,
    orderBy: { createdAt: "desc" },
  })

  const hasMore = records.length > take
  const logs = hasMore ? records.slice(0, take) : records
  const nextCursor = hasMore ? logs[logs.length - 1].createdAt : null

  return { logs, nextCursor, hasMore }
}