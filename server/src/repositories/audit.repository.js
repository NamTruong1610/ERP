import * as prismaConfig from '../config/prisma.config.js';
import { AuditAction, TargetType, TriggerType, ActorType, UserStatus } from '@prisma/client';
export const createAuditLog = async ({
  actorId = null,
  actorType = ActorType.USER,
  targetId = null,
  targetType = null,
  action,
  metadata = null,
  ip = null,
  userAgent = null,
  trigger = TriggerType.USER_ACTION
}, client = prismaConfig.prisma) => {
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

export const findAuditLogs = async ({
  actorType,
  targetType,
  actorId,
  action,
  trigger,
  take = 50,
  from,      // date range start — gte, from the UI filter
  to,        // date range end   — lte, from the UI filter
  cursor     // pagination cursor — lt, from the previous page's last record
} = {}, client = prismaConfig.prisma) => {

  const where = {
    ...(actorType && { actorType }),
    ...(targetType && { targetType }),
    ...(actorId && { actorId }),
    ...(action && { action }),
    ...(trigger && { trigger }),
    // Date range and cursor are separate concerns built into one createdAt clause
    ...((from || to || cursor) && {
      createdAt: {
        ...(from && { gte: new Date(from) }),    // range start — inclusive
        ...(to && { lte: new Date(to) }),    // range end   — inclusive
        ...(cursor && { lt: new Date(cursor) }),  // pagination  — exclusive
      }
    })
  }

  const records = await client.auditLog.findMany({
    where,
    take: take + 1,
    orderBy: { createdAt: 'desc' }
  })

  const hasMore = records.length > take
  const logs = hasMore ? records.slice(0, take) : records
  const nextCursor = hasMore ? logs[logs.length - 1].createdAt : null

  return { logs, nextCursor, hasMore }
}