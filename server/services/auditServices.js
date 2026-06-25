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

exports.findAuditLogs = async ({ actorType, targetType, actorId, action, trigger, take = 50, from, to } = {}, client = prisma) => {
  const returnPage = await client.auditLog.findMany({
    where: {
      ...{ actorType },
      ...{ targetType },
      ...{ actorId },
      ...{ action },
      ...{ trigger },
      ...{
        createdAt: {
          ...(to && { lte: new Date(to) }),
          ...(from && { gte: new Date(from) })
        }
      }
    },
    take: take + 1,
    orderBy: {
      createdAt: "desc",
    },
  })

  const nextFrom = returnPage.length > take ? returnPage.pop().createdAt : null 

  return {
    returnPage,
    nextFrom
  }
}